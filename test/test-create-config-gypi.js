'use strict'

const path = require('path')
const { describe, it } = require('mocha')
const assert = require('assert')
const gyp = require('../lib/node-gyp')
const { parseConfigGypi, getCurrentConfigGypi } = require('../lib/create-config-gypi')

describe('create-config-gypi', function () {
  it('config.gypi with no options', async function () {
    const prog = gyp()
    prog.parseArgv([])

    const config = await getCurrentConfigGypi({ gyp: prog, vsInfo: {} })
    assert.strictEqual(config.target_defaults.default_configuration, 'Release')
    assert.strictEqual(config.variables.target_arch, process.arch)
  })

  it('config.gypi with --debug', async function () {
    const prog = gyp()
    prog.parseArgv(['_', '_', '--debug'])

    const config = await getCurrentConfigGypi({ gyp: prog, vsInfo: {} })
    assert.strictEqual(config.target_defaults.default_configuration, 'Debug')
  })

  it('config.gypi with custom options', async function () {
    const prog = gyp()
    prog.parseArgv(['_', '_', '--shared-libxml2'])

    const config = await getCurrentConfigGypi({ gyp: prog, vsInfo: {} })
    assert.strictEqual(config.variables.shared_libxml2, true)
  })

  it('config.gypi with nodedir', async function () {
    const nodeDir = path.join(__dirname, 'fixtures', 'nodedir')

    const prog = gyp()
    prog.parseArgv(['_', '_', `--nodedir=${nodeDir}`])

    const config = await getCurrentConfigGypi({ gyp: prog, nodeDir, vsInfo: {} })
    assert.strictEqual(config.variables.build_with_electron, true)
  })

  it('config.gypi with --force-process-config', async function () {
    const nodeDir = path.join(__dirname, 'fixtures', 'nodedir')

    const prog = gyp()
    prog.parseArgv(['_', '_', '--force-process-config', `--nodedir=${nodeDir}`])

    const config = await getCurrentConfigGypi({ gyp: prog, nodeDir, vsInfo: {} })
    assert.strictEqual(config.variables.build_with_electron, undefined)
  })

  it('config.gypi overrides host-specific vars from process.config when nodedir is set', async function () {
    // The fixture mimics a Linux x64 / GCC build farm headers tarball. When
    // running on a different host (e.g. macOS arm64 / clang), the host-specific
    // fields must come from process.config, not from the headers tarball,
    // otherwise binding.gyp / common.gypi `if (clang==1)` branches break
    // (e.g. -std=gnu++20 is silently dropped, breaking node-addon-api).
    const nodeDir = path.join(__dirname, 'fixtures', 'nodedir-mismatched-host')

    const prog = gyp()
    prog.parseArgv(['_', '_', `--nodedir=${nodeDir}`])

    const config = await getCurrentConfigGypi({ gyp: prog, nodeDir, vsInfo: {} })

    // target build config from headers is still preserved (PR #2497 intent).
    assert.strictEqual(config.variables.build_with_electron, true)

    // host-specific fields come from process.config.
    assert.strictEqual(config.variables.host_arch, process.config.variables.host_arch)
    assert.strictEqual(config.variables.clang, process.config.variables.clang)
    assert.strictEqual(config.variables.llvm_version, process.config.variables.llvm_version)

    // fields that are present in headers but absent in process.config must be
    // deleted (e.g. gas_version is Linux-only and meaningless on macOS).
    if (process.config.variables.gas_version === undefined) {
      assert.strictEqual('gas_version' in config.variables, false)
    }
    if (process.config.variables.xcode_version === undefined) {
      assert.strictEqual('xcode_version' in config.variables, false)
    }
  })

  it('config.gypi with --force-process-config bypasses host override too (back-compat)', async function () {
    const nodeDir = path.join(__dirname, 'fixtures', 'nodedir-mismatched-host')

    const prog = gyp()
    prog.parseArgv(['_', '_', '--force-process-config', `--nodedir=${nodeDir}`])

    const config = await getCurrentConfigGypi({ gyp: prog, nodeDir, vsInfo: {} })

    // --force-process-config still skips reading the headers entirely.
    assert.strictEqual(config.variables.build_with_electron, undefined)
    // And of course the host fields are from process.config (always were).
    assert.strictEqual(config.variables.host_arch, process.config.variables.host_arch)
    assert.strictEqual(config.variables.clang, process.config.variables.clang)
  })

  it('config.gypi parsing', function () {
    const str = "# Some comments\n{'variables': {'multiline': 'A'\n'B'}}"
    const config = parseConfigGypi(str)
    assert.deepStrictEqual(config, { variables: { multiline: 'AB' } })
  })
})
