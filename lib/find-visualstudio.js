module.exports = exports = findVisualStudio
module.exports.test = {
  VisualStudioFinder: VisualStudioFinder,
  findVisualStudio: findVisualStudio
}

const log = require('npmlog')
const execFile = require('child_process').execFile
const path = require('path').win32
const logWithPrefix = require('./util').logWithPrefix

function findVisualStudio (callback) {
  const finder = new VisualStudioFinder(callback)
  finder.findVisualStudio()
}

function VisualStudioFinder (callback) {
  this.callback = callback
  this.errorLog = []
}

VisualStudioFinder.prototype = {
  log: logWithPrefix(log, 'find VS'),

  // Logs a message at verbose level, but also saves it to be displayed later
  // at error level if an error occurs. This should help diagnose the problem.
  addLog: function addLog (message) {
    this.log.verbose(message)
    this.errorLog.push(message)
  },

  findVisualStudio: function findVisualStudio () {
    var ps = path.join(process.env.SystemRoot, 'System32',
      'WindowsPowerShell', 'v1.0', 'powershell.exe')
    var csFile = path.join(__dirname, 'Find-VisualStudio.cs')
    var psArgs = ['-ExecutionPolicy', 'Unrestricted', '-NoProfile',
      '-Command', '&{Add-Type -Path \'' + csFile + '\';' +
      '[VisualStudioConfiguration.Main]::PrintJson()}']

    this.log.silly('Running', ps, psArgs)
    var child = execFile(ps, psArgs, { encoding: 'utf8' },
      this.parseData.bind(this))
    child.stdin.end()
  },

  parseData: function parseData (err, stdout, stderr) {
    this.log.silly('PS stderr = %j', stderr)

    if (err) {
      this.log.silly('PS err = %j', err && (err.stack || err))
      return this.failPowershell()
    }

    var vsInfo
    try {
      vsInfo = JSON.parse(stdout)
    } catch (e) {
      this.log.silly('PS stdout = %j', stdout)
      this.log.silly(e)
      return this.failPowershell()
    }

    if (!Array.isArray(vsInfo)) {
      this.log.silly('PS stdout = %j', stdout)
      return this.failPowershell()
    }

    vsInfo = vsInfo.map((info) => {
      this.log.silly(`processing installation: "${info.path}"`)
      const versionYear = this.getVersionYear(info)
      return {
        path: info.path,
        version: info.version,
        versionYear: versionYear,
        hasMSBuild: this.getHasMSBuild(info),
        toolset: this.getToolset(info, versionYear),
        sdk: this.getSDK(info)
      }
    })
    this.log.silly('vsInfo:', vsInfo)

    // Remove future versions or errors parsing version number
    vsInfo = vsInfo.filter((info) => {
      if (info.versionYear) { return true }
      this.addLog(`unknown version "${info.version}" found at "${info.path}"`)
      return false
    })

    // Sort to place newer versions first
    vsInfo.sort((a, b) => b.versionYear - a.versionYear)

    for (var i = 0; i < vsInfo.length; ++i) {
      const info = vsInfo[i]
      this.addLog(`checking VS${info.versionYear} (${info.version}) found ` +
                  `at\n"${info.path}"`)

      if (info.hasMSBuild) {
        this.addLog('- found "Visual Studio C++ core features"')
      } else {
        this.addLog('- "Visual Studio C++ core features" missing')
        continue
      }

      if (info.toolset) {
        this.addLog(`- found VC++ toolset: ${info.toolset}`)
      } else {
        this.addLog('- missing any VC++ toolset')
        continue
      }

      if (info.sdk) {
        this.addLog(`- found Windows SDK: ${info.sdk}`)
      } else {
        this.addLog('- missing any Windows SDK')
        continue
      }

      this.succeed(info)
      return
    }

    this.fail()
  },

  succeed: function succeed (info) {
    this.log.info(`using VS${info.versionYear} (${info.version}) found ` +
                  `at\n"${info.path}"`)
    process.nextTick(this.callback.bind(null, null, info))
  },

  failPowershell: function failPowershell () {
    process.nextTick(this.callback.bind(null, new Error(
      'Could not use PowerShell to find Visual Studio')))
  },

  fail: function fail () {
    const errorLog = this.errorLog.join('\n')

    // For Windows 80 col console, use up to the column before the one marked
    // with X (total 79 chars including logger prefix, 62 chars usable here):
    //                                                               X
    const infoLog = [
      '**************************************************************',
      'You need to install the latest version of Visual Studio',
      'including the "Desktop development with C++" workload.',
      'For more information consult the documentation at:',
      'https://github.com/nodejs/node-gyp#on-windows',
      '**************************************************************'
    ].join('\n')

    this.log.error(`\n${errorLog}\n\n${infoLog}\n`)
    process.nextTick(this.callback.bind(null, new Error(
      'Could not find any Visual Studio installation to use')))
  },

  getVersionYear: function getVersionYear (info) {
    const version = parseInt(info.version, 10)
    if (version === 15) {
      return 2017
    }
    this.log.silly('- failed to parse version:', info.version)
    return null
  },

  getHasMSBuild: function getHasMSBuild (info) {
    const pkg = 'Microsoft.VisualStudio.VC.MSBuild.Base'
    return info.packages.indexOf(pkg) !== -1
  },

  getToolset: function getToolset (info, versionYear) {
    const pkg = 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64'
    if (info.packages.indexOf(pkg) !== -1) {
      this.log.silly('- found VC.Tools.x86.x64')
      if (versionYear === 2017) {
        return 'v141'
      }
    }
    return null
  },

  getSDK: function getSDK (info) {
    const win8SDK = 'Microsoft.VisualStudio.Component.Windows81SDK'
    const win10SDKPrefix = 'Microsoft.VisualStudio.Component.Windows10SDK.'

    var Win10SDKVer = 0
    info.packages.forEach((pkg) => {
      if (!pkg.startsWith(win10SDKPrefix)) {
        return
      }
      const parts = pkg.split('.')
      if (parts.length > 5 && parts[5] !== 'Desktop') {
        this.log.silly('- ignoring non-Desktop Win10SDK:', pkg)
        return
      }
      const foundSdkVer = parseInt(parts[4], 10)
      if (isNaN(foundSdkVer)) {
        // Microsoft.VisualStudio.Component.Windows10SDK.IpOverUsb
        this.log.silly('- failed to parse Win10SDK number:', pkg)
        return
      }
      this.log.silly('- found Win10SDK:', foundSdkVer)
      Win10SDKVer = Math.max(Win10SDKVer, foundSdkVer)
    })

    if (Win10SDKVer !== 0) {
      return `10.0.${Win10SDKVer}.0`
    } else if (info.packages.indexOf(win8SDK) !== -1) {
      this.log.silly('- found Win8SDK')
      return '8.1'
    }
    return null
  }
}
