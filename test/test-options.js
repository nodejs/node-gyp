'use strict'

const { test } = require('tap')
const Gyp = require('../lib/node-gyp')

test('options in environment', (t) => {
  t.plan(1)

  // `npm test` dumps a ton of npm_config_* variables in the environment.
  Object.keys(process.env)
    .filter((key) => /^npm_config_/.test(key))
    .forEach((key) => delete process.env[key])

  // Zero-length keys should get filtered out.
  process.env.npm_config_ = '42'
  // Other keys should get added.
  process.env.npm_config_x = '42'
  // Except loglevel.
  process.env.npm_config_loglevel = 'debug'

  const gyp = new Gyp()
  gyp.parseArgv(['rebuild']) // Also sets opts.argv.

  t.deepEqual(Object.keys(gyp.opts).sort(), ['argv', 'x'])
})
