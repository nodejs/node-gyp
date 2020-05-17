'use strict'

const usage = 'Removes any generated build files and the "out" dir'

const log = require('npmlog')
const { promisify } = require('util')
const rm = promisify(require('rimraf'))

async function clean (gyp, argv) {
  // Remove the 'build' dir
  const buildDir = 'build'
  log.verbose('clean', 'removing "%s" directory', buildDir)
  await rm(buildDir)
}

module.exports = clean
module.exports.usage = usage
