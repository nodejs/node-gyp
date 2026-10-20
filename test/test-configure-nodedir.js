'use strict'

const { describe, it, before, after } = require('mocha')
const assert = require('assert')
const path = require('path')
const os = require('os')
const gyp = require('../lib/node-gyp')
const requireInject = require('require-inject')
const semver = require('semver')

const versionSemver = semver.parse(process.version)

const configure = requireInject('../lib/configure', {
  'graceful-fs': {
    openSync: () => 0,
    closeSync: () => {},
    existsSync: () => true,
    readFileSync: () => '#define NODE_MAJOR_VERSION ' + versionSemver.major + '\n' +
        '#define NODE_MINOR_VERSION ' + versionSemver.minor + '\n' +
        '#define NODE_PATCH_VERSION ' + versionSemver.patch + '\n',
    promises: {
      stat: async () => ({}),
      mkdir: async () => {},
      writeFile: async () => {}
    }
  }
})

const configure2 = requireInject('../lib/configure', {
  'graceful-fs': {
    openSync: () => 0,
    closeSync: () => {},
    existsSync: () => true,
    readFileSync: () => '#define NODE_MAJOR_VERSION 8\n' +
        '#define NODE_MINOR_VERSION 0\n' +
        '#define NODE_PATCH_VERSION 0\n',
    promises: {
      stat: async () => ({}),
      mkdir: async () => {},
      writeFile: async () => {}
    }
  }
})

const SPAWN_RESULT = cb => ({ on: function () { cb() } })

const driveLetter = os.platform() === 'win32' ? `${process.cwd().split(path.sep)[0]}` : ''
function checkTargetPath (target, value) {
  let targetPath = path.join(path.sep, target, 'include',
    'node', 'common.gypi')
  if (process.platform === 'win32') {
    targetPath = driveLetter + targetPath
  }

  return targetPath.localeCompare(value) === 0
}

describe('configure-nodedir', function () {
  // CI harnesses such as citgm export npm_config_nodedir, which parseArgv lets
  // override --nodedir, so keep it out of these tests
  const envKeys = ['npm_config_nodedir', 'npm_package_config_node_gyp_nodedir']
  const savedEnv = {}

  before(function () {
    for (const key of envKeys) {
      savedEnv[key] = process.env[key]
      delete process.env[key]
    }
  })

  after(function () {
    for (const key of envKeys) {
      if (savedEnv[key] !== undefined) {
        process.env[key] = savedEnv[key]
      }
    }
  })

  it('configure nodedir with node-gyp command line', function (done) {
    const prog = gyp()
    prog.parseArgv(['dummy_prog', 'dummy_script', '--nodedir=' + path.sep + 'usr'])

    prog.spawn = function (program, args) {
      for (let i = 0; i < args.length; i++) {
        if (checkTargetPath('usr', args[i])) {
          return SPAWN_RESULT(done)
        }
      };
      assert.fail()
    }
    configure(prog, []).catch(done)
  })

  if (process.config.variables.use_prefix_to_find_headers) {
    it('use-prefix-to-find-headers build time option - match', function (done) {
      const prog = gyp()
      prog.parseArgv(['dummy_prog', 'dummy_script'])

      prog.spawn = function (program, args) {
        for (let i = 0; i < args.length; i++) {
          const nodedir = process.config.variables.node_prefix
          if (checkTargetPath(nodedir, args[i])) {
            return SPAWN_RESULT(done)
          }
        };
        assert.fail()
      }
      configure(prog, []).catch(done)
    })

    it('use-prefix-to-find-headers build time option - no match', function (done) {
      const prog = gyp()
      prog.parseArgv(['dummy_prog', 'dummy_script'])

      prog.spawn = function (program, args) {
        for (let i = 0; i < args.length; i++) {
          const nodedir = process.config.variables.node_prefix
          if (checkTargetPath(nodedir, args[i])) {
            assert.fail()
          }
        };
        return SPAWN_RESULT(done)
      }
      configure2(prog, []).catch(done)
    })

    it('use-prefix-to-find-headers build time option, target specified', function (done) {
      const prog = gyp()
      prog.parseArgv(['dummy_prog', 'dummy_script', '--target=8.0.0'])

      prog.spawn = function (program, args) {
        for (let i = 0; i < args.length; i++) {
          const nodedir = process.config.variables.node_prefix
          if (checkTargetPath(nodedir, args[i])) {
            assert.fail()
          }
        };
        return SPAWN_RESULT(done)
      }
      configure(prog, []).catch(done)
    })
  }
})
