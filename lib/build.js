
module.exports = exports = build

/**
 * Module dependencies.
 */

var path = require('path')
  , which = require('which')
  , win = process.platform == 'win32'

exports.usage = 'Invokes `' + (win ? 'msbuild' : 'make') + '` and builds the module'

function build (gyp, argv, callback) {

  gyp.verbose('build args', argv)
  var command = win ? 'msbuild' : 'make'

  // First make sure we have the build command in the PATH
  which(command, function (err, execPath) {
    if (err) return callback(err)
    gyp.verbose('which ' + command, execPath)

    var config = gyp.opts.debug ? 'Debug' : 'Release'

    // Enable Verbose build
    if (!win && gyp.opts.verbose) {
      argv.push('V=1')
    }
    if (win && !gyp.opts.verbose) {
      argv.push('/clp:Verbosity=minimal')
    }

    // Turn off the Microsoft logo on Windows
    if (win) {
      argv.push('/nologo')
    }

    // Specify the build type, Release by default
    if (win) {
      argv.push('/p:Configuration=' + config)
    } else {
      argv.push('-f');
      argv.push('Makefile.gyp');
      argv.push('BUILDTYPE=' + config)
    }

    if (win && !hasSln) {
      // did the user specify their own .sln file?
      var hasSln = argv.some(function (arg) {
        return path.extname(arg) == '.sln'
      })
      if (!hasSln) {
        // on windows, specify the sln file to use. "bindings.sln" by default
        argv.unshift(gyp.opts.solution || 'bindings.sln')
      }
    }

    var proc = gyp.spawn(command, argv)
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
