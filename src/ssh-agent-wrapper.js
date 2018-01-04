// @ts-check
'use strict;'

const net = require('net')

// https://tools.ietf.org/id/draft-miller-ssh-agent-00.html#rfc.section.8

const SSH_AGENT = {
  FAILURE: 5,
  SUCCESS: 6,
  EXTENSION_FAILURE: 28,
  IDENTITIES_ANSWER: 12,
  SIGN_RESPONSE: 14
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

class SshAgentWrapper {
  constructor(socketPath) {
    this.requests = []
    this.sshAgentBuffer = new Buffer(0)
    this.sshClientBuffer = new Buffer(0)
    this._setupConnection(socketPath)
  }
  _setupConnection(socketPath) {
    this.sshAgentSock = net.createConnection(socketPath)
    this.sshAgentSock.on('connect', () => {
      console.log(`sshAgentSock: Connected`)
    })
    this.sshAgentSock.on('end', () => {
      console.log(`sshAgentSock: Closed`)
    })
    this.sshAgentSock.on('data', data => {
      let [buffer, messages] = SshAgentWrapper.readMessages(
        this.sshAgentBuffer,
        data
      )
      this.sshAgentBuffer = buffer
      for (let message of messages) {
        let [requestType, resolve, reject] = this.requests.shift()
        if (resolve === undefined) {
          // Should neven happen but if it does lets ignore the response
          return
        }
        switch (message.type) {
          case SSH_AGENT.FAILURE: {
            resolve({ type: 'failure', payload: message.payload })
            break
          }
          case SSH_AGENT.SUCCESS: {
            resolve({ type: 'success', payload: message.payload })
            break
          }
          case SSH_AGENT.EXTENSION_FAILURE: {
            resolve({ type: 'extension_failure', payload: message.payload })
            break
          }
          case SSH_AGENT.IDENTITIES_ANSWER:
            if (requestType !== 'request_identities') return
            let nKeys = message.payload.readUInt32BE(5)
            let offset = 9
            for (let i = 0; i < nKeys; i++) {
              let key = readByteString(message.payload, offset)
              offset += key.length
              let comment = readByteString(message.payload, offset)
              console.log(`SSH Key: ${comment.toString()}`)
            }
            resolve({ type: 'identities_answer', payload: message.payload })
            break
          case SSH_AGENT.SIGN_RESPONSE: {
            if (requestType !== 'sign_request') return
            resolve({ type: 'sign_request', payload: message.payload })
            break
          }
          default: {
            reject({ type: 'unknown', payload: message.payload })
          }
        }
      }
    })
  }

  close() {
    this.sshAgentSock.end()
  }
  static readMessages(buffer, data) {
    // Add data to buffer
    buffer = Buffer.concat([buffer, data], buffer.length + data.length)

    let messages = []
    while (buffer.length >= 5) {
      let requestLength = 4 + buffer.readUInt32BE(0)
      if (requestLength >= buffer.length) {
        let type = buffer.readUInt8(4)
        let payload = buffer.slice(0, requestLength)
        buffer = buffer.slice(requestLength)
        messages.push({ type, payload })
      }
    }
    return [buffer, messages]
  }
  sendRequests(data) {
    let [buffer, messages] = SshAgentWrapper.readMessages(
      this.sshClientBuffer,
      data
    )
    this.sshClientBuffer = buffer
    let promises = []
    for (let message of messages) {
      switch (message.type) {
        case SSH_AGENT_CLIENT.REQUEST_IDENTITIES: {
          this.sshAgentSock.write(message.payload)
          promises.push(this._queueRequest('request_identities'))
          break
        }
        case SSH_AGENT_CLIENT.SIGN_REQUEST: {
          this.sshAgentSock.write(message.payload)
          promises.push(this._queueRequest('sign_request'))
          break
        }
        default: {
          let failedResponse = new Buffer(5)
          failedResponse.writeUInt32BE(1, 0)
          failedResponse.writeUInt8(SSH_AGENT.FAILURE, 4)
          promises.push(
            Promise.resolve({ type: 'rejected', payload: failedResponse })
          )
        }
      }
    }

    return promises
  }
  _queueRequest(requestTypes) {
    return new Promise((resolve, reject) => {
      this.requests.push([requestTypes, resolve, reject])
    })
  }
}

function readByteString(buffer, offset) {
  let keyLength = buffer.readUInt32BE(offset)
  offset += 4
  return buffer.slice(offset, offset + keyLength + 4)
}

module.exports = SshAgentWrapper
