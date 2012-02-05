
module.exports = exports = use

exports.usage = 'Sets the specified version as the default node version to compile against'

/**
 * Module dependencies.
 */

var fs = require('fs')
  , path = require('path')

function use (gyp, argv, callback) {

  // TODO: Make ~/.node-gyp configurable
  var nodeGypDir = path.join(process.env.HOME, '.node-gyp')
    , currentPath = path.join(nodeGypDir, 'current')

  gyp.verbose('using node-gyp dir', nodeGypDir)

  var version = parseFloat(argv[0] || gyp.opts.target)
    , versionPath = path.join(nodeGypDir, version.toString())

  gyp.verbose('setting to version', version)

  fs.stat(versionPath, function (err, stat) {
    if (err) {
      if (err.code == 'ENOENT') {
        gyp.verbose('need to install devlopment files for version', version)
        gyp.commands.install([ version ], afterInstall)
      } else {
        callback(err)
      }
      return
    }
    afterInstall()
  })

  function afterInstall (err) {
    if (err) return callback(err)
    fs.writeFile(currentPath, version + '\n', callback)
  }
}
