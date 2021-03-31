'use strict'

const rm = require('rimraf')
const log = require('npmlog')
const util = require('util')

async function clean (gyp, argv) {
  // Remove the 'build' dir
  const buildDir = 'build'

  log.verbose('clean', 'removing "%s" directory', buildDir)
  return util.promisify(rm)(buildDir)
}

module.exports = function (gyp, argv, callback) {
  clean(gyp, argv).then(callback.bind(undefined, null), callback)
}
module.exports.usage = 'Removes any generated build files and the "out" dir'
