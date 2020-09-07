'use strict'

const test = require('tap').test
const gyp = require('../lib/node-gyp')

test('options in environment', function (t) {
  t.plan(1)

  // `npm test` dumps a ton of npm_config_* variables in the environment.
  Object.keys(process.env)
    .filter(function (key) { return /^npm_config_/.test(key) })
    .forEach(function (key) {
      console.log(key, process.env[key])
      delete process.env[key]
    })

  console.log('npm_config_cache!', process.env.npm_config_cache)

  // Zero-length keys should get filtered out.
  process.env.npm_config_ = '42'
  // Other keys should get added.
  process.env.npm_config_x = '42'
  // Except loglevel.
  process.env.npm_config_loglevel = 'debug'

  var g = gyp()
  g.parseArgv(['rebuild']) // Also sets opts.argv.

  t.deepEqual(Object.keys(g.opts).sort(), ['argv', 'x'])
})
