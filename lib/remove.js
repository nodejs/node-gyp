
module.exports = exports = remove

exports.usage = 'Removes the node development files for the specified version'

/**
 * Module dependencies.
 */

var fs = require('fs')
  , rm = require('rimraf')
  , path = require('path')

function remove (gyp, argv, callback) {

  // TODO: Make ~/.node-gyp configurable
  var nodeGypDir = path.join(process.env.HOME, '.node-gyp')

  gyp.verbose('using node-gyp dir', nodeGypDir)

  var version = parseFloat(argv[0] || gyp.opts.target)
    , versionPath = path.join(nodeGypDir, version.toString())

  gyp.verbose('removing development files for version', version)

  fs.stat(versionPath, function (err, stat) {
    if (err) {
      if (err.code == 'ENOENT') {
        gyp.info('version was already not installed', version)
        callback()
      } else {
        callback(err)
      }
      return
    }
    // Go ahead and delete the dir
    rm(versionPath, afterRm)
  })

  function afterRm (err) {
    if (err) return callback(err)
    // Get the current version, if the match, then delete the version
    gyp.commands.current([], onCurrent)
  }

  function onCurrent (err, cur) {
    if (err) return callback(err)
    if (cur == version) {
      gyp.verbose('"current" version matches, removing `current` file')
      // Versions match, delete the 'current' file
      var currentPath = path.join(nodeGypDir, 'current')
      rm(currentPath, function (err) {
        if (err) return callback(err)
        // Now that there's no 'current', "use" the first installed version, if
        // available
        gyp.commands.list([], function (err, versions) {
          if (err) return callback(err)
          if (versions.length === 0) {
            gyp.verbose('no other dev versions installed to "use"')
            callback()
            return
          }
          gyp.verbose('changing the "use" other version', versions[0])
          gyp.commands.use([ versions[0] ], function (err) {
            if (err) return callback(err)
            callback()
          })
        })
      })
    } else {
      // no match, so were done
      callback()
    }
  }
}
