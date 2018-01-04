// @ts-check
'use strict;'

const { spawn } = require('child_process')
const expect = require('unexpected')

describe('soauth', () => {
  //this.slow(10000)
  it('get response from github', async () => {
    let result = await runProcessAsync(
      `${__dirname}/soauth.js`,
      ['ssh', '-T', 'git@github.com'],
      { env: { ...process.env, SOAUTH_URL: 'http://localhost:3000/ssh-agent' } }
    )
    expect(result, 'to equal', {
      code: 1,
      signal: null,
      stdout: '',
      stderr:
        "Hi tlbdk! You've successfully authenticated, but GitHub does not provide shell access.\n"
    })
  })
})

function runProcessAsync(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    let cmd = spawn(command, args, options)

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
    // cmd.stdin.end()

    cmd.on('exit', (code, signal) => {
      resolve({
        code: code,
        signal: signal,
        stdout: stdoutStr,
        stderr: stderrStr
      })
    })
  })
}
