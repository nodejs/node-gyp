'use strict'

const { describe, it, beforeEach, afterEach } = require('mocha')
const assert = require('assert')
const os = require('os')
const path = require('path')
const { EventEmitter } = require('events')
const gracefulFs = require('graceful-fs')
const fs = gracefulFs.promises
const build = require('../lib/build')

const fakeGyp = {
  opts: { make: process.execPath },
  spawn () {
    const proc = new EventEmitter()
    setImmediate(() => proc.emit('exit', 0, null))
    return proc
  }
}

function stubSymlink (code) {
  gracefulFs.promises.symlink = async () => {
    const err = new Error(`${code}: simulated symlink failure`)
    err.code = code
    throw err
  }
}

describe('build symlink fallback', function () {
  let projectDir, buildDir
  const orig = {}
  beforeEach(async function () {
    if (process.platform === 'win32') {
      return this.skip('symlink logic only runs on non-Windows')
    }
    projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'node-gyp-build-'))
    buildDir = path.join(projectDir, 'build')
    await fs.mkdir(buildDir, { recursive: true })
    await fs.writeFile(path.join(buildDir, 'Makefile'), '')
    const config = {
      target_defaults: { default_configuration: 'Release' },
      variables: { target_arch: 'x64', nodedir: projectDir, python: 'python3' }
    }
    await fs.writeFile(path.join(buildDir, 'config.gypi'), JSON.stringify(config))

    orig.symlink = gracefulFs.promises.symlink
    orig.cwd = process.cwd()
    orig.path = process.env.PATH

    process.chdir(projectDir)
  })
  afterEach(async function () {
    if (process.platform === 'win32') {
      return
    }
    gracefulFs.promises.symlink = orig.symlink
    process.chdir(orig.cwd)
    process.env.PATH = orig.path
    await fs.rm(projectDir, { recursive: true, force: true })
  })
  it('continues and warns when symlink creation fails', async function () {
    stubSymlink('EPERM')
    const warnings = []
    const onLog = (level, prefix) => {
      if (level === 'warn') {
        warnings.push(prefix)
      }
    }
    process.on('log', onLog)
    try {
      await build(fakeGyp, [])
      assert.ok(
        !gracefulFs.existsSync(path.join(buildDir, 'node_gyp_bins')),
        'node_gyp_bins should be removed after symlink failure'
      )
      assert.ok(
        !process.env.PATH.includes('node_gyp_bins'),
        'PATH should not contain node_gyp_bins when symlink fails'
      )
      assert.ok(warnings.includes('bin symlinks'), 'should warn about the failed symlink')
    } finally {
      process.removeListener('log', onLog)
    }
  })
  it('fails if symlink creation failed for unknown reason', async function () {
    stubSymlink('UNKNOWN')
    await assert.rejects(
      build(fakeGyp, []),
      /UNKNOWN/,
      'build should rethrow errors that are not symlink-support failures'
    )
    assert.ok(
      !process.env.PATH.includes('node_gyp_bins'),
      'PATH should not contain node_gyp_bins when symlink fails'
    )
  })
})
