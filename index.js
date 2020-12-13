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
wss.on('connection',(socket)=>onConnect(socket))
const connections = new Map()
function onConnect(socket){
    socket.send('hello world!')
    socket.tid = new uuidv4()
    console.log(`[Connect] New connection id:${socket.tid}`)
    connections.set(socket.tid,socket)
    socket.on('message',(e)=>{doMessageReceived(e,socket)})
    socket.on('close',(e)=>{connections.delete(socket.tid)})
    broadcast({data:`NC:${socket.tid}`,ws:socket})
}
wshttps.listen(11256,()=>{console.log("[INIT] Https listing")})
httpsserver = https.createServer(creds,app)
httpsserver.listen(443)
app.get('/',(req,res)=>{
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end('Hello World\n');
})
function doMessageReceived(message,socket){
if(message.startsWith('END:END')){socket.terminate()}
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
    wss.clients.forEach((client)=>{
        if(data.ws){if(client != socket.ws && client.readyState === WebSocket.OPEN){client.send(data.data)}}else{client.send(data.data)}
    })
}
