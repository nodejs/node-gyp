'use strict'

const fs = require('fs/promises')
const log = require('./log')

async function clean (gyp, argv) {
  // Remove the 'build' dir
  const buildDir = 'build'

  log.verbose('clean', 'removing "%s" directory', buildDir)
  await fs.rm(buildDir, { recursive: true, force: true })
}

module.exports = function (gyp, argv, callback) {
  clean(gyp, argv).then(callback.bind(undefined, null), callback)
}
module.exports.usage = 'Removes any generated build files and the "out" dir'
