'use strict'

var test = require('tape')
var configure = require('../lib/configure')
var execFile = require('child_process').execFile
var fs = require('graceful-fs')

test('find python executable', function (t) {
  t.plan(4)

  configure.test.findPython(null, function (err, found) {
    t.equal(err, null)
    var proc = execFile(found, ['-V'], function (err, stdout, stderr) {
      t.equal(err, null)
      t.equal(stdout, '')
      t.ok(/Python 2/.test(stderr), 'should be python 2.x.x')
    })
    proc.stdout.setEncoding('utf-8')
    proc.stderr.setEncoding('utf-8')
  })
})


test('find python batch files on windows', function (t) {
  if (process.platform !== 'win32') {
    t.end()
  }
  var mockFileName = __dirname + '\\python2.bat'
  var oldPath = process.env.PATH
  process.env.PATH = __dirname
  t.plan(2)

  configure.test.findPython(null, function (err, found) {
    process.env.PATH = oldPath

    t.equal(err, null)
    t.equal(found.toLowerCase(), mockFileName.toLowerCase())
  })
})
