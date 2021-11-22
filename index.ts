import * as https from "https"
import * as fs from "fs"
import * as crypto from "crypto"
import Axios from "axios"
import { randomUUID } from "crypto"
import * as ws from "ws"
import { MessageEvent } from "ws"
import { IncomingMessage } from "http"
import { Console, time, timeStamp } from "console"
import { textChangeRangeIsUnchanged } from "typescript"
import { runInThisContext } from "vm"
require("dotenv").config()
const GlobleConnections = new Map<string,Connection>()
const GlobleUsers = new Map<string,User>()
const Worlds = new Map<string,Session>()
interface messageProcesser{
    (event:MessageEvent):Promise<void>;
} 
class User{
    constructor(userid:string,local:string){
        this.id =userid
        this.local = local
        this.sessions = new Map<string,SessionUser>()
    }
    public get userID() : string {
        return this.id
    }
    private id:string
    public username?:string
    public sessions:Map<string,SessionUser>
    public sourceConnection?:Connection
    public local:string
    public activesession?:string
    toString (){
        return `[UserID:${this.userID},Local:${this.local}]`
    }
}
class Session{
    constructor(id:string,name?:string){
        if(name){
            this.name = name
        }
        this.sessionID = id
        this.languageList = new Array()
        this.connectionList = new Array()
        this.userList = new Map<string,SessionUser>()
        this.sessioncleaner = setInterval(()=>{
            console.log(`Cleening langlist For:${this.sessionID}`);
            let newlangs = new Array<string>()
            for(let suser of this.userList.values()){
                if(suser.user){
                newlangs.push(suser.user.local)
                }
            }
            console.log(newlangs);
            this.languageList = newlangs
            if(this.userList.size <1){
                console.log(`Session:${this.sessionID} is Empty Deleting`);
                
                clearInterval(this.sessioncleaner)
                Worlds.delete(this.sessionID)
            }
        },10000)
    }
    public sessioncleaner:NodeJS.Timer
    public sessionID:string
    public name?:string
    public languageList:string[]
    public connectionList:string[]
    public userList:Map<string,SessionUser>
}
class SessionUser{
    constructor(con:string,user:string,username:string,sessionid:string){
        this.connection = con
        this.userid = user
        this.username= username
        this.sessionid = sessionid
    }
    public connection:string
    public userid:string
    public username:string
    public sessionid:string
    public get local() : string {
        return GlobleUsers.has(this.userid)? (<User>GlobleUsers.get(this.userid)).local: ""
    }
    public get user() : User{
        return <User>GlobleUsers.get(this.userid)
    }
}
class Connection {
    constructor(soc:ws.WebSocket,req:IncomingMessage,uid:string){
        this.request=req
        this.socket=soc
        this.uid=uid
    }
    public sessionuser?:SessionUser
    public request:IncomingMessage
    public socket:ws.WebSocket
    public uid:string
    public userid:string =""
    public async handleMessage(event:MessageEvent){
        let message = event.data.toString()
        let type:number = Number.parseInt(message.slice(0,3).toString())
        let msg:string = message.slice(3)
        switch(type){
            case 1:
                if(msg.length < 8){
                    return
                }
                let indexofuserid = msg.indexOf('U-')
                let local = msg.slice(1,indexofuserid)
                let userid = msg.slice(indexofuserid)
                let isInWorld:boolean = Number.parseInt( msg.slice(0,1) )?true:false
                if(userid.length > 0){
                    let UserExists =GlobleUsers.has(userid) 
                    console.log(`setting up connection for user:${userid} userexists:${UserExists}`);
                    let user = UserExists ? <User>GlobleUsers.get(userid) : new User(userid,local)
                    if(!UserExists){GlobleUsers.set(userid,user)};
                    this.userid = userid
                    this.socket.send(`${user.toString()}`)
                    if(!isInWorld){
                        if(!user.sourceConnection){
                        user.sourceConnection = this
                        this.socket.send("OK")
                        }else{
                            this.socket.send("ERR User Already Has A sourceConnection")
                            this.socket.close()
                        }
                    }else{
                        this.socket.send("OK Waiting For SessionID")
                    }
                }
            break;
            case 2:
                if(this.userid != ""){
                    let usernameindex = msg.indexOf(":")
                    let user = <User>GlobleUsers.get(this.userid)
                    console.log(`Got Sessionid ${user.toString()}`);
                    let sessionid = msg.slice(0,usernameindex-1)
                    let username = msg.slice(usernameindex+1)
                    let suser:SessionUser = new SessionUser(this.uid,user.userID,username,sessionid)
                    let world:Session;
                    if(!Worlds.has(sessionid)){
                        world = new Session(sessionid)
                        Worlds.set(sessionid,world)
                    }else{
                        world = <Session>Worlds.get(sessionid)
                    }
                    world.connectionList.push(this.uid)
                    world.userList.set(this.userid,suser)
                    world.languageList.push(suser.local)
                    user.sessions.set(world.sessionID,suser)
                    user.username = username
                    user.activesession = sessionid
                    this.sessionuser = suser
                    this.socket.send("DONE")
                }
            break;
            case 3:
                if(this.userid != "" && this.sessionuser){
                    let user = GlobleUsers.get(this.userid)
                    if(user){
                        user.activesession = msg
                    }
                }
            break;
            case 4:
                console.log(msg)
                if(GlobleUsers.has(this.userid)){
                   let user:User = <User>GlobleUsers.get(this.userid)
                   if(user.activesession && Worlds.has(<string>user.activesession)){
                       let world = <Session>Worlds.get(<string>user.activesession)
                       console.log(world.languageList)
                       let message = new Map<string,string>()
                       let langs = world.languageList
                       let source = user.local
                       for(let i=0;i<langs.length;i++){
                            let translatedtext =await translate(msg,source,langs[i])
                            message.set(langs[i],`${user.username ?? user.userID}:${translatedtext}`)
                       }
                       console.log(message)
                       world.userList.forEach(function(suser,userid){
                           let con = <Connection>GlobleConnections.get(suser.connection)
                           con.socket.send(message.get(<string>suser.local))
                       })
                   }
                }
            break;
    
        }
    }
    handleClose(e:ws.CloseEvent){
        GlobleConnections.delete(this.uid)
        if(this.sessionuser){
            let sess = <Session>Worlds.get((<SessionUser>this.sessionuser).sessionid)
            sess.userList.delete((<SessionUser>this.sessionuser).sessionid)
        }
        if(this.userid != "" && GlobleUsers.has(this.userid)){
            let user = <User>GlobleUsers.get(this.userid)
            if(this.sessionuser){
                user.sessions.delete(this.sessionuser.sessionid)
            }
            if(!user.sourceConnection && user.sessions.size<1){
                GlobleUsers.delete(user.userID)
            }else{
                if(user.sourceConnection == this){
                    user.sourceConnection = undefined
                }
            }
        }
    }
}

let creds ={key:fs.readFileSync(process.env.Privkeyfile ? process.env.Privkeyfile : ""),cert:fs.readFileSync(process.env.certfile ? process.env.certfile : "")}
let wsserver = https.createServer(creds)
let wss = new ws.Server({server:wsserver})
wss.on("connection",(socket,req)=>{
    let id = randomUUID()
    let con = new Connection(socket,req,id)
    GlobleConnections.set(id,con)
    socket.onmessage = function(e){con.handleMessage(e)}
    socket.onclose =function(e){con.handleClose(e)}
    console.log(`New Connection ${id}`);
    socket.send("OK")
})
wsserver.listen(11256)
console.log("ready!!");

async function translate(text:string,source:string,target:string){
    if(source==target){ return text};
    await Axios.post('https://script.google.com/macros/s/AKfycbxgCdhQVwiuhRa0V4DaPkgY0U2bIUH1rQ2r6p9nPs3_BuL5WvfX/exec',{type:"Translate",text:text,source:source,target:target}).then((e:any)=>{text=e.data}).catch()
    var cont = `<color=#0f0fff>${text}</color>`
    return cont
}
