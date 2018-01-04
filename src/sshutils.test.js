// @ts-check
'use strict;'

const { parseSshOptions, parseGitSshCommand } = require('./sshutils')
const expect = require('unexpected')

describe.only('sshutils', () => {
  describe('parseSshCommand', () => {
    it('-v git@github.com', () => {
      expect(parseSshOptions(['-v', 'git@github.com']), 'to equal', {
        sshOptions: {
          v: true
        },
        username: 'git',
        hostname: 'github.com',
        commandOptions: []
      })
    })
    it('git@github.com', () => {
      expect(parseSshOptions(['git@github.com']), 'to equal', {
        sshOptions: {},
        username: 'git',
        hostname: 'github.com',
        commandOptions: []
      })
    })
    it('-l git github.com', () => {
      expect(parseSshOptions(['-l', 'git', 'github.com']), 'to equal', {
        sshOptions: { l: 'git' },
        username: 'git',
        hostname: 'github.com',
        commandOptions: []
      })
    })
    it('USER=git github.com', () => {
      let orgUser = process.env['USER']
      process.env['USER'] = 'git'
      expect(parseSshOptions(['github.com']), 'to equal', {
        sshOptions: {},
        username: 'git',
        hostname: 'github.com',
        commandOptions: []
      })
      process.env['USER'] = orgUser
    })
    it('-v4 -l git github.com', () => {
      expect(parseSshOptions(['-v4', '-l', 'git', 'github.com']), 'to equal', {
        sshOptions: { v: true, l: 'git', '4': true },
        username: 'git',
        hostname: 'github.com',
        commandOptions: []
      })
    })
    it(`-v4 -l git github.com git-upload-pack 'tlbdk/socketauth.git'`, () => {
      expect(
        parseSshOptions([
          '-v4',
          '-l',
          'git',
          'github.com',
          'git-upload-pack',
          "'tlbdk/socketauth.git'"
        ]),
        'to equal',
        {
          sshOptions: { v: true, l: 'git', '4': true },
          username: 'git',
          hostname: 'github.com',
          commandOptions: ['git-upload-pack', "'tlbdk/socketauth.git'"]
        }
      )
    })
    it('-v4l git github.com', () => {
      expect(parseSshOptions(['-v4l', 'git', 'github.com']), 'to equal', {
        sshOptions: { v: true, l: 'git', '4': true },
        username: 'git',
        hostname: 'github.com',
        commandOptions: []
      })
    })
    it('-v', () => {
      expect(parseSshOptions(['-v']), 'to equal', {
        sshOptions: { v: true },
        username: process.env['USER'],
        hostname: null,
        commandOptions: []
      })
    })
    it('empty string', () => {
      expect(parseSshOptions(['']), 'to equal', {
        sshOptions: {},
        username: process.env['USER'],
        hostname: null,
        commandOptions: []
      })
    })
    it('empty array', () => {
      expect(parseSshOptions([]), 'to equal', {
        sshOptions: {},
        username: process.env['USER'],
        hostname: null,
        commandOptions: []
      })
    })
    describe('parseGitSshCommand', () => {
      it(`git-upload-pack 'tlbdk/socketauth.git'`, () => {
        expect(
          parseGitSshCommand(['git-upload-pack', `'tlbdk/socketauth.git'`]),
          'to equal',
          {
            command: 'git-upload-pack',
            repo: 'tlbdk/socketauth'
          }
        )
      })
      it(`git-upload-pack tlbdk/socketauth.git`, () => {
        expect(
          parseGitSshCommand(['git-upload-pack', `tlbdk/socketauth.git`]),
          'to equal',
          {
            command: 'git-upload-pack',
            repo: 'tlbdk/socketauth'
          }
        )
      })
      it(`git-upload-pack tlbdk/socketauth`, () => {
        expect(
          parseGitSshCommand(['git-upload-pack', `tlbdk/socketauth`]),
          'to equal',
          {
            command: 'git-upload-pack',
            repo: 'tlbdk/socketauth'
          }
        )
      })
      it(`git-upload-pack tlbdk/socketauth/`, () => {
        expect(
          parseGitSshCommand(['git-upload-pack', `tlbdk/socketauth/`]),
          'to equal',
          {
            command: 'git-upload-pack',
            repo: 'tlbdk/socketauth'
          }
        )
      })
      it(`git-upload-pack2 tlbdk/socketauth/`, () => {
        expect(
          parseGitSshCommand(['git-upload-pack2', `tlbdk/socketauth/`]),
          'to equal',
          {
            command: null,
            repo: null
          }
        )
      })
      it(`git-upload-pack`, () => {
        expect(parseGitSshCommand(['git-upload-pack']), 'to equal', {
          command: null,
          repo: null
        })
      })
      it(`empty string`, () => {
        expect(parseGitSshCommand(['']), 'to equal', {
          command: null,
          repo: null
        })
      })
      it(`empty array`, () => {
        expect(parseGitSshCommand([]), 'to equal', {
          command: null,
          repo: null
        })
      })
    })
  })
})
