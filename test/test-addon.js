'use strict'

var test = require('tape')
var execFile = require('child_process').execFile
var path = require('path')
var addonPath = path.resolve(__dirname, 'node_modules', 'hello_world')
var nodeGyp = path.resolve(__dirname, '..', 'bin', 'node-gyp.js')

test('build simple addon', function (t) {
  t.plan(4)

  exec(t, ['clean', 'rebuild'], [], function (err, stdout, stderr) {
    var logLines = stderr.toString().trim().split(/\r?\n/)
    var lastLine = logLines[logLines.length-1]
    t.strictEqual(err, null)
    t.strictEqual(lastLine, 'gyp info ok', 'should end in ok')
    try {
      var hello = require('hello_world/hello')
      t.strictEqual(hello.hello(), 'world')
    } catch (error) {
      t.error(error, 'load module')
    }

    try {
      var world = require('hello_world/world')
      t.strictEqual(world.world(), 'hello')
    } catch (error) {
      t.error(error, 'load module')
    }
  })
})

function exec(t, cmd, args, cb) {
  // Set the loglevel otherwise the output disappears when run via 'npm test'
  var toExec = [nodeGyp]
    .concat(cmd)
    .concat(['-C', addonPath, '--loglevel=verbose'])
    .concat(args)

  t.comment(toExec.join(' '))
  var proc = execFile(process.execPath, toExec, cb)
  proc.stdout.setEncoding('utf-8')
  proc.stderr.setEncoding('utf-8')
}
