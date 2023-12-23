'use strict'

const { describe, it } = require('mocha')
const assert = require('assert')
const fs = require('fs')
const path = require('path')
const VisualStudioFinder = require('../lib/find-visualstudio')
const { poison } = require('./common')

const semverV1 = { major: 1, minor: 0, patch: 0 }

delete process.env.VCINSTALLDIR

class TestVisualStudioFinder extends VisualStudioFinder {
  async findVisualStudio () {
    try {
      return { err: null, info: await super.findVisualStudio() }
    } catch (err) {
      return { err, info: null }
    }
  }
}

describe('find-visualstudio', function () {
  it('VS2013', async function () {
    const finder = new TestVisualStudioFinder(semverV1, null)
    finder.findVisualStudio2017OrNewerUsingSetupModule = async() => {
      return null
    }
    finder.findVisualStudio2017OrNewer = async () => {
      return finder.parseData(new Error(), '', '')
    }
    finder.regSearchKeys = async (keys, value, addOpts) => {
      for (let i = 0; i < keys.length; ++i) {
        const fullName = `${keys[i]}\\${value}`
        switch (fullName) {
          case 'HKLM\\Software\\Microsoft\\VisualStudio\\SxS\\VC7\\14.0':
          case 'HKLM\\Software\\Wow6432Node\\Microsoft\\VisualStudio\\SxS\\VC7\\14.0':
            continue
          case 'HKLM\\Software\\Microsoft\\VisualStudio\\SxS\\VC7\\12.0':
            assert.ok(true, `expected search for registry value ${fullName}`)
            return 'C:\\VS2013\\VC\\'
          case 'HKLM\\Software\\Microsoft\\MSBuild\\ToolsVersions\\12.0\\MSBuildToolsPath':
            assert.ok(true, `expected search for registry value ${fullName}`)
            return 'C:\\MSBuild12\\'
          default:
            assert.fail(`unexpected search for registry value ${fullName}`)
        }
      }
      throw new Error()
    }

    const { err, info } = await finder.findVisualStudio()
    assert.strictEqual(err, null)
    assert.deepStrictEqual(info, {
      msBuild: 'C:\\MSBuild12\\MSBuild.exe',
      path: 'C:\\VS2013',
      sdk: null,
      toolset: 'v120',
      version: '12.0',
      versionMajor: 12,
      versionMinor: 0,
      versionYear: 2013
    })
  })

  it('VS2013 should not be found on new node versions', async function () {
    const finder = new TestVisualStudioFinder({
      major: 10,
      minor: 0,
      patch: 0
    }, null)

    finder.findVisualStudio2017OrNewerUsingSetupModule = async() => {
      return null
    }

    finder.findVisualStudio2017OrNewer = async () => {
      const file = path.join(__dirname, 'fixtures', 'VS_2017_Unusable.txt')
      const data = fs.readFileSync(file)
      const vsInfo = finder.parseData(null, data, '', { checkIsArray: true })
      return finder.processData(vsInfo)
    }
    finder.regSearchKeys = async (keys, value, addOpts) => {
      for (let i = 0; i < keys.length; ++i) {
        const fullName = `${keys[i]}\\${value}`
        switch (fullName) {
          case 'HKLM\\Software\\Microsoft\\VisualStudio\\SxS\\VC7\\14.0':
          case 'HKLM\\Software\\Wow6432Node\\Microsoft\\VisualStudio\\SxS\\VC7\\14.0':
            continue
          default:
            assert.fail(`unexpected search for registry value ${fullName}`)
        }
      }
      throw new Error()
    }

    const { err, info } = await finder.findVisualStudio()
    assert.ok(/find .* Visual Studio/i.test(err), 'expect error')
    assert.ok(!info, 'no data')
  })

  it('VS2015', async function () {
    const finder = new TestVisualStudioFinder(semverV1, null)

    finder.findVisualStudio2017OrNewerUsingSetupModule = async() => {
      return null
    }

    finder.findVisualStudio2017OrNewer = async () => {
      return finder.parseData(new Error(), '', '')
    }
    finder.regSearchKeys = async (keys, value, addOpts) => {
      for (let i = 0; i < keys.length; ++i) {
        const fullName = `${keys[i]}\\${value}`
        switch (fullName) {
          case 'HKLM\\Software\\Microsoft\\VisualStudio\\SxS\\VC7\\14.0':
            assert.ok(true, `expected search for registry value ${fullName}`)
            return 'C:\\VS2015\\VC\\'
          case 'HKLM\\Software\\Microsoft\\MSBuild\\ToolsVersions\\14.0\\MSBuildToolsPath':
            assert.ok(true, `expected search for registry value ${fullName}`)
            return 'C:\\MSBuild14\\'
          default:
            assert.fail(`unexpected search for registry value ${fullName}`)
        }
      }
      throw new Error()
    }
    const { err, info } = await finder.findVisualStudio()
    assert.strictEqual(err, null)
    assert.deepStrictEqual(info, {
      msBuild: 'C:\\MSBuild14\\MSBuild.exe',
      path: 'C:\\VS2015',
      sdk: null,
      toolset: 'v140',
      version: '14.0',
      versionMajor: 14,
      versionMinor: 0,
      versionYear: 2015
    })
  })

  it('error from PowerShell', async function () {
    const finder = new TestVisualStudioFinder(semverV1, null, null)

    finder.parseData(new Error(), '', '', (info) => {
      assert.ok(/use PowerShell/i.test(finder.errorLog[0]), 'expect error')
      assert.ok(!info, 'no data')
    })
  })

  it('empty output from PowerShell', async function () {
    const finder = new TestVisualStudioFinder(semverV1, null, null)

    finder.parseData(null, '', '', (info) => {
      assert.ok(/use PowerShell/i.test(finder.errorLog[0]), 'expect error')
      assert.ok(!info, 'no data')
    }, { checkIsArray: true })
  })

  it('output from PowerShell not JSON', async function () {
    const finder = new TestVisualStudioFinder(semverV1, null, null)

    finder.parseData(null, 'AAAABBBB', '', (info) => {
      assert.ok(/use PowerShell/i.test(finder.errorLog[0]), 'expect error')
      assert.ok(!info, 'no data')
    }, { checkIsArray: true })
  })

  it('wrong JSON from PowerShell', async function () {
    const finder = new TestVisualStudioFinder(semverV1, null, null)

    finder.parseData(null, '{}', '', (info) => {
      assert.ok(/use PowerShell/i.test(finder.errorLog[0]), 'expect error')
      assert.ok(!info, 'no data')
    }, { checkIsArray: true })
  })

  it('empty JSON from PowerShell', async function () {
    const finder = new TestVisualStudioFinder(semverV1, null, null)

    finder.parseData(null, '[]', '', (info) => {
      assert.ok(/find .* Visual Studio/i.test(finder.errorLog[0]), 'expect error')
      assert.ok(!info, 'no data')
    }, { checkIsArray: true })
  })

  it('future version', async function () {
    const finder = new TestVisualStudioFinder(semverV1, null, null)

    finder.parseData(null, JSON.stringify([{
      packages: [
        'Microsoft.VisualStudio.Component.VC.Tools.x86.x64',
        'Microsoft.VisualStudio.Component.Windows10SDK.17763',
        'Microsoft.VisualStudio.VC.MSBuild.Base'
      ],
      path: 'C:\\VS',
      version: '9999.9999.9999.9999'
    }]), '', (info) => {
      assert.ok(/unknown version/i.test(finder.errorLog[0]), 'expect error')
      assert.ok(/find .* Visual Studio/i.test(finder.errorLog[1]), 'expect error')
      assert.ok(!info, 'no data')
    }, { checkIsArray: true })
  })

  it('single unusable VS2017', async function () {
    const finder = new TestVisualStudioFinder(semverV1, null, null)

    const file = path.join(__dirname, 'fixtures', 'VS_2017_Unusable.txt')
    const data = fs.readFileSync(file)
    finder.parseData(null, data, '', (info) => {
      assert.ok(/checking/i.test(finder.errorLog[0]), 'expect error')
      assert.ok(/find .* Visual Studio/i.test(finder.errorLog[2]), 'expect error')
      assert.ok(!info, 'no data')
    }, { checkIsArray: true })
  })

  it('minimal VS2017 Build Tools', async function () {
    const finder = new TestVisualStudioFinder(semverV1, null)

    poison(finder, 'regSearchKeys')
    finder.findVisualStudio2017OrNewerUsingSetupModule = async() => {
      return null
    }
    finder.findVisualStudio2017OrNewer = async () => {
      const file = path.join(__dirname, 'fixtures',
        'VS_2017_BuildTools_minimal.txt')
      const data = fs.readFileSync(file)
      const vsInfo = finder.parseData(null, data, '', { checkIsArray: true })
      return finder.processData(vsInfo)
    }
    const { err, info } = await finder.findVisualStudio()
    assert.strictEqual(err, null)
    assert.deepStrictEqual(info, {
      msBuild: 'C:\\Program Files (x86)\\Microsoft Visual Studio\\2017\\' +
        'BuildTools\\MSBuild\\15.0\\Bin\\MSBuild.exe',
      path:
        'C:\\Program Files (x86)\\Microsoft Visual Studio\\2017\\BuildTools',
      sdk: '10.0.17134.0',
      toolset: 'v141',
      version: '15.9.28307.665',
      versionMajor: 15,
      versionMinor: 9,
      versionYear: 2017
    })
  })

  it('VS2017 Community with C++ workload', async function () {
    const finder = new TestVisualStudioFinder(semverV1, null)

    poison(finder, 'regSearchKeys')
    finder.findVisualStudio2017OrNewerUsingSetupModule = async() => {
      return null
    }
    finder.findVisualStudio2017OrNewer = async () => {
      const file = path.join(__dirname, 'fixtures',
        'VS_2017_Community_workload.txt')
      const data = fs.readFileSync(file)
      const vsInfo = finder.parseData(null, data, '', { checkIsArray: true })
      return finder.processData(vsInfo)
    }
    const { err, info } = await finder.findVisualStudio()
    assert.strictEqual(err, null)
    assert.deepStrictEqual(info, {
      msBuild: 'C:\\Program Files (x86)\\Microsoft Visual Studio\\2017\\' +
        'Community\\MSBuild\\15.0\\Bin\\MSBuild.exe',
      path:
        'C:\\Program Files (x86)\\Microsoft Visual Studio\\2017\\Community',
      sdk: '10.0.17763.0',
      toolset: 'v141',
      version: '15.9.28307.665',
      versionMajor: 15,
      versionMinor: 9,
      versionYear: 2017
    })
  })

  it('VS2017 Express', async function () {
    const finder = new TestVisualStudioFinder(semverV1, null)

    poison(finder, 'regSearchKeys')
    finder.findVisualStudio2017OrNewerUsingSetupModule = async() => {
      return null
    }
    finder.findVisualStudio2017OrNewer = async () => {
      const file = path.join(__dirname, 'fixtures', 'VS_2017_Express.txt')
      const data = fs.readFileSync(file)
      const vsInfo = finder.parseData(null, data, '', { checkIsArray: true })
      return finder.processData(vsInfo)
    }
    const { err, info } = await finder.findVisualStudio()
    assert.strictEqual(err, null)
    assert.deepStrictEqual(info, {
      msBuild: 'C:\\Program Files (x86)\\Microsoft Visual Studio\\2017\\' +
        'WDExpress\\MSBuild\\15.0\\Bin\\MSBuild.exe',
      path:
        'C:\\Program Files (x86)\\Microsoft Visual Studio\\2017\\WDExpress',
      sdk: '10.0.17763.0',
      toolset: 'v141',
      version: '15.9.28307.858',
      versionMajor: 15,
      versionMinor: 9,
      versionYear: 2017
    })
  })

  it('VS2019 Preview with C++ workload', async function () {
    const finder = new TestVisualStudioFinder(semverV1, null)

    poison(finder, 'regSearchKeys')
    finder.findVisualStudio2017OrNewerUsingSetupModule = async() => {
      return null
    }
    finder.findVisualStudio2017OrNewer = async () => {
      const file = path.join(__dirname, 'fixtures',
        'VS_2019_Preview.txt')
      const data = fs.readFileSync(file)
      const vsInfo = finder.parseData(null, data, '', { checkIsArray: true })
      return finder.processData(vsInfo)
    }
    const { err, info } = await finder.findVisualStudio()
    assert.strictEqual(err, null)
    assert.deepStrictEqual(info, {
      msBuild: 'C:\\Program Files (x86)\\Microsoft Visual Studio\\2019\\' +
        'Preview\\MSBuild\\Current\\Bin\\MSBuild.exe',
      path:
        'C:\\Program Files (x86)\\Microsoft Visual Studio\\2019\\Preview',
      sdk: '10.0.17763.0',
      toolset: 'v142',
      version: '16.0.28608.199',
      versionMajor: 16,
      versionMinor: 0,
      versionYear: 2019
    })
  })

  it('minimal VS2019 Build Tools', async function () {
    const finder = new TestVisualStudioFinder(semverV1, null)

    poison(finder, 'regSearchKeys')
    finder.findVisualStudio2017OrNewerUsingSetupModule = async() => {
      return null
    }
    finder.findVisualStudio2017OrNewer = async () => {
      const file = path.join(__dirname, 'fixtures',
        'VS_2019_BuildTools_minimal.txt')
      const data = fs.readFileSync(file)
      const vsInfo = finder.parseData(null, data, '', { checkIsArray: true })
      return finder.processData(vsInfo)
    }
    const { err, info } = await finder.findVisualStudio()
    assert.strictEqual(err, null)
    assert.deepStrictEqual(info, {
      msBuild: 'C:\\Program Files (x86)\\Microsoft Visual Studio\\2019\\' +
        'BuildTools\\MSBuild\\Current\\Bin\\MSBuild.exe',
      path:
        'C:\\Program Files (x86)\\Microsoft Visual Studio\\2019\\BuildTools',
      sdk: '10.0.17134.0',
      toolset: 'v142',
      version: '16.1.28922.388',
      versionMajor: 16,
      versionMinor: 1,
      versionYear: 2019
    })
  })

  it('VS2019 Community with C++ workload', async function () {
    const finder = new TestVisualStudioFinder(semverV1, null)

    poison(finder, 'regSearchKeys')
    finder.findVisualStudio2017OrNewerUsingSetupModule = async() => {
      return null
    }
    finder.findVisualStudio2017OrNewer = async () => {
      const file = path.join(__dirname, 'fixtures',
        'VS_2019_Community_workload.txt')
      const data = fs.readFileSync(file)
      const vsInfo = finder.parseData(null, data, '', { checkIsArray: true })
      return finder.processData(vsInfo)
    }
    const { err, info } = await finder.findVisualStudio()
    assert.strictEqual(err, null)
    assert.deepStrictEqual(info, {
      msBuild: 'C:\\Program Files (x86)\\Microsoft Visual Studio\\2019\\' +
        'Community\\MSBuild\\Current\\Bin\\MSBuild.exe',
      path:
        'C:\\Program Files (x86)\\Microsoft Visual Studio\\2019\\Community',
      sdk: '10.0.17763.0',
      toolset: 'v142',
      version: '16.1.28922.388',
      versionMajor: 16,
      versionMinor: 1,
      versionYear: 2019
    })
  })

  it('VS2022 Preview with C++ workload', async function () {
    const msBuildPath = process.arch === 'arm64'
      ? 'C:\\Program Files\\Microsoft Visual Studio\\2022\\' +
        'Community\\MSBuild\\Current\\Bin\\arm64\\MSBuild.exe'
      : 'C:\\Program Files\\Microsoft Visual Studio\\2022\\' +
        'Community\\MSBuild\\Current\\Bin\\MSBuild.exe'

    const finder = new TestVisualStudioFinder(semverV1, null)

    poison(finder, 'regSearchKeys')
    finder.msBuildPathExists = (path) => {
      return true
    }
    finder.findVisualStudio2017OrNewerUsingSetupModule = async() => {
      return null
    }
    finder.findVisualStudio2017OrNewer = async () => {
      const file = path.join(__dirname, 'fixtures',
        'VS_2022_Community_workload.txt')
      const data = fs.readFileSync(file)
      const vsInfo = finder.parseData(null, data, '', { checkIsArray: true })
      return finder.processData(vsInfo)
    }
    const { err, info } = await finder.findVisualStudio()
    assert.strictEqual(err, null)
    assert.deepStrictEqual(info, {
      msBuild: msBuildPath,
      path:
        'C:\\Program Files\\Microsoft Visual Studio\\2022\\Community',
      sdk: '10.0.22621.0',
      toolset: 'v143',
      version: '17.4.33213.308',
      versionMajor: 17,
      versionMinor: 4,
      versionYear: 2022
    })
  })

  it('VSSetup: VS2022 with C++ workload', async function () {
    const msBuildPath = process.arch === 'arm64'
      ? 'C:\\Program Files\\Microsoft Visual Studio\\2022\\' +
        'Enterprise\\MSBuild\\Current\\Bin\\arm64\\MSBuild.exe'
      : 'C:\\Program Files\\Microsoft Visual Studio\\2022\\' +
        'Enterprise\\MSBuild\\Current\\Bin\\MSBuild.exe'

    const finder = new TestVisualStudioFinder(semverV1, null)

    poison(finder, 'regSearchKeys')
    const expectedVSPath = 'C:\\Program Files\\Microsoft Visual Studio\\2022\\Enterprise'
    finder.msBuildPathExists = (path) => {
      if (path.startsWith(expectedVSPath) && path.endsWith('MSBuild.exe')) {
        return true
      }
      return false
    }
    finder.findVisualStudio2017OrNewer = async () => {
      throw new Error("findVisualStudio2017OrNewer shouldn't be called")
    }
    setupExecFixture(finder, 'VSSetup_VS_2022_workload.txt')
    const { err, info } = await finder.findVisualStudio()
    assert.strictEqual(err, null)
    assert.deepStrictEqual(info, {
      msBuild: msBuildPath,
      path:
        'C:\\Program Files\\Microsoft Visual Studio\\2022\\Enterprise',
      sdk: '10.0.22000.0',
      toolset: 'v143',
      version: '17.8.34330.188',
      versionMajor: 17,
      versionMinor: 8,
      versionYear: 2022
    })
  })

  it('VSSetup: VS2022 with C++ workload without SDK', async function () {
    const finder = new TestVisualStudioFinder(semverV1, null)
    finder.msBuildPathExists = (path) => {
      return true
    }
    finder.findVisualStudio2017OrNewer = async () => {
      return null
    }
    finder.findOldVS = async (info) => {
      return null
    }
    setupExecFixture(finder, 'VSSetup_VS_2022_workload_missing_sdk.txt')
    const { err, info } = await finder.findVisualStudio()
    assert.match(err.message, /could not find/i)
    assert.strictEqual(info, null)
  })

  it('VSSetup: VS2022 with multiple installations', async function () {
    const msBuildPath = process.arch === 'arm64'
      ? 'C:\\Program Files\\Microsoft Visual Studio\\2022\\' +
        'Enterprise\\MSBuild\\Current\\Bin\\arm64\\MSBuild.exe'
      : 'C:\\Program Files\\Microsoft Visual Studio\\2022\\' +
        'Enterprise\\MSBuild\\Current\\Bin\\MSBuild.exe'

    const finder = new TestVisualStudioFinder(semverV1, null)
    poison(finder, 'regSearchKeys')
    finder.msBuildPathExists = (path) => {
      return true
    }

    finder.msBuildPathExists = (path) => {
      return true
    }
    finder.findVisualStudio2017OrNewer = async () => {
      throw new Error("findVisualStudio2017OrNewer shouldn't be called")
    }
    setupExecFixture(finder, 'VSSetup_VS_2022_multiple_install.txt')
    const { err, info } = await finder.findVisualStudio()
    assert.strictEqual(err, null)
    assert.deepStrictEqual(info, {
      msBuild: msBuildPath,
      path:
        'C:\\Program Files\\Microsoft Visual Studio\\2022\\Enterprise',
      sdk: '10.0.22000.0',
      toolset: 'v143',
      version: '17.8.34330.188',
      versionMajor: 17,
      versionMinor: 8,
      versionYear: 2022
    })
  })

  function setupExecFixture (finder, fixtureName) {
    finder.execFile = async (exec, args) => {
      if (args.length > 2 && args[2].includes('Get-Module')) {
        return [null, '1.0.0', '']
      } else if (args.length > 2 && args.at(-1).includes('Get-VSSetupInstance')) {
        const file = path.join(__dirname, 'fixtures', fixtureName)
        return [null, fs.readFileSync(file), '']
      }
      return [new Error(), '', '']
    }
  }

  function allVsVersions (finder) {
    finder.findVisualStudio2017OrNewerUsingSetupModule = async () => {
      return null
    }

    finder.findVisualStudio2017OrNewer = async () => {
      const data0 = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures',
        'VS_2017_Unusable.txt')))
      const data1 = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures',
        'VS_2017_BuildTools_minimal.txt')))
      const data2 = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures',
        'VS_2017_Community_workload.txt')))
      const data3 = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures',
        'VS_2017_Express.txt')))
      const data4 = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures',
        'VS_2019_Preview.txt')))
      const data5 = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures',
        'VS_2019_BuildTools_minimal.txt')))
      const data6 = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures',
        'VS_2019_Community_workload.txt')))
      const data7 = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures',
        'VS_2022_Community_workload.txt')))
      const data = JSON.stringify(data0.concat(data1, data2, data3, data4,
        data5, data6, data7))
      const parsedData = finder.parseData(null, data, '', { checkIsArray: true })
      return finder.processData(parsedData)
    }
    finder.regSearchKeys = async (keys, value, addOpts) => {
      for (let i = 0; i < keys.length; ++i) {
        const fullName = `${keys[i]}\\${value}`
        switch (fullName) {
          case 'HKLM\\Software\\Microsoft\\VisualStudio\\SxS\\VC7\\14.0':
          case 'HKLM\\Software\\Microsoft\\VisualStudio\\SxS\\VC7\\12.0':
            continue
          case 'HKLM\\Software\\Wow6432Node\\Microsoft\\VisualStudio\\SxS\\VC7\\12.0':
            return 'C:\\VS2013\\VC\\'
          case 'HKLM\\Software\\Microsoft\\MSBuild\\ToolsVersions\\12.0\\MSBuildToolsPath':
            return 'C:\\MSBuild12\\'
          case 'HKLM\\Software\\Wow6432Node\\Microsoft\\VisualStudio\\SxS\\VC7\\14.0':
            return 'C:\\VS2015\\VC\\'
          case 'HKLM\\Software\\Microsoft\\MSBuild\\ToolsVersions\\14.0\\MSBuildToolsPath':
            return 'C:\\MSBuild14\\'
          default:
            assert.fail(`unexpected search for registry value ${fullName}`)
        }
      }
      throw new Error()
    }
  }

  it('fail when looking for invalid path', async function () {
    const finder = new TestVisualStudioFinder(semverV1, 'AABB')

    allVsVersions(finder)
    const { err, info } = await finder.findVisualStudio()
    assert.ok(/find .* Visual Studio/i.test(err), 'expect error')
    assert.ok(!info, 'no data')
  })

  it('look for VS2013 by version number', async function () {
    const finder = new TestVisualStudioFinder(semverV1, '2013')

    allVsVersions(finder)
    const { err, info } = await finder.findVisualStudio()
    assert.strictEqual(err, null)
    assert.deepStrictEqual(info.versionYear, 2013)
  })

  it('look for VS2013 by installation path', async function () {
    const finder = new TestVisualStudioFinder(semverV1, 'C:\\VS2013')

    allVsVersions(finder)
    const { err, info } = await finder.findVisualStudio()
    assert.strictEqual(err, null)
    assert.deepStrictEqual(info.path, 'C:\\VS2013')
  })

  it('look for VS2015 by version number', async function () {
    const finder = new TestVisualStudioFinder(semverV1, '2015')

    allVsVersions(finder)
    const { err, info } = await finder.findVisualStudio()
    assert.strictEqual(err, null)
    assert.deepStrictEqual(info.versionYear, 2015)
  })

  it('look for VS2015 by installation path', async function () {
    const finder = new TestVisualStudioFinder(semverV1, 'C:\\VS2015')

    allVsVersions(finder)
    const { err, info } = await finder.findVisualStudio()
    assert.strictEqual(err, null)
    assert.deepStrictEqual(info.path, 'C:\\VS2015')
  })

  it('look for VS2017 by version number', async function () {
    const finder = new TestVisualStudioFinder(semverV1, '2017')

    allVsVersions(finder)
    const { err, info } = await finder.findVisualStudio()
    assert.strictEqual(err, null)
    assert.deepStrictEqual(info.versionYear, 2017)
  })

  it('look for VS2017 by installation path', async function () {
    const finder = new TestVisualStudioFinder(semverV1,
      'C:\\Program Files (x86)\\Microsoft Visual Studio\\2017\\Community')

    allVsVersions(finder)
    const { err, info } = await finder.findVisualStudio()
    assert.strictEqual(err, null)
    assert.deepStrictEqual(info.path,
      'C:\\Program Files (x86)\\Microsoft Visual Studio\\2017\\Community')
  })

  it('look for VS2019 by version number', async function () {
    const finder = new TestVisualStudioFinder(semverV1, '2019')

    allVsVersions(finder)
    const { err, info } = await finder.findVisualStudio()
    assert.strictEqual(err, null)
    assert.deepStrictEqual(info.versionYear, 2019)
  })

  it('look for VS2019 by installation path', async function () {
    const finder = new TestVisualStudioFinder(semverV1,
      'C:\\Program Files (x86)\\Microsoft Visual Studio\\2019\\BuildTools')

    allVsVersions(finder)
    const { err, info } = await finder.findVisualStudio()
    assert.strictEqual(err, null)
    assert.deepStrictEqual(info.path,
      'C:\\Program Files (x86)\\Microsoft Visual Studio\\2019\\BuildTools')
  })

  it('look for VS2022 by version number', async function () {
    const finder = new TestVisualStudioFinder(semverV1, '2022')

    finder.msBuildPathExists = (path) => {
      return true
    }

    allVsVersions(finder)
    const { err, info } = await finder.findVisualStudio()
    assert.strictEqual(err, null)
    assert.deepStrictEqual(info.versionYear, 2022)
  })

  it('msvs_version match should be case insensitive', async function () {
    const finder = new TestVisualStudioFinder(semverV1,
      'c:\\program files (x86)\\microsoft visual studio\\2019\\BUILDTOOLS')

    allVsVersions(finder)
    const { err, info } = await finder.findVisualStudio()
    assert.strictEqual(err, null)
    assert.deepStrictEqual(info.path,
      'C:\\Program Files (x86)\\Microsoft Visual Studio\\2019\\BuildTools')
  })

  it('latest version should be found by default', async function () {
    const finder = new TestVisualStudioFinder(semverV1, null)

    finder.msBuildPathExists = (path) => {
      return true
    }

    allVsVersions(finder)
    const { err, info } = await finder.findVisualStudio()
    assert.strictEqual(err, null)
    assert.deepStrictEqual(info.versionYear, 2022)
  })

  it('run on a usable VS Command Prompt', async function () {
    process.env.VCINSTALLDIR = 'C:\\VS2015\\VC'
    // VSINSTALLDIR is not defined on Visual C++ Build Tools 2015
    delete process.env.VSINSTALLDIR

    const finder = new TestVisualStudioFinder(semverV1, null)

    allVsVersions(finder)
    const { err, info } = await finder.findVisualStudio()
    assert.strictEqual(err, null)
    assert.deepStrictEqual(info.path, 'C:\\VS2015')
  })

  it('VCINSTALLDIR match should be case insensitive', async function () {
    process.env.VCINSTALLDIR =
      'c:\\program files (x86)\\microsoft visual studio\\2019\\BUILDTOOLS\\VC'

    const finder = new TestVisualStudioFinder(semverV1, null)

    allVsVersions(finder)
    const { err, info } = await finder.findVisualStudio()
    assert.strictEqual(err, null)
    assert.deepStrictEqual(info.path,
      'C:\\Program Files (x86)\\Microsoft Visual Studio\\2019\\BuildTools')
  })

  it('run on a unusable VS Command Prompt', async function () {
    process.env.VCINSTALLDIR =
      'C:\\Program Files (x86)\\Microsoft Visual Studio\\2019\\BuildToolsUnusable\\VC'

    const finder = new TestVisualStudioFinder(semverV1, null)

    allVsVersions(finder)
    const { err, info } = await finder.findVisualStudio()
    assert.ok(/find .* Visual Studio/i.test(err), 'expect error')
    assert.ok(!info, 'no data')
  })

  it('run on a VS Command Prompt with matching msvs_version', async function () {
    process.env.VCINSTALLDIR = 'C:\\VS2015\\VC'

    const finder = new TestVisualStudioFinder(semverV1, 'C:\\VS2015')

    allVsVersions(finder)
    const { err, info } = await finder.findVisualStudio()
    assert.strictEqual(err, null)
    assert.deepStrictEqual(info.path, 'C:\\VS2015')
  })

  it('run on a VS Command Prompt with mismatched msvs_version', async function () {
    process.env.VCINSTALLDIR =
      'C:\\Program Files (x86)\\Microsoft Visual Studio\\2019\\BuildTools\\VC'

    const finder = new TestVisualStudioFinder(semverV1, 'C:\\VS2015')

    allVsVersions(finder)
    const { err, info } = await finder.findVisualStudio()
    assert.ok(/find .* Visual Studio/i.test(err), 'expect error')
    assert.ok(!info, 'no data')
  })
})
