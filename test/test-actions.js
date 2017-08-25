'use strict'

var child_process = require('child_process')
var test = require('tape')
var path = require('path')

var execFileSync = child_process.execFileSync
var execFile = child_process.execFile

var addonPath = path.resolve(__dirname, 'node_modules', 'name\'s (weird)')
var nodeGyp = path.resolve(__dirname, '..', 'bin', 'node-gyp.js')

function runSpacedName() {
  var testCode = "require('name\\'s (weird)')"
  return execFileSync('node', ['-e', testCode], { cwd: __dirname }).toString()
}

test('build addon w/ actions and spaces in path', function (t) {
  t.plan(3)

  // Set the loglevel otherwise the output disappears when run via 'npm test'
  var cmd = [ nodeGyp, 'rebuild', '-C', addonPath, '--loglevel=verbose' ]

  var proc = execFile(process.execPath, cmd, function (err, stdout, stderr) {
    var logLines = stderr.toString().trim().split(/\r?\n/)
    var lastLine = logLines[logLines.length-1]
    t.strictEqual(err, null)
    t.strictEqual(lastLine, 'gyp info ok', 'should end in ok')
    t.strictEqual(runSpacedName().trim(), 'world')
  })

  proc.stdout.setEncoding('utf-8')
  proc.stderr.setEncoding('utf-8')
})
