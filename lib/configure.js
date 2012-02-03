
module.exports = exports = configure

/**
 * Module dependencies.
 */

var path = require('path')
  , spawn = require('child_process').spawn
  , win = process.platform == 'win32'

exports.usage = 'Creates the project files to build the native addon.'

function configure (gyp, argv, callback) {

  //console.error(gyp.opts)
  //console.error(argv)
  //console.error(gyp.argv)

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

  var cp = spawn(gyp_addon, argv, {
      customFds: [ 0, 1, 2 ]
  })

  cp.on('end', function () {
    console.error('end')
  })

}
