'use strict'

var test = require('tape')
var execFile = require('child_process').execFile
var path = require('path')
var fs = require('fs')
var nodeGyp = path.resolve(__dirname, '..', 'bin', 'node-gyp.js')

test('#1151 build addon with an action', function (t) {
  t.plan(3)

  var addonPath = path.resolve(__dirname, 'node_modules', 'test_action1')
  // Set the loglevel otherwise the output disappears when run via 'npm test'
  var cmd = [nodeGyp, 'rebuild', '-C', addonPath, '--loglevel=verbose']
  var proc = execFile(process.execPath, cmd, function (err, stdout, stderr) {
    var logLines = stderr.toString().trim().split(/\r?\n/)
    var lastLine = logLines[logLines.length - 1]
    t.notOk(err)
    t.strictEqual(lastLine, 'gyp info ok', 'should end in ok')
    var locPath = path.resolve(addonPath, 'loc.txt')
    var loc = fs.readFileSync(locPath, {encoding: 'utf-8'}).trim()
    fs.unlinkSync(locPath);
    t.ok(fs.existsSync(loc));
  })
  proc.stdout.setEncoding('utf-8')
  proc.stderr.setEncoding('utf-8')
})

test('#1151 build addon with an action 2', function (t) {
  t.plan(3)

  var addonPath = path.resolve(__dirname, 'node_modules', 'test_action2')
  // Set the loglevel otherwise the output disappears when run via 'npm test'
  var cmd = [nodeGyp, 'rebuild', '-C', addonPath, '--loglevel=verbose']
  var proc = execFile(process.execPath, cmd, function (err, stdout, stderr) {
    var logLines = stderr.toString().trim().split(/\r?\n/)
    var lastLine = logLines[logLines.length - 1]
    t.notOk(err)
    t.strictEqual(lastLine, 'gyp info ok', 'should end in ok')
    var locPath = path.resolve(addonPath, 'loc.txt')
    var loc = fs.readFileSync(locPath, {encoding: 'utf-8'}).trim()
    fs.unlinkSync(locPath);
    t.ok(fs.existsSync(loc));
  })
  proc.stdout.setEncoding('utf-8')
  proc.stderr.setEncoding('utf-8')
})
