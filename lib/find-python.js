'use strict'
// @ts-check

const path = require('path')
const log = require('npmlog')
const semver = require('semver')
const cp = require('child_process')
const extend = require('util')._extend // eslint-disable-line
const win = process.platform === 'win32'
const logWithPrefix = require('./util').logWithPrefix

const systemDrive = process.env.SystemDrive || 'C:'
const username = process.env.USERNAME || process.env.USER || getOsUserInfo()
const localAppData = process.env.LOCALAPPDATA || `${systemDrive}\\${username}\\AppData\\Local`
const foundLocalAppData = process.env.LOCALAPPDATA || username
const programFiles = process.env.ProgramW6432 || process.env.ProgramFiles || `${systemDrive}\\Program Files`
const programFilesX86 = process.env['ProgramFiles(x86)'] || `${programFiles} (x86)`

const winDefaultLocationsArray = []
for (const majorMinor of ['39', '38', '37', '36']) {
  if (foundLocalAppData) {
    winDefaultLocationsArray.push(
      `${localAppData}\\Programs\\Python\\Python${majorMinor}\\python.exe`,
      `${programFiles}\\Python${majorMinor}\\python.exe`,
      `${localAppData}\\Programs\\Python\\Python${majorMinor}-32\\python.exe`,
      `${programFiles}\\Python${majorMinor}-32\\python.exe`,
      `${programFilesX86}\\Python${majorMinor}-32\\python.exe`
    )
  } else {
    winDefaultLocationsArray.push(
      `${programFiles}\\Python${majorMinor}\\python.exe`,
      `${programFiles}\\Python${majorMinor}-32\\python.exe`,
      `${programFilesX86}\\Python${majorMinor}-32\\python.exe`
    )
  }
}

function getOsUserInfo () {
  try {
    return require('os').userInfo().username
  } catch {}
}

//! after editing file dont forget run "npm test" and
//! change tests for this file if needed

// ? may be some addition info in silly and verbose levels
// ? add safety to colorizeOutput function. E.g. when terminal doesn't
// ? support colorizing, just disable it (return given string)
// i hope i made not bad error handling but may be some improvements would be nice
// TODO: better error handler on linux/macOS

const RED = '\x1b[31m'
const RESET = '\x1b[0m'
const GREEN = '\x1b[32m'

/**
 * Paint (not print, just colorize) string with selected color
 *
 * @param color color to set: RED or GREEN
 * @param {string} string string to colorize
 */
function colorizeOutput (color, string) {
  return color + string + RESET
}

//! on windows debug running with locale cmd (e. g. chcp 866) encoding
// to avoid that uncoment next lines
// locale encdoings couse issues. See run func for more info
// this lines only for testing
// win ? cp.execSync("chcp 65001") : null
// log.level = "silly";

/**
 * @class
 */
class PythonFinder {
  /**
   *
   * @param {string} configPython force setted from terminal or npm config python path
   * @param {(err:Error, found:string) => void} callback succsed/error callback from where result
   * is available
   */
  constructor (configPython, callback) {
    this.callback = callback
    this.configPython = configPython
    this.errorLog = []

    this.catchErrors = this.catchErrors.bind(this)
    this.checkExecPath = this.checkExecPath.bind(this)
    this.succeed = this.succeed.bind(this)

    this.SKIP = 0
    this.FAIL = 1

    this.log = logWithPrefix(log, 'find Python')

    this.argsExecutable = [path.resolve(__dirname, 'find-python-script.py')]
    this.argsVersion = [
      '-c',
      'import sys; print("%s.%s.%s" % sys.version_info[:3]);'
      // for testing
      // 'print("2.1.1")'
    ]
    this.semverRange = '>=3.6.0'
    // These can be overridden for testing:
    this.execFile = cp.execFile
    this.env = process.env
    this.win = win
    this.pyLauncher = 'py.exe'
    this.winDefaultLocations = winDefaultLocationsArray
  }

  /**
   * Logs a message at verbose level, but also saves it to be displayed later
   * at error level if an error occurs. This should help diagnose the problem.
   *
   * ?message is array or one string
   *
   * @private
   */
  addLog (message) {
    this.log.verbose(message)
    this.errorLog.push(message)
  }

  /**
   * Find Python by trying a sequence of possibilities.
   * Ignore errors, keep trying until Python is found.
   *
   * @public
   */
  findPython () {
    this.toCheck = this.getChecks()

    this.runChecks(this.toCheck)
  }

  /**
   * Getting list of checks which should be cheked
   *
   * @private
   * @returns {check[]}
   */
  getChecks () {
    if (this.env.NODE_GYP_FORCE_PYTHON) {
      /**
       * @type {check[]}
       */
      return [
        {
          before: () => {
            this.addLog(
              'checking Python explicitly set from NODE_GYP_FORCE_PYTHON'
            )
            this.addLog(
              '- process.env.NODE_GYP_FORCE_PYTHON is ' +
                `"${this.env.NODE_GYP_FORCE_PYTHON}"`
            )
          },
          checkFunc: this.checkCommand,
          arg: this.env.NODE_GYP_FORCE_PYTHON
        }
      ]
    }

    /**
     * @type {check[]}
     */
    const checks = [
      {
        before: (name) => {
          if (!this.configPython) {
            this.addLog(
              `${colorizeOutput(
                GREEN,
                'Python is not set from command line or npm configuration'
              )}`
            )
            this.addLog('')
            return this.SKIP
          }
          this.addLog(
            'checking Python explicitly set from command line or ' +
              'npm configuration'
          )
          this.addLog(
            '- "--python=" or "npm config get python" is ' +
              `"${colorizeOutput(GREEN, this.configPython)}"`
          )
        },
        checkFunc: this.checkCommand,
        arg: this.configPython
      },
      {
        before: (name) => {
          if (!this.env.PYTHON) {
            this.addLog(
              `Python is not set from environment variable ${colorizeOutput(
                GREEN,
                'PYTHON'
              )}`
            )
            return this.SKIP
          }
          this.addLog(
            'checking Python explicitly set from environment ' +
              'variable PYTHON'
          )
          this.addLog(
            `${colorizeOutput(
              GREEN,
              'process.env.PYTHON'
            )} is "${colorizeOutput(GREEN, this.env.PYTHON)}"`
          )
        },
        checkFunc: this.checkCommand,
        arg: this.env.PYTHON,
        // name used as very short description
        name: 'process.env.PYTHON'
      },
      {
        checkFunc: this.checkCommand,
        name: 'python3',
        arg: 'python3'
      },
      {
        checkFunc: this.checkCommand,
        name: 'python',
        arg: 'python'
      },
    ]

    if (this.win) {
      for (let i = 0; i < this.winDefaultLocations.length; ++i) {
        const location = this.winDefaultLocations[i]
        checks.push({
          before: () => {
            this.addLog(
              `checking if Python is ${colorizeOutput(GREEN, location)}`
            )
          },
          checkFunc: this.checkExecPath,
          arg: location
        })
      }
      checks.push({
        before: () => {
          this.addLog(
            `checking if the ${colorizeOutput(
              GREEN,
              'py launcher'
            )} can be used to find Python`
          )
        },
        checkFunc: this.checkPyLauncher,
        name: 'py Launcher'
      })
    }

    return checks
  }

  /**
   * Type for possible place where python is
   *
   * @typedef check
   * @type {object}
   * @property {(name: string) => number|void} [before]
   * @property {function} checkFunc
   * @property {*} [arg]
   * @property {string} [name]
   */

  /**
   *
   *
   * @private
   * @argument {check[]} checks
   */
  async runChecks (checks) {
    // using this flag becouse Fail is happen when ALL checks fail
    let fail = true

    for (const check of checks) {
      if (check.before) {
        const beforeResult = check.before.apply(this)

        // if pretask fail - skip
        if (beforeResult === this.SKIP || beforeResult === this.FAIL) {
          // ?optional
          // TODO: write to result arr which tests is SKIPPED
          continue
        }
      }

      try {
        if (!check.before) {
          this.addLog(
            `checking if ${colorizeOutput(
              GREEN,
              check.name || check.arg
            )} can be used`
          )
        }

        this.log.verbose(
          `executing "${colorizeOutput(
            GREEN,
            check.name || check.arg
          )}" to get Python executable path`
        )

        const result = await check.checkFunc.apply(this, [check ? check.arg : null])
        fail = false
        this.succeed(result.path, result.version)

        break
      } catch (err) {
        this.catchErrors(err, check)
      }
    }

    if (fail) {
      this.fail()
    }
  }

  /**
   * Check if command is a valid Python to use.
   * Will exit the Python finder on success.
   * If on Windows, run in a CMD shell to support BAT/CMD launchers.
   *
   * @private
   * @argument {string} command command which will be executed in shell
   * @returns {Promise}
   */
  checkCommand (command) {
    let exec = command
    let args = this.argsExecutable
    let shell = false
    if (this.win) {
      // Arguments have to be manually quoted to avoid bugs with spaces in pathes
      exec = `"${exec}"`
      args = args.map((a) => `"${a}"`)
      shell = true
    }

    return new Promise((resolve, reject) => {
      this.run(exec, args, shell).then(this.checkExecPath).then(resolve).catch(reject)
    })
  }

  /**
   * Check if the py launcher can find a valid Python to use.
   * Will exit the Python finder on success.
   * Distributions of Python on Windows by default install with the "py.exe"
   * Python launcher which is more likely to exist than the Python executable
   * being in the $PATH.
   *
   * @private
   * @returns {Promise}
   */
  checkPyLauncher () {
    return new Promise((resolve, reject) => {
      this.run(this.pyLauncher, this.argsExecutable, false)
        .then(this.checkExecPath)
        .then(resolve)
        .catch(reject)
    })
  }

  /**
   *
   * Check if a getted path is correct and
   * Python executable hase the correct version to use.
   *
   * @private
   * @argument {string} execPath path to check
   * @returns {Promise}
   */
  checkExecPath (execPath) {
    // Returning new Promise instead of forwarding existing
    // to pass both path and version
    return new Promise((resolve, reject) => {
      this.log.verbose(`- executing "${execPath}" to get version`)
      this.run(execPath, this.argsVersion, false)
        .then((ver) => {
          // ? may be better code for version check
          // ? may be move log messgaes to catchError func
          const range = new semver.Range(this.semverRange)
          let valid = false

          try {
            valid = range.test(ver)
            // throw new Error("test error")
          } catch (err) {
            this.log.silly(`range.test() threw:\n${err.stack}`)
            this.addLog(
              `"${colorizeOutput(RED, execPath)}" does not have a valid version`
            )
            this.addLog('is it a Python executable?')

            reject(err)
          }

          if (!valid) {
            this.addLog(
              `version is ${colorizeOutput(
                RED,
                ver
              )} - should be ${colorizeOutput(RED, this.semverRange)}`
            )
            this.addLog(
              colorizeOutput(RED, 'THIS VERSION OF PYTHON IS NOT SUPPORTED')
            )
            // object with error passed for conveniences
            // (becouse we can also pass stderr or some additional staff)
            // eslint-disable-next-line prefer-promise-reject-errors
            reject({ err: new Error(`Found unsupported Python version ${ver}`) })
          }

          resolve({ path: execPath, version: ver })
        })
        .catch(reject)
    })
  }

  /**
   * Run an executable or shell command, trimming the output.
   *
   * @private
   * @argument {string} exec command or path without arguments to execute
   * @argument {string[]} args command args
   * @argument {boolean} shell need be documented
   * @returns {Promise}
   */
  run (exec, args, shell) {
    return new Promise(
      /**
       * @this {PythonFinder}
       * @argument {function} resolve
       * @argument {function} reject
       */
      function (resolve, reject) {
        const env = extend({}, this.env)
        env.TERM = 'dumb'
        const opts = { env: env, shell: shell }

        this.log.verbose(
          `${colorizeOutput(GREEN, 'execFile')}: exec = %j`,
          exec
        )
        this.log.verbose(
          `${colorizeOutput(GREEN, 'execFile')}: args = %j`,
          args
        )
        this.log.silly('execFile: opts = ', JSON.stringify(opts, null, 2))

        //* assume that user use utf8 compatible termnal

        //* prosible outcomes with error messages (err.message, error.stack, stderr)
        //! on windows:
        // issue of encoding (garbage in terminal ) when 866 or any other locale code
        // page is setted
        // possible solutions:
        // use "cmd" command with flag "/U" and "/C" (for more informatiom help cmd)
        // which "Causes the output of
        // internal commands to a pipe or file to be Unicode" (utf16le)
        //* note: find-python-script.py send output in utf8 then may become necessary
        //* to reencoded string with Buffer.from(stderr).toString() or something
        //* similar (if needed)
        // for this solution all args should be passed as SINGLE string in quotes
        // becouse cmd has such signature: CMD [/A | /U] [/Q] [/D] [/E:ON | /E:OFF]
        // [/F:ON | /F:OFF] [/V:ON | /V:OFF] [[/S] [/C | /K] string]
        //* all pathes/commands and each argument must be in quotes becouse if they have
        //* spaces they will broke everything
        this.execFile(exec, args, opts, execFileCallback.bind(this))

        /**
         *
         * @param {Error} err
         * @param {string} stdout
         * @param {string} stderr
         */
        function execFileCallback (err, stdout, stderr) {
          this.log.silly(
            `${colorizeOutput(RED, 'execFile result')}: err =`,
            (err && err.stack) || err
          )

          // executed script shouldn't pass anythong to stderr if successful
          if (err || stderr) {
            reject({ err: err || null, stderr: stderr || null })
          } else {
            // trim function removing endings which couse bugs when comparing strings
            const stdoutTrimed = stdout.trim()
            resolve(stdoutTrimed)
          }
        }
      }.bind(this)
    )
  }

  /**
   * Main error handling function in module
   * Promises should throw errors up to this function
   * Also used for logging
   *
   * @private
   * TODO: figure out err type
   * @param {{err: Error, stderr: string}} error
   * @param {check} check
   */
  catchErrors (error, check) {
    const { err, stderr } = error

    this.addLog(colorizeOutput(RED, `FAIL: ${check.name || check.arg}`))

    // array of error codes (type of errors) that we handling
    const catchedErrorsCods = ['ENOENT', 9009]

    // dont know type of terminal errors
    // @ts-ignore
    if (catchedErrorsCods.includes(err ? err.code : undefined)) {
      // @ts-ignore
      switch (err ? err.code : undefined) {
        case 'ENOENT':
          this.addLog(
            `${colorizeOutput(
              RED,
              'ERROR:'
              // @ts-ignore
            )} No such file or directory: ${colorizeOutput(RED, err.path)}`
          )
          break

        case 9009:
          this.addLog(
            `${colorizeOutput(
              RED,
              'ERROR:'
            )} Command failed: file not found or not in PATH`
          )
          break
      }
    } else {
      this.addLog(`${colorizeOutput(RED, 'ERROR:')} ${err ? err.message : ''}`)
      this.log.silly(err ? err.stack : '')

      if (stderr) {
        this.addLog(`${colorizeOutput(RED, 'STDERR:')} ${stderr ? stderr.trim() : ''}`)
      }
    }
    this.addLog('--------------------------------------------')
  }

  /**
   * Function which is called if python path founded
   *
   * @private
   * @param {string} execPath founded path
   * @param {string} version python version
   */
  succeed (execPath, version) {
    this.log.info(
      `using Python version ${colorizeOutput(
        GREEN,
        version
      )} found at "${colorizeOutput(GREEN, execPath)}"`
    )
    process.nextTick(this.callback.bind(null, null, execPath))
  }

  /**
   * @private
   */
  fail () {
    const errorLog = this.errorLog.map((str) => str.trim()).join('\n')

    const pathExample = this.win
      ? 'C:\\Path\\To\\python.exe'
      : '/path/to/pythonexecutable'
    // For Windows 80 col console, use up to the column before the one marked
    // with X (total 79 chars including logger prefix, 58 chars usable here):
    //                                                           X
    const info = [
      '**********************************************************',
      'If you have non-displayed characters set "UTF-8" encoding.',
      'You need to install the latest version of Python.',
      'Node-gyp should be able to find and use Python. If not,',
      'you can try one of the following options:',
      `- Use the switch --python="${pathExample}"`,
      '  (accepted by both node-gyp and npm)',
      '- Set the environment variable PYTHON',
      '- Set the npm configuration variable python:',
      `  npm config set python "${pathExample}"`,
      'For more information consult the documentation at:',
      'https://github.com/nodejs/node-gyp#installation',
      '**********************************************************'
    ].join('\n')

    this.log.error(`\n${errorLog}\n\n${info}\n`)
    process.nextTick(
      this.callback.bind(
        null,
        // if changing error message dont forget also change it test file too
        new Error('Could not find any Python installation to use')
      )
    )
  }
}

/**
 *
 * @param {string} configPython force setted from terminal or npm config python path
 * @param {(err:Error, found:string)=> void} callback succsed/error callback from where result
 * is available
 */
function findPython (configPython, callback) {
  const finder = new PythonFinder(configPython, callback)
  finder.findPython()
}

// function for tests
/* findPython(null, (err, found) => {
  console.log('found:', '\x1b[31m', found)
  console.log('\x1b[0m')
})
 */
module.exports = findPython
module.exports.test = {
  PythonFinder: PythonFinder,
  findPython: findPython
}
