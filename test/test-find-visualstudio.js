'use strict'

const { test } = require('tap')
const fs = require('fs').promises
const path = require('path')
const { VisualStudioFinder } = require('../lib/find-visualstudio').test

const semverV1 = { major: 1, minor: 0, patch: 0 }

delete process.env.VCINSTALLDIR

function poison (object, property) {
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

class TestVisualStudioFinder extends VisualStudioFinder {
  constructor (...args) {
    super(...args)

    // Silence npmlog - remove for debugging
    this.log = {
      silly: () => {},
      verbose: () => {},
      info: () => {},
      warn: () => {},
      error: () => {}
    }
  }
}

test('VS2013', async (t) => {
  t.plan(3)

  const finder = new TestVisualStudioFinder(semverV1, null)

  finder.findVisualStudio2017OrNewer = async () => null

  finder.regSearchKeys = async (keys, value, addOpts) => {
    for (const key of keys) {
      const fullName = `${key}\\${value}`
      switch (fullName) {
        case 'HKLM\\Software\\Microsoft\\VisualStudio\\SxS\\VC7\\14.0':
        case 'HKLM\\Software\\Wow6432Node\\Microsoft\\VisualStudio\\SxS\\VC7\\14.0':
          continue
        case 'HKLM\\Software\\Microsoft\\VisualStudio\\SxS\\VC7\\12.0':
          t.pass(`expected search for registry value ${fullName}`)
          return 'C:\\VS2013\\VC\\'
        case 'HKLM\\Software\\Microsoft\\MSBuild\\ToolsVersions\\12.0\\MSBuildToolsPath':
          t.pass(`expected search for registry value ${fullName}`)
          return 'C:\\MSBuild12\\'
        default:
          t.fail(`unexpected search for registry value ${fullName}`)
      }
    }
    throw new Error()
  }

  const info = await finder.findVisualStudio()
  t.deepEqual(info, {
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

test('VS2013 should not be found on new node versions', async (t) => {
  t.plan(1)

  const finder = new TestVisualStudioFinder({ major: 10, minor: 0, patch: 0 }, null)

  finder.findVisualStudio2017OrNewer = async () => {
    const file = path.join(__dirname, 'fixtures/VS_2017_Unusable.txt')
    const data = await fs.readFile(file)
    return finder.parseData(data, '')
  }

  finder.regSearchKeys = async (keys, value, addOpts) => {
    for (const key of keys) {
      const fullName = `${key}\\${value}`
      switch (fullName) {
        case 'HKLM\\Software\\Microsoft\\VisualStudio\\SxS\\VC7\\14.0':
        case 'HKLM\\Software\\Wow6432Node\\Microsoft\\VisualStudio\\SxS\\VC7\\14.0':
          continue
        default:
          t.fail(`unexpected search for registry value ${fullName}`)
      }
    }
    throw new Error()
  }

  return t.rejects(() => finder.findVisualStudio(), /find .* Visual Studio/i, 'expect error')
})

test('VS2015', async (t) => {
  t.plan(3)

  const finder = new TestVisualStudioFinder(semverV1, null)

  finder.findVisualStudio2017OrNewer = (cb) => null

  finder.regSearchKeys = async (keys, value, addOpts) => {
    for (const key of keys) {
      const fullName = `${key}\\${value}`
      switch (fullName) {
        case 'HKLM\\Software\\Microsoft\\VisualStudio\\SxS\\VC7\\14.0':
          t.pass(`expected search for registry value ${fullName}`)
          return 'C:\\VS2015\\VC\\'
        case 'HKLM\\Software\\Microsoft\\MSBuild\\ToolsVersions\\14.0\\MSBuildToolsPath':
          t.pass(`expected search for registry value ${fullName}`)
          return 'C:\\MSBuild14\\'
        default:
          t.fail(`unexpected search for registry value ${fullName}`)
      }
    }
    throw new Error()
  }

  const info = await finder.findVisualStudio()
  t.deepEqual(info, {
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

test('empty output from PowerShell', (t) => {
  t.plan(2)

  const finder = new TestVisualStudioFinder(semverV1, null)

  const info = finder.parseData(null, '', '')
  t.ok(/use PowerShell/i.test(finder.errorLog[0]), 'expect error')
  t.false(info, 'no data')
})

test('output from PowerShell not JSON', (t) => {
  t.plan(2)

  const finder = new TestVisualStudioFinder(semverV1, null)

  const info = finder.parseData(null, 'AAAABBBB', '')
  t.ok(/use PowerShell/i.test(finder.errorLog[0]), 'expect error')
  t.false(info, 'no data')
})

test('wrong JSON from PowerShell', (t) => {
  t.plan(2)

  const finder = new TestVisualStudioFinder(semverV1, null, null)

  const info = finder.parseData(null, '{}', '')
  t.ok(/use PowerShell/i.test(finder.errorLog[0]), 'expect error')
  t.false(info, 'no data')
})

test('empty JSON from PowerShell', (t) => {
  t.plan(2)

  const finder = new TestVisualStudioFinder(semverV1, null, null)

  const info = finder.parseData('[]', '')
  t.ok(/find .* Visual Studio/i.test(finder.errorLog[0]), 'expect error')
  t.false(info, 'no data')
})

test('future version', (t) => {
  t.plan(3)

  const finder = new TestVisualStudioFinder(semverV1, null, null)

  const info = finder.parseData(JSON.stringify([{
    packages: [
      'Microsoft.VisualStudio.Component.VC.Tools.x86.x64',
      'Microsoft.VisualStudio.Component.Windows10SDK.17763',
      'Microsoft.VisualStudio.VC.MSBuild.Base'
    ],
    path: 'C:\\VS',
    version: '9999.9999.9999.9999'
  }]), '')

  t.ok(/unknown version/i.test(finder.errorLog[0]), 'expect error')
  t.ok(/find .* Visual Studio/i.test(finder.errorLog[1]), 'expect error')
  t.false(info, 'no data')
})

test('single unusable VS2017', async (t) => {
  t.plan(3)

  const finder = new TestVisualStudioFinder(semverV1, null, null)

  const file = path.join(__dirname, 'fixtures/VS_2017_Unusable.txt')
  const data = await fs.readFile(file)
  const info = finder.parseData(data, '')
  t.ok(/checking/i.test(finder.errorLog[0]), 'expect error')
  t.ok(/find .* Visual Studio/i.test(finder.errorLog[2]), 'expect error')
  t.false(info, 'no data')
})

test('minimal VS2017 Build Tools', async (t) => {
  t.plan(1)

  const finder = new TestVisualStudioFinder(semverV1, null)

  poison(finder, 'regSearchKeys')
  finder.findVisualStudio2017OrNewer = async () => {
    const file = path.join(__dirname, 'fixtures/VS_2017_BuildTools_minimal.txt')
    const data = await fs.readFile(file)
    return finder.parseData(data, '')
  }

  const info = await finder.findVisualStudio()

  t.deepEqual(info, {
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

test('VS2017 Community with C++ workload', async (t) => {
  t.plan(1)

  const finder = new TestVisualStudioFinder(semverV1, null)

  poison(finder, 'regSearchKeys')
  finder.findVisualStudio2017OrNewer = async () => {
    const file = path.join(__dirname, 'fixtures/VS_2017_Community_workload.txt')
    const data = await fs.readFile(file)
    return finder.parseData(data, '')
  }

  const info = await finder.findVisualStudio()

  t.deepEqual(info, {
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

test('VS2017 Express', async (t) => {
  t.plan(1)

  const finder = new TestVisualStudioFinder(semverV1, null)

  poison(finder, 'regSearchKeys')
  finder.findVisualStudio2017OrNewer = async () => {
    const file = path.join(__dirname, 'fixtures/VS_2017_Express.txt')
    const data = await fs.readFile(file)
    return finder.parseData(data, '')
  }

  const info = await finder.findVisualStudio()

  t.deepEqual(info, {
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

test('VS2019 Preview with C++ workload', async (t) => {
  t.plan(1)

  const finder = new TestVisualStudioFinder(semverV1, null)

  poison(finder, 'regSearchKeys')
  finder.findVisualStudio2017OrNewer = async () => {
    const file = path.join(__dirname, 'fixtures/VS_2019_Preview.txt')
    const data = await fs.readFile(file)
    return finder.parseData(data, '')
  }

  const info = await finder.findVisualStudio()

  t.deepEqual(info, {
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

test('minimal VS2019 Build Tools', async (t) => {
  t.plan(1)

  const finder = new TestVisualStudioFinder(semverV1, null)

  poison(finder, 'regSearchKeys')
  finder.findVisualStudio2017OrNewer = async () => {
    const file = path.join(__dirname, 'fixtures/VS_2019_BuildTools_minimal.txt')
    const data = await fs.readFile(file)
    return finder.parseData(data, '')
  }

  const info = await finder.findVisualStudio()

  t.deepEqual(info, {
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

test('VS2019 Community with C++ workload', async (t) => {
  t.plan(1)

  const finder = new TestVisualStudioFinder(semverV1, null)
  poison(finder, 'regSearchKeys')

  finder.findVisualStudio2017OrNewer = async () => {
    const file = path.join(__dirname, 'fixtures/VS_2019_Community_workload.txt')
    const data = await fs.readFile(file)
    return finder.parseData(data, '')
  }

  const info = await finder.findVisualStudio()

  t.deepEqual(info, {
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

function allVsVersions (t, finder) {
  finder.findVisualStudio2017OrNewer = async () => {
    const data = JSON.stringify((await Promise.all([
      'VS_2017_Unusable.txt',
      'VS_2017_BuildTools_minimal.txt',
      'VS_2017_Community_workload.txt',
      'VS_2017_Express.txt',
      'VS_2019_Preview.txt',
      'VS_2019_BuildTools_minimal.txt',
      'VS_2019_Community_workload.txt'
    ].map((f) => fs.readFile(path.join(__dirname, `fixtures/${f}`)))))
      .map((c) => JSON.parse(c))
      .reduce((p, c) => p.concat(c), []))
    return finder.parseData(data, '')
  }

  finder.regSearchKeys = async (keys, value, addOpts) => {
    for (const key of keys) {
      const fullName = `${key}\\${value}`
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
          t.fail(`unexpected search for registry value ${fullName}`)
      }
    }
    throw new Error()
  }
}

test('fail when looking for invalid path', async (t) => {
  t.plan(1)

  const finder = new TestVisualStudioFinder(semverV1, 'AABB')

  allVsVersions(t, finder)

  return t.rejects(() => finder.findVisualStudio(), /find .* Visual Studio/i, 'expect error')
})

test('look for VS2013 by version number', async (t) => {
  t.plan(1)

  const finder = new TestVisualStudioFinder(semverV1, '2013')

  allVsVersions(t, finder)

  const info = await finder.findVisualStudio()
  t.deepEqual(info.versionYear, 2013)
})

test('look for VS2013 by installation path', async (t) => {
  t.plan(1)

  const finder = new TestVisualStudioFinder(semverV1, 'C:\\VS2013')

  allVsVersions(t, finder)

  const info = await finder.findVisualStudio()
  t.deepEqual(info.path, 'C:\\VS2013')
})

test('look for VS2015 by version number', async (t) => {
  t.plan(1)

  const finder = new TestVisualStudioFinder(semverV1, '2015')

  allVsVersions(t, finder)

  const info = await finder.findVisualStudio()
  t.deepEqual(info.versionYear, 2015)
})

test('look for VS2015 by installation path', async (t) => {
  t.plan(1)

  const finder = new TestVisualStudioFinder(semverV1, 'C:\\VS2015')

  allVsVersions(t, finder)

  const info = await finder.findVisualStudio()
  t.deepEqual(info.path, 'C:\\VS2015')
})

test('look for VS2017 by version number', async (t) => {
  t.plan(1)

  const finder = new TestVisualStudioFinder(semverV1, '2017')

  allVsVersions(t, finder)

  const info = await finder.findVisualStudio()
  t.deepEqual(info.versionYear, 2017)
})

test('look for VS2017 by installation path', async (t) => {
  t.plan(1)

  const finder = new TestVisualStudioFinder(semverV1,
    'C:\\Program Files (x86)\\Microsoft Visual Studio\\2017\\Community')

  allVsVersions(t, finder)

  const info = await finder.findVisualStudio()
  t.deepEqual(info.path,
    'C:\\Program Files (x86)\\Microsoft Visual Studio\\2017\\Community')
})

test('look for VS2019 by version number', async (t) => {
  t.plan(1)

  const finder = new TestVisualStudioFinder(semverV1, '2019')

  allVsVersions(t, finder)

  const info = await finder.findVisualStudio()
  t.deepEqual(info.versionYear, 2019)
})

test('look for VS2019 by installation path', async (t) => {
  t.plan(1)

  const finder = new TestVisualStudioFinder(semverV1,
    'C:\\Program Files (x86)\\Microsoft Visual Studio\\2019\\BuildTools')

  allVsVersions(t, finder)
  const info = await finder.findVisualStudio()
  t.deepEqual(info.path,
    'C:\\Program Files (x86)\\Microsoft Visual Studio\\2019\\BuildTools')
})

test('msvs_version match should be case insensitive', async (t) => {
  t.plan(1)

  const finder = new TestVisualStudioFinder(semverV1,
    'c:\\program files (x86)\\microsoft visual studio\\2019\\BUILDTOOLS')

  allVsVersions(t, finder)

  const info = await finder.findVisualStudio()
  t.deepEqual(info.path,
    'C:\\Program Files (x86)\\Microsoft Visual Studio\\2019\\BuildTools')
})

test('latest version should be found by default', async (t) => {
  t.plan(1)

  const finder = new TestVisualStudioFinder(semverV1, null)

  allVsVersions(t, finder)

  const info = await finder.findVisualStudio()
  t.deepEqual(info.versionYear, 2019)
})

test('run on a usable VS Command Prompt', async (t) => {
  t.plan(1)

  process.env.VCINSTALLDIR = 'C:\\VS2015\\VC'
  // VSINSTALLDIR is not defined on Visual C++ Build Tools 2015
  delete process.env.VSINSTALLDIR

  const finder = new TestVisualStudioFinder(semverV1, null)

  allVsVersions(t, finder)

  const info = await finder.findVisualStudio()
  t.deepEqual(info.path, 'C:\\VS2015')
})

test('VCINSTALLDIR match should be case insensitive', async (t) => {
  t.plan(1)

  process.env.VCINSTALLDIR =
    'c:\\program files (x86)\\microsoft visual studio\\2019\\BUILDTOOLS\\VC'

  const finder = new TestVisualStudioFinder(semverV1, null)

  allVsVersions(t, finder)

  const info = await finder.findVisualStudio()
  t.deepEqual(info.path,
    'C:\\Program Files (x86)\\Microsoft Visual Studio\\2019\\BuildTools')
})

test('run on a unusable VS Command Prompt', async (t) => {
  t.plan(1)

  process.env.VCINSTALLDIR =
    'C:\\Program Files (x86)\\Microsoft Visual Studio\\2019\\BuildToolsUnusable\\VC'

  const finder = new TestVisualStudioFinder(semverV1, null)

  allVsVersions(t, finder)

  return t.rejects(() => finder.findVisualStudio(), /find .* Visual Studio/i, 'expect error')
})

test('run on a VS Command Prompt with matching msvs_version', async (t) => {
  t.plan(1)

  process.env.VCINSTALLDIR = 'C:\\VS2015\\VC'

  const finder = new TestVisualStudioFinder(semverV1, 'C:\\VS2015')

  allVsVersions(t, finder)

  const info = await finder.findVisualStudio()
  t.deepEqual(info.path, 'C:\\VS2015')
})

test('run on a VS Command Prompt with mismatched msvs_version', async (t) => {
  t.plan(1)

  process.env.VCINSTALLDIR =
    'C:\\Program Files (x86)\\Microsoft Visual Studio\\2019\\BuildTools\\VC'

  const finder = new TestVisualStudioFinder(semverV1, 'C:\\VS2015')

  allVsVersions(t, finder)

  return t.rejects(() => finder.findVisualStudio(), /find .* Visual Studio/i, 'expect error')
})
