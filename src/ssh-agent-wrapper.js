// @ts-check
'use strict;'

const net = require('net')

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
      let [buffer, messageType, payload] = SshAgentWrapper.readMessage(
        this.sshAgentBuffer,
        data
      )
      this.sshAgentBuffer = buffer
      if (messageType !== undefined) {
        let [requestType, resolve, reject] = this.requests.shift()
        if (resolve === undefined) {
          // Should neven happen but if it does lets ignore the response
          return
        }
        switch (messageType) {
          case SSH_AGENT.FAILURE: {
            resolve({ type: 'failure', payload: payload })
            break
          }
          case SSH_AGENT.SUCCESS: {
            resolve({ type: 'success', payload: payload })
            break
          }
          case SSH_AGENT.EXTENSION_FAILURE: {
            resolve({ type: 'extension_failure', payload: payload })
            break
          }
          case SSH_AGENT.IDENTITIES_ANSWER:
            if (requestType !== 'request_identities') return
            resolve({ type: 'identities_answer', payload: payload })
            break
          case SSH_AGENT.SIGN_RESPONSE: {
            if (requestType !== 'sign_request') return
            resolve({ type: 'sign_request', payload: payload })
            break
          }
          default: {
            reject({ type: 'unknown', payload: payload })
          }
        }
      }
    })
  }

  close() {
    this.sshAgentSock.end()
  }
  static readMessage(buffer, data) {
    // Add data to buffer
    buffer = Buffer.concat([buffer, data], buffer.length + data.length)
    // Check if we have a full message
    if (buffer.length >= 5) {
      let requestLength = 4 + buffer.readInt32BE(0)
      if (requestLength >= buffer.length) {
        let type = buffer.readInt8(4)
        let payload = buffer.slice(0, requestLength)
        buffer = buffer.slice(requestLength)
        return [buffer, type, payload]
      }
    }

    return [buffer]
  }
  sendRequest(data) {
    let [buffer, type, payload] = SshAgentWrapper.readMessage(
      this.sshClientBuffer,
      data
    )
    this.sshClientBuffer = buffer
    if (type !== undefined) {
      switch (type) {
        case SSH_AGENT_CLIENT.REQUEST_IDENTITIES: {
          this.sshAgentSock.write(payload)
          return this._queueRequest('request_identities')
        }
        case SSH_AGENT_CLIENT.SIGN_REQUEST: {
          this.sshAgentSock.write(payload)
          return this._queueRequest('sign_request')
        }
        default: {
          let failedResponse = new Buffer(5)
          failedResponse.writeInt32BE(1, 0)
          failedResponse.writeInt8(SSH_AGENT.FAILURE, 4)
          return Promise.resolve({ type: 'rejected', payload: failedResponse })
        }
      }
    }
    return Promise.resolve(null)
  }
  _queueRequest(requestType) {
    return new Promise((resolve, reject) => {
      this.requests.push([requestType, resolve, reject])
    })
  }
}

module.exports = SshAgentWrapper
