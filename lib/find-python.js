module.exports = findPython
module.exports.test = {
  PythonFinder: PythonFinder,
  findPython: findPython,
}

var fs = require('graceful-fs')
  , path = require('path')
  , log = require('npmlog')
  , which = require('which')
  , cp = require('child_process')
  , extend = require('util')._extend
  , semver = require('semver')
  , win = process.platform == 'win32'

function PythonFinder(python, callback) {
  this.callback = callback
  this.python = python
}

PythonFinder.prototype = {
  checkPythonLauncherDepth: 0,
  env: process.env,
  execFile: cp.execFile,
  log: log,
  stat: fs.stat,
  which: which,
  win: win,

  checkPython: function checkPython () {
    this.log.verbose('check python',
                     'checking for Python executable "%s" in the PATH',
                     this.python)
    this.which(this.python, function (err, execPath) {
      if (err) {
        this.log.verbose('`which` failed', this.python, err)
        if (this.python === 'python2') {
          this.python = 'python'
          return this.checkPython()
        }
        if (this.win) {
          this.checkPythonLauncher()
        } else {
          this.failNoPython()
        }
      } else {
        this.log.verbose('`which` succeeded', this.python, execPath)
        // Found the `python` executable, and from now on we use it explicitly.
        // This solves #667 and #750 (`execFile` won't run batch files
        // (*.cmd, and *.bat))
        this.python = execPath
        this.checkPythonVersion()
      }
    }.bind(this))
  },

  // Distributions of Python on Windows by default install with the "py.exe"
  // Python launcher which is more likely to exist than the Python executable
  // being in the $PATH.
  // Because the Python launcher supports all versions of Python, we have to
  // explicitly request a Python 2 version. This is done by supplying "-2" as
  // the first command line argument. Since "py.exe -2" would be an invalid
  // executable for "execFile", we have to use the launcher to figure out
  // where the actual "python.exe" executable is located.
  checkPythonLauncher: function checkPythonLauncher () {
    this.checkPythonLauncherDepth += 1

    this.log.verbose(
        'could not find "' + this.python + '". checking python launcher')
    var env = extend({}, this.env)
    env.TERM = 'dumb'

    var launcherArgs = ['-2', '-c', 'import sys; print sys.executable']
    this.execFile('py.exe', launcherArgs, { env: env }, function (err, stdout) {
      if (err) {
        this.guessPython()
      } else {
        this.python = stdout.trim()
        this.log.verbose('check python launcher',
                         'python executable found: %j',
                         this.python)
        this.checkPythonVersion()
      }
      this.checkPythonLauncherDepth -= 1
    }.bind(this))
  },

  checkPythonVersion: function checkPythonVersion () {
    var args = ['-c', 'import platform; print(platform.python_version());']
    var env = extend({}, this.env)
    env.TERM = 'dumb'

    this.execFile(this.python, args, { env: env }, function (err, stdout) {
      if (err) {
        return this.callback(err)
      }
      this.log.verbose('check python version',
                       '`%s -c "' + args[1] + '"` returned: %j',
                       this.python, stdout)
      var version = stdout.trim()
      if (~version.indexOf('+')) {
        this.log.silly('stripping "+" sign(s) from version')
        version = version.replace(/\+/g, '')
      }
      if (~version.indexOf('rc')) {
        this.log.silly('stripping "rc" identifier from version')
        version = version.replace(/rc(.*)$/ig, '')
      }
      var range = semver.Range('>=2.5.0 <3.0.0')
      var valid = false
      try {
        valid = range.test(version)
      } catch (e) {
        this.log.silly('range.test() error', e)
      }
      if (valid) {
        this.callback(null, this.python)
      } else if (this.win && this.checkPythonLauncherDepth === 0) {
        this.checkPythonLauncher()
      } else {
        this.failPythonVersion(version)
      }
    }.bind(this))
  },

  failNoPython: function failNoPython () {
    var errmsg =
        'Can\'t find Python executable "' + this.python +
        '", you can set the PYTHON env variable.'
    this.callback(new Error(errmsg))
  },

  failPythonVersion: function failPythonVersion (badVersion) {
    var errmsg =
        'Python executable "' + this.python +
        '" is v' + badVersion + ', which is not supported by gyp.\n' +
        'You can pass the --python switch to point to ' +
        'Python >= v2.5.0 & < 3.0.0.'
    this.callback(new Error(errmsg))
  },

  // Called on Windows when "python" isn't available in the current $PATH.
  // We are going to check if "%SystemDrive%\python27\python.exe" exists.
  guessPython: function guessPython () {
    this.log.verbose('could not find "' + this.python + '". guessing location')
    var rootDir = this.env.SystemDrive || 'C:\\'
    if (rootDir[rootDir.length - 1] !== '\\') {
      rootDir += '\\'
    }
    var resolve = path.win32 && path.win32.resolve || path.resolve
    var pythonPath = resolve(rootDir, 'Python27', 'python.exe')
    this.log.verbose('ensuring that file exists:', pythonPath)
    this.stat(pythonPath, function (err, stat) {
      if (err) {
        if (err.code == 'ENOENT') {
          this.failNoPython()
        } else {
          this.callback(err)
        }
        return
      }
      this.python = pythonPath
      this.checkPythonVersion()
    }.bind(this))
  },
}

function findPython (python, callback) {
  var finder = new PythonFinder(python, callback)
  finder.checkPython()
}
