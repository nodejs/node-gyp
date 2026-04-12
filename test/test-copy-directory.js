'use strict'

const { describe, it, afterEach } = require('mocha')
const assert = require('assert')
const path = require('path')
const fs = require('fs')
const { promises: fsp } = fs
const os = require('os')
const { FULL_TEST, platformTimeout } = require('./common')
const copyDirectory = require('../lib/copy-directory')

describe('copyDirectory', function () {
  let timer
  let tmpDir

  afterEach(async () => {
    if (tmpDir) {
      await fsp.rm(tmpDir, { recursive: true, force: true })
      tmpDir = null
    }
    clearInterval(timer)
  })

  it('large file appears atomically (no partial writes visible)', async function () {
    if (!FULL_TEST) {
      return this.skip('Skipping due to test environment configuration')
    }

    this.timeout(platformTimeout(5, { win32: 10 }))

    tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'node-gyp-copy-test-'))
    const srcDir = path.join(tmpDir, 'src')
    const destDir = path.join(tmpDir, 'dest')
    await fsp.mkdir(srcDir)

    const fileName = 'large.bin'
    const srcFile = path.join(srcDir, fileName)
    const destFile = path.join(destDir, fileName)

    // Create a 5 GB sparse file — instant to create, consumes no real
    // disk, but fs.copyFile still has to process the full extent map so
    // the destination file is visible at size 0 and grows over time.
    // fs.rename() is atomic at the VFS level: the file either does not
    // exist at the destination or appears at its full size in one step.
    const fileSize = 5 * 1024 * 1024 * 1024
    const handle = await fsp.open(srcFile, 'w')
    await handle.truncate(fileSize)
    await handle.close()

    // Tight synchronous poll: stat the destination on every event-loop
    // turn while copyDirectory runs concurrently.
    let polls = 0
    const violations = []

    timer = setInterval(() => {
      try {
        const stat = fs.statSync(destFile)
        polls++
        if (stat.size !== fileSize) {
          violations.push({ poll: polls, size: stat.size })
        }
      } catch (err) {
        if (err.code !== 'ENOENT') throw err
      }
    }, 0)

    await copyDirectory(srcDir, destDir)

    clearInterval(timer)
    timer = undefined

    console.log(`        ${polls} stats observed the file during the operation`)

    assert.strictEqual(violations.length, 0, 'file must never be observed at a partial size')

    const finalStat = await fsp.stat(destFile)
    assert.strictEqual(finalStat.size, fileSize,
      'destination file should have the correct final size')
  })
})
