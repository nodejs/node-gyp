'use strict'

const test = require('tape')
const fs = require('fs')
const path = require('path')
const findVisualStudio = require('../lib/find-visualstudio')
const VisualStudioFinder = findVisualStudio.test.VisualStudioFinder

test('empty output', function (t) {
  t.plan(2)

  const finder = new VisualStudioFinder(function (err, info) {
    t.ok(/se PowerShell/i.test(err), 'expect error')
    t.false(info, 'no data')
  })

  finder.parseData(null, '', '')
})

test('output not JSON', function (t) {
  t.plan(2)

  const finder = new VisualStudioFinder(function (err, info) {
    t.ok(/use PowerShell/i.test(err), 'expect error')
    t.false(info, 'no data')
  })

  finder.parseData(null, 'AAAABBBB', '')
})

test('wrong JSON', function (t) {
  t.plan(2)

  const finder = new VisualStudioFinder(function (err, info) {
    t.ok(/use PowerShell/i.test(err), 'expect error')
    t.false(info, 'no data')
  })

  finder.parseData(null, '{}', '')
})

test('empty JSON', function (t) {
  t.plan(2)

  const finder = new VisualStudioFinder(function (err, info) {
    t.ok(/find any Visual Studio/i.test(err), 'expect error')
    t.false(info, 'no data')
  })

  finder.parseData(null, '[]', '')
})

test('future version', function (t) {
  t.plan(2)

  const finder = new VisualStudioFinder(function (err, info) {
    t.ok(/find any Visual Studio/i.test(err), 'expect error')
    t.false(info, 'no data')
  })

  finder.parseData(null, JSON.stringify([{
    packages: [
      'Microsoft.VisualStudio.Component.VC.Tools.x86.x64',
      'Microsoft.VisualStudio.Component.Windows10SDK.17763',
      'Microsoft.VisualStudio.VC.MSBuild.Base'
    ],
    path: 'C:\\VS',
    version: '9999.9999.9999.9999'
  }]), '')
})

test('single unusable VS2017', function (t) {
  t.plan(2)

  const finder = new VisualStudioFinder(function (err, info) {
    t.ok(/find any Visual Studio/i.test(err), 'expect error')
    t.false(info, 'no data')
  })

  const file = path.join(__dirname, 'fixtures', 'VS_2017_Unusable.txt')
  const data = fs.readFileSync(file)
  finder.parseData(null, data, '')
})

test('minimal VS2017 Build Tools', function (t) {
  t.plan(2)

  const finder = new VisualStudioFinder(function (err, info) {
    t.strictEqual(err, null)
    t.deepEqual(info, {
      hasMSBuild: true,
      path:
        'C:\\Program Files (x86)\\Microsoft Visual Studio\\2017\\BuildTools',
      sdk: '10.0.17134.0',
      toolset: 'v141',
      version: '15.9.28307.665',
      versionYear: 2017
    })
  })

  const file = path.join(__dirname, 'fixtures',
    'VS_2017_BuildTools_minimal.txt')
  const data = fs.readFileSync(file)
  finder.parseData(null, data, '')
})

test('VS2017 Community with C++ workload', function (t) {
  t.plan(2)

  const finder = new VisualStudioFinder(function (err, info) {
    t.strictEqual(err, null)
    t.deepEqual(info, {
      hasMSBuild: true,
      path:
        'C:\\Program Files (x86)\\Microsoft Visual Studio\\2017\\Community',
      sdk: '10.0.17763.0',
      toolset: 'v141',
      version: '15.9.28307.665',
      versionYear: 2017
    })
  })

  const file = path.join(__dirname, 'fixtures',
    'VS_2017_Community_workload.txt')
  const data = fs.readFileSync(file)
  finder.parseData(null, data, '')
})
