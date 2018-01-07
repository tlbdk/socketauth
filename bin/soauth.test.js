// @ts-check
'use strict;'

const { spawn } = require('child_process')
const expect = require('unexpected')
const fs = require('fs')
const http = require('http')
const SshAgentWrapper = require('../src/ssh-agent-wrapper')
const { parseSshOptions, parseGitSshCommand } = require('../src/sshutils')

// Import some missing types
// import { ChildProcess } from 'child_process'

describe('soauth', () => {
  let sshAgentCmd = null
  let sshAgentCmdPromise = null
  let httpServer = null
  let soauthUrl = null
  before(async () => {
    // Start ssh-agent and load key
    let sshAuthSock = `${__dirname}/ssh-agent.sock`
    if (fs.existsSync(sshAuthSock)) {
      fs.unlinkSync(sshAuthSock)
    }
    ;[sshAgentCmd, sshAgentCmdPromise] = runProcessAsync('ssh-agent', [
      '-a',
      sshAuthSock,
      '-D'
    ])
    await delayAsync(500)

    // Load keys
    for (let key of [
      'id_rsa',
      'id_rsa-github.com_connectedcars_private-module'
    ]) {
      let keyPath = `${__dirname}/../resources/${key}`
      let [sshAddCmd, sshAddCmdPromise] = runProcessAsync(
        'ssh-add',
        [keyPath],
        {
          closeStdin: true,
          detached: true,
          env: {
            SSH_AUTH_SOCK: sshAuthSock,
            DISPLAY: ':0'
          }
        }
      )
      await sshAddCmdPromise
    }

    let sshAgentWrapper = new SshAgentWrapper(sshAuthSock)
    let listenPromise = null
    ;[httpServer, listenPromise] = testHttpServer((req, res) => {
      if (req.method === 'POST' && req.url === '/ssh-agent') {
        let sshArgs = parseSshOptions(
          JSON.parse(req.headers['x-ssh-args'] || '{}')
        )
        let gitArgs = parseGitSshCommand(sshArgs.commandOptions)
        let context = {
          hostname: sshArgs.hostname,
          username: sshArgs.username,
          command: gitArgs.command,
          repo: gitArgs.repo
        }
        req.on('data', async data => {
          try {
            let responses = await Promise.all(
              sshAgentWrapper.sendRequests(data, context)
            )
            if (responses.length > 0) {
              res.setHeader('Content-Type', 'application/octet-stream')
              res.statusCode = 200
              let payloads = Buffer.concat(
                responses.map(response => response.payload)
              )
              res.end(payloads)
            }
          } catch (e) {
            console.log(e)
            res.statusCode = 500
            res.end()
          }
        })
        req.on('end', () => {
          console.log('end')
        })
      } else {
        res.statusCode = 404
        res.end()
      }
    })
    let httpListen = await listenPromise
    soauthUrl = `http://localhost:${httpListen.port}/ssh-agent`
    console.log(`Server running at ${soauthUrl}`)
  })

  after(async () => {
    httpServer.close()
    sshAgentCmd.kill('SIGTERM')
    let sshAgentResult = await sshAgentCmdPromise
    console.log(JSON.stringify(sshAgentResult))
  })

  it('get response from github', async () => {
    let [soauthCmd, soauthCmdPromise] = runProcessAsync(
      'git',
      ['ls-remote', 'git@github.com:connectedcars/private-module.git'],
      {
        env: {
          ...process.env,
          SOAUTH_URL: soauthUrl,
          GIT_SSH: `${__dirname}/ssh`
        }
      }
    )
    let result = await soauthCmdPromise
    expect(result.code, 'to equal', 0)
    expect(result.signal, 'to equal', null)
    expect(result.stderr, 'to equal', '')
    expect(result.stdout, 'to contain', 'refs/heads/master')
  })
})

/**
 * Run process returning a the handle and a with the result promise
 * @param {*} command
 * @param {*} args
 * @param {*} options
 * @returns {[ChildProcess, Promise<any>]}
 */
function runProcessAsync(command, args, options = {}) {
  console.log(`${command} ${args.join(' ')}`)
  let cmd = spawn(command, args, {
    env: options.env,
    detached: options.detached
  })
  let promise = new Promise((resolve, reject) => {
    if (options.timeout) {
      setTimeout(() => {
        cmd.kill() // does not terminate the node process in the shell
      }, options.timeout)
    }

    // Read stdout
    let stdoutStr = ''
    let stdData = []
    cmd.stdout.on('data', data => {
      stdData.push(data)
    })
    cmd.stdout.on('end', () => {
      stdoutStr = Buffer.concat(stdData).toString('utf8')
    })

    // Read stderr
    let stderrStr = ''
    let errorData = []
    cmd.stderr.on('data', data => {
      errorData.push(data)
    })
    cmd.stderr.on('end', () => {
      stderrStr = Buffer.concat(errorData).toString('utf8')
    })

    // Close stdin
    if (options.closeStdin) {
      cmd.stdin.end()
    }

    cmd.on('exit', (code, signal) => {
      resolve({
        code: code,
        signal: signal,
        stdout: stdoutStr,
        stderr: stderrStr
      })
    })
  })
  return [cmd, promise]
}
/**
 * Start a test http server
 * @param {*} requestHandler
 * @returns {[Server, Promise<Object>]}
 */
function testHttpServer(requestHandler) {
  const httpServer = http.createServer(requestHandler)
  const listenPromise = new Promise((resolve, reject) => {
    httpServer.listen(0, () => {
      resolve({
        hostname: httpServer.address().address,
        port: httpServer.address().port
      })
    })
  })
  return [httpServer, listenPromise]
}

function delayAsync(timeout) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve()
    }, timeout)
  })
}
