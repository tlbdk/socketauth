// @ts-check
'use strict;'

const http = require('http')
const httpRequest = require('./httpRequest')
const { spawn } = require('child_process')
const fs = require('fs')
const net = require('net')
const SshAgentWrapper = require('./ssh-agent-wrapper')

let sockPath = '/tmp/test.sock'

if (fs.existsSync(sockPath)) {
  fs.unlinkSync(sockPath)
}

const SSH_AGENT_CLIENT = {
  REQUEST_IDENTITIES: 11,
  SIGN_REQUEST: 13,
  ADD_IDENTITY: 17,
  REMOVE_IDENTITY: 18,
  REMOVE_ALL_IDENTITIES: 19,
  ADD_ID_CONSTRAINED: 25,
  ADD_SMARTCARD_KEY: 20,
  REMOVE_SMARTCARD_KEY: 21,
  LOCK: 22,
  UNLOCK: 23,
  ADD_SMARTCARD_KEY_CONSTRAINED: 26,
  EXTENSION: 27
}

const SSH_AGENT = {
  FAILURE: 5,
  SUCCESS: 6,
  EXTENSION_FAILURE: 28,
  IDENTITIES_ANSWER: 12,
  SIGN_RESPONSE: 14
}

describe('Socket forward', () => {
  const httpServer = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/') {
      res.statusCode = 200
      res.end()
    } else {
      res.statusCode = 404
      res.end()
    }
  })

  let port = 0
  let hostname = null
  before(done => {
    httpServer.listen(0, () => {
      port = httpServer.address().port
      hostname = httpServer.address().address
      console.log(`Server running at http://${hostname}:${port}/`)
      done()
    })
  })
  after(() => {
    httpServer.close()
    process.exit(0)
  })

  it('response from ssh-agent', done => {
    const unixServer = net.createServer(sshClientSock => {
      // Connected to SSH agent
      let agentBuf = new Buffer(0)
      const sshAgentSock = net.createConnection(process.env['SSH_AUTH_SOCK'])
      sshAgentSock.on('connect', () => {
        console.log(`sshAgentSock: Connected`)
      })
      sshAgentSock.on('data', data => {
        agentBuf = Buffer.concat(
          [agentBuf, data],
          agentBuf.length + data.length
        )
        if (agentBuf.length >= 5) {
          let requestLength = 4 + agentBuf.readInt32BE(0)
          if (requestLength >= agentBuf.length) {
            let type = agentBuf.readInt8(4)
            let payload = agentBuf.slice(0, requestLength)
            agentBuf = agentBuf.slice(requestLength)
            switch (type) {
              case SSH_AGENT.IDENTITIES_ANSWER: {
                console.log(`sshAgentSock: identity answer`)
                sshClientSock.write(payload)
                break
              }
              case SSH_AGENT.SIGN_RESPONSE: {
                console.log(`sshAgentSock: sign`)
                sshClientSock.write(payload)
                break
              }
              default: {
                console.log(`sshAgentSock: ${data.length}`)
                sshClientSock.write(payload)
              }
            }
          }
        }
      })
      sshAgentSock.on('end', () => {
        console.log(`sshAgentSock: Closed`)
      })

      let sshBuf = new Buffer(0)
      sshClientSock.on('data', data => {
        sshBuf = Buffer.concat([sshBuf, data], sshBuf.length + data.length)
        if (sshBuf.length >= 5) {
          let requestLength = 4 + sshBuf.readInt32BE(0)
          if (requestLength >= sshBuf.length) {
            let type = sshBuf.readInt8(4)
            let payload = sshBuf.slice(0, requestLength)
            sshBuf = sshBuf.slice(requestLength)
            switch (type) {
              case SSH_AGENT_CLIENT.REQUEST_IDENTITIES: {
                console.log(`sshClientSock: Request identities`)
                sshAgentSock.write(payload)
                break
              }
              case SSH_AGENT_CLIENT.SIGN_REQUEST: {
                console.log(`sshClientSock: Sign request`)
                sshAgentSock.write(payload)
                break
              }
              default: {
                console.log(`sshClientSock: ${data.length}`)
                let failedResponse = new Buffer(5)
                failedResponse.writeInt32BE(1, 0)
                failedResponse.writeInt8(SSH_AGENT.FAILURE, 4)
                sshClientSock.write(failedResponse)
              }
            }
          }
        }
      })
      sshClientSock.on('end', () => {
        console.log(`sshClientSock: Closed`)
        sshAgentSock.end()
      })
    })
    unixServer.listen(sockPath, () => {
      let ssh = spawn(`ssh`, ['git@github.com'], {
        env: { SSH_AUTH_SOCK: sockPath }
      })
      ssh.stderr.on('data', data => {
        console.log(`SSH:${data.toString('utf8')}`)
      })
      ssh.stderr.on('end', () => {
        console.log('end')
      })
      ssh.on('exit', (code, signal) => {
        console.log(`code: ${code}`)
        done()
      })
    })
  })
})

/* httpRequest(
          'POST',
          `http://${hostname}:${port}/`,
          {
            'Content-Type': 'application/binary',
            'Contant-Length': data.length
          },
          data
        )
          .then(response => {
            console.log(response.statusCode)
          })
          .catch(e => {
            console.error(e)
          }) */
