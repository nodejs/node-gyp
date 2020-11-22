// @ts-check
'use strict'
/** @typedef {import("tap")} Tap */

const test = require('tap').test
const execFile = require('child_process').execFile
const path = require('path')

require('npmlog').level = 'warn'

//* can use name as short descriptions

/**
 * @typedef Check
 * @property {string} path - path to execurtable or command
 * @property {string} name - very little description
 */

/**
 * @type {Check[]}
 */
const checks = [
  { path: process.env.PYTHON, name: 'env var PYTHON' },
  { path: process.env.python2, name: 'env var python2' },
  { path: 'python3', name: 'env var python3' }
]
const args = [path.resolve('./lib/find-python-script.py')]
const options = {
  windowsHide: true
}

/**
  Getting output from find-python-script.py,
  compare it to path provided to terminal.
  If equale - test pass

  runs for all checks

  @private
  @argument {Error} err - exec error
  @argument {string} stdout - stdout buffer of child process
  @argument {string} stderr
  @this {{t, exec: Check}}
 */
function check (err, stdout, stderr) {
  const { t, exec } = this
  if (!err && !stderr) {
    t.strictEqual(
      stdout.trim(),
      exec.path,
      `${exec.name}: check path ${exec.path} equals ${stdout.trim()}`
    )
  } else {
    // @ts-ignore
    if (err.code === 9009) {
      t.skip(`skipped: ${exec.name} file not found`)
    } else {
      t.fail(`error: ${err}\n\nstderr: ${stderr}`)
    }
  }
}

test('find-python-script', (t) => {
  t.plan(checks.length)

  // context for check functions
  const ctx = {
    t: t,
    exec: {}
  }

  for (const exec of checks) {
    // checking if env var exist
    if (!(exec.path === undefined || exec.path === null)) {
      ctx.exec = exec
      // passing ctx as coppied object to make properties immutable from here
      const boundedCheck = check.bind(Object.assign({}, ctx))
      execFile(exec.path, args, options, boundedCheck)
    } else {
      t.skip(`skipped: ${exec.name} doesn't exist or unavailable`)
    }
  }
})
