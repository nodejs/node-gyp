
module.exports = exports = build

exports.usage = 'Invokes `' + (win ? 'msbuild' : 'make') + '` and builds the module'

/**
 * Module dependencies.
 */

var which = require('which')
  , win = process.platform == 'win32'

function build (gyp, argv, callback) {

  var command

  if (win) {
    // invoke "msbuild"
    command = 'msbuild'
  } else {
    // invoke "make"
    command = 'make'
  }

  // First make sure we have the build command in the PATH
  which(command, function (err, execPath) {
    if (err) return callback(err)
    gyp.verbose('which ' + command, execPath)

    var args = []

    // Enable Verbose build
    if (gyp.opts.verbose) {
      args.push('V=1')
    }

    // Specify the build type, Release by default
    args.push('BUILDTYPE=' + (gyp.opts.debug ? 'Debug' : 'Release'))

    var proc = gyp.spawn(command, args)
    proc.on('exit', function (code, signal) {
      if (code !== 0) {
        return callback(new Error('`' + command + '` failed with exit code: ' + code))
      }
      if (signal) {
        return callback(new Error('`' + command + '` got signal: ' + signal))
      }
      callback()
    })
  })
}
