'use strict'

var test = require('tape')
var configure = require('../lib/configure')
var execFile = require('child_process').execFile

test('find python executable', function (t) {
  t.plan(4)

  configure.test.findPython('python', function (err, found) {
    t.equal(err, null)
    var proc = execFile(found, ['-V'], function (err, stdout, stderr) {
      t.equal(err, null)
      t.equal(stdout, '')
      t.ok(/Python 2/.test(stderr))
    })
    proc.stdout.setEncoding('utf-8')
    proc.stderr.setEncoding('utf-8')
  })
})
