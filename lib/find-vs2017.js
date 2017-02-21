const log = require('npmlog')
  , execSync = require('child_process').execSync
  , path = require('path')

var hasCache = false
  , cache = null

function findVS2017() {
  if (hasCache)
    return cache

  hasCache = true

  const ps = 'PowerShell -ExecutionPolicy Unrestricted -Command '
  const csFile = path.join(__dirname, 'Find-VS2017.cs')
  const psQuery = ps + '"&{Add-Type -Path \'' + csFile + '\'; [VisualStudioConfiguration.Main]::Query()}" 2>&1'

  var vsSetup
  try {
    const vsSetupRaw = execSync(psQuery, { encoding: 'utf8' })
    log.silly('find vs2017', 'vsSetupRaw:', vsSetupRaw)
    vsSetup = JSON.parse(vsSetupRaw)
    log.silly('find vs2017', 'vsSetup:', vsSetup)
  } catch (e) {
    log.silly('find vs2017', e)
    log.verbose('find vs2017', 'could not use PowerShell to find VS2017')
    return cache
  }

  if (vsSetup && vsSetup.log)
    log.verbose('find vs2017', vsSetup.log.trimRight())

  if (!vsSetup || !vsSetup.path || !vsSetup.sdk) {
    log.verbose('find vs2017', 'no usable installation found')
    return cache
  }

  cache = {
    "path": vsSetup.path,
    "sdk": vsSetup.sdk
  }

  log.verbose('find vs2017', 'using installation:', cache.path)
  return cache
}

module.exports = findVS2017
