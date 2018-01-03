#!/usr/bin/env node
// @ts-check
'use strict'

// Links:
// * https://cloud.google.com/compute/docs/access/create-enable-service-accounts-for-instances
// * https://github.com/nathan7/peercred

const { spawn } = require('child_process')
const net = require('net')
const fs = require('fs')
const httpRequest = require('../src/httprequest')

if (process.argv.length < 3) {
  console.log('soauth command [options]')
  process.exit(255)
}

// http://username:password@localhost:3000/

// Copy current enviroment
let environment = { ...process.env }
const soAuthUrl = environment['SOAUTH_URL']
delete environment['SOAUTH_URL']

let command = process.argv[2]
let args = process.argv.slice(3)
let sockPath = `${process.cwd()}/soauth.sock`

if (fs.existsSync(sockPath)) {
  fs.unlinkSync(sockPath)
}
const unixServer = net.createServer(clientSocket => {
  let buffer = new Buffer(0)
  clientSocket.on('data', async data => {
    // Do basic message parsing
    buffer = Buffer.concat([buffer, data])
    let messages = []
    while (buffer.length >= 5) {
      let requestLength = 4 + buffer.readInt32BE(0)
      if (requestLength >= buffer.length) {
        let message = buffer.slice(0, requestLength)
        buffer = buffer.slice(requestLength)
        messages.push(message)
      }
    }
    if (messages.length === 0) return

    // Upload ssh-agent message payload
    try {
      let payload = Buffer.concat(messages)
      let response = await httpRequest(
        'POST',
        soAuthUrl,
        {
          'Content-Type': 'application/octet-stream',
          'Contant-Length': payload.length
        },
        payload,
        { debug: false }
      )
      if (response.statusCode !== 200) {
        console.error(`Error: ${response.statusCode}`)
        clientSocket.destroy()
      }
      clientSocket.write(response.data)
    } catch (e) {
      console.error(`Error: ${e.message}`)
      clientSocket.destroy()
    }
  })
})
unixServer.listen(sockPath, () => {
  let cmd = spawn(command, args, {
    env: { ...environment, ...{ SSH_AUTH_SOCK: sockPath } }
  })
  cmd.stdout.pipe(process.stdout)
  cmd.stderr.pipe(process.stderr)
  process.stdin.pipe(cmd.stdin)
  cmd.on('exit', (code, signal) => {
    unixServer.close()
    process.exit(code)
  })
})
