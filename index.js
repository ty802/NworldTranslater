const express = require('express')
const { v4:uuidv4 } = require('uuid')
const ws = require("ws")
const https = require("https")
const fs = require('fs')
const Privkey = fs.readFileSync(process.env.Privkeyfile)
const cert = fs.readFileSync(process.env.certfile)
const creds = {key:Privkey,cert:cert}
const app = express()
const wshttps = https.createServer(creds)
const wss = new ws.Server({server:wshttps})
const nusers = new Map()
wss.on('connection',(socket)=>onConnect(socket))
const connections = new Map()
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
function doMessageReceived(message,socket){
console.log(`[${socket.tid}]: ${message}`)
if(message.startsWith('END:END')){socket.terminate()}else if(message.startsWith('SOCTYPE:')){
   mode = message.split(':')[1]
   socket.soctype = mode
   socket.Typechange()
   socket.send(`Chenged Soctype to ${mode}`)
}else if (message.startsWith('POS:')){
    if(socket.soctype != 1){socket.send('[ERROR]Invalid request'); return}
    pos = message.split(':')[1].split(",")
    socket.Xpos = pos[0] 
    socket.Ypos = pos[1]
    socket.Zpos = pos[2]
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
        if(data.ws){if(client != data.ws && client.readyState === WebSocket.OPEN){client.send(data.data)}}else{client.send(data.data)}
    })
}
