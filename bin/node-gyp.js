#!/usr/bin/env node

/**
 * Set the title.
 */

process.title = 'node-gyp'

/**
 * Module dependencies.
 */

var fs = require('fs')
  , path = require('path')
  , usage = require('../lib/usage')

/**
 * Ensure a command was given.
 */

if (process.argv.length < 3) {
  usage.print().exit()
}

/**
 * Process and execute the selected command.
 */

var command = process.argv[2]
  , module = path.join(__dirname, '..', 'lib', command + '.js')

fs.stat(module, function (err, stat) {
  if (err || !stat || !stat.isFile()) {
    console.error('Unknown command `%s`', command)
    return usage.print().exit()
  }
  require(module)(process.argv)
})
