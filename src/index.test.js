// @ts-check
'use strict;'

const http = require('http')
const httpRequest = require('./httprequest')
const { spawn } = require('child_process')
const fs = require('fs')
const net = require('net')
let SshAgentWrapper = require('./ssh-agent-wrapper')

let sockPath = '/tmp/test.sock'

if (fs.existsSync(sockPath)) {
  fs.unlinkSync(sockPath)
}

describe('Socket forward', () => {
  let sshAgentWrapper = new SshAgentWrapper(process.env['SSH_AUTH_SOCK'])
  const httpServer = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/ssh-agent') {
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
      req.on('end', () => {
        console.log('end')
      })
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
      //let sshAgentWrapper = new SshAgentWrapper(process.env['SSH_AUTH_SOCK'])
      sshClientSock.on('data', data => {
        httpRequest(
          'POST',
          `http://localhost:${port}/ssh-agent`,
          {
            'Content-Type': 'application/octet-stream',
            'Contant-Length': data.length
          },
          data,
          { debug: false }
        )
          .then(response => {
            sshClientSock.write(response.data)
            console.log(response.statusCode)
          })
          .catch(e => {
            console.error(e)
          })
        /*let responses = sshAgentWrapper.sendRequests(data)
        for (let responsePromise of responses) {
          responsePromise
            .then(response => {
              console.log(response.type)
              sshClientSock.write(response.payload)
            })
            .catch(e => {
              console.error(e)
            })
        }*/
      })
      sshClientSock.on('end', () => {
        console.log(`sshClientSock: Closed`)
        //sshAgentWrapper.close()
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

/*  */
