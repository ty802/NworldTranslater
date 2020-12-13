const express = require('express')
const { v4:uuidv4 } = require('uuid')
const ws = require("ws")
const https = require("https")
const fs = require('fs')
const Privkey = fs.readFileSync(process.env.Privkeyfile)
const cert = fs.readFileSync(process.env.certfile)
let creds = {key:Privkey,cert:cert}
wshttps = https.createServer(creds)
const wss = new ws.Server({wshttps})
wss.on('connection',(socket)=>onConnect(socket))
function onConnect(socket){
    socket.send('hello world')
    socket.terminate()
}
wshttps.listen(11256,()=>{console.log("[INIT] Https listing")})