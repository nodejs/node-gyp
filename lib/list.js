
module.exports = exports = list

exports.usage = 'Prints a listing of the currently installed node development files'

/**
 * Module dependencies.
 */

var fs = require('fs')
  , path = require('path')

function list (gyp, args, callback) {

  // TODO: Make ~/.node-gyp configurable
  var nodeGypDir = path.join(process.env.HOME, '.node-gyp')
    , currentPath = path.join(nodeGypDir, 'current')

  gyp.verbose('using node-gyp dir', nodeGypDir)

  // Read the 'current' version, and readdir the node-gyp dir
  fs.readFile(currentPath, 'ascii', oncurrent)
  fs.readdir(nodeGypDir, onreaddir)

  var gotCurrent = false
    , gotReaddir = false
    , versions
    , current

  function oncurrent (err, _current) {
    if (err && err.code != 'ENOENT') {
      return callback(err)
    }
    gotCurrent = true
    if (typeof _current == 'string') {
      current = parseFloat(_current.trim())
    }
    if (gotReaddir) go()
  }

  function onreaddir (err, _versions) {
    if (err) return callback(err)
    gotReaddir = true
    versions = _versions.filter(function (v) { return v != 'current' })
    if (gotCurrent) go()
  }

  function go () {
    versions.forEach(function (version) {
      var isCurrent = current == version
    })
    callback(null, versions, current)
  }
}
