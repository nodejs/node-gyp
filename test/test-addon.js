'use strict'

var test = require('tape')
var childProcess = require('child_process')
var execFile = childProcess.execFile
var exec = childProcess.exec
var path = require('path')
var addonPath = path.resolve(__dirname, 'node_modules', 'hello_world')
var nodeGyp = path.resolve(__dirname, '..', 'bin', 'node-gyp.js')
var rimraf = require('rimraf')

function cleanup (dir) {
  return function teardown (t) {
    Object.keys(require.cache)
      .forEach(function (d) {
        if (d.indexOf(addonPath) == 0)
          delete require.cache[d]
      })
    rimraf(dir, t.end)
  }
}

test('build simple addon - setup', cleanup(path.join(addonPath, 'build')))

test('build simple addon', function (t) {
  t.plan(3)

  // Set the loglevel otherwise the output disappears when run via 'npm test'
  var cmd = [nodeGyp, 'rebuild', '-C', addonPath, '--loglevel=verbose']
  var proc = execFile(process.execPath, cmd, function (err, stdout, stderr) {
    var logLines = stderr.toString().trim().split(/\r?\n/)
    var lastLine = logLines[logLines.length-1]
    t.strictEqual(err, null)
    t.strictEqual(lastLine, 'gyp info ok', 'should end in ok')
    try {
      var binding = require('hello_world')
      t.strictEqual(binding.hello(), 'world')
    } catch (error) {
      t.error(error, 'load module')
    }
  })
  proc.stdout.setEncoding('utf-8')
  proc.stderr.setEncoding('utf-8')
})

test('build simple addon - teardown', cleanup(path.join(addonPath, 'build')))

test('build with different build dir - setup',
     cleanup(path.join(addonPath, 'foo')))

test('build with different build dir', function(t) {
  var cmd = [nodeGyp, 'rebuild', '-C',
              addonPath, '--loglevel=verbose', '--build-dir=foo']
  var proc = execFile(process.execPath, cmd, function (err, stdout, stderr) {
    var logLines = stderr.toString().trim().split(/\r?\n/)
    var lastLine = logLines[logLines.length-1]
    t.strictEqual(err, null)
    t.strictEqual(lastLine, 'gyp info ok', 'should end in ok')

    try {
      var binding = require(path.join(addonPath, 'foo/Release/hello.node'))
      t.strictEqual(binding.hello(), 'world')

      // Cleanup
      execFile(process.execPath, [nodeGyp, '--build-dir=foo',  'clean'], t.end)
    } catch (error) {
      t.error(error, 'load module')
    }
  })

  proc.stdout.setEncoding('utf-8')
  proc.stderr.setEncoding('utf-8')
})

test('build with different build dir - teardown',
     cleanup(path.join(addonPath, 'foo')))
