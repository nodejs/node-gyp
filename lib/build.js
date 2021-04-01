'use strict'

const fs = require('graceful-fs')
const path = require('path')
const util = require('util')
const glob = require('glob')
const log = require('npmlog')
const which = require('which')
const win = process.platform === 'win32'

async function build (gyp, argv) {
  let platformMake = 'make'
  if (process.platform === 'aix') {
    platformMake = 'gmake'
  } else if (process.platform.indexOf('bsd') !== -1) {
    platformMake = 'gmake'
  } else if (win && argv.length > 0) {
    argv = argv.map(target => '/t:' + target)
  }

  const makeCommand = gyp.opts.make || process.env.MAKE || platformMake
  const jobs = gyp.opts.jobs || process.env.JOBS
  let command = win ? 'msbuild' : makeCommand
  let buildType
  let config
  let arch
  let nodeDir
  let guessedSolution

  await loadConfigGypi()
  if (win) {
    await findSolutionFile()
  }
  await doWhich()
  await doBuild()

  /**
   * Load the "config.gypi" file that was generated during "configure".
   */

  async function loadConfigGypi () {
    const configPath = path.resolve('build', 'config.gypi')

    try {
      const data = await fs.promises.readFile(configPath, 'utf8')

      config = JSON.parse(data.replace(/#.+\n/, ''))
    } catch (err) {
      if (err.code === 'ENOENT') {
        throw new Error('You must run `node-gyp configure` first!')
      }
      throw err
    }

    // get the 'arch', 'buildType', and 'nodeDir' vars from the config
    buildType = config.target_defaults.default_configuration
    arch = config.variables.target_arch
    nodeDir = config.variables.nodedir

    if ('debug' in gyp.opts) {
      buildType = gyp.opts.debug ? 'Debug' : 'Release'
    }
    if (!buildType) {
      buildType = 'Release'
    }

    log.verbose('build type', buildType)
    log.verbose('architecture', arch)
    log.verbose('node dev dir', nodeDir)
  }

  /**
   * On Windows, find the first build/*.sln file.
   */

  async function findSolutionFile () {
    const files = await util.promisify(glob)('build/*.sln')
    if (files.length === 0) {
      throw new Error('Could not find *.sln file. Did you run "configure"?')
    }
    guessedSolution = files[0]
    log.verbose('found first Solution file', guessedSolution)
  }

  /**
   * Uses node-which to locate the msbuild / make executable.
   */

  async function doWhich () {
    // On Windows use msbuild provided by node-gyp configure
    if (win) {
      if (!config.variables.msbuild_path) {
        throw new Error('MSBuild is not set, please run `node-gyp configure`.')
      }
      command = config.variables.msbuild_path
      log.verbose('using MSBuild:', command)
    } else {
      // First make sure we have the build command in the PATH
      // If there's an error or 'make' not found on Unix, propagate that to the user
      const execPath = await which(command)
      log.verbose('`which` succeeded for `' + command + '`', execPath)
    }
  }

  /**
   * Actually spawn the process and compile the module.
   */

  async function doBuild () {
    // Enable Verbose build
    const verbose = log.levels[log.level] <= log.levels.verbose
    let j

    if (!win && verbose) {
      argv.push('V=1')
    }

    if (win && !verbose) {
      argv.push('/clp:Verbosity=minimal')
    }

    if (win) {
      // Turn off the Microsoft logo on Windows
      argv.push('/nologo')
    }

    // Specify the build type, Release by default
    if (win) {
      // Convert .gypi config target_arch to MSBuild /Platform
      // Since there are many ways to state '32-bit Intel', default to it.
      // N.B. msbuild's Condition string equality tests are case-insensitive.
      const archLower = arch.toLowerCase()
      const p = archLower === 'x64' ? 'x64'
        : (archLower === 'arm' ? 'ARM'
          : (archLower === 'arm64' ? 'ARM64' : 'Win32'))
      argv.push(`/p:Configuration=${buildType};Platform=${p}`)
      if (jobs) {
        j = parseInt(jobs, 10)
        if (!isNaN(j) && j > 0) {
          argv.push('/m:' + j)
        } else if (jobs.toUpperCase() === 'MAX') {
          argv.push('/m:' + require('os').cpus().length)
        }
      }
    } else {
      argv.push('BUILDTYPE=' + buildType)
      // Invoke the Makefile in the 'build' dir.
      argv.push('-C')
      argv.push('build')
      if (jobs) {
        j = parseInt(jobs, 10)
        if (!isNaN(j) && j > 0) {
          argv.push('--jobs')
          argv.push(j)
        } else if (jobs.toUpperCase() === 'MAX') {
          argv.push('--jobs')
          argv.push(require('os').cpus().length)
        }
      }
    }

    if (win) {
      // did the user specify their own .sln file?
      const hasSln = argv.some(arg => path.extname(arg) === '.sln')
      if (!hasSln) {
        argv.unshift(gyp.opts.solution || guessedSolution)
      }
    }

    return new Promise((resolve, reject) => {
      const proc = gyp.spawn(command, argv)
      proc.on('exit', (code, signal) => {
        if (code !== 0) {
          return reject(new Error('`' + command + '` failed with exit code: ' + code))
        }
        if (signal) {
          return reject(new Error('`' + command + '` got signal: ' + signal))
        }
        resolve()
      })
    })
  }
}

module.exports = function (gyp, argv, callback) {
  build(gyp, argv).then(callback.bind(undefined, null), callback)
}
module.exports.usage = `Invokes \`${win ? 'msbuild' : 'make'}\` and builds the module`
