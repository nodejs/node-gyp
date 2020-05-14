'use strict'

const { test } = require('tap')
const path = require('path')
const devDir = require('./common').devDir()
const Gyp = require('../lib/node-gyp')
const requireInject = require('require-inject')

const configure = requireInject('../lib/configure', {
  'graceful-fs': {
    openSync: () => 0,
    closeSync: () => {},
    writeFile: (file, data, cb) => cb(),
    stat: (file, cb) => cb(null, {})
  }
})

const EXPECTED_PYPATH = path.join(__dirname, '../gyp/pylib')
const SEPARATOR = process.platform === 'win32' ? ';' : ':'
const SPAWN_RESULT = { on: () => {} }

require('npmlog').level = 'warn'

test('configure PYTHONPATH with no existing env', (t) => {
  t.plan(1)

  delete process.env.PYTHONPATH

  const gyp = new Gyp()
  gyp.parseArgv([])
  gyp.spawn = () => {
    t.equal(process.env.PYTHONPATH, EXPECTED_PYPATH)
    return SPAWN_RESULT
  }
  gyp.devDir = devDir
  configure(gyp, [], t.fail)
})

test('configure PYTHONPATH with existing env of one dir', (t) => {
  t.plan(2)

  const existingPath = path.join('a', 'b')
  process.env.PYTHONPATH = existingPath

  const gyp = new Gyp()
  gyp.parseArgv([])
  gyp.spawn = () => {
    t.equal(process.env.PYTHONPATH, [EXPECTED_PYPATH, existingPath].join(SEPARATOR))

    const dirs = process.env.PYTHONPATH.split(SEPARATOR)
    t.deepEqual(dirs, [EXPECTED_PYPATH, existingPath])

    return SPAWN_RESULT
  }
  gyp.devDir = devDir
  configure(gyp, [], t.fail)
})

test('configure PYTHONPATH with existing env of multiple dirs', (t) => {
  t.plan(2)

  const pythonDir1 = path.join('a', 'b')
  const pythonDir2 = path.join('b', 'c')
  const existingPath = [pythonDir1, pythonDir2].join(SEPARATOR)
  process.env.PYTHONPATH = existingPath

  const gyp = new Gyp()
  gyp.parseArgv([])
  gyp.spawn = () => {
    t.equal(process.env.PYTHONPATH, [EXPECTED_PYPATH, existingPath].join(SEPARATOR))

    const dirs = process.env.PYTHONPATH.split(SEPARATOR)
    t.deepEqual(dirs, [EXPECTED_PYPATH, pythonDir1, pythonDir2])

    return SPAWN_RESULT
  }
  gyp.devDir = devDir
  configure(gyp, [], t.fail)
})
