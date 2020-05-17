'use strict'

const log = require('npmlog')
const { execFile } = require('child_process')
const { win32: path } = require('path')
const { logWithPrefix, regSearchKeys } = require('./util')

function findVisualStudio (nodeSemver, configMsvsVersion, callback) {
  const finder = new VisualStudioFinder(nodeSemver, configMsvsVersion,
    callback)
  finder.findVisualStudio()
}

class VisualStudioFinder {
  constructor (nodeSemver, configMsvsVersion, callback) {
    this.nodeSemver = nodeSemver
    this.configMsvsVersion = configMsvsVersion
    this.callback = callback
    this.errorLog = []
    this.validVersions = []

    this.log = logWithPrefix(log, 'find VS')
    this.regSearchKeys = regSearchKeys
  }

  // Logs a message at verbose level, but also saves it to be displayed later
  // at error level if an error occurs. This should help diagnose the problem.
  addLog (message) {
    this.log.verbose(message)
    this.errorLog.push(message)
  }

  async findVisualStudio () {
    this.configVersionYear = null
    this.configPath = null
    if (this.configMsvsVersion) {
      this.addLog('msvs_version was set from command line or npm config')
      if (this.configMsvsVersion.match(/^\d{4}$/)) {
        this.configVersionYear = parseInt(this.configMsvsVersion, 10)
        this.addLog(`- looking for Visual Studio version ${this.configVersionYear}`)
      } else {
        this.configPath = path.resolve(this.configMsvsVersion)
        this.addLog(`- looking for Visual Studio installed in "${this.configPath}"`)
      }
    } else {
      this.addLog('msvs_version not set from command line or npm config')
    }

    if (process.env.VCINSTALLDIR) {
      this.envVcInstallDir = path.resolve(process.env.VCINSTALLDIR, '..')
      this.addLog('running in VS Command Prompt, installation path is:\n' +
        `"${this.envVcInstallDir}"\n- will only use this version`)
    } else {
      this.addLog('VCINSTALLDIR not set, not running in VS Command Prompt')
    }

    let info = await this.findVisualStudio2017OrNewer()
    if (info) {
      return this.succeed(info)
    }
    info = await this.findVisualStudio2015()
    if (info) {
      return this.succeed(info)
    }
    info = await this.findVisualStudio2013()
    if (info) {
      return this.succeed(info)
    }
    this.fail()
  }

  succeed (info) {
    this.log.info(`using VS${info.versionYear} (${info.version}) found at:` +
                  `\n"${info.path}"` +
                  '\nrun with --verbose for detailed information')
    return info
  }

  fail () {
    if (this.configMsvsVersion && this.envVcInstallDir) {
      this.errorLog.push(
        'msvs_version does not match this VS Command Prompt or the',
        'installation cannot be used.')
    } else if (this.configMsvsVersion) {
      // If msvs_version was specified but finding VS failed, print what would
      // have been accepted
      this.errorLog.push('')
      if (this.validVersions) {
        this.errorLog.push('valid versions for msvs_version:')
        this.validVersions.forEach((version) => {
          this.errorLog.push(`- "${version}"`)
        })
      } else {
        this.errorLog.push('no valid versions for msvs_version were found')
      }
    }

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

    throw new Error('Could not find any Visual Studio installation to use')
  }

  // Invoke the PowerShell script to get information about Visual Studio 2017
  // or newer installations
  async findVisualStudio2017OrNewer () {
    const ps = path.join(process.env.SystemRoot,
      'System32\\WindowsPowerShell\\v1.0\\powershell.exe')
    const csFile = path.join(__dirname, 'Find-VisualStudio.cs')
    const psArgs = [
      '-ExecutionPolicy',
      'Unrestricted',
      '-NoProfile',
      '-Command',
      `&{Add-Type -Path '${csFile}';[VisualStudioConfiguration.Main]::PrintJson()}`
    ]

    this.log.silly('Running', ps, psArgs)
    const { stdout, stderr } = await new Promise((resolve, reject) => {
      const child = execFile(ps, psArgs, { encoding: 'utf8' }, (err, stdout, stderr) => {
        if (err) {
          this.log.silly('PS err = %j', err && (err.stack || err))
          this.addLog('could not use PowerShell to find Visual Studio 2017 or newer')
          return reject(err)
        }
        resolve({ stdout, stderr })
      })
      child.stdin.end()
    })

    return this.parseData(stdout, stderr)
  }

  // Parse the output of the PowerShell script and look for an installation
  // of Visual Studio 2017 or newer to use
  parseData (stdout, stderr) {
    this.log.silly('PS stderr = %j', stderr)

    const failPowershell = () => {
      this.addLog('could not use PowerShell to find Visual Studio 2017 or newer')
      return null
    }

    let vsInfo
    try {
      vsInfo = JSON.parse(stdout)
    } catch (e) {
      this.log.silly('PS stdout = %j', stdout)
      this.log.silly(e)
      return failPowershell()
    }

    if (!Array.isArray(vsInfo)) {
      this.log.silly('PS stdout = %j', stdout)
      return failPowershell()
    }

    vsInfo = vsInfo.map((info) => {
      this.log.silly(`processing installation: "${info.path}"`)
      info.path = path.resolve(info.path)
      const ret = this.getVersionInfo(info)
      ret.path = info.path
      ret.msBuild = this.getMSBuild(info, ret.versionYear)
      ret.toolset = this.getToolset(info, ret.versionYear)
      ret.sdk = this.getSDK(info)
      return ret
    })
    this.log.silly('vsInfo:', vsInfo)

    // Remove future versions or errors parsing version number
    vsInfo = vsInfo.filter((info) => {
      if (info.versionYear) {
        return true
      }
      this.addLog(`unknown version "${info.version}" found at "${info.path}"`)
      return false
    })

    // Sort to place newer versions first
    vsInfo.sort((a, b) => b.versionYear - a.versionYear)

    for (let i = 0; i < vsInfo.length; ++i) {
      const info = vsInfo[i]
      this.addLog(
        `checking VS${info.versionYear} (${info.version}) found at:\n"${info.path}"`)

      if (info.msBuild) {
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

      if (!this.checkConfigVersion(info.versionYear, info.path)) {
        continue
      }

      return info
    }

    this.addLog('could not find a version of Visual Studio 2017 or newer to use')
  }

  // Helper - process version information
  getVersionInfo (info) {
    const match = /^(\d+)\.(\d+)\..*/.exec(info.version)
    if (!match) {
      this.log.silly('- failed to parse version:', info.version)
      return {}
    }
    this.log.silly('- version match = %j', match)
    const ret = {
      version: info.version,
      versionMajor: parseInt(match[1], 10),
      versionMinor: parseInt(match[2], 10)
    }
    if (ret.versionMajor === 15) {
      ret.versionYear = 2017
      return ret
    }
    if (ret.versionMajor === 16) {
      ret.versionYear = 2019
      return ret
    }
    this.log.silly('- unsupported version:', ret.versionMajor)
    return {}
  }

  // Helper - process MSBuild information
  getMSBuild (info, versionYear) {
    const pkg = 'Microsoft.VisualStudio.VC.MSBuild.Base'
    if (info.packages.indexOf(pkg) !== -1) {
      this.log.silly('- found VC.MSBuild.Base')
      if (versionYear === 2017) {
        return path.join(info.path, 'MSBuild\\15.0\\Bin\\MSBuild.exe')
      }
      if (versionYear === 2019) {
        return path.join(info.path, 'MSBuild\\Current\\Bin\\MSBuild.exe')
      }
    }
    return null
  }

  // Helper - process toolset information
  getToolset (info, versionYear) {
    const pkg = 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64'
    const express = 'Microsoft.VisualStudio.WDExpress'

    if (info.packages.indexOf(pkg) !== -1) {
      this.log.silly('- found VC.Tools.x86.x64')
    } else if (info.packages.indexOf(express) !== -1) {
      this.log.silly('- found Visual Studio Express (looking for toolset)')
    } else {
      return null
    }

    if (versionYear === 2017) {
      return 'v141'
    } else if (versionYear === 2019) {
      return 'v142'
    }
    this.log.silly('- invalid versionYear:', versionYear)
    return null
  }

  // Helper - process Windows SDK information
  getSDK (info) {
    const win8SDK = 'Microsoft.VisualStudio.Component.Windows81SDK'
    const win10SDKPrefix = 'Microsoft.VisualStudio.Component.Windows10SDK.'

    let Win10SDKVer = 0
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

  // Find an installation of Visual Studio 2015 to use
  async findVisualStudio2015 () {
    return this.findOldVS({
      version: '14.0',
      versionMajor: 14,
      versionMinor: 0,
      versionYear: 2015,
      toolset: 'v140'
    })
  }

  // Find an installation of Visual Studio 2013 to use
  async findVisualStudio2013 () {
    if (this.nodeSemver.major >= 9) {
      this.addLog(
        'not looking for VS2013 as it is only supported up to Node.js 8')
      return null
    }
    return this.findOldVS({
      version: '12.0',
      versionMajor: 12,
      versionMinor: 0,
      versionYear: 2013,
      toolset: 'v120'
    })
  }

  // Helper - common code for VS2013 and VS2015
  async findOldVS (info) {
    const regVC7 = ['HKLM\\Software\\Microsoft\\VisualStudio\\SxS\\VC7',
      'HKLM\\Software\\Wow6432Node\\Microsoft\\VisualStudio\\SxS\\VC7']
    const regMSBuild = 'HKLM\\Software\\Microsoft\\MSBuild\\ToolsVersions'

    this.addLog(`looking for Visual Studio ${info.versionYear}`)
    let res
    try {
      res = await this.regSearchKeys(regVC7, info.version, [])
    } catch (err) {
      this.addLog('- not found')
      return null
    }

    const vsPath = path.resolve(res, '..')
    this.addLog(`- found in "${vsPath}"`)

    const msBuildRegOpts = process.arch === 'ia32' ? [] : ['/reg:32']
    try {
      res = await this.regSearchKeys([`${regMSBuild}\\${info.version}`], 'MSBuildToolsPath', msBuildRegOpts)
    } catch (err) {
      this.addLog(
        '- could not find MSBuild in registry for this version')
      return null
    }

    const msBuild = path.join(res, 'MSBuild.exe')
    this.addLog(`- MSBuild in "${msBuild}"`)

    if (!this.checkConfigVersion(info.versionYear, vsPath)) {
      return null
    }

    info.path = vsPath
    info.msBuild = msBuild
    info.sdk = null
    return info
  }

  // After finding a usable version of Visual Stuido:
  // - add it to validVersions to be displayed at the end if a specific
  //   version was requested and not found;
  // - check if this is the version that was requested.
  // - check if this matches the Visual Studio Command Prompt
  checkConfigVersion (versionYear, vsPath) {
    this.validVersions.push(versionYear)
    this.validVersions.push(vsPath)

    if (this.configVersionYear && this.configVersionYear !== versionYear) {
      this.addLog('- msvs_version does not match this version')
      return false
    }
    if (this.configPath && path.relative(this.configPath, vsPath) !== '') {
      this.addLog('- msvs_version does not point to this installation')
      return false
    }
    if (this.envVcInstallDir && path.relative(this.envVcInstallDir, vsPath) !== '') {
      this.addLog('- does not match this Visual Studio Command Prompt')
      return false
    }

    return true
  }
}

module.exports = findVisualStudio
module.exports.test = {
  VisualStudioFinder: VisualStudioFinder,
  findVisualStudio: findVisualStudio
}
