
module.exports = exports = build

/**
 * Module dependencies.
 */

var which = require('which')
  , win = process.platform == 'win32'

function build (gyp, argv, callback) {

  console.error('build')

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
    //console.error(execPath)

    var args = []

    // Enable Verbose build
    if (gyp.opts.verbose) {
      args.push('V=1')
    }

    // Specify the build type, Release by default
    args.push('BUILDTYPE=' + (gyp.opts.debug ? 'Debug' : 'Release'))

    var proc = gyp.spawn(command, args)
  })
}
