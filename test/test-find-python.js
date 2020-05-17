'use strict'

delete process.env.PYTHON

const { test } = require('tap')
const { execFile } = require('child_process')
const { findPython, PythonFinder } = require('../lib/find-python').test

require('npmlog').level = 'warn'

test('find python', async (t) => {
  t.plan(2)

  const found = await findPython(null)
  const { stdout, stderr } = await new Promise((resolve, reject) => {
    const proc = execFile(found, ['-V'], (err, stdout, stderr) => {
      if (err) {
        return reject(err)
      }
      resolve({ stdout, stderr })
    })
    proc.stdout.setEncoding('utf-8')
    proc.stderr.setEncoding('utf-8')
  })
  if (/Python 2/.test(stderr)) {
    t.strictEqual(stdout, '')
    t.ok(/Python 2/.test(stderr))
  } else {
    t.ok(/Python 3/.test(stdout))
    t.strictEqual(stderr, '')
  }
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

class TestPythonFinder extends PythonFinder {
  constructor (...args) {
    super(...args)

    // Silence npmlog - remove for debugging
    this.log = {
      silly: () => {},
      verbose: () => {},
      info: () => {},
      warn: () => {},
      error: () => {}
    }

    delete this.env.NODE_GYP_FORCE_PYTHON
  }
}

test('find python - python', async (t) => {
  t.plan(5)

  const f = new TestPythonFinder('python')

  f.execFile = (program, args, opts, cb) => {
    f.execFile = (program, args, opts, cb) => {
      poison(f, 'execFile')
      t.strictEqual(program, '/path/python')
      t.ok(/sys\.version_info/.test(args[1]))
      cb(null, '2.7.15')
    }
    t.strictEqual(program, process.platform === 'win32' ? '"python"' : 'python')
    t.ok(/sys\.executable/.test(args[1]))
    cb(null, '/path/python')
  }

  const python = await f.findPython()
  t.strictEqual(python, '/path/python')
})

test('find python - python too old', async (t) => {
  t.plan(2)

  const f = new TestPythonFinder(null)

  f.execFile = (program, args, opts, cb) => {
    if (/sys\.executable/.test(args[args.length - 1])) {
      cb(null, '/path/python')
    } else if (/sys\.version_info/.test(args[args.length - 1])) {
      cb(null, '2.3.4')
    } else {
      t.fail()
    }
  }

  await t.rejects(() => f.findPython(), /Could not find any Python/)
  t.ok(/not supported/i.test(f.errorLog))
})

test('find python - no python', async (t) => {
  t.plan(2)

  const f = new TestPythonFinder(null)

  f.execFile = (program, args, opts, cb) => {
    if (/sys\.executable/.test(args[args.length - 1])) {
      cb(new Error('not found'))
    } else if (/sys\.version_info/.test(args[args.length - 1])) {
      cb(new Error('not a Python executable'))
    } else {
      t.fail()
    }
  }

  await t.rejects(() => f.findPython(), /Could not find any Python/)
  t.ok(/not in PATH/.test(f.errorLog))
})

test('find python - no python2, no python, unix', async (t) => {
  t.plan(2)

  const f = new TestPythonFinder(null)
  f.checkPyLauncher = t.fail
  f.win = false

  f.execFile = (program, args, opts, cb) => {
    if (/sys\.executable/.test(args[args.length - 1])) {
      cb(new Error('not found'))
    } else {
      t.fail()
    }
  }

  await t.rejects(() => f.findPython(), /Could not find any Python/)
  t.ok(/not in PATH/.test(f.errorLog))
})

test('find python - no python, use python launcher', async (t) => {
  t.plan(3)

  const f = new TestPythonFinder(null)
  f.win = true

  f.execFile = (program, args, opts, cb) => {
    if (program === 'py.exe') {
      t.notEqual(args.indexOf('-2'), -1)
      t.notEqual(args.indexOf('-c'), -1)
      return cb(null, 'Z:\\snake.exe')
    }
    if (/sys\.executable/.test(args[args.length - 1])) {
      cb(new Error('not found'))
    } else if (f.winDefaultLocations.includes(program)) {
      cb(new Error('not found'))
    } else if (/sys\.version_info/.test(args[args.length - 1])) {
      if (program === 'Z:\\snake.exe') {
        cb(null, '2.7.14')
      } else {
        t.fail()
      }
    } else {
      t.fail()
    }
  }

  const python = await f.findPython()
  t.strictEqual(python, 'Z:\\snake.exe')
})

test('find python - no python, no python launcher, good guess', async (t) => {
  t.plan(1)

  const re = /C:[\\/]Python37[\\/]python[.]exe/
  const f = new TestPythonFinder(null)
  f.win = true

  f.execFile = (program, args, opts, cb) => {
    if (program === 'py.exe') {
      return cb(new Error('not found'))
    }
    if (/sys\.executable/.test(args[args.length - 1])) {
      cb(new Error('not found'))
    } else if (re.test(program) &&
        /sys\.version_info/.test(args[args.length - 1])) {
      cb(null, '3.7.3')
    } else {
      t.fail()
    }
  }

  const python = await f.findPython()
  t.ok(re.test(python))
})

test('find python - no python, no python launcher, bad guess', async (t) => {
  t.plan(2)

  const f = new TestPythonFinder(null)
  f.win = true

  f.execFile = (program, args, opts, cb) => {
    if (/sys\.executable/.test(args[args.length - 1])) {
      cb(new Error('not found'))
    } else if (/sys\.version_info/.test(args[args.length - 1])) {
      cb(new Error('not a Python executable'))
    } else {
      t.fail()
    }
  }

  await t.rejects(() => f.findPython(), /Could not find any Python/)
  t.ok(/not in PATH/.test(f.errorLog))
})
