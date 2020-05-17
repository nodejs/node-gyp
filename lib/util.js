'use strict'

const log = require('npmlog')
const execFile = require('child_process').execFile
const path = require('path')

function logWithPrefix (log, prefix) {
  function setPrefix (logFunction) {
    return (...args) => logFunction.apply(null, [ prefix, ...args ]) // eslint-disable-line
  }
  return {
    silly: setPrefix(log.silly),
    verbose: setPrefix(log.verbose),
    info: setPrefix(log.info),
    warn: setPrefix(log.warn),
    error: setPrefix(log.error)
  }
}

async function regGetValue (key, value, addOpts) {
  const outReValue = value.replace(/\W/g, '.')
  const outRe = new RegExp(`^\\s+${outReValue}\\s+REG_\\w+\\s+(\\S.*)$`, 'im')
  const reg = path.join(process.env.SystemRoot, 'System32\\reg.exe')
  const regArgs = ['query', key, '/v', value].concat(addOpts)

  log.silly('reg', 'running', reg, regArgs)
  const stdout = await new Promise((resolve, reject) => {
    const child = execFile(reg, regArgs, { encoding: 'utf8' }, (err, stdout, stderr) => {
      if (err) {
        log.silly('reg', 'reg.exe stdout = %j', stdout)
        if (err || stderr.trim() !== '') {
          log.silly('reg', 'reg.exe err = %j', err && (err.stack || err))
          log.silly('reg', 'reg.exe stderr = %j', stderr)
          return reject(err)
        }
      }
      resolve(stdout)
    })
    child.stdin.end()
  })

  const result = outRe.exec(stdout)
  if (!result) {
    log.silly('reg', 'error parsing stdout')
    throw new Error('Could not parse output of reg.exe')
  }

  log.silly('reg', 'found: %j', result[1])
  return result[1]
}

async function regSearchKeys (keys, value, addOpts) {
  async function search (i) {
    log.silly('reg-search', 'looking for %j in %j', value, keys[i])
    regGetValue(keys[i], value, addOpts, (err, res) => {
      if (err && i < keys.length - 1) {
        return search(i + 1)
      }
      return res
    })
  }
  return search(0)
}

module.exports = {
  logWithPrefix: logWithPrefix,
  regGetValue: regGetValue,
  regSearchKeys: regSearchKeys
}
