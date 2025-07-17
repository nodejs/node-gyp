'use strict'

const { describe, it } = require('node:test')
const assert = require('assert')
const path = require('path')
const fs = require('graceful-fs')
const os = require('os')
const cp = require('child_process')
const util = require('../lib/util')
const { platformTimeout } = require('./common')

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
  const timeout = platformTimeout(1, { win32: 5 })

  it('build simple addon', { timeout }, async function () {
    // Set the loglevel otherwise the output disappears when run via 'npm test'
    const cmd = [nodeGyp, 'rebuild', '-C', addonPath, '--loglevel=verbose']
    const [err, logLines] = await execFile(cmd)
    const lastLine = logLines[logLines.length - 1]
    assert.strictEqual(err, null)
    assert.strictEqual(lastLine, 'gyp info ok', 'should end in ok')
    assert.strictEqual(runHello(), 'world')
  })

  it('build simple addon in path with non-ascii characters', { timeout }, async function (t) {
    if (!checkCharmapValid()) {
      return t.skip('python console app can\'t encode non-ascii character.')
    }

    // Select non-ascii characters by current encoding
    const testDirName = {
      cp936: '文件夹',
      cp1252: 'Latīna',
      cp932: 'フォルダ'
    }[getEncoding()]
    // If encoding is UTF-8 or other then no need to test
    if (!testDirName) {
      return t.skip('no need to test')
    }

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

  it('addon works with renamed host executable', { timeout }, async function () {
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
})
