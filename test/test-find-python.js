'use strict'

delete process.env.PYTHON

const { test } = require('tap')
const { execFile } = require('child_process')
const { findPython, PythonFinder } = require('../lib/find-python').test

require('npmlog').level = 'warn'

test('find python', (t) => {
  t.plan(4)

  findPython(null, (err, found) => {
    t.strictEqual(err, null)
    const proc = execFile(found, ['-V'], (err, stdout, stderr) => {
      t.strictEqual(err, null)
      if (/Python 2/.test(stderr)) {
        t.strictEqual(stdout, '')
        t.ok(/Python 2/.test(stderr))
      } else {
        t.ok(/Python 3/.test(stdout))
        t.strictEqual(stderr, '')
      }
    })
    proc.stdout.setEncoding('utf-8')
    proc.stderr.setEncoding('utf-8')
  })
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

function TestPythonFinder (...args) {
  PythonFinder.apply(this, args)
}

TestPythonFinder.prototype = Object.create(PythonFinder.prototype)

// Silence npmlog - remove for debugging
TestPythonFinder.prototype.log = {
  silly: () => {},
  verbose: () => {},
  info: () => {},
  warn: () => {},
  error: () => {}
}

delete TestPythonFinder.prototype.env.NODE_GYP_FORCE_PYTHON

test('find python - python', (t) => {
  t.plan(6)

  const f = new TestPythonFinder('python', (err, python) => {
    t.strictEqual(err, null)
    t.strictEqual(python, '/path/python')
  })

  f.execFile = (program, args, opts, cb) => {
    f.execFile = (program, args, opts, cb) => {
      poison(f, 'execFile')
      t.strictEqual(program, '/path/python')
      t.ok(/sys\.version_info/.test(args[1]))
      cb(null, '2.7.15')
    }
    t.strictEqual(program,
      process.platform === 'win32' ? '"python"' : 'python')
    t.ok(/sys\.executable/.test(args[1]))
    cb(null, '/path/python')
  }

  f.findPython()
})

test('find python - python too old', (t) => {
  t.plan(2)

  const f = new TestPythonFinder(null, (err) => {
    t.ok(/Could not find any Python/.test(err))
    t.ok(/not supported/i.test(f.errorLog))
  })

  f.execFile = (program, args, opts, cb) => {
    if (/sys\.executable/.test(args[args.length - 1])) {
      cb(null, '/path/python')
    } else if (/sys\.version_info/.test(args[args.length - 1])) {
      cb(null, '2.3.4')
    } else {
      t.fail()
    }
  }

  f.findPython()
})

test('find python - no python', (t) => {
  t.plan(2)

  const f = new TestPythonFinder(null, (err) => {
    t.ok(/Could not find any Python/.test(err))
    t.ok(/not in PATH/.test(f.errorLog))
  })

  f.execFile = (program, args, opts, cb) => {
    if (/sys\.executable/.test(args[args.length - 1])) {
      cb(new Error('not found'))
    } else if (/sys\.version_info/.test(args[args.length - 1])) {
      cb(new Error('not a Python executable'))
    } else {
      t.fail()
    }
  }

  f.findPython()
})

test('find python - no python2, no python, unix', (t) => {
  t.plan(2)

  const f = new TestPythonFinder(null, (err) => {
    t.ok(/Could not find any Python/.test(err))
    t.ok(/not in PATH/.test(f.errorLog))
  })

  f.checkPyLauncher = t.fail
  f.win = false

  f.execFile = (program, args, opts, cb) => {
    if (/sys\.executable/.test(args[args.length - 1])) {
      cb(new Error('not found'))
    } else {
      t.fail()
    }
  }

  f.findPython()
})

test('find python - no python, use python launcher', (t) => {
  t.plan(4)

  const f = new TestPythonFinder(null, (err, python) => {
    t.strictEqual(err, null)
    t.strictEqual(python, 'Z:\\snake.exe')
  })
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

  f.findPython()
})

test('find python - no python, no python launcher, good guess', (t) => {
  t.plan(2)

  const re = /C:[\\/]Python37[\\/]python[.]exe/
  const f = new TestPythonFinder(null, (err, python) => {
    t.strictEqual(err, null)
    t.ok(re.test(python))
  })
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

  f.findPython()
})

test('find python - no python, no python launcher, bad guess', (t) => {
  t.plan(2)

  const f = new TestPythonFinder(null, (err) => {
    t.ok(/Could not find any Python/.test(err))
    t.ok(/not in PATH/.test(f.errorLog))
  })
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

  f.findPython()
})
