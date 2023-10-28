'use strict'

const { describe, it, afterEach, beforeEach } = require('mocha')
const { rm, mkdtemp } = require('fs/promises')
const { createWriteStream } = require('fs')
const assert = require('assert')
const path = require('path')
const os = require('os')
const { pipeline: streamPipeline } = require('stream/promises')
const requireInject = require('require-inject')
const { skip } = require('./common')
const gyp = require('../lib/node-gyp')
const { test: { download, install } } = require('../lib/install')

describe('install', function () {
  it('EACCES retry once', async () => {
    let statCalled = 0
    const mockInstall = requireInject('../lib/install', {
      'graceful-fs': {
        promises: {
          stat (_) {
            const err = new Error()
            err.code = 'EACCES'
            statCalled++
            throw err
          }
        }
      }
    }).test.install
    const Gyp = {
      devDir: __dirname,
      opts: {
        ensure: true
      },
      commands: {
        install: (...args) => mockInstall(Gyp, ...args),
        remove: async () => {}
      }
    }

    let err
    try {
      await Gyp.commands.install([])
    } catch (e) {
      err = e
    }

    assert.ok(err)
    assert.equal(statCalled, 2)
    if (/"pre" versions of node cannot be installed/.test(err.message)) {
      assert.ok(true)
    }
  })

  describe('parallel', function () {
    let prog

    beforeEach(async () => {
      prog = gyp()
      prog.parseArgv([])
      prog.devDir = await mkdtemp(path.join(os.tmpdir(), 'node-gyp-test-'))
    })

    afterEach(async () => {
      await rm(prog.devDir, { recursive: true, force: true })
      prog = null
    })

    const runIt = (name, fn) => {
      // only run these tests if we are running a version of Node with predictable version path behavior
      if (skip) {
        return it.skip('Skipping parallel installs test due to test environment configuration')
      }
      return it(name, async function () {
        this.timeout(600000)
        await fn.call(this)
        const expectedDir = path.join(prog.devDir, process.version.replace(/^v/, ''))
        await rm(expectedDir, { recursive: true, force: true })
        await Promise.all([
          install(prog, []),
          install(prog, []),
          install(prog, []),
          install(prog, []),
          install(prog, []),
          install(prog, []),
          install(prog, []),
          install(prog, []),
          install(prog, []),
          install(prog, [])
        ])
      })
    }

    runIt('ensure=true', async function () {
      prog.opts.ensure = true
    })

    runIt('ensure=false', async function () {
      prog.opts.ensure = false
    })

    runIt('tarball', async function () {
      prog.opts.tarball = path.join(prog.devDir, 'node-headers.tar.gz')
      const dl = await download(prog, `https://nodejs.org/dist/${process.version}/node-${process.version}.tar.gz`)
      await streamPipeline(dl.body, createWriteStream(prog.opts.tarball))
    })
  })
})
