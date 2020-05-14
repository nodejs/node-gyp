'use strict'

const { test } = require('tap')
const path = require('path')
const requireInject = require('require-inject')
const configure = requireInject('../lib/configure', {
  'graceful-fs': {
    closeSync: () => {},
    openSync: (path) => {
      if (readableFiles.some((f) => f === path)) {
        return 0
      }
      throw new Error('ENOENT - not found')
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

test('find accessible - empty array', (t) => {
  t.plan(1)

  const candidates = []
  const found = configure.test.findAccessibleSync('test', dir, candidates)
  t.strictEqual(found, undefined)
})

test('find accessible - single item array, readable', (t) => {
  t.plan(1)

  const candidates = [readableFile]
  const found = configure.test.findAccessibleSync('test', dir, candidates)
  t.strictEqual(found, path.resolve(dir, readableFile))
})

test('find accessible - single item array, readable in subdir', (t) => {
  t.plan(1)

  const candidates = [readableFileInDir]
  const found = configure.test.findAccessibleSync('test', dir, candidates)
  t.strictEqual(found, path.resolve(dir, readableFileInDir))
})

test('find accessible - single item array, unreadable', (t) => {
  t.plan(1)

  const candidates = ['unreadable_file']
  const found = configure.test.findAccessibleSync('test', dir, candidates)
  t.strictEqual(found, undefined)
})

test('find accessible - multi item array, no matches', (t) => {
  t.plan(1)

  const candidates = ['non_existent_file', 'unreadable_file']
  const found = configure.test.findAccessibleSync('test', dir, candidates)
  t.strictEqual(found, undefined)
})

test('find accessible - multi item array, single match', (t) => {
  t.plan(1)

  const candidates = ['non_existent_file', readableFile]
  const found = configure.test.findAccessibleSync('test', dir, candidates)
  t.strictEqual(found, path.resolve(dir, readableFile))
})

test('find accessible - multi item array, return first match', (t) => {
  t.plan(1)

  const candidates = ['non_existent_file', anotherReadableFile, readableFile]
  const found = configure.test.findAccessibleSync('test', dir, candidates)
  t.strictEqual(found, path.resolve(dir, anotherReadableFile))
})
