'use strict'

const { describe, it, beforeEach, afterEach } = require('mocha')
const assert = require('assert')
const path = require('path')
const fs = require('graceful-fs')
const { rm, mkdtemp } = require('fs/promises')
const os = require('os')
const cp = require('child_process')
const util = require('../lib/util')
const { FULL_TEST, platformTimeout } = require('./common')

const addonPath = path.resolve(__dirname, 'node_modules', 'hello_world')
const nodeGyp = path.resolve(__dirname, '..', 'bin', 'node-gyp.js')

const execFileSync = (...args) => cp.execFileSync(...args).toString().trim()

const execFile = async (cmd) => {
  const [err,, stderr] = await util.execFile(process.execPath, cmd, {
    env: { ...process.env, NODE_GYP_NULL_LOGGER: undefined },
    encoding: 'utf-8'
  })
  return [err, stderr.toString().trim().split(/\r?\n/)]
}

function runHello (hostProcess = process.execPath) {
  const testCode = "console.log(require('hello_world').hello())"
  return execFileSync(hostProcess, ['-e', testCode], { cwd: __dirname })
}

function getEncoding () {
  const code = 'import locale;print(locale.getdefaultlocale()[1])'
  return execFileSync('python', ['-c', code])
}

function checkCharmapValid () {
  try {
    const data = execFileSync('python', ['fixtures/test-charmap.py'], { cwd: __dirname })
    return data.split('\n').pop() === 'True'
  } catch {
    return false
  }
}

describe('addon', function () {
  it('build simple addon', async function () {
    this.timeout(platformTimeout(1, { win32: 5 }))

    // Set the loglevel otherwise the output disappears when run via 'npm test'
    const cmd = [nodeGyp, 'rebuild', '-C', addonPath, '--loglevel=verbose']
    const [err, logLines] = await execFile(cmd)
    const lastLine = logLines[logLines.length - 1]
    assert.strictEqual(err, null)
    assert.strictEqual(lastLine, 'gyp info ok', 'should end in ok')
    assert.strictEqual(runHello(), 'world')
  })

  it('build simple addon in path with non-ascii characters', async function () {
    if (!checkCharmapValid()) {
      return this.skip('python console app can\'t encode non-ascii character.')
    }

    // Select non-ascii characters by current encoding
    const testDirName = {
      cp936: '文件夹',
      cp1252: 'Latīna',
      cp932: 'フォルダ'
    }[getEncoding()]
    // If encoding is UTF-8 or other then no need to test
    if (!testDirName) {
      return this.skip('no need to test')
    }

    this.timeout(platformTimeout(1, { win32: 5 }))

    let data
    const configPath = path.join(addonPath, 'build', 'config.gypi')
    try {
      data = fs.readFileSync(configPath, 'utf8')
    } catch (err) {
      return assert.fail(err)
    }
    const config = JSON.parse(data.replace(/#.+\n/, ''))
    const nodeDir = config.variables.nodedir
    const testNodeDir = path.join(addonPath, testDirName)
    // Create symbol link to path with non-ascii characters
    try {
      fs.symlinkSync(nodeDir, testNodeDir, 'dir')
    } catch (err) {
      switch (err.code) {
        case 'EEXIST': break
        case 'EPERM':
          return assert.fail(err, null, 'Please try to running console as an administrator')
        default:
          return assert.fail(err)
      }
    }

    const cmd = [
      nodeGyp,
      'rebuild',
      '-C',
      addonPath,
      '--loglevel=verbose',
      '-nodedir=' + testNodeDir
    ]
    const [err, logLines] = await execFile(cmd)
    try {
      fs.unlink(testNodeDir)
    } catch (err) {
      assert.fail(err)
    }
    const lastLine = logLines[logLines.length - 1]
    assert.strictEqual(err, null)
    assert.strictEqual(lastLine, 'gyp info ok', 'should end in ok')
    assert.strictEqual(runHello(), 'world')
  })

  it('addon works with renamed host executable', async function () {
    this.timeout(platformTimeout(1, { win32: 5 }))

    const notNodePath = path.join(os.tmpdir(), 'notnode' + path.extname(process.execPath))
    fs.copyFileSync(process.execPath, notNodePath)

    const cmd = [nodeGyp, 'rebuild', '-C', addonPath, '--loglevel=verbose']
    const [err, logLines] = await execFile(cmd)
    const lastLine = logLines[logLines.length - 1]
    assert.strictEqual(err, null)
    assert.strictEqual(lastLine, 'gyp info ok', 'should end in ok')
    assert.strictEqual(runHello(notNodePath), 'world')
    fs.unlinkSync(notNodePath)
  })

  describe('parallel', function () {
    let devDir
    let addonCopiesDir

    beforeEach(async () => {
      devDir = await mkdtemp(path.join(os.tmpdir(), 'node-gyp-test-'))
      addonCopiesDir = await mkdtemp(path.join(os.tmpdir(), 'node-gyp-test-addons-'))
    })

    afterEach(async () => {
      await Promise.all([
        rm(devDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 1000 }),
        rm(addonCopiesDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 1000 })
      ])
      devDir = null
      addonCopiesDir = null
    })

    const runIt = (name, fn) => {
      if (!FULL_TEST) {
        return it.skip('Skipping parallel rebuild test due to test environment configuration')
      }

      if (process.platform === 'darwin' && process.arch === 'x64') {
        return it.skip('Skipping parallel rebuild test on x64 macOS')
      }

      return it(name, async function () {
        this.timeout(platformTimeout(4, { win32: 20 }))
        await fn.call(this)
      })
    }

    runIt('parallel rebuild', async function () {
      // Install dependencies (nan) so copies in temp directories can resolve them
      const [npmErr] = await util.execFile('npm', ['install', '--ignore-scripts'], { cwd: addonPath, shell: process.platform === 'win32' })
      assert.strictEqual(npmErr, null)

      const copies = await Promise.all(new Array(5).fill(0).map(async (_, i) => {
        const copyDir = path.join(addonCopiesDir, `hello_world_${i}`)
        await fs.promises.cp(addonPath, copyDir, { recursive: true })
        return copyDir
      }))
      await Promise.all(copies.map(async (copyDir, i) => {
        const cmd = [nodeGyp, 'rebuild', '-C', copyDir, '--loglevel=verbose', `--devdir=${devDir}`]
        const title = `${' '.repeat(8)}parallel rebuild ${(i + 1).toString().padEnd(2, ' ')}`
        console.log(`${title} : Start`)
        console.time(title)
        const [err, logLines] = await execFile(cmd)
        console.timeEnd(title)
        const lastLine = logLines[logLines.length - 1]
        assert.strictEqual(err, null)
        assert.strictEqual(lastLine, 'gyp info ok', 'should end in ok')
      }))
    })
  })
})
