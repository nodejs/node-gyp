// @ts-check
'use strict'

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

// DONE: make more beautiful solution for selector of color
const colorHighlight = {
  RED: '\x1b[31m',
  RESET: '\x1b[0m',
  GREEN: '\x1b[32m'
}

/**
 * Paint (not print, just colorize) string with selected color
 *
 * @param color color to set: colorHighlight.RED or colorHighlight.GREEN
 * @param {string} string string to colorize
 */
function colorizeOutput (color, string) {
  return color + string + colorHighlight.RESET
}

//! on windows debug running with locale cmd encoding (e. g. chcp 866)
// to avoid that uncomment next lines
// locale encodings cause issues. See run func for more info
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
   * @param {(err:Error, found:string) => void} callback succeed/error callback from where result
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
    // write also to verbose for consistent output
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
   * Getting list of checks which should be checked
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
                colorHighlight.GREEN,
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
              `"${colorizeOutput(colorHighlight.GREEN, this.configPython)}"`
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
                colorHighlight.GREEN,
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
              colorHighlight.GREEN,
              'process.env.PYTHON'
            )} is "${colorizeOutput(colorHighlight.GREEN, this.env.PYTHON)}"`
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
              `checking if Python is "${colorizeOutput(colorHighlight.GREEN, location)}"`
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
              colorHighlight.GREEN,
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
   * @property {(name: string) => number|void} [before] what to execute before running check itself
   * @property {function} checkFunc function which will perform check
   * @property {string} [arg] what will be executed
   * @property {string} [name] how check is named. this name is displayed to user
   * @property {{shell: boolean}} [options] additional data, may be extended later, if shell true, exec command as in shell
   */

  /**
   *
   *
   * @private
   * @argument {check[]} checks
   */
  async runChecks (checks) {
    // using this flag because Fail is happen when ALL checks fail
    let fail = true

    for (const check of checks) {
      if (check.before) {
        const beforeResult = check.before.apply(this, [check.name])

        // if pretask fail - skip
        if (beforeResult === this.SKIP || beforeResult === this.FAIL) {
          // ?optional
          // TODO: write to result arr which tests are SKIPPED
          continue
        }
      }

      try {
        if (!check.before) {
          this.addLog(
            `checking if "${colorizeOutput(
              colorHighlight.GREEN,
              check.name || check.arg
            )}" can be used`
          )
        }

        this.log.verbose(
          `executing "${colorizeOutput(
            colorHighlight.GREEN,
            // DONE: swap in favor of arg (user want to see what we actually will run not how it is named)
            check.arg || check.name
          )}" to get Python executable path`
        )

        const result = await check.checkFunc.apply(this, [
          check ? check.arg : null
        ])
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

    // TODO: add explanation why shell is needed
    if (this.win) {
      // Arguments have to be manually quoted to avoid bugs with spaces in paths
      shell = true
      exec = `"${exec}"`
      args = args.map((a) => `"${a}"`)
    }

    return new Promise((resolve, reject) => {
      this.run(exec, args, shell)
        .then(this.checkExecPath)
        .then(resolve)
        .catch(reject)
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
  // theoretically this method can be removed in favor of checkCommand and getChecks.
  // the only difference between checkCommand and checkPyLauncher is the shell arg for run function
  // BUT! if we will use declarative style (would be cool i think)
  // then we should somehow instruct checkCommand esp. on windows, that
  // we do not want to execute command in the shell mode.
  // Have tried to do this via "optional.shell" property of check object
  // but have failed, because to support high modularity of file
  // consistent interface across functions should be supported.
  // Thus we have to pass check object not only in checkCommand but in
  // every other function in conveyor.
  // Passing check to every function from previous in promise chain would lead to
  // hard to fix errors and overcomplicate structure of module

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
   * Check if a gotten path is correct and
   * Python executable has the correct version to use.
   *
   * @private
   * @argument {string} execPath path to check
   * @returns {Promise}
   */
  checkExecPath (execPath) {
    // Returning new Promise instead of forwarding existing
    // to pass both path and version
    return new Promise((resolve, reject) => {
      this.log.verbose(`executing "${colorizeOutput(colorHighlight.GREEN, execPath)}" to get version`)

      // do not wrap with quotes because executing without shell
      this.run(execPath, this.argsVersion, false)
        .then((ver) => {
          this.log.silly(colorizeOutput(colorHighlight.GREEN, 'version got:'), ver)
          // ? may be better code for version check
          // ? may be move log messages to catchError func
          const range = new semver.Range(this.semverRange)
          let valid = false

          try {
            valid = range.test(ver)
            // throw new Error("test error")
          } catch (err) {
            this.log.silly(`range.test() threw:\n${err.stack}`)
            this.addLog(
              `"${colorizeOutput(colorHighlight.RED, execPath)}" does not have a valid version`
            )
            this.addLog('Is it a Python executable?')

            // if you need to pass additional data, use ErrorWithData class
            // you can also use any Error capable object
            return reject(err)
          }

          if (!valid) {
            this.addLog(
              `version is ${colorizeOutput(
                colorHighlight.RED,
                ver
              )} - should be ${colorizeOutput(colorHighlight.RED, this.semverRange)}`
            )
            this.addLog(
              colorizeOutput(colorHighlight.RED, 'THIS VERSION OF PYTHON IS NOT SUPPORTED')
            )
            // if you need to pass additional data, use ErrorWithData class
            reject(new Error(`Found unsupported Python version ${ver}`))
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
        /** @type {cp.ExecFileOptions} */
        const opts = { env: env, shell: shell }

        this.log.verbose(`${colorizeOutput(colorHighlight.GREEN, 'execFile')}: exec = `, exec)
        this.log.verbose(`${colorizeOutput(colorHighlight.GREEN, 'execFile')}: args = `, args)
        // TODO: make beauty print of PATH property (new line by semicolon)
        this.log.silly(`${colorizeOutput(colorHighlight.GREEN, 'execFile')}: opts = `, JSON.stringify(opts, null, 2), '\n\n')

        //* possible outcomes with error messages on Windows (err.message, error.stack?, stderr)
        // issue of encoding (garbage in terminal ) when 866 or any other locale code
        // page is setted
        // possible solutions:
        // 1. leave it as is and just warn the user that it should use utf8
        // (already done in this.catchError's info statement)
        // 2. somehow determine the user's terminal encoding and use utils.TextDecoder
        // with the raw buffer from execFile.
        // Requires to correct error.message because garbage persists there
        // 3. Force the user's terminal to use utf8 encoding via e.g. run "chcp 65001". May break user's programs
        // 4. use "cmd" command with flag "/U" and "/C" (for more information run "help cmd")
        // which "Causes the output of
        // internal commands ... to be Unicode" (utf16le)
        //* note: find-python-script.py already send output in utf8 then may become necessary
        //* to reencode string with Buffer.from(stderr).toString() or something
        //* similar (if needed)
        // for this solution all execFile call should look like execFile("cmd", ["/U", "/C", command to run, arg1, arg2, ...])
        //* all paths/commands and each argument must be in quotes if they contain spaces

        // ! potential bug
        // if "shell" is true and is users default shell on windows is powershell then executables in PATH which name contain spaces will not work.
        // it is feature of powershell which handle first arg in quotes as string
        // thus if exec name has spaces, we can shield them (every space) with ` (backtick)
        // or & (ampersand) can be placed before string in quotes, to tell to shell that
        // it is executable, not string

        //* assume we have a utf8 compatible terminal
        this.execFile(exec, args, opts, execFileCallback.bind(this))

        // ? may be better to use utils.promisify
        /**
         *
         * @param {Error} err
         * @param {string} stdout
         * @param {string} stderr
         * @this {PythonFinder}
         */
        function execFileCallback (err, stdout, stderr) {
          // Done: add silly logs as in previous version
          this.log.silly(`${colorizeOutput(colorHighlight.RED, 'execFile result')}: err =`, (err && err.stack) || err)
          this.log.verbose(`${colorizeOutput(colorHighlight.RED, 'execFile result')}: stdout =`, stdout)
          this.log.silly(`${colorizeOutput(colorHighlight.RED, 'execFile result')}: stderr =`, stderr)

          // executed script shouldn't pass anything to stderr if successful
          if (err || stderr) {
            reject(new ErrorWithData({ data: { stderr: stderr || null }, messageOrError: err || null }))
          } else {
            // trim() function removes string endings that would break string comparison
            const stdoutTrimmed = stdout.trim()
            resolve(stdoutTrimmed)
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
   * @param {ErrorWithData} err
   * @param {check} check
   */
  catchErrors (err, check) {
    this.addLog(colorizeOutput(colorHighlight.RED, `FAIL: ${check.name || check.arg}`))

    // array of error codes (type of errors) that we handling
    const catchedErrorsCods = ['ENOENT', 9009]

    // don't know type of terminal errors
    // @ts-ignore
    if (catchedErrorsCods.includes(err.error ? err.error.code : undefined)) {
      const { error } = err
      // @ts-ignore
      switch (error ? error.code : undefined) {
        case 'ENOENT':
          this.addLog(
            `${colorizeOutput(
              colorHighlight.RED,
              'ERROR:'
              // @ts-ignore
            )} No such file or directory: "${colorizeOutput(colorHighlight.RED, error.path)}"`
          )
          break

        case 9009:
          this.addLog(
            `${colorizeOutput(
              colorHighlight.RED,
              'ERROR:'
            )} Command failed: file not found or not in PATH`
          )
          break
      }
    } else {
      this.addLog(
        `${colorizeOutput(colorHighlight.RED, 'ERROR:')} ${
          err ? (err.message ? err.message : err) : ''
        }`
      )
      this.log.silly(colorizeOutput(colorHighlight.RED, 'FULL ERROR:'), err ? (err.stack ? err.stack : err) : '')

      // map through data object to print it as KEY: value
      for (const prop in err.data) {
        if (err.data[prop]) {
          this.addLog(`${colorizeOutput(colorHighlight.RED, `${prop.toUpperCase()}:`)} ${err.data[prop].trim()}`)
        }
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
        colorHighlight.GREEN,
        version
      )} found at "${colorizeOutput(colorHighlight.GREEN, execPath)}"`
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
      'If you have non-displayed characters, please set "UTF-8"',
      'encoding.',
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
        // if changing error message don't forget also change it test file too
        new Error('Could not find any Python installation to use')
      )
    )
  }
}

/**
 * Error with additional data.
 * If you do not want to pass any additional data use regular Error
 *
 * !ALL MEMBERS EXCEPT "DATA" ARE OPTIONAL!
 * @see Error
 *
 * @class
 * @extends Error
*/
class ErrorWithData extends Error {
  // DONE: give to user possibility to pass existing error for which provide additional data
  /**
   *
   * @typedef ErrorConstructor
   * @property {{[key:string]: any}} data additional data to pass in data property of error object
   * @property {string|Error} [messageOrError]
   * @private
   */
  /**
  * @constructor
  * @param {ErrorConstructor} [options]
  */
  constructor (options) {
    if (typeof options.messageOrError === 'string') {
      const message = options.messageOrError
      super(message)
    } else if (options.messageOrError instanceof Error) {
      const error = options.messageOrError
      super(error.message)
      this.error = error
    } else {
      super()
    }

    if (!options.data) {
      throw new TypeError('"data" property is required. If you do not want pass any additional data use regular Error instead this one')
    }

    this.data = options.data
  }
}

/**
 *
 * @param {string} configPython force setted from terminal or npm config python path
 * @param {(err:Error, found:string)=> void} callback succeed/error callback from where result
 * is available
 */
function findPython (configPython, callback) {
  const finder = new PythonFinder(configPython, callback)
  finder.findPython()
}

// function for tests
/* findPython(null, (err, found) => {
  console.log('found:', colorizeOutput(colorHighlight.GREEN, found))
  console.log('err:', err)
})
 */
module.exports = findPython
module.exports.test = {
  PythonFinder: PythonFinder,
  findPython: findPython
}
