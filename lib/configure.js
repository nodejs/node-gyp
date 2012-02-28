
module.exports = exports = configure

/**
 * Module dependencies.
 */

var fs = require('fs')
  , path = require('path')
  , glob = require('glob')
  , createHook = require('./util/hook')
  , asyncEmit = require('./util/asyncEmit')
  , nodeVersion = require('./util/node_version')
  , win = process.platform == 'win32'

exports.usage = 'Generates ' + (win ? 'MSVC project files' : 'a Makefile') + ' for the current module'

function configure (gyp, argv, callback) {

  var python = gyp.opts.python || 'python'
    , emitter
    , version

  // Very first step is to load up the user-defined 'gyp-configure.js' file if it
  // exists. We relay filecycle events using the eventemitter returned from this
  createHook('gyp-configure.js', function (err, _e) {
    if (err) return callback(err)
    emitter = _e
    getVersion()
  })

  function getVersion () {
    if (gyp.opts.target) {
      // if --target was given, then ensure that version is installed
      version = nodeVersion.parse(gyp.opts.target)
      gyp.verbose('compiling against --target node version', version)
    } else {
      // if no --target was specified then use the current host node version
      version = nodeVersion.parse(process.versions.node)
      gyp.verbose('no --target version specified, falling back to host node version', version)
    }
    gyp.opts.ensure = true
    gyp.commands.install([ version ], go)
  }

  function go (err) {
    if (err) return callback(err)

    var devDir = path.resolve(process.env.HOME, '.node-gyp', version)
      , gyp_addon = path.resolve(devDir, 'tools', 'gyp_addon')

    if (!win && !~argv.indexOf('-f') && !~argv.indexOf('--format')) {
      gyp.verbose('gyp format was not specified; forcing "make"')
      // force the 'make' target for non-Windows
      argv.unshift('make')
      argv.unshift('-f')
    }

    var hasArch = argv.some(function (arg) {
      return arg.indexOf('-Dtarget_arch') === 0
    })
    // was --arch specified?
    if (!hasArch && gyp.opts.arch) {
      gyp.verbose('using the architecture specified by --arch', gyp.opts.arch)
      argv.push('-Dtarget_arch=' + gyp.opts.arch)
      hasArch = true
    }

    // this may need to be tweaked for windows and stuff, we'll see...
    if (!hasArch) {
      // on < 0.8 the target_arch variable is set to ia32 by default unless
      // overridden, so we have to explicitly specify the arch here
      gyp.verbose('target arch not specified, using the current host architecture', process.arch)
      argv.push('-Dtarget_arch=' + process.arch)
      gyp.opts.arch = process.arch
      hasArch = true
    }

    // execute `gyp_addon` from the current target node version
    argv.unshift(gyp_addon)

    asyncEmit(emitter, 'before', function (err) {
      if (err) return callback(err)

      var cp = gyp.spawn(python, argv)
      cp.on('exit', onCpExit)
    })
  }

  /**
   * Called when the `gyp_addon` child process exits.
   */

  function onCpExit (code, signal) {
    asyncEmit(emitter, 'after', function (err) {
      if (err) {
        callback(err)
      } else if (code !== 0) {
        callback(new Error('`gyp_addon` failed with exit code: ' + code))
      } else {
        // we're done
        callback()
      }
    })
  }

}
