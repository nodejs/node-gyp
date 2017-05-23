'use strict'

var test = require('tape')
var path = require('path')
var fs = require('graceful-fs')
var child_process = require('child_process')
var addonPath = path.resolve(__dirname, 'node_modules', 'hello_world')
var nodeGyp = path.resolve(__dirname, '..', 'bin', 'node-gyp.js')
var execFileSync = child_process.execFileSync
var execFile = child_process.execFile

function runHello() {
  var testCode = "console.log(require('hello_world').hello())"
  return execFileSync('node', ['-e', testCode], { cwd: __dirname }).toString()
}

test('build simple addon', function (t) {
  t.plan(3)

  // Set the loglevel otherwise the output disappears when run via 'npm test'
  var cmd = [nodeGyp, 'rebuild', '-C', addonPath, '--loglevel=verbose']
  var proc = execFile(process.execPath, cmd, function (err, stdout, stderr) {
    var logLines = stderr.toString().trim().split(/\r?\n/)
    var lastLine = logLines[logLines.length-1]
    t.strictEqual(err, null)
    t.strictEqual(lastLine, 'gyp info ok', 'should end in ok')
    t.strictEqual(runHello().trim(), 'world')
  })
  proc.stdout.setEncoding('utf-8')
  proc.stderr.setEncoding('utf-8')
})

test('build simple addon in path with non-ascii characters', function (t) {
  t.plan(3)

  var data, config, nodeDir, testNodeDir
  var configPath = path.join(addonPath, 'build', 'config.gypi')

  try {
    data = fs.readFileSync(configPath, 'utf8')
  } catch (err) {
    t.error(err)
    return
  }
  config = JSON.parse(data.replace(/\#.+\n/, ''))
  nodeDir = config.variables.nodedir
  // Create path with non-ascii characters
  testNodeDir = path.join(addonPath, '非英文字符')
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

  var cmd = [nodeGyp, 'rebuild', '-C', addonPath,
             '--loglevel=verbose', '-nodedir=' + testNodeDir]
  var proc = execFile(process.execPath, cmd, function (err, stdout, stderr) {
    try {
      fs.unlink(testNodeDir)
    } catch (err) {
      t.error(err)
    }

    var logLines = stderr.toString().trim().split(/\r?\n/)
    var lastLine = logLines[logLines.length-1]
    t.strictEqual(err, null)
    t.strictEqual(lastLine, 'gyp info ok', 'should end in ok')
    t.strictEqual(runHello().trim(), 'world')
  })
  proc.stdout.setEncoding('utf-8')
  proc.stderr.setEncoding('utf-8')
})
