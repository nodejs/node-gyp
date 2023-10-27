'use strict'

const { describe, it, after } = require('mocha')
const { rm, mkdtemp } = require('fs/promises')
const { createWriteStream } = require('fs')
const assert = require('assert')
const path = require('path')
const os = require('os')
const semver = require('semver')
const { pipeline: streamPipeline } = require('stream/promises')
const requireInject = require('require-inject')
const gyp = require('../lib/node-gyp')

const createInstall = (mocks = {}) => requireInject('../lib/install', mocks).test
const { download, install } = createInstall()

describe('install', function () {
  it('EACCES retry once', async () => {
    let statCalled = 0
    const mockInstall = createInstall({
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
    })
    const Gyp = {
      devDir: __dirname,
      opts: {
        ensure: true
      },
      commands: {
        install: (...args) => mockInstall.install(Gyp, ...args),
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

  // only run these tests if we are running a version of Node with predictable version path behavior
  const skipParallelInstallTests = process.env.FAST_TEST ||
    process.release.name !== 'node' ||
    semver.prerelease(process.version) !== null ||
    semver.satisfies(process.version, '<10')

  async function parallelInstallsTest (test, devDir, prog) {
    if (skipParallelInstallTests) {
      return test.skip('Skipping parallel installs test due to test environment configuration')
    }

    after(async () => {
      await rm(devDir, { recursive: true, force: true })
    })

    const expectedDir = path.join(devDir, process.version.replace(/^v/, ''))
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
  }

  it('parallel installs (ensure=true)', async function () {
    this.timeout(600000)

    const devDir = await mkdtemp(path.join(os.tmpdir(), 'node-gyp-test-'))

    const prog = gyp()
    prog.parseArgv([])
    prog.devDir = devDir
    prog.opts.ensure = true

    await parallelInstallsTest(this, devDir, prog)
  })

  it('parallel installs (ensure=false)', async function () {
    this.timeout(600000)

    const devDir = await mkdtemp(path.join(os.tmpdir(), 'node-gyp-test-'))

    const prog = gyp()
    prog.parseArgv([])
    prog.devDir = devDir
    prog.opts.ensure = false

    await parallelInstallsTest(this, devDir, prog)
  })

  it('parallel installs (tarball)', async function () {
    this.timeout(600000)

    const devDir = await mkdtemp(path.join(os.tmpdir(), 'node-gyp-test-'))

    const prog = gyp()
    prog.parseArgv([])
    prog.devDir = devDir
    prog.opts.tarball = path.join(devDir, 'node-headers.tar.gz')

    await streamPipeline(
      (await download(prog, `https://nodejs.org/dist/${process.version}/node-${process.version}.tar.gz`)).body,
      createWriteStream(prog.opts.tarball)
    )

    await parallelInstallsTest(this, devDir, prog)
  })
})
