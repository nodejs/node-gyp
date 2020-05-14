'use strict'

const { test } = require('tap')
const { install } = require('../lib/install').test

require('npmlog').level = 'error' // we expect a warning

test('EACCES retry once', (t) => {
  t.plan(3)

  const fs = {}
  fs.stat = (path, cb) => {
    const err = new Error()
    err.code = 'EACCES'
    cb(err)
    t.ok(true)
  }

  const gyp = {}
  gyp.devDir = __dirname
  gyp.opts = {}
  gyp.opts.ensure = true
  gyp.commands = {}
  gyp.commands.install = (argv, cb) => {
    install(fs, gyp, argv, cb)
  }
  gyp.commands.remove = (argv, cb) => {
    cb()
  }

  gyp.commands.install([], (err) => {
    t.ok(true)
    if (/"pre" versions of node cannot be installed/.test(err.message)) {
      t.ok(true)
      t.ok(true)
    }
  })
})
