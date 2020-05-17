#!/usr/bin/env node

'use strict'

process.title = 'node-gyp'

const envPaths = require('env-paths')
const Gyp = require('../')
const log = require('npmlog')
const os = require('os')
const fs = require('fs').promises

/**
 * Process and execute the selected commands.
 */

let completed = false

async function run () {
  const gyp = new Gyp()
  gyp.parseArgv(process.argv)

  printVersion(gyp)
  setupDevDir(gyp)

  log.info('it worked if it ends with', 'ok')
  log.verbose('cli', process.argv)
  log.info('using', `node-gyp@${gyp.version}`)
  log.info('using', `node@${process.versions.node} | ${process.platform} | ${process.arch}`)

  await chdir(gyp)
  await execute(gyp)
}

function printVersion (gyp) {
  if (gyp.todo.length === 0) {
    if (process.argv.includes('-v') || process.argv.includes('--version')) {
      console.log('v%s', gyp.version)
    } else {
      console.log('%s', gyp.usage())
    }
    process.exit(0)
  }
}

function setupDevDir (gyp) {
  gyp.devDir = gyp.opts.devdir

  const homeDir = os.homedir()
  if (gyp.devDir) {
    gyp.devDir = gyp.devDir.replace(/^~/, homeDir)
  } else if (homeDir) {
    gyp.devDir = envPaths('node-gyp', { suffix: '' }).cache
  } else {
    throw new Error(
      'node-gyp requires that the user\'s home directory is specified ' +
      'in either of the environmental variables HOME or USERPROFILE. ' +
      'Overide with: --devdir /path/to/.node-gyp')
  }
}

/**
 * Change dir if -C/--directory was passed.
 */
async function chdir (gyp) {
  const dir = gyp.opts.directory
  if (dir) {
    try {
      const stat = await fs.stat(dir)
      if (stat.isDirectory()) {
        log.info('chdir', dir)
        process.chdir(dir)
      } else {
        log.warn('chdir', dir + ' is not a directory')
      }
    } catch (e) {
      if (e.code === 'ENOENT') {
        log.warn('chdir', dir + ' is not a directory')
      } else {
        log.warn('chdir', 'error during chdir() "%s"', e.message)
      }
    }
  }
}

const asyncCommands = [
  'clean'
]

async function execute (gyp) {
  while (true) {
    const command = gyp.todo.shift()
    if (!command) {
      // done!
      completed = true
      log.info('ok')
      return
    }

    if (asyncCommands.includes(command.name)) {
      try {
        const result = await gyp.commands[command.name](command.args)

        if (command.name === 'list') {
          const versions = result[0]
          if (versions.length > 0) {
            versions.forEach((version) => console.log(version))
          } else {
            console.log('No node development files installed. Use `node-gyp install` to install a version.')
          }
        } else if (Array.isArray(result) && result.length) {
          console.log.apply(console, result)
        }
      } catch (err) {
        log.error(command.name + ' error')
        log.error('stack', err.stack)
        errorMessage()
        log.error('not ok')
        return process.exit(1)
      }
    } else {
      // TODO: removeme
      await new Promise((resolve, reject) => {
        gyp.commands[command.name](command.args, (err, ...args) => {
          if (err) {
            log.error(command.name + ' error')
            log.error('stack', err.stack)
            errorMessage()
            log.error('not ok')
            return process.exit(1)
          }

          if (command.name === 'list') {
            const versions = args[0]
            if (versions.length > 0) {
              versions.forEach((version) => console.log(version))
            } else {
              console.log('No node development files installed. Use `node-gyp install` to install a version.')
            }
          } else if (args.length >= 1) {
            console.log.apply(console, args)
          }

          resolve()
        })
      })
    }
  }
}

process.on('exit', (code) => {
  if (!completed && !code) {
    log.error('Completion callback never invoked!')
    issueMessage()
    process.exit(6)
  }
})

process.on('uncaughtException', (err) => {
  log.error('UNCAUGHT EXCEPTION')
  log.error('stack', err.stack)
  issueMessage()
  process.exit(7)
})

function errorMessage () {
  // copied from npm's lib/utils/error-handler.js
  const os = require('os')
  log.error('System', `${os.type()}${os.release()}`)
  log.error('command', process.argv.map(JSON.stringify).join(' '))
  log.error('cwd', process.cwd())
  log.error('node -v', process.version)
  log.error('node-gyp -v', `v${require('../package.json').version}`)
}

function issueMessage () {
  errorMessage()
  log.error('',
`node-gyp failed to build your package.
Try to update npm and/or node-gyp and if it does not help file an issue with the package author.`)
}

run().catch((err) => {
  console.error(err.stack)
  process.exit(1)
})
