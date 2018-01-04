#!/usr/bin/env node
// @ts-check
'use strict'

const http = require('http')
const SshAgentWrapper = require('../src/ssh-agent-wrapper')
const { parseSshOptions, parseGitSshCommand } = require('../src/sshutils')

let listenPort = 3000

let sshAgentWrapper = new SshAgentWrapper(process.env['SSH_AUTH_SOCK'])
const httpServer = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/ssh-agent') {
    let auth = req.headers['authorization'] || ''
    let sshArgs = parseSshOptions(JSON.parse(req.headers['x-ssh-args'] || '{}'))
    let gitArgs = parseGitSshCommand(sshArgs.commandOptions)

    let authMatch = auth.match(/^Basic\s+(.+)$/)
    if (!authMatch) {
      res.statusCode = 401
      res.setHeader('WWW-Authenticate', 'Basic realm="Secure Area"')
      res.end()
    }
    let [username, password] = Buffer.from(authMatch[1], 'base64')
      .toString('utf8')
      .split(':')

    if (username !== 'test' || password !== 'test') {
      res.statusCode = 403
      res.end()
    }

    req.on('data', data => {
      Promise.all(sshAgentWrapper.sendRequests(data)).then(responses => {
        res.setHeader('Content-Type', 'application/octet-stream')
        res.statusCode = 200
        let payloads = Buffer.concat(
          responses.map(response => response.payload)
        )
        res.end(payloads)
      })
    })
    req.on('end', () => {})
  } else {
    res.statusCode = 404
    res.end()
  }
})

httpServer.listen(listenPort, () => {
  console.log(`Server running at http://localhost:${listenPort}/`)
})
