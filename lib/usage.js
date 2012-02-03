
/**
 * Module dependencies.
 */

var win = process.platform === 'win32'
  , path = require('path')

exports.usage = [
    ''
  , '  Usage: node-gyp <command>'
  , ''
  , 'where <command> is one of:'
  , '    - configure   - Generates ' + (win ? 'MSVS project files' : 'a Makefile') + ' for the current platform'
  , '    - build       - Invokes `' + (win ? 'msbuild' : 'make') + '` and builds the module'
  , '    - ls          - List the currently installed node development versions'
  , '    - install     - Install development files for the specified node version'
  , ''
  , 'node-gyp  ' + path.resolve(__dirname, '..')
].join('\n')

/**
 * Print usage to stderr.
 */

exports.print = function print () {
  console.error(exports.usage)
  return exports
}

/**
 * Exit with a consistent exit code.
 */

exports.exit = function exit () {
  process.exit(1)
}
