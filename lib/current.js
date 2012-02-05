
module.exports = exports = current

exports.usage = 'Gets the currently set version of node to compile against'

/**
 * Module dependencies.
 */

var fs = require('fs')
  , path = require('path')

function current (gyp, argv, callback) {

  // TODO: Make ~/.node-gyp configurable
  var nodeGypDir = path.join(process.env.HOME, '.node-gyp')
    , currentPath = path.join(nodeGypDir, 'current')

  fs.readFile(currentPath, 'ascii', function (err, version) {
    if (err && err.code != 'ENOENT') {
      return callback(err)
    }
    if (version) version = parseFloat(version.trim())
    callback(null, version)
  })
}
