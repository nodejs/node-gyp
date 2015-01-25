var path = require('path')
  , url = require('url')
  , semver = require('semver')
  , win = process.platform == 'win32'
  , defaultDistUrl = 'http://nodejs.org/dist/'

// note: this does not support explicit 'version' setting where the platform
// is not 'node' (i.e. --target=1.0.3 won't pull down io.js)
function getRelease (gyp, version) {
  var versionObj = semver.parse(version || process.version)
    , versionStr
    , release

  if (!versionObj) {
    throw new Error('Invalid version number: ' + version)
  }

  if (versionObj.compare('0.8.0') < 0) {
    throw new Error('Minimum target version is `0.8.0` or greater. Got: ' + version)
  }

  versionStr = versionObj && ('v' + versionObj.version)
  release = {
    version: versionObj,
    versionStr: versionStr
  }

  if ((!version || version == process.version) && process.release) {
    release.name = process.release.name
    release.sourceUrl = process.release.sourceUrl
    // headersUrl
  } else {
    release.name = 'node'
    release.sourceUrl = defaultDistUrl + versionStr + '/node-' + release.versionStr + '.tar.gz'
  }

  // distributions starting with 0.10.0 contain sha256 checksums
  release.checksumAlgo = semver.gte(versionObj, '0.10.0') ? 'sha256' : 'sha1'
  release.shasumsFile = (release.checksumAlgo === 'sha256') ? 'SHASUMS256.txt' : 'SHASUMS.txt'
  
  var u = url.parse(release.sourceUrl)
  u.pathname = u.pathname.replace(/[^\/]+$/, release.shasumsFile)
  release.shasumsUrl = url.format(u)
  
  if (win) {
    if (process.release && process.release.libUrl)
      release.libUrl = process.release.libUrl
    else
      release.libUrl = defaultDistUrl + versionStr + '/' + (process.arch == 'x64' ? 'x64/' : '') + 'node.lib'
  }

  // the directory where the dev files will be installed, prefixed with
  // the platform name if !node
  release.devDir = path.resolve(gyp.devDir,
      (release.name != 'node' ? release.name + '-' : '') + release.version.version)

  return release
}

module.exports = getRelease