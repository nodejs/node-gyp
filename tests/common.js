const { cache } = require('env-paths')('node-gyp', { suffix: '' })
const semver = require('semver')

module.exports = {
  devDir: cache,

  poison (object, property) {
    const fail = () => {
      console.error(new Error(`Property ${property} should not have been accessed.`))
      process.abort()
    }
    Object.defineProperty(object, property, { configurable: false, enumerable: false, get: fail, set: fail })
  },

  FULL_TEST: process.env.FULL_TEST === '1' && process.release.name === 'node' && !semver.prerelease(process.version),

  platformTimeout (def, obj) {
    const platformTimeout = obj[process.platform]
    return platformTimeout ? platformTimeout * 60 * 1000 : def * 60 * 1000
  }
}
