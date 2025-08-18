'use strict'

const { describe, it } = require('node:test')
const path = require('path')
const os = require('os')
const gyp = require('../lib/node-gyp')
const requireInject = require('require-inject')
const semver = require('semver')

const versionSemver = semver.parse(process.version)

const configure = requireInject('../lib/configure', {
  'graceful-fs': {
    openSync: () => 0,
    closeSync: () => {},
    existsSync: () => true,
    readFileSync: () => '#define NODE_MAJOR_VERSION ' + versionSemver.major + '\n' +
        '#define NODE_MINOR_VERSION ' + versionSemver.minor + '\n' +
        '#define NODE_PATCH_VERSION ' + versionSemver.patch + '\n',
    promises: {
      stat: async () => ({}),
      mkdir: async () => {},
      writeFile: async () => {}
    }
  }
})

const configure2 = requireInject('../lib/configure', {
  'graceful-fs': {
    openSync: () => 0,
    closeSync: () => {},
    existsSync: () => true,
    readFileSync: () => '#define NODE_MAJOR_VERSION 8\n' +
        '#define NODE_MINOR_VERSION 0\n' +
        '#define NODE_PATCH_VERSION 0\n',
    promises: {
      stat: async () => ({}),
      mkdir: async () => {},
      writeFile: async () => {}
    }
  }
})

const SPAWN_RESULT = cb => ({ on: function () { cb() } })

const driveLetter = os.platform() === 'win32' ? `${process.cwd().split(path.sep)[0]}` : ''
function checkTargetPath (target, value) {
  let targetPath = path.join(path.sep, target, 'include', 'node', 'common.gypi')
  if (process.platform === 'win32') {
    targetPath = driveLetter + targetPath
  }

  return targetPath.localeCompare(value) === 0
}

describe('configure-nodedir', function () {
  it('configure nodedir with node-gyp command line', async function () {
    const prog = gyp()
    prog.parseArgv(['dummy_prog', 'dummy_script', '--nodedir=' + path.sep + 'usr'])

    await new Promise((resolve, reject) => {
      prog.spawn = function (program, args) {
        for (let i = 0; i < args.length; i++) {
          if (checkTargetPath('usr', args[i])) {
            return SPAWN_RESULT(resolve)
          }
        }
        reject(new Error('Expected nodedir path not found'))
      }
      configure(prog, [], reject)
    })
  })

  if (process.config.variables.use_prefix_to_find_headers) {
    it('use-prefix-to-find-headers build time option - match', async function () {
      const prog = gyp()
      prog.parseArgv(['dummy_prog', 'dummy_script'])

      await new Promise((resolve, reject) => {
        prog.spawn = function (program, args) {
          const nodedir = process.config.variables.node_prefix
          for (let i = 0; i < args.length; i++) {
            if (checkTargetPath(nodedir, args[i])) {
              return SPAWN_RESULT(resolve)
            }
          }
          reject(new Error('Expected nodedir path not found'))
        }
        configure(prog, [], reject)
      })
    })

    it('use-prefix-to-find-headers build time option - no match', async function () {
      const prog = gyp()
      prog.parseArgv(['dummy_prog', 'dummy_script'])

      await new Promise((resolve, reject) => {
        prog.spawn = function (program, args) {
          const nodedir = process.config.variables.node_prefix
          for (let i = 0; i < args.length; i++) {
            if (checkTargetPath(nodedir, args[i])) {
              return reject(new Error('Unexpected match found'))
            }
          }
          return SPAWN_RESULT(resolve)
        }
        configure2(prog, [], reject)
      })
    })

    it('use-prefix-to-find-headers build time option, target specified', async function () {
      const prog = gyp()
      prog.parseArgv(['dummy_prog', 'dummy_script', '--target=8.0.0'])

      await new Promise((resolve, reject) => {
        prog.spawn = function (program, args) {
          const nodedir = process.config.variables.node_prefix
          for (let i = 0; i < args.length; i++) {
            if (checkTargetPath(nodedir, args[i])) {
              return reject(new Error('Unexpected match found for target'))
            }
          }
          return SPAWN_RESULT(resolve)
        }
        configure(prog, [], reject)
      })
    })
  }
})
