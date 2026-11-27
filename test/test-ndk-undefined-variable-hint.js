'use strict'

const { describe, it } = require('mocha')
const assert = require('assert')
const configure = require('../lib/configure')

const isHint = configure.isNdkUndefinedVariableHint

describe('isNdkUndefinedVariableHint', function () {
  it('detects the android_ndk_path failure from the official headers', function () {
    const stderr = 'gyp: Undefined variable android_ndk_path in binding.gyp while trying to load binding.gyp\n'
    assert.strictEqual(isHint(stderr), true)
  })

  it('detects other android_ndk_* variables', function () {
    const stderr = 'gyp: Undefined variable android_ndk_include_dir in binding.gyp while trying to load binding.gyp\n'
    assert.strictEqual(isHint(stderr), true)
  })

  it('detects an undefined variable while loading common.gypi', function () {
    const stderr = 'gyp: Undefined variable some_var in /usr/include/node/common.gypi while trying to load binding.gyp\n'
    assert.strictEqual(isHint(stderr), true)
  })

  it('ignores an undefined variable in the project binding.gyp', function () {
    const stderr = 'gyp: Undefined variable my_custom_flag in binding.gyp while trying to load binding.gyp\n'
    assert.strictEqual(isHint(stderr), false)
  })

  it('ignores unrelated gyp errors', function () {
    const stderr = "gyp: 'x' doesn't look like a valid filename\n"
    assert.strictEqual(isHint(stderr), false)
  })

  it('ignores empty stderr', function () {
    assert.strictEqual(isHint(''), false)
  })
})

// re-trigger CI after stale failures (ruff README drift / flaky windows download)
// ci: refresh PR checks
