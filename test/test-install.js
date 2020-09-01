'use strict'

const test = require('tap').test
const install = require('../lib/install').test.install

require('npmlog').level = 'error' // we expect a warning

test('EACCES retry once', function (t) {
  t.plan(3)

  var fs = {}
  fs.stat = function (path, cb) {
    var err = new Error()
    err.code = 'EACCES'
    cb(err)
    t.ok(true)
  }

  var nnabt = {}
  nnabt.devDir = __dirname
  nnabt.opts = {}
  nnabt.opts.ensure = true
  nnabt.commands = {}
  nnabt.commands.install = function (argv, cb) {
    install(fs, nnabt, argv, cb)
  }
  nnabt.commands.remove = function (argv, cb) {
    cb()
  }

  nnabt.commands.install([], function (err) {
    t.ok(true)
    if (/"pre" versions of node cannot be installed/.test(err.message)) {
      t.ok(true)
      t.ok(true)
    }
  })
})
