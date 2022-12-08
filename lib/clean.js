'use strict'

const rm = require('rimraf')
const log = require('./log')

function clean (gyp, argv, callback) {
  // Remove the 'build' dir
  const buildDir = 'build'

  log.verbose('clean', 'removing "%s" directory', buildDir)
  rm(buildDir, callback)
}

module.exports = clean
module.exports.usage = 'Removes any generated build files and the "out" dir'
