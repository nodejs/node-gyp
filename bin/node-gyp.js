#!/usr/bin/env node

/**
 * Set the title.
 */

process.title = 'node-gyp'

/**
 * Module dependencies.
 */

var gyp = require('../lib/node-gyp')
  , inspect = require('util').inspect
  , ansi = require('ansi')
  , cursor = ansi(process.stdout)

/**
 * Process and execute the selected command.
 */

var prog = gyp()
prog.parseArgv(process.argv)

/**
 * Set up logging handlers.
 */

prog.on('info', function () {
  cursor.fg.green().write('info ')
        .fg.grey().write(arguments[0] + ' ')
        .reset()
  for (var i=1, l=arguments.length; i<l; i++) {
    cursor.write(arguments[i] + ' ')
  }
  cursor.write('\n')
})

if (prog.opts.verbose) {
  prog.on('verbose', function () {
    cursor.fg.blue().write('verbose ')
          .fg.grey().write(arguments[0] + ' ')
          .reset()
    for (var i=1, l=arguments.length; i<l; i++) {
      cursor.write(inspect(arguments[i]) + ' ')
    }
    cursor.write('\n')
  })
}

prog.on('spawn', function (command, args, proc) {
  cursor.fg.magenta().write('spawn ')
        .fg.grey().write(command + ' ')
        .reset().write(inspect(args) + '\n')

  proc.stdout.pipe(process.stdout, { end: false })
  proc.stderr.pipe(process.stderr, { end: false })
})

/**
 * Process and execute the selected command.
 */

if (!prog.command) {
  return prog.usageAndExit()
}

prog.commands[prog.command](prog.argv, function (err) {
  if (err) throw err
})

