const express = require('express')
const { v4:uuidv4 } = require('uuid')
const ws = require("ws")
const https = require("https")
const fs = require('fs')
const axios = require('axios')
const { text } = require('express')
const creds = {key:fs.readFileSync(process.env.Privkeyfile),cert:fs.readFileSync(process.env.certfile)}
const app = express()
const wshttps = https.createServer(creds)
const wss = new ws.Server({server:wshttps})
const nusers = new Map()
wss.on('connection',(socket)=>onConnect(socket))
const connections = new Map()
const users = new Map()
const langs = new Array()
app.use(require('body-parser')())
function onConnect(socket){
    socket.send('hello world!')
    socket.tid = uuidv4()
    console.log(`[Connect] New connection id:${socket.tid}`)
    connections.set(socket.tid,socket)
    socket.on('message',(e)=>{doMessageReceived(e,socket)})
    socket.on('close',(e)=>{connections.delete(socket.tid)})
    broadcast({data:`NC:${socket.tid}`,ws:socket})
    socket.Typechange = function (){
        if(nusers.has(this.tid)){nusers.delete(this.tid)}
        if(this.soctype == 1){
            nusers.set(this.tid,this)
        }
    }
}
wshttps.listen(11256,()=>{console.log("[INIT] Https listing")})
httpsserver = https.createServer(creds,app)
httpsserver.listen(443)
app.get('/',(req,res)=>{
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end('Hello World\n');
})
app.post('/Updates', async (req,res)=>{
    var content = ""
    var temp
    user = users.get(req.body.User)
    await user.postcash.forEach(async element => {
        if(user.lang != element.lang){
            var cont = await axios.post('https://script.google.com/macros/s/AKfycbxgCdhQVwiuhRa0V4DaPkgY0U2bIUH1rQ2r6p9nPs3_BuL5WvfX/exec',{"type":"Translate","text":'"'+element.text+'"',"source":'"'+element.lang+'"',"target":'"'+user.lang+'"'})
            cont = `<color=#0f0fff>${text}</color>`
        }else{cont = element.text }
        content.concat(`${element.user} : ${text}\\n`)
    });
    res.send(content)
    
})
app.post('/',(req,res)=>{

})
function doMessageReceived(message,socket){
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
        users.get(socket.Username).lang = message.slice(8)
        socket.send("REQ:1")
    }else{
        socket.send('REQ:0')
    }
}else if(message.startsWith('TXT:')){
    msg = {}
    msg.text = message.slice(4)
    msg.user = socket.Username
    msg.lang = socket.lang
    msg.pos = users.get(socket.Username).pos
    users.forEach(e=>{
        if(e.postcash && !e.NeosSocket){
        e.postcash.push(msg)
        }else{}
    })
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
function broadcast(data){
    if(data.list){list=data.list}else{list = wss.clients}
    list.forEach((client)=>{
        if(data.ws){if(client != data.ws && client.readyState == 1){client.send(data.data)}}else{client.send(data.data)}
    })
}
