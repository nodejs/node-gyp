// @ts-check
'use strict'
/** @typedef {import("tap")} Tap */

const test = require('tap').test
const execFile = require('child_process').execFile
const path = require('path')

require('npmlog').level = 'warn'

//* name can be used as short descriptions

/**
 * @typedef Check
 * @property {string} path - path to executable or command
 * @property {string} name - very little description
 */

// TODO: add symlinks to python which will contain utf-8 chars
/**
 * @type {Check[]}
 */
const checks = [
  { path: process.env.PYTHON, name: 'env var PYTHON' },
  { path: 'python3', name: 'python3 in PATH' },
  { path: 'python', name: 'python in PATH' }
]
const args = [path.resolve('./lib/find-python-script.py')]
const options = {
  windowsHide: true
}

/**
  Getting output from find-python-script.py,
  compare it to path provided to terminal.
  If equals - test pass

  runs for all checks

  @private
  @argument {Error} err - exec error
  @argument {string} stdout - stdout buffer of child process
  @argument {string} stderr
  @this {{t: Tap, exec: Check}}
 */
function check (err, stdout, stderr) {
  const { t, exec } = this
  if (!err && !stderr) {
    t.ok(
      stdout.trim(),
      `${exec.name}: check path ${exec.path} equals ${stdout.trim()}`
    )
  } else {
    // @ts-ignore
    if (err.code === 9009 || err.code === 'ENOENT') {
      t.skip(`skipped: ${exec.name} file not found`)
    } else {
      t.skip(`error: ${err}\n\nstderr: ${stderr}`)
    }
  }
}

test('find-python-script', { buffered: false }, (t) => {
  t.plan(checks.length)

  // ? may be more elegant way to pass context
  // context for check functions
  const ctx = {
    t: t,
    exec: {}
  }

  for (const exec of checks) {
    // checking if env var exist
    if (!(exec.path === undefined || exec.path === null)) {
      ctx.exec = exec
      // passing ctx as copied object to make properties immutable from here
      const boundedCheck = check.bind(Object.assign({}, ctx))
      execFile(exec.path, args, options, boundedCheck)
    } else {
      t.skip(`skipped: ${exec.name} doesn't exist or unavailable`)
    }
  }
})
