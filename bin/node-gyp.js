#!/usr/bin/env node

/**
 * Set the title.
 */

process.title = 'node-gyp'

/**
 * Module dependencies.
 */

var gyp = require('../lib/node-gyp')

/**
 * Process and execute the selected command.
 */

var prog = gyp()
prog.parseArgv(process.argv)
if (!prog.command) {
  return prog.usageAndExit()
}

prog.commands[prog.command](prog.argv, function (err) {
  if (err) throw err
})

prog.on('spawn', function (command, args, proc) {
  //console.error('spawn', command, args)
  proc.stdout.pipe(process.stdout, { end: false })
  proc.stderr.pipe(process.stderr, { end: false })
})
