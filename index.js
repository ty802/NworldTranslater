const express = require('express')
const { v4:uuidv4 } = require('uuid')
const ws = require("ws")
const https = require("https")
const fs = require('fs')
const axios = require('axios')
const { text } = require('express')
const { Console } = require('console')
const creds = {key:fs.readFileSync(process.env.Privkeyfile),cert:fs.readFileSync(process.env.certfile)}
const app = express()
const wshttps = https.createServer(creds)
const wss = new ws.Server({server:wshttps})
const nusers = new Map()
wss.on('connection',(socket)=>onConnect(socket))
const worlds = new Map()
connections = new Map()
class world {
    constructor(id){
        this.worldid = id
    }
    worldid = ''
    registerConnection(connection){
        connection.world = this
        connection.removeAllListeners("message")
        connection.on("message",(e)=>{console.log(this)})
        connection.send(`Regestered to world ${this.worldid}`)
    }
    users = new Map()
    langs = new Array()
    async doMessageReceived(message,socket){
        console.log(`[${socket.Username ? `${socket.Username} ${socket.soctype ==1 ? `Neos` : `text` }` : socket.tid }]: ${message}`)
        if(message.startsWith('END:END')){socket.terminate()}else if(message.startsWith('SOCTYPE:')){
            mode = message.split(':',2)[1]
            data = message.slice(8)
            username = data.slice((data.indexOf(':')+1))
            socket.soctype = mode
            socket.Typechange()
            
            if(username){
                socket.Username = username
                if(!users.has(username)) users.set(username,{})
                userentry = users.get(username)
                if(mode == 1){
                    userentry.NeosSocket = socket
                }else{
                    userentry.TextSocket = socket
                }
                userentry.postcash = new Array()
                console.log(`Got user ${username} id:${socket.tid}`)
                broadcast({data:`${username} has joind`,socket:socket})
            }
            
            socket.send(`REQ:1`)
        }else if (message.startsWith('POS:')){
            if(socket.soctype != 1){socket.send('REQ:0'); return}
            pos = message.split(':')[1].split(",")
            socket.Xpos = pos[0] 
            socket.Ypos = pos[1]
            socket.Zpos = pos[2]
            socket.send('REQ:1')
            console.log(`updated pos for socket id:${socket.tid}`)
            users.get(socket.Username).pos =pos
        }else if (message.startsWith('SETLANG:')){
            if(socket.Username){
                lang = message.slice(8)
                socket.lang=lang    
                if(!langs.includes(lang)){langs.push(lang)}
                users.get(socket.Username).lang = lang
                socket.send("REQ:1")
            }else{
                socket.send('REQ:0')
            }
        }else if(message.startsWith('TXT:')){
            msg = {}
            msg.text = message.slice(4)
            msg.user = socket.Username
            msg.lang = socket.lang
            msg.langs = new Map()
            msg.pos = users.get(socket.Username).pos
            for(let i=0;i < langs.length; i++){
                msg.langs[langs[i]] = await translate(msg.text,msg.lang,langs[i])
            }
            users.forEach(e=>{
                if(e.postcash && !e.NeosSocket){
                    if (e.postcash.length > 9){
                        e.postcash.shift()
                    }
                    e.postcash.push(msg)
                }else if (e.NeosSocket){
                    e.NeosSocket.send(msg.langs[e.lang])
                }
            })
        }
        
    }
}
function onConnect(socket){
    socket.tid = uuidv4()
    runner = new Runner()
    console.log(`[Connect] New connection id:${socket.tid}`)
    connections.set(socket.tid,socket)
    socket.on('message',connectionHandeler(message,socket))
    broadcast({data:`NC:${socket.tid}`,ws:socket})
    socket.on('close',()=>{
        console.log(`lost ${socket.Username} rebuilding leng list`)
        while (langs.length > 0){
            langs.pop()
        }
        users.forEach((e)=>{
            if (!langs.includes(e.lang)){langs.push(e.lang)}
        })
        users.delete(socket.Username)
        connections.delete(socket.tid)
    })
}
app.use(require('body-parser')())
wshttps.listen(11256,()=>{console.log("[INIT] Https listing")})
httpsserver = https.createServer(creds,app)
httpsserver.listen(443)
async function translate(text,source,target){
    if(source==target){ return text};
    await axios.post('https://script.google.com/macros/s/AKfycbxgCdhQVwiuhRa0V4DaPkgY0U2bIUH1rQ2r6p9nPs3_BuL5WvfX/exec',{type:"Translate",text:text,source:source,target:target}).then((e)=>{text=e}).catch()
    cont = `<color=#0f0fff>${text.data}</color>`
    return cont
}
app.post('/Updates', (req,res)=>{
    var content = ""
    var temp
    worldId = req.body.User 
    if(!worlds.has(worldId)){res.send('World Not Found');return}
    user = worlds.get(worldId).users.get(req.body.User)
    if(!user) {res.send('Webapp Not Connected'); return}
    while(user.postcash.length > 0){
        const element = user.postcash.shift()
        console.log(`[${req.body.User}@${worldid}]:got update: text:${element.text}`)
        content =`${content}${element.user}:${element.langs[user.lang]}\n`
    }
    if(user.postcash.length =0){
        res.end(':NODATA:')
    }
    res.send(content)
    res.end()
});
app.post('/',(req,res)=>{
    
})
function broadcast(data){
    if(data.list){list=data.list}else{list = wss.clients}
    list.forEach((client)=>{
        if(data.ws){if(client != data.ws && client.readyState == 1){client.send(data.data)}}else{client.send(data.data)}
    })
}
function connectionHandeler(message,socket) {
    if(message.startsWith('WORLD:')){
        id = message.split(6)
        if(!worlds.has(id)){worlds.set(id,new world(id))}
        instance = worlds.get(id)
        instance.registerConnection(socket)
    }
}
class Runner {
    constructor(funcs = new Array(),endfunc =i=>{},socket)
    {
        this.socket = socket
        this.arr = funcs
        this.endfunc = endfunc
        
    }
    next(message){
        if (this.arr.length>0) {
            var run = this.arr.pop()
            if(!run(message)){
                this.socket.terminate()
            }
        }else{
            this.next = this.endfunc
            console.log(this.next);
            this.next(message)
        }
    }
}
app.get('/',(req,res)=>{
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end('Hello World\n');
})
console.log('YAY')