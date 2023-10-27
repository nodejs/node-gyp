'use strict'

delete process.env.PYTHON

const { describe, it } = require('mocha')
const assert = require('assert')
const { test: { PythonFinder, findPython: testFindPython } } = require('../lib/find-python')
const { execFile } = require('../lib/util')

describe('find-python', function () {
  it('find python', async function () {
    const found = await testFindPython(null)
    const [err, stdout, stderr] = await execFile(found, ['-V'], { encoding: 'utf-8' })
    assert.strictEqual(err, null)
    assert.ok(/Python 3/.test(stdout))
    assert.strictEqual(stderr, '')
  })

  function poison (object, property) {
    function fail () {
      console.error(Error(`Property ${property} should not have been accessed.`))
      process.abort()
    }
    const descriptor = {
      configurable: false,
      enumerable: false,
      get: fail,
      set: fail
    }
    Object.defineProperty(object, property, descriptor)
  }

  function TestPythonFinder () { PythonFinder.apply(this, arguments) }
  TestPythonFinder.prototype = Object.create(PythonFinder.prototype)
  delete TestPythonFinder.prototype.env.NODE_GYP_FORCE_PYTHON
  const findPython = async (f) => {
    try {
      return { err: null, python: await f.findPython() }
    } catch (err) {
      return { err, python: null }
    }
  }

  it('find python - python', async function () {
    const f = new TestPythonFinder('python')
    f.execFile = async function (program, args, opts) {
      f.execFile = async function (program, args, opts) {
        poison(f, 'execFile')
        assert.strictEqual(program, '/path/python')
        assert.ok(/sys\.version_info/.test(args[1]))
        return [null, '3.9.1']
      }
      assert.strictEqual(program, process.platform === 'win32' ? '"python"' : 'python')
      assert.ok(/sys\.executable/.test(args[1]))
      return [null, '/path/python']
    }

    const { err, python } = await findPython(f)
    assert.strictEqual(err, null)
    assert.strictEqual(python, '/path/python')
  })

  it('find python - python too old', async function () {
    const f = new TestPythonFinder(null)
    f.execFile = async function (program, args, opts) {
      if (/sys\.executable/.test(args[args.length - 1])) {
        return [null, '/path/python']
      } else if (/sys\.version_info/.test(args[args.length - 1])) {
        return [null, '2.3.4']
      } else {
        assert.fail()
      }
    }

    const { err } = await findPython(f)
    assert.ok(/Could not find any Python/.test(err))
    assert.ok(/not supported/i.test(f.errorLog))
  })

  it('find python - no python', async function () {
    const f = new TestPythonFinder(null)
    f.execFile = async function (program, args, opts) {
      if (/sys\.executable/.test(args[args.length - 1])) {
        throw new Error('not found')
      } else if (/sys\.version_info/.test(args[args.length - 1])) {
        throw new Error('not a Python executable')
      } else {
        assert.fail()
      }
    }

    const { err } = await findPython(f)
    assert.ok(/Could not find any Python/.test(err))
    assert.ok(/not in PATH/.test(f.errorLog))
  })

  it('find python - no python2, no python, unix', async function () {
    const f = new TestPythonFinder(null)
    f.checkPyLauncher = assert.fail
    f.win = false

    f.execFile = async function (program, args, opts) {
      if (/sys\.executable/.test(args[args.length - 1])) {
        throw new Error('not found')
      } else {
        assert.fail()
      }
    }

    const { err } = await findPython(f)
    assert.ok(/Could not find any Python/.test(err))
    assert.ok(/not in PATH/.test(f.errorLog))
  })

  it('find python - no python, use python launcher', async function () {
    const f = new TestPythonFinder(null)
    f.win = true

    f.execFile = async function (program, args, opts) {
      if (program === 'py.exe') {
        assert.notStrictEqual(args.indexOf('-3'), -1)
        assert.notStrictEqual(args.indexOf('-c'), -1)
        return [null, 'Z:\\snake.exe']
      }
      if (/sys\.executable/.test(args[args.length - 1])) {
        throw new Error('not found')
      } else if (f.winDefaultLocations.includes(program)) {
        throw new Error('not found')
      } else if (/sys\.version_info/.test(args[args.length - 1])) {
        if (program === 'Z:\\snake.exe') {
          return [null, '3.9.0']
        } else {
          assert.fail()
        }
      } else {
        assert.fail()
      }
    }
    const { err, python } = await findPython(f)
    assert.strictEqual(err, null)
    assert.strictEqual(python, 'Z:\\snake.exe')
  })

  it('find python - no python, no python launcher, good guess', async function () {
    const f = new TestPythonFinder(null)
    f.win = true
    const expectedProgram = f.winDefaultLocations[0]

    f.execFile = async function (program, args, opts) {
      if (program === 'py.exe') {
        throw new Error('not found')
      }
      if (/sys\.executable/.test(args[args.length - 1])) {
        throw new Error('not found')
      } else if (program === expectedProgram &&
                 /sys\.version_info/.test(args[args.length - 1])) {
        return [null, '3.7.3']
      } else {
        assert.fail()
      }
    }
    const { err, python } = await findPython(f)
    assert.strictEqual(err, null)
    assert.ok(python === expectedProgram)
  })

  it('find python - no python, no python launcher, bad guess', async function () {
    const f = new TestPythonFinder(null)
    f.win = true

    f.execFile = async function (program, args, opts) {
      if (/sys\.executable/.test(args[args.length - 1])) {
        throw new Error('not found')
      } else if (/sys\.version_info/.test(args[args.length - 1])) {
        throw new Error('not a Python executable')
      } else {
        assert.fail()
      }
    }
    const { err } = await findPython(f)
    assert.ok(/Could not find any Python/.test(err))
    assert.ok(/not in PATH/.test(f.errorLog))
  })
})
