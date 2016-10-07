'use strict'

var test = require('tape')
var path = require('path')
var semver = require('semver')
var processRelease = require('../lib/process-release')
var configure = require('../lib/configure')

var gyp = require('../lib/node-gyp')() // for gyp.devDir
gyp.parseArgv([]) // to initialize gyp.opts

test('modules version for the current release', function (t) {
  t.plan(1)

  var release = processRelease([], gyp, process.version)
  var nodeDir = path.join(gyp.devDir, release.versionDir)
  var modulesVersion = configure.test.nodeModulesVersion(nodeDir)
  t.equal(modulesVersion, process.versions.modules,
    nodeDir + ' modulesVersion=' + modulesVersion)
})

test('node modules version for installed targets', function (t) {
  gyp.commands.list([], function(err, versions) {
    if (err) return t.fail(err)
    t.plan(versions.length)

    versions.forEach(function(version) {
      var nodeDir = path.join(gyp.devDir, version)
      var modulesVersion = configure.test.nodeModulesVersion(nodeDir)
      t.ok(modulesVersion > 0,
        nodeDir + ' modulesVersion=' + modulesVersion)
    })
  })
})
