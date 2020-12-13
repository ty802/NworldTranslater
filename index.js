const express = require('express')
const { v4:uuidv4 } = require('uuid')
const ws = require("ws")
const http = require("http")
const fs = require('fs')
const Privkey = fs.readFileSync(process.env.Privkeyfile)
const cert = fs.readFileSync(process.env.certfile)
let creds = {key:Privkey,cert:cert}
var app = express(creds)
server = app.listen(11256,()=>{console.log("[INIT] Https listing")})
wss = new WebSocket.server(server)
wss.on('connection',(e)=>{onConnect(e)})
function onConnect(socket){
socket.send('Hello World!')
socket.terminate()
}
