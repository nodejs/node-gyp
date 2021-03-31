'use strict'

const fs = require('graceful-fs')
const rimraf = require('rimraf')
const util = require('util')
const path = require('path')
const log = require('npmlog')
const semver = require('semver')

async function remove (gyp, argv) {
  log.verbose('remove', 'using node-gyp dir:', gyp.devDir)

  // get the user-specified version to remove
  let version = argv[0] || gyp.opts.target
  log.verbose('remove', 'removing target version:', version)

  if (!version) {
    throw new Error(`You must specify a version number to remove. Ex: "${process.version}"`)
  }

  const versionSemver = semver.parse(version)
  if (versionSemver) {
    // flatten the version Array into a String
    version = versionSemver.version
  }

  const versionPath = path.resolve(gyp.devDir, version)
  log.verbose('remove', 'removing development files for version:', version)

  // first check if its even installed
  try {
    await fs.promises.stat(versionPath)
  } catch (err) {
    if (err) {
      if (err.code === 'ENOENT') {
        return 'version was already uninstalled: ' + version
      }
      throw err
    }
  }

  // Go ahead and delete the dir
  return util.promisify(rimraf)(versionPath)
}

module.exports = function (gyp, argv, callback) {
  remove(gyp, argv).then(callback.bind(undefined, null), callback)
}
module.exports.usage = 'Removes the node development files for the specified version'
