
module.exports = exports = configure

/**
 * Module dependencies.
 */

var path = require('path')
  , win = process.platform == 'win32'

exports.usage = 'Generates ' + (win ? 'MSVC project files' : 'a Makefile') + ' for the current module'

function configure (gyp, argv, callback) {

  var python = gyp.opts.python || 'python'
    , version

  if (gyp.opts.target) {
    // if '--target=x.x' was given, then ensure that version is installed
    version = parseFloat(gyp.opts.target)
    gyp.opts.ensure = true
    gyp.commands.install([ version ], go)
  } else {
    // otherwise look up the 'current' version
    gyp.commands.current([], function (err, _version) {
      if (err) return callback(err)
      if (!_version) return callback(new Error('No dev files installed. Run `node-gyp use x.x` where "x.x" is a node version like "0.7"'))
      version = _version
      go()
    })
  }


  function go (err) {
    if (err) return callback(err)

    var target = String(version)
      , devDir = path.join(process.env.HOME, '.node-gyp', target)
      , gyp_addon = path.join(devDir, 'tools', 'gyp_addon')

    if (win) {
      // add a <= version check when joyent/node#2685 gets merged
      argv.push('-Dnode_root_dir="' + devDir + '"')
      argv.push('-I')
      argv.push(path.join(devDir, 'tools', 'patch.gypi'))
    } else {
      // Force the 'make' target for non-Windows
      argv.unshift('make')
      argv.unshift('-f')
    }

    argv.unshift(gyp_addon)
    var cp = gyp.spawn(python, argv)

    cp.on('exit', function (code, signal) {
      if (code !== 0) {
        callback(new Error('`gyp_addon` failed with exit code: ' + code))
      } else {
        callback()
      }
    })

  }

}
