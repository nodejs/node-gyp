'use strict'

const path = require('path')
const log = require('npmlog')
const childProcess = require('child_process')
const EE = require('events').EventEmitter
const inherits = require('util').inherits
const pkg = require('../package.json')
const args = require('./args')

// differentiate node-gyp's logs from npm's
log.heading = 'gyp'

class Gyp {
  constructor () {
    this.devDir = ''
    this.package = pkg
    this.configDefs = args.configDefs
    this.shorthands = args.shorthands
    this.aliases = args.aliases

    this.commands = {}
    for (const command of args.commands) {
      this.commands[command] = (argv, callback) => {
        log.verbose('command', command, argv)
        return require(`./${command}`)(this, argv, callback)
      }
    }
  }

  /**
   * Version number getter.
   */
  get version () {
    return this.package.version
  }

  parseArgv (_argv) {
    const { opts, argv, todo } = args(_argv)
    this.opts = opts
    this.argv = argv
    this.todo = todo
  }

  /**
   * Spawns a child process and emits a 'spawn' event.
   */
  spawn (command, args, opts) {
    if (!opts) {
      opts = {}
    }

    if (!opts.silent && !opts.stdio) {
      opts.stdio = [0, 1, 2]
    }

    const cp = childProcess.spawn(command, args, opts)
    log.info('spawn', command)
    log.info('spawn args', args)
    return cp
  }

  /**
   * Returns the usage instructions for node-gyp.
   */
  usage () {
    return `
  Usage: node-gyp <command> [options]

  where <command> is one of:
${args.commands.map((c) => `    - ${c} - ${require(`./${c}`).usage}`).join('\n')}

node-gyp@${this.version}  ${path.resolve(__dirname, '..')}
node@${process.versions.node}`
  }
}

inherits(Gyp, EE)

module.exports = Gyp
