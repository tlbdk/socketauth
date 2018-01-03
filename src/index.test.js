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
      let sshAgentWrapper = new SshAgentWrapper(process.env['SSH_AUTH_SOCK'])
      sshClientSock.on('data', data => {
        sshAgentWrapper
          .sendRequest(data)
          .then(response => {
            if (!response) return
            console.log(response.type)
            sshClientSock.write(response.payload)
          })
          .catch(e => {})
      })
      sshClientSock.on('end', () => {
        console.log(`sshClientSock: Closed`)
        sshAgentWrapper.close()
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
