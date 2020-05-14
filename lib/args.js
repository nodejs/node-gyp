const nopt = require('nopt')
const log = require('npmlog')

const commands = [
  // Module build commands
  'build',
  'clean',
  'configure',
  'rebuild',
  // Development Header File management commands
  'install',
  'list',
  'remove'
]

const aliases = {
  ls: 'list',
  rm: 'remove'
}

const shorthands = {
  release: '--no-debug',
  C: '--directory',
  debug: '--debug',
  j: '--jobs',
  silly: '--loglevel=silly',
  verbose: '--loglevel=verbose',
  silent: '--loglevel=silent'
}

const configDefs = {
  help: Boolean, // everywhere
  arch: String, // 'configure'
  cafile: String, // 'install'
  debug: Boolean, // 'build'
  directory: String, // bin
  make: String, // 'build'
  msvs_version: String, // 'configure'
  ensure: Boolean, // 'install'
  solution: String, // 'build' (windows only)
  proxy: String, // 'install'
  noproxy: String, // 'install'
  devdir: String, // everywhere
  nodedir: String, // 'configure'
  loglevel: String, // everywhere
  python: String, // 'configure'
  'dist-url': String, // 'install'
  tarball: String, // 'install'
  jobs: String, // 'build'
  thin: String // 'configure'
}

/**
 * Parses the given argv array and sets the 'opts',
 * 'argv' and 'command' properties.
 */
function parseArgv (argv) {
  const opts = nopt(configDefs, shorthands, argv)
  argv = opts.argv.remain.slice()

  const todo = []

  // create a copy of the argv array with aliases mapped
  argv = argv.map((arg) => {
    // is this an alias?
    if (arg in aliases) {
      arg = aliases[arg]
    }
    return arg
  })

  // process the mapped args into "command" objects ("name" and "args" props)
  argv.slice().forEach((arg) => {
    if (commands.includes(arg)) {
      const args = argv.splice(0, argv.indexOf(arg))
      argv.shift()
      if (todo.length > 0) {
        todo[todo.length - 1].args = args
      }
      todo.push({ name: arg, args: [] })
    }
  })
  if (todo.length > 0) {
    todo[todo.length - 1].args = argv.splice(0)
  }

  // support for inheriting config env variables from npm
  const npmConfigPrefix = 'npm_config_'
  Object.keys(process.env).forEach((name) => {
    if (name.indexOf(npmConfigPrefix) !== 0) {
      return
    }
    const val = process.env[name]
    if (name === npmConfigPrefix + 'loglevel') {
      log.level = val
    } else {
      // add the user-defined options to the config
      name = name.substring(npmConfigPrefix.length)
      // gyp@741b7f1 enters an infinite loop when it encounters
      // zero-length options so ensure those don't get through.
      if (name) {
        opts[name] = val
      }
    }
  })

  if (opts.loglevel) {
    log.level = opts.loglevel
  }

  log.resume()

  return { opts, argv, todo }
}

module.exports = parseArgv
module.exports.commands = commands
module.exports.aliases = aliases
module.exports.shorthands = shorthands
module.exports.configDefs = configDefs
