'use strict'

const tap = require('tap')
const { test } = tap
const findPython = require('../lib/find-python')
const execFile = require('child_process').execFile
const PythonFinder = findPython.test.PythonFinder

const npmlog = require('npmlog')
npmlog.level = 'silent'

// what final error message displayed in terminal should contain
const finalErrorMessage = 'Could not find any Python'

//! don't forget manually call pythonFinderInstance.findPython()

// String emulating path command or anything else with spaces
// and UTF-8 characters.
// Is returned by execFile
//! USE FOR ALL STRINGS
const testString = 'python one love♥'
const testVersions = {
  outdated: '2.0.0',
  normal: '3.9.0',
  testError: new Error('test error')
}

function strictDeepEqual (received, wanted) {
  let result = false

  for (let i = 0; i < received.length; i++) {
    if (Array.isArray(received[i]) && Array.isArray(wanted[i])) {
      result = strictDeepEqual(received[i], wanted[i])
    } else {
      result = received[i] === wanted[i]
    }

    if (!result) {
      return result
    }
  }

  return result
}

/**
 * @typedef OptionsObj
 * @property {boolean} [shouldProduceError] pass test error to callback
 * @property {boolean} [checkingPyLauncher]
 * @property {boolean} [isPythonOutdated] return outdated version
 * @property {boolean} [checkingWinDefaultPathes]
 *
 */

/**
 * @param {OptionsObj} [optionsObj]
 */
function TestExecFile (optionsObj) {
  /**
   *
   * @this {PythonFinder}
   */
  return function testExecFile (exec, args, options, callback) {
    if (!(optionsObj ? optionsObj.shouldProduceError : false)) {
      if (args === this.argsVersion) {
        if (optionsObj ? optionsObj.checkingWinDefaultPathes : false) {
          if (this.winDefaultLocations.includes(exec)) {
            callback(null, testVersions.normal)
          } else {
            callback(new Error('not found'))
          }
        } else if (optionsObj ? optionsObj.isPythonOutdated : false) {
          callback(null, testVersions.outdated, null)
        } else {
          callback(null, testVersions.normal, null)
        }
      } else if (
        // DONE: map through argsExecutable to check that all args are equals
        strictDeepEqual(args, this.argsExecutable.map((arg) => `"${arg}"`))
      ) {
        if (optionsObj ? optionsObj.checkingPyLauncher : false) {
          if (
            exec === 'py.exe' ||
            exec === (this.win ? '"python"' : 'python')
          ) {
            callback(null, testString, null)
          } else {
            callback(new Error('not found'))
          }
        } else if (optionsObj ? optionsObj.checkingWinDefaultPathes : false) {
          callback(new Error('not found'))
        } else {
          // should be trimmed
          callback(null, testString + '\n', null)
        }
      } else {
        throw new Error(
          `invalid arguments are provided! provided args 
are: ${args};\n\nValid are: \n${this.argsExecutable}\n${this.argsVersion}`
        )
      }
    } else {
      const testError = new Error(
        `test error ${testString}; optionsObj: ${optionsObj}`
      )
      callback(testError)
    }
  }
}

/**
 *
 * @param {boolean} isPythonOutdated if true will return outdated version of python
 * @param {OptionsObj} optionsObj
 */

test('find-python', { buffered: true }, (t) => {
  t.test('whole module tests', (t) => {
    t.test('python found', (t) => {
      const pythonFinderInstance = new PythonFinder(null, (err, path) => {
        if (err) {
          t.fail(
            `mustn't produce any errors if execFile doesn't produced error. ${err}`
          )
        } else {
          t.strictEqual(path, testString)
          t.end()
        }
      })
      pythonFinderInstance.execFile = TestExecFile()

      pythonFinderInstance.findPython()
    })

    t.test('outdated version of python found', (t) => {
      const pythonFinderInstance = new PythonFinder(null, (err, path) => {
        if (!err) {
          t.fail("mustn't return path for outdated version")
        } else {
          t.end()
        }
      })

      pythonFinderInstance.execFile = TestExecFile({ isPythonOutdated: true })

      pythonFinderInstance.findPython()
    })

    t.test('no python on computer', (t) => {
      const pythonFinderInstance = new PythonFinder(null, (err, path) => {
        t.ok(err.message.includes(finalErrorMessage))
        t.end()
      })

      pythonFinderInstance.execFile = TestExecFile({
        shouldProduceError: true
      })

      pythonFinderInstance.findPython()
    })

    t.test('no python, unix', (t) => {
      const pythonFinderInstance = new PythonFinder(null, (err, path) => {
        t.false(path)

        t.true(err)
        t.ok(err.message.includes(finalErrorMessage))
        t.end()
      })

      pythonFinderInstance.win = false
      pythonFinderInstance.checkPyLauncher = t.fail

      pythonFinderInstance.execFile = TestExecFile({
        shouldProduceError: true
      })

      pythonFinderInstance.findPython()
    })

    t.test('no python, use python launcher', (t) => {
      const pythonFinderInstance = new PythonFinder(null, (err, path) => {
        t.strictEqual(err, null)

        t.strictEqual(path, testString)

        t.end()
      })

      pythonFinderInstance.win = true

      pythonFinderInstance.execFile = TestExecFile({
        checkingPyLauncher: true
      })

      pythonFinderInstance.findPython()
    })

    t.test(
      'no python, no python launcher, checking win default locations',
      (t) => {
        const pythonFinderInstance = new PythonFinder(null, (err, path) => {
          t.strictEqual(err, null)
          t.true(pythonFinderInstance.winDefaultLocations.includes(path))
          t.end()
        })

        pythonFinderInstance.win = true

        pythonFinderInstance.execFile = TestExecFile({
          checkingWinDefaultPathes: true
        })
        pythonFinderInstance.findPython()
      }
    )

    t.test('python is setted from config', (t) => {
      const pythonFinderInstance = new PythonFinder(testString, (err, path) => {
        t.strictEqual(err, null)

        t.strictEqual(path, testString)

        t.end()
      })

      pythonFinderInstance.win = true

      pythonFinderInstance.execFile = TestExecFile()
      pythonFinderInstance.findPython()
    })

    t.end()
  })

  // TODO: make symlink to python with utf-8 chars
  t.test('real testing (trying to find real python exec)', (t) => {
    const pythonFinderInstance = new PythonFinder(null, (err, path) => {
      t.strictEqual(err, null)

      execFile(path, ['-V'], (err, stdout, stderr) => {
        t.false(err)
        console.log('stdout:' + stdout)
        console.log('stderr:' + stderr)

        t.ok(stdout.includes('Python 3'))
        t.strictEqual(stderr, '')

        t.end()
      })
    })

    pythonFinderInstance.findPython()
  })

  t.end()
})
