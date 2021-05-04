'use strict'

const tap = require('tap')
const { test } = tap
const findPython = require('../lib/find-python')
const cp = require('child_process')
const PythonFinder = findPython.test.PythonFinder
const util = require('util')
const path = require('path')
const npmlog = require('npmlog')
const fs = require('fs')
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
        strictDeepEqual(args, this.win ? this.argsExecutable.map((arg) => `"${arg}"`) : this.argsExecutable)
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
          t.equal(path, testString)
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
        t.notOk(path)

        t.ok(err)
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
        t.equal(err, null)

        t.equal(path, testString)

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
          t.equal(err, null)
          t.ok(pythonFinderInstance.winDefaultLocations.includes(path))
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
        t.equal(err, null)

        t.equal(path, testString)

        t.end()
      })

      pythonFinderInstance.win = true

      pythonFinderInstance.execFile = TestExecFile()
      pythonFinderInstance.findPython()
    })

    t.end()
  })

  // DONE: make symlink to python with utf-8 chars
  t.test('real testing', async (t) => {
    const paths = {
      python: '',
      pythonDir: '',
      testDir: '',
      baseDir: __dirname
    }

    const execFile = util.promisify(cp.execFile)

    // a bit tricky way to make PythonFinder promisified
    function promisifyPythonFinder (config) {
      let pythonFinderInstance

      const result = new Promise((resolve, reject) => {
        pythonFinderInstance = new PythonFinder(config, (err, path) => {
          if (err) {
            reject(err)
          } else {
            resolve(path)
          }
        })
      })

      return { pythonFinderInstance, result }
    }

    async function testPythonPath (t, pythonPath) {
      try {
        const { stderr, stdout } = await execFile(pythonPath, ['-V'])

        console.log('stdout:', stdout)
        console.log('stderr:', stderr)

        if (t.ok(stdout.includes('Python 3'), 'is it python with major version 3') &&
              t.equal(stderr, '', 'is stderr empty')) {
          return true
        }

        return false
      } catch (err) {
        t.equal(err, null, 'is error null')
        return false
      }
    }

    // await is needed because test func is async
    await t.test('trying to find real python exec', async (t) => {
      const { pythonFinderInstance, result } = promisifyPythonFinder(null)

      try {
        pythonFinderInstance.findPython()

        const pythonPath = await result

        if (t.ok(await testPythonPath(t, pythonPath), 'is path valid')) {
          // stdout contain output of "python -V" command, not python path
          // using found path as trusted
          paths.python = pythonPath
          paths.pythonDir = path.join(paths.python, '../')
        }
      } catch (err) {
        t.notOk(err, 'are we having error')
      }

      t.end()
    })

    await t.test(`test with path containing "${testString}"`, async (t) => {
      // making fixture
      paths.testDir = fs.mkdtempSync(path.resolve(paths.baseDir, 'node_modules', 'pythonFindTestFolder-'))

      // using "junction" to avoid permission error
      fs.symlinkSync(paths.pythonDir, path.resolve(paths.testDir, testString), 'junction')
      console.log('🚀 ~ file: test-find-python.js ~ line 312 ~ await.test ~ path.resolve(paths.testDir, testString)', path.resolve(paths.testDir, testString))
      console.log('🚀 ~ file: test-find-python.js ~ line 312 ~ await.test ~ paths.pythonDir', paths.pythonDir)

      const { pythonFinderInstance, result } = promisifyPythonFinder(path.resolve(paths.testDir, 'python'))

      pythonFinderInstance.findPython()

      const pythonPath = await result

      t.ok(await testPythonPath(t, pythonPath), 'is path valid')

      t.end()
    })

    // remove fixture
    if (fs.rmSync) {
      fs.rmSync(paths.testDir, { recursive: true })
    } else {
      //
      require('./rm.js')(paths.testDir)
    }

    t.end()
  })

  t.end()
})
