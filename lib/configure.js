
module.exports = exports = configure

/**
 * Module dependencies.
 */

var path = require('path')
  , win = process.platform == 'win32'

exports.usage = 'Creates the project files to build the native addon.'

function configure (gyp, argv, callback) {

  //console.error(gyp.opts)
  //console.error(argv)
  //console.error(gyp.argv)

  // TODO: Really detect the latest version
  if (!gyp.opts.target) {
    gyp.opts.target = 0.7
  }

  // TODO: Don't always install, check if this version is installed first
  gyp.commands.install([gyp.opts.target], go)

  function go () {
    console.error('starting "configure"')

    // TODO: Detect and add support for a "current" dev version,
    //       so `target` would be implicit.
    var target = String(gyp.opts.target)
      , devDir = path.join(process.env.HOME, '.node-gyp', target)
      , gyp_addon = path.join(devDir, 'tools', 'gyp_addon')

    // Force the 'make' target for non-Windows
    if (!win) {
      argv.unshift('make')
      argv.unshift('-f')
    }

    //console.error(gyp_addon)
    var cp = gyp.spawn(gyp_addon, argv)

    cp.on('exit', function (code, signal) {
      if (code !== 0) {
        callback(new Error('`gyp_addon` failed with exit code: ' + code))
      }
    })

  }

}
