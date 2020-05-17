'use strict'

const path = require('path')
const log = require('npmlog')
const semver = require('semver')
const cp = require('child_process')
const extend = require('util')._extend // eslint-disable-line
const { logWithPrefix } = require('./util')
const win = process.platform === 'win32'

class PythonFinder {
  constructor (configPython, callback) {
    this.callback = callback
    this.configPython = configPython
    this.errorLog = []

    this.log = logWithPrefix(log, 'find Python')
    this.argsExecutable = ['-c', 'import sys; print(sys.executable);']
    this.argsVersion = ['-c', 'import sys; print("%s.%s.%s" % sys.version_info[:3]);']
    this.semverRange = '2.7.x || >=3.5.0'

    // These can be overridden for testing:
    this.execFile = cp.execFile
    this.env = process.env
    this.win = win
    this.pyLauncher = 'py.exe'
    this.winDefaultLocations = [
      path.join(process.env.SystemDrive || 'C:\\Python37\\python.exe'),
      path.join(process.env.SystemDrive || 'C:\\Python27\\python.exe')
    ]
  }

  // Logs a message at verbose level, but also saves it to be displayed later
  // at error level if an error occurs. This should help diagnose the problem.
  addLog (message) {
    this.log.verbose(message)
    this.errorLog.push(message)
  }

  // Find Python by trying a sequence of possibilities.
  // Ignore errors, keep trying until Python is found.
  findPython () {
    const toCheck = (() => {
      if (this.env.NODE_GYP_FORCE_PYTHON) {
        return [{
          before: () => {
            this.addLog('checking Python explicitly set from NODE_GYP_FORCE_PYTHON')
            this.addLog(`- process.env.NODE_GYP_FORCE_PYTHON is "${this.env.NODE_GYP_FORCE_PYTHON}"`)
          },
          check: this.checkCommand,
          arg: this.env.NODE_GYP_FORCE_PYTHON
        }]
      }

      const checks = [
        {
          before: () => {
            if (!this.configPython) {
              this.addLog('Python is not set from command line or npm configuration')
              return 'skip'
            }
            this.addLog('checking Python explicitly set from command line or npm configuration')
            this.addLog(`- "--python=" or "npm config get python" is "${this.configPython}"`)
          },
          check: this.checkCommand,
          arg: this.configPython
        },
        {
          before: () => {
            if (!this.env.PYTHON) {
              this.addLog('Python is not set from environment variable PYTHON')
              return 'skip'
            }
            this.addLog('checking Python explicitly set from environment variable PYTHON')
            this.addLog(`- process.env.PYTHON is "${this.env.PYTHON}"`)
          },
          check: this.checkCommand,
          arg: this.env.PYTHON
        },
        {
          before: () => this.addLog('checking if "python3" can be used'),
          check: this.checkCommand,
          arg: 'python3'
        },
        {
          before: () => this.addLog('checking if "python" can be used'),
          check: this.checkCommand,
          arg: 'python'
        },
        {
          before: () => this.addLog('checking if "python2" can be used'),
          check: this.checkCommand,
          arg: 'python2'
        }
      ]

      if (this.win) {
        for (let i = 0; i < this.winDefaultLocations.length; ++i) {
          const location = this.winDefaultLocations[i]
          checks.push({
            before: () => this.addLog(`checking if Python is ${location}`),
            check: this.checkExecPath,
            arg: location
          })
        }
        checks.push({
          before: () => this.addLog('checking if the py launcher can be used to find Python 2'),
          check: this.checkPyLauncher
        })
      }

      return checks
    })()

    const runChecks = async () => {
      const check = toCheck.shift()
      if (!check) {
        return this.fail()
      }

      const before = check.before()
      if (before === 'skip') {
        return runChecks()
      }

      try {
        return await check.check.call(this, check.arg ? check.arg : undefined)
      } catch (err) {
        this.log.silly('runChecks: err = %j', (err && err.stack) || err)
        return runChecks()
      }
    }

    return runChecks()
  }

  // Check if command is a valid Python to use.
  // Will exit the Python finder on success.
  // If on Windows, run in a CMD shell to support BAT/CMD launchers.
  async checkCommand (command) {
    let exec = command
    let args = this.argsExecutable
    let shell = false
    if (this.win) {
      // Arguments have to be manually quoted
      exec = `"${exec}"`
      args = args.map(a => `"${a}"`)
      shell = true
    }

    this.log.verbose(`- executing "${command}" to get executable path`)
    let execPath
    try {
      execPath = await this.run(exec, args, shell)
      // Possible outcomes:
      // - Error: not in PATH, not executable or execution fails
      // - Gibberish: the next command to check version will fail
      // - Absolute path to executable
      this.addLog(`- executable path is "${execPath}"`)
    } catch (err) {
      this.addLog(`- "${command}" is not in PATH or produced an error`)
      throw err
    }
    return this.checkExecPath(execPath)
  }

  // Check if the py launcher can find a valid Python to use.
  // Will exit the Python finder on success.
  // Distributions of Python on Windows by default install with the "py.exe"
  // Python launcher which is more likely to exist than the Python executable
  // being in the $PATH.
  // Because the Python launcher supports all versions of Python, we have to
  // explicitly request a Python 2 version. This is done by supplying "-2" as
  // the first command line argument. Since "py.exe -2" would be an invalid
  // executable for "execFile", we have to use the launcher to figure out
  // where the actual "python.exe" executable is located.
  async checkPyLauncher () {
    this.log.verbose(`- executing "${this.pyLauncher}" to get Python 2 executable path`)
    let execPath
    try {
      execPath = await this.run(this.pyLauncher, ['-2', ...this.argsExecutable], false)
      // Possible outcomes: same as checkCommand
    } catch (err) {
      this.addLog(`- "${this.pyLauncher}" is not in PATH or produced an error`)
      throw err
    }
    this.addLog(`- executable path is "${execPath}"`)
    return this.checkExecPath(execPath)
  }

  // Check if a Python executable is the correct version to use.
  // Will exit the Python finder on success.
  async checkExecPath (execPath) {
    this.log.verbose(`- executing "${execPath}" to get version`)
    let version
    try {
      version = await this.run(execPath, this.argsVersion, false)
      // Possible outcomes:
      // - Error: executable can not be run (likely meaning the command wasn't
      //   a Python executable and the previous command produced gibberish)
      // - Gibberish: somehow the last command produced an executable path,
      //   this will fail when verifying the version
      // - Version of the Python executable
    } catch (err) {
      this.addLog(`- "${execPath}" could not be run`)
      throw err
    }

    this.addLog(`- version is "${version}"`)

    const range = new semver.Range(this.semverRange)
    let valid = false
    try {
      valid = range.test(version)
    } catch (err) {
      this.log.silly('range.test() threw:\n%s', err.stack)
      this.addLog(`- "${execPath}" does not have a valid version`)
      this.addLog('- is it a Python executable?')
      throw err
    }

    if (!valid) {
      this.addLog(`- version is ${version} - should be ${this.semverRange}`)
      this.addLog('- THIS VERSION OF PYTHON IS NOT SUPPORTED')
      throw new Error(`Found unsupported Python version ${version}`)
    }

    return this.succeed(execPath, version)
  }

  // Run an executable or shell command, trimming the output.
  async run (exec, args, shell) {
    const env = extend({}, this.env)
    env.TERM = 'dumb'
    const opts = { env: env, shell: shell }

    this.log.silly('execFile: exec = %j', exec)
    this.log.silly('execFile: args = %j', args)
    this.log.silly('execFile: opts = %j', opts)
    try {
      const stdout = await new Promise((resolve, reject) => {
        this.execFile(exec, args, opts, (err, stdout, stderr) => {
          if (err) {
            err.stdout = stdout
            err.stderr = stderr
            reject(err)
          }
          resolve(stdout)
        })
      })
      const execPath = stdout.trim()
      return execPath
    } catch (err) {
      this.log.silly('execFile result: err = %j', (err && err.stack) || err)
      this.log.silly('execFile result: stdout = %j', err.stdout)
      this.log.silly('execFile result: stderr = %j', err.stderr)
      throw err
    }
  }

  succeed (execPath, version) {
    this.log.info(`using Python version ${version} found at "${execPath}"`)
    return execPath
  }

  fail () {
    const errorLog = this.errorLog.join('\n')

    const pathExample = this.win ? 'C:\\Path\\To\\python.exe' : '/path/to/pythonexecutable'
    // For Windows 80 col console, use up to the column before the one marked
    // with X (total 79 chars including logger prefix, 58 chars usable here):
    const info =
`**********************************************************
You need to install the latest version of Python.
Node-gyp should be able to find and use Python. If not,
you can try one of the following options:
- Use the switch --python="${pathExample}"
  (accepted by both node-gyp and npm)
- Set the environment variable PYTHON
- Set the npm configuration variable python:
  npm config set python "${pathExample}"
For more information consult the documentation at:
https://github.com/nodejs/node-gyp#installation
**********************************************************
`
    this.log.error(`\n${errorLog}\n\n${info}\n`)
    throw new Error('Could not find any Python installation to use')
  }
}

async function findPython (configPython, callback) {
  const finder = new PythonFinder(configPython, callback)
  return finder.findPython()
}

module.exports = findPython
module.exports.test = {
  PythonFinder: PythonFinder,
  findPython: findPython
}
