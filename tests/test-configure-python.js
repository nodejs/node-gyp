'use strict'

const { describe, it } = require('node:test')
const assert = require('assert')
const path = require('path')
const { devDir } = require('./common')
const gyp = require('../lib/node-gyp')
const requireInject = require('require-inject')

const configure = requireInject('../lib/configure', {
  'graceful-fs': {
    openSync: () => 0,
    closeSync: () => {},
    existsSync: () => {},
    promises: {
      stat: async () => ({}),
      mkdir: async () => {},
      writeFile: async () => {}
    }
  }
})

const EXPECTED_PYPATH = path.join(__dirname, '..', 'gyp', 'pylib')
const SEPARATOR = process.platform === 'win32' ? ';' : ':'
const SPAWN_RESULT = cb => ({ on: function () { cb() } })

describe('configure-python', function () {
  it('configure PYTHONPATH with no existing env', async function () {
    delete process.env.PYTHONPATH

    const prog = gyp()
    prog.parseArgv([])

    await new Promise((resolve, reject) => {
      prog.spawn = function () {
        try {
          assert.strictEqual(process.env.PYTHONPATH, EXPECTED_PYPATH)
          return SPAWN_RESULT(resolve)
        } catch (err) {
          reject(err)
        }
      }
      prog.devDir = devDir
      configure(prog, [], reject)
    })
  })

  it('configure PYTHONPATH with existing env of one dir', async function () {
    const existingPath = path.join('a', 'b')
    process.env.PYTHONPATH = existingPath

    const prog = gyp()
    prog.parseArgv([])

    await new Promise((resolve, reject) => {
      prog.spawn = function () {
        try {
          assert.strictEqual(process.env.PYTHONPATH, [EXPECTED_PYPATH, existingPath].join(SEPARATOR))

          const dirs = process.env.PYTHONPATH.split(SEPARATOR)
          assert.deepStrictEqual(dirs, [EXPECTED_PYPATH, existingPath])

          return SPAWN_RESULT(resolve)
        } catch (err) {
          reject(err)
        }
      }
      prog.devDir = devDir
      configure(prog, [], reject)
    })
  })

  it('configure PYTHONPATH with existing env of multiple dirs', async function () {
    const pythonDir1 = path.join('a', 'b')
    const pythonDir2 = path.join('b', 'c')
    const existingPath = [pythonDir1, pythonDir2].join(SEPARATOR)
    process.env.PYTHONPATH = existingPath

    const prog = gyp()
    prog.parseArgv([])

    await new Promise((resolve, reject) => {
      prog.spawn = function () {
        try {
          assert.strictEqual(process.env.PYTHONPATH, [EXPECTED_PYPATH, existingPath].join(SEPARATOR))

          const dirs = process.env.PYTHONPATH.split(SEPARATOR)
          assert.deepStrictEqual(dirs, [EXPECTED_PYPATH, pythonDir1, pythonDir2])

          return SPAWN_RESULT(resolve)
        } catch (err) {
          reject(err)
        }
      }
      prog.devDir = devDir
      configure(prog, [], reject)
    })
  })
})
