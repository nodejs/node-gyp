const envPaths = require('env-paths')
const semver = require('semver')

module.exports.devDir = () => envPaths('node-gyp', { suffix: '' }).cache

module.exports.poison = (object, property) => {
  function fail () {
    console.error(Error(`Property ${property} should not have been accessed.`))
    process.abort()
  }
  const descriptor = {
    configurable: false,
    enumerable: false,
    get: fail,
    set: fail
  }
  Object.defineProperty(object, property, descriptor)
}

module.exports.skip = process.env.FAST_TEST === '1' ||
  process.release.name !== 'node' ||
  semver.prerelease(process.version) !== null
