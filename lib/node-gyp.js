
module.exports = exports = gyp

/**
 * Module dependencies.
 */

var fs = require('fs')
  , path = require('path')
  , nopt = require('nopt')
  , child_process = require('child_process')
  , EE = require('events').EventEmitter
  , inherits = require('util').inherits
  , commands = [
        'configure'
      , 'build'
      , 'install'
    ]

/**
 * The `gyp` function.
 */

function gyp () {
  return new Gyp
}

function Gyp () {
  var me = this

  this.commands = {}
  commands.forEach(function (command) {
    me.commands[command] = function (argv, callback) {
      return require('./' + command)(me, argv, callback)
    }
  })
}
inherits(Gyp, EE)
exports.Gyp = Gyp
var proto = Gyp.prototype

/**
 * Export the contents of the package.json.
 */

proto.package = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf8'))

proto.configDefs = {
    debug: Boolean
  , verbose: Boolean
}

proto.shorthands = {}

/**
 * Runs a command given in the argv Array with its options as well.
 * Example: [ 'configure', 'bindings.gyp', '--debug' ]
 */

proto.run = function run (argv, callback) {
  this.parseArgv(argv)
  this.commands[this.command](this.argv, callback)
}

proto.parseArgv = function parseOpts (argv) {
  this.opts = nopt(this.configDefs, this.shorthands, argv)
  this.argv = this.opts.argv.remain.slice()
  this.command = this.argv.shift()
}

/**
 * Spawns a child process and emits a 'spawn' event.
 */

proto.spawn = function spawn () {
  var cp = child_process.spawn.apply(child_process, arguments)
  this.emit('spawn', cp)
  return cp
}

/**
 * Version number proxy.
 */

Object.defineProperty(proto, 'version', {
    get: function () {
      return this.package.version
    }
  , enumerable: true
})

