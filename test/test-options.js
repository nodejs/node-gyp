'use strict'

const { describe, it } = require('mocha')
const assert = require('assert')
const gyp = require('../lib/node-gyp')

describe('options', function () {
  it('options in environment', () => {
    // `npm test` dumps a ton of npm_config_* variables in the environment.
    Object.keys(process.env)
      .filter((key) => /^npm_config_/.test(key) || /^npm_package_config_node_gyp_/.test(key))
      .forEach((key) => { delete process.env[key] })

    // in some platforms, certain keys are stubborn and cannot be removed
    const keys = Object.keys(process.env)
      .filter((key) => /^npm_config_/.test(key) || /^npm_package_config_node_gyp_/.test(key))
      .map((key) => key.substring('npm_config_'.length))
      .concat('argv', 'x', 'y', 'foo')

    // Environment variables with the following prefixes should be added to opts.
    // - `npm_config_` for npm versions before v11.
    // - `npm_package_config_node_gyp_` for npm versions 11 and later.

    // Zero-length keys should get filtered out.
    process.env.npm_config_ = '42'
    process.env.npm_package_config_node_gyp_ = '42'
    // Other keys should get added.
    process.env.npm_config_x = '42'
    process.env.npm_config_y = '41'
    process.env.npm_package_config_node_gyp_foo = '42'
    // Package config should take precedence over npm_config_ keys.
    process.env.npm_package_config_node_gyp_y = '42'
    // Except loglevel.
    process.env.npm_config_loglevel = 'debug'

    const g = gyp()
    g.parseArgv(['rebuild']) // Also sets opts.argv.

    assert.deepStrictEqual(Object.keys(g.opts).sort(), keys.sort())
    assert.strictEqual(g.opts['x'], '42')
    assert.strictEqual(g.opts['y'], '42')
    assert.strictEqual(g.opts['foo'], '42')
  })

  it('options with spaces in environment', () => {
    process.env.npm_config_force_process_config = 'true'

    const g = gyp()
    g.parseArgv(['rebuild']) // Also sets opts.argv.

    assert.strictEqual(g.opts['force-process-config'], 'true')
  })

  it('options with msvs_version', () => {
    process.env.npm_config_msvs_version = '2017'

    const g = gyp()
    g.parseArgv(['rebuild']) // Also sets opts.argv.

    assert.strictEqual(g.opts['msvs-version'], '2017')
  })
})
