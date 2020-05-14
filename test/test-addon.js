'use strict'

const { test } = require('tap')
const path = require('path')
const fs = require('fs')
const { execFileSync, execFile } = require('child_process')
const os = require('os')

const addonPath = path.resolve(__dirname, 'node_modules/hello_world')
const nodeGyp = path.resolve(__dirname, '../bin/node-gyp.js')

function runHello (hostProcess) {
  if (!hostProcess) {
    hostProcess = process.execPath
  }
  const testCode = 'console.log(require(\'hello_world\').hello())'
  return execFileSync(hostProcess, ['-e', testCode], { cwd: __dirname }).toString()
}

function getEncoding () {
  const code = 'import locale;print(locale.getdefaultlocale()[1])'
  return execFileSync('python', ['-c', code]).toString().trim()
}

function checkCharmapValid () {
  let data
  try {
    data = execFileSync('python', ['fixtures/test-charmap.py'],
      { cwd: __dirname })
  } catch (err) {
    return false
  }
  const lines = data.toString().trim().split('\n')
  return lines.pop() === 'True'
}

test('build simple addon', (t) => {
  t.plan(3)

  // Set the loglevel otherwise the output disappears when run via 'npm test'
  const cmd = [nodeGyp, 'rebuild', '-C', addonPath, '--loglevel=verbose']
  const proc = execFile(process.execPath, cmd, (err, stdout, stderr) => {
    const logLines = stderr.toString().trim().split(/\r?\n/)
    const lastLine = logLines[logLines.length - 1]
    t.strictEqual(err, null)
    t.strictEqual(lastLine, 'gyp info ok', 'should end in ok')
    t.strictEqual(runHello().trim(), 'world')
  })
  proc.stdout.setEncoding('utf-8')
  proc.stderr.setEncoding('utf-8')
})

test('build simple addon in path with non-ascii characters', (t) => {
  t.plan(1)

  if (!checkCharmapValid()) {
    return t.skip('python console app can\'t encode non-ascii character.')
  }

  const testDirNames = {
    cp936: '文件夹',
    cp1252: 'Latīna',
    cp932: 'フォルダ'
  }
  // Select non-ascii characters by current encoding
  const testDirName = testDirNames[getEncoding()]
  // If encoding is UTF-8 or other then no need to test
  if (!testDirName) {
    return t.skip('no need to test')
  }

  t.plan(3)

  let data
  const configPath = path.join(addonPath, 'build', 'config.gypi')
  try {
    data = fs.readFileSync(configPath, 'utf8')
  } catch (err) {
    t.error(err)
    return
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
        t.error(err, 'Please try to running console as an administrator')
        return
      default:
        t.error(err)
        return
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
  const proc = execFile(process.execPath, cmd, (err, stdout, stderr) => {
    try {
      fs.unlinkSync(testNodeDir)
    } catch (err) {
      t.error(err)
    }

    const logLines = stderr.toString().trim().split(/\r?\n/)
    const lastLine = logLines[logLines.length - 1]
    t.strictEqual(err, null)
    t.strictEqual(lastLine, 'gyp info ok', 'should end in ok')
    t.strictEqual(runHello().trim(), 'world')
  })
  proc.stdout.setEncoding('utf-8')
  proc.stderr.setEncoding('utf-8')
})

test('addon works with renamed host executable', (t) => {
  t.plan(3)

  const notNodePath = path.join(os.tmpdir(), `notnode${path.extname(process.execPath)}`)
  fs.copyFileSync(process.execPath, notNodePath)

  const cmd = [nodeGyp, 'rebuild', '-C', addonPath, '--loglevel=verbose']
  const proc = execFile(process.execPath, cmd, (err, stdout, stderr) => {
    const logLines = stderr.toString().trim().split(/\r?\n/)
    const lastLine = logLines[logLines.length - 1]
    t.strictEqual(err, null)
    t.strictEqual(lastLine, 'gyp info ok', 'should end in ok')
    t.strictEqual(runHello(notNodePath).trim(), 'world')
    fs.unlinkSync(notNodePath)
  })
  proc.stdout.setEncoding('utf-8')
  proc.stderr.setEncoding('utf-8')
})
