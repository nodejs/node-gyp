'use strict'

const { describe, it } = require('node:test')
const assert = require('assert')
const path = require('path')
const requireInject = require('require-inject')
const { findAccessibleSync } = requireInject('../lib/util', {
  'graceful-fs': {
    closeSync: function () { return undefined },
    openSync: function (path) {
      if (readableFiles.some(function (f) { return f === path })) {
        return 0
      } else {
        const error = new Error('ENOENT - not found')
        throw error
      }
    }
  }
})

const dir = path.sep + 'testdir'
const readableFile = 'readable_file'
const anotherReadableFile = 'another_readable_file'
const readableFileInDir = 'somedir' + path.sep + readableFile
const readableFiles = [
  path.resolve(dir, readableFile),
  path.resolve(dir, anotherReadableFile),
  path.resolve(dir, readableFileInDir)
]

describe('find-accessible-sync', function () {
  it('find accessible - empty array', function () {
    const candidates = []
    const found = findAccessibleSync('test', dir, candidates)
    assert.strictEqual(found, undefined)
  })

  it('find accessible - single item array, readable', function () {
    const candidates = [readableFile]
    const found = findAccessibleSync('test', dir, candidates)
    assert.strictEqual(found, path.resolve(dir, readableFile))
  })

  it('find accessible - single item array, readable in subdir', function () {
    const candidates = [readableFileInDir]
    const found = findAccessibleSync('test', dir, candidates)
    assert.strictEqual(found, path.resolve(dir, readableFileInDir))
  })

  it('find accessible - single item array, unreadable', function () {
    const candidates = ['unreadable_file']
    const found = findAccessibleSync('test', dir, candidates)
    assert.strictEqual(found, undefined)
  })

  it('find accessible - multi item array, no matches', function () {
    const candidates = ['non_existent_file', 'unreadable_file']
    const found = findAccessibleSync('test', dir, candidates)
    assert.strictEqual(found, undefined)
  })

  it('find accessible - multi item array, single match', function () {
    const candidates = ['non_existent_file', readableFile]
    const found = findAccessibleSync('test', dir, candidates)
    assert.strictEqual(found, path.resolve(dir, readableFile))
  })

  it('find accessible - multi item array, return first match', function () {
    const candidates = ['non_existent_file', anotherReadableFile, readableFile]
    const found = findAccessibleSync('test', dir, candidates)
    assert.strictEqual(found, path.resolve(dir, anotherReadableFile))
  })
})
