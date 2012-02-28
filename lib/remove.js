
module.exports = exports = remove

exports.usage = 'Removes the node development files for the specified version'

/**
 * Module dependencies.
 */

var fs = require('fs')
  , rm = require('rimraf')
  , path = require('path')
  , nodeVersion = require('./util/node_version')

function remove (gyp, argv, callback) {

  // TODO: Make ~/.node-gyp configurable
  var nodeGypDir = path.resolve(process.env.HOME, '.node-gyp')

  gyp.verbose('using node-gyp dir', nodeGypDir)

  var version = nodeVersion.parse(argv[0] || gyp.opts.target)
    , versionPath = path.resolve(nodeGypDir, version)

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
    rm(versionPath, callback)
  })

}
