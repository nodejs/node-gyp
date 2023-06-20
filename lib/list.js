'use strict'

const fs = require('graceful-fs')
const log = require('./log')

function list (gyp, args, callback) {
  const devDir = gyp.devDir
  log.verbose('list', 'using node-gyp dir:', devDir)

  fs.readdir(devDir, onreaddir)

  function onreaddir (err, versions) {
    if (err && err.code !== 'ENOENT') {
      return callback(err)
    }

    if (Array.isArray(versions)) {
      versions = versions.filter(function (v) { return v !== 'current' })
    } else {
      versions = []
    }
    callback(null, versions)
  }
}

module.exports = list
module.exports.usage = 'Prints a listing of the currently installed node development files'
