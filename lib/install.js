'use strict'

const fs = require('graceful-fs')
const os = require('os')
const tar = require('tar')
const path = require('path')
const util = require('util')
const stream = require('stream')
const crypto = require('crypto')
const log = require('npmlog')
const semver = require('semver')
const request = require('request')
const processRelease = require('./process-release')
const win = process.platform === 'win32'
const getProxyFromURI = require('./proxy')

/**
 * @param {import('graceful-fs')} fs
 */

async function install (fs, gyp, argv) {
  var release = processRelease(argv, gyp, process.version, process.release)

  // Determine which node dev files version we are installing
  log.verbose('install', 'input version string %j', release.version)

  if (!release.semver) {
    // could not parse the version string with semver
    throw new Error('Invalid version number: ' + release.version)
  }

  if (semver.lt(release.version, '0.8.0')) {
    throw new Error('Minimum target version is `0.8.0` or greater. Got: ' + release.version)
  }

  // 0.x.y-pre versions are not published yet and cannot be installed. Bail.
  if (release.semver.prerelease[0] === 'pre') {
    log.verbose('detected "pre" node version', release.version)
    if (gyp.opts.nodedir) {
      log.verbose('--nodedir flag was passed; skipping install', gyp.opts.nodedir)
      return
    }
    throw new Error('"pre" versions of node cannot be installed, use the --nodedir flag instead')
  }

  // flatten version into String
  log.verbose('install', 'installing version: %s', release.versionDir)

  // the directory where the dev files will be installed
  var devDir = path.resolve(gyp.devDir, release.versionDir)

  // If '--ensure' was passed, then don't *always* install the version;
  // check if it is already installed, and only install when needed
  if (gyp.opts.ensure) {
    log.verbose('install', '--ensure was passed, so won\'t reinstall if already installed')
    try {
      await fs.promises.stat(devDir)
    } catch (err) {
      if (err.code === 'ENOENT') {
        log.verbose('install', 'version not already installed, continuing with install', release.version)
        return go().catch(rollback)
      }
      if (err.code === 'EACCES') {
        return eaccesFallback(err)
      }
      throw err
    }
    log.verbose('install', 'version is already installed, need to check "installVersion"')
    var installVersionFile = path.resolve(devDir, 'installVersion')
    let installVersion = 0
    try {
      const ver = await fs.promises.readFile(installVersionFile, 'ascii')
      installVersion = parseInt(ver, 10) || 0
    } catch (err) {
      if (err.code !== 'ENOENT') {
        throw err
      }
    }
    log.verbose('got "installVersion"', installVersion)
    log.verbose('needs "installVersion"', gyp.package.installVersion)
    if (installVersion < gyp.package.installVersion) {
      log.verbose('install', 'version is no good; reinstalling')
      return go().catch(rollback)
    }
    log.verbose('install', 'version is good')
    return release.version
  }

  return go().catch(rollback)

  async function go () {
    log.verbose('ensuring nodedir is created', devDir)

    // first create the dir for the node dev files
    try {
      const created = await fs.promises.mkdir(devDir, { recursive: true })

      if (created) {
        log.verbose('created nodedir', created)
      }
    } catch (err) {
      if (err.code === 'EACCES') {
        return eaccesFallback(err)
      }
      throw err
    }

    // now download the node tarball
    var tarPath = gyp.opts.tarball
    var extractCount = 0
    var contentShasums = {}
    var expectShasums = {}

    // checks if a file to be extracted from the tarball is valid.
    // only .h header files and the gyp files get extracted
    function isValid (path) {
      var isValid = valid(path)
      if (isValid) {
        log.verbose('extracted file from tarball', path)
        extractCount++
      } else {
        // invalid
        log.silly('ignoring from tarball', path)
      }
      return isValid
    }

    // download the tarball and extract!
    if (tarPath) {
      await tar.extract({
        file: tarPath,
        strip: 1,
        filter: isValid,
        cwd: devDir
      })
    } else {
      await new Promise((resolve, reject) => {
        try {
          var req = download(gyp, process.env, release.tarballUrl)
        } catch (e) {
          return reject(e)
        }

        // something went wrong downloading the tarball?
        req.on('error', function (err) {
          if (err.code === 'ENOTFOUND') {
            return reject(new Error('This is most likely not a problem with node-gyp or the package itself and\n' +
              'is related to network connectivity. In most cases you are behind a proxy or have bad \n' +
              'network settings.'))
          }
          reject(err)
        })

        req.on('close', function () {
          if (extractCount === 0) {
            reject(new Error('Connection closed while downloading tarball file'))
          }
        })

        req.on('response', function (res) {
          if (res.statusCode !== 200) {
            reject(new Error(res.statusCode + ' response downloading ' + release.tarballUrl))
            return
          }
          // content checksum
          const sha256 = new Sha256(function (_, checksum) {
            var filename = path.basename(release.tarballUrl).trim()
            contentShasums[filename] = checksum
            log.verbose('content checksum', filename, checksum)
          })

          // start unzipping and untaring
          res.pipe(sha256.pipe(tar.extract({
            strip: 1,
            cwd: devDir,
            filter: isValid
          }).on('close', resolve).on('error', reject)))
        })
      })
    }

    // invoked after the tarball has finished being extracted

    if (extractCount === 0) {
      throw new Error('There was a fatal problem while downloading/extracting the tarball')
    }
    log.verbose('tarball', 'done parsing tarball')

    var installVersionPath = path.resolve(devDir, 'installVersion')
    await Promise.all([
      // need to download node.lib
      ...(win ? downloadNodeLib() : []),

      // write the "installVersion" file
      fs.promises.writeFile(installVersionPath, gyp.package.installVersion + '\n'),

      // Only download SHASUMS.txt if we downloaded something in need of SHA verification
      ...(!tarPath || win ? [downloadShasums()] : [])
    ])

    log.verbose('download contents checksum', JSON.stringify(contentShasums))
    // check content shasums
    for (var k in contentShasums) {
      log.verbose('validating download checksum for ' + k, '(%s == %s)', contentShasums[k], expectShasums[k])
      if (contentShasums[k] !== expectShasums[k]) {
        throw new Error(k + ' local checksum ' + contentShasums[k] + ' not match remote ' + expectShasums[k])
      }
    }
    return release.version

    function downloadShasums () {
      log.verbose('check download content checksum, need to download `SHASUMS256.txt`...')
      log.verbose('checksum url', release.shasumsUrl)
      return new Promise((resolve, reject) => {
        try {
          var req = download(gyp, process.env, release.shasumsUrl)
        } catch (e) {
          return reject(e)
        }

        req.on('error', reject)
        req.on('response', function (res) {
          if (res.statusCode !== 200) {
            reject(new Error(res.statusCode + ' status code downloading checksum'))
            return
          }

          var chunks = []
          res.on('data', function (chunk) {
            chunks.push(chunk)
          })
          res.on('end', function () {
            var lines = Buffer.concat(chunks).toString().trim().split('\n')
            lines.forEach(function (line) {
              var items = line.trim().split(/\s+/)
              if (items.length !== 2) {
                return
              }

              // 0035d18e2dcf9aad669b1c7c07319e17abfe3762  ./node-v0.11.4.tar.gz
              var name = items[1].replace(/^\.\//, '')
              expectShasums[name] = items[0]
            })

            log.verbose('checksum data', JSON.stringify(expectShasums))
            resolve()
          })
        })
      })
    }

    function downloadNodeLib () {
      log.verbose('on Windows; need to download `' + release.name + '.lib`...')
      var archs = ['ia32', 'x64', 'arm64']
      return archs.map(async function (arch) {
        var dir = path.resolve(devDir, arch)
        var targetLibPath = path.resolve(dir, release.name + '.lib')
        var libUrl = release[arch].libUrl
        var libPath = release[arch].libPath
        var name = arch + ' ' + release.name + '.lib'
        log.verbose(name, 'dir', dir)
        log.verbose(name, 'url', libUrl)

        await fs.promises.mkdir(dir, { recursive: true })
        log.verbose('streaming', name, 'to:', targetLibPath)

        return new Promise((resolve, reject) => {
          try {
            var req = download(gyp, process.env, libUrl)
          } catch (e) {
            return reject(e)
          }

          req.on('error', reject)
          req.on('response', function (res) {
            if (res.statusCode === 403 || res.statusCode === 404) {
              if (arch === 'arm64') {
                // Arm64 is a newer platform on Windows and not all node distributions provide it.
                log.verbose(`${name} was not found in ${libUrl}`)
              } else {
                log.warn(`${name} was not found in ${libUrl}`)
              }
              return resolve()
            } else if (res.statusCode !== 200) {
              reject(new Error(res.statusCode + ' status code downloading ' + name))
              return
            }

            const sha256 = new Sha256(function (_, checksum) {
              contentShasums[libPath] = checksum
              log.verbose('content checksum', libPath, checksum)
            })

            var ws = fs.createWriteStream(targetLibPath)
            ws.on('close', resolve).on('error', reject)
            res.pipe(sha256.pipe(ws))
          })
        })
      })
    } // downloadNodeLib()
  } // go()

  /**
   * Checks if a given filename is "valid" for this installation.
   */

  function valid (file) {
    // header files
    var extname = path.extname(file)
    return extname === '.h' || extname === '.gypi'
  }

  async function rollback (err) {
    log.warn('install', 'got an error, rolling back install')
    // roll-back the install if anything went wrong
    await util.promisify(gyp.commands.remove)([release.versionDir])
    throw err
  }

  /**
   * The EACCES fallback is a workaround for npm's `sudo` behavior, where
   * it drops the permissions before invoking any child processes (like
   * node-gyp). So what happens is the "nobody" user doesn't have
   * permission to create the dev dir. As a fallback, make the tmpdir() be
   * the dev dir for this installation. This is not ideal, but at least
   * the compilation will succeed...
   */

  async function eaccesFallback (err) {
    var noretry = '--node_gyp_internal_noretry'
    if (argv.indexOf(noretry) !== -1) {
      throw err
    }
    var tmpdir = os.tmpdir()
    gyp.devDir = path.resolve(tmpdir, '.node-gyp')
    var userString = ''
    try {
      // os.userInfo can fail on some systems, it's not critical here
      userString = ` ("${os.userInfo().username}")`
    } catch (e) {}
    log.warn('EACCES', 'current user%s does not have permission to access the dev dir "%s"', userString, devDir)
    log.warn('EACCES', 'attempting to reinstall using temporary dev dir "%s"', gyp.devDir)
    if (process.cwd() === tmpdir) {
      log.verbose('tmpdir == cwd', 'automatically will remove dev files after to save disk space')
      gyp.todo.push({ name: 'remove', args: argv })
    }
    return util.promisify(gyp.commands.install)([noretry].concat(argv))
  }
}

class Sha256 extends stream.Transform {
  constructor (callback) {
    super()
    this._callback = callback
    this._digester = crypto.createHash('sha256')
  }

  _transform (chunk, _, callback) {
    this._digester.update(chunk)
    callback(chunk)
  }

  _flush (callback) {
    this._callback(null, this._digester.digest('hex'))
    callback()
  }
}

function download (gyp, env, url) {
  log.http('GET', url)

  var requestOpts = {
    uri: url,
    headers: {
      'User-Agent': 'node-gyp v' + gyp.version + ' (node ' + process.version + ')',
      Connection: 'keep-alive'
    }
  }

  var cafile = gyp.opts.cafile
  if (cafile) {
    requestOpts.ca = readCAFile(cafile)
  }

  // basic support for a proxy server
  var proxyUrl = getProxyFromURI(gyp, env, url)
  if (proxyUrl) {
    if (/^https?:\/\//i.test(proxyUrl)) {
      log.verbose('download', 'using proxy url: "%s"', proxyUrl)
      requestOpts.proxy = proxyUrl
    } else {
      log.warn('download', 'ignoring invalid "proxy" config setting: "%s"', proxyUrl)
    }
  }

  var req = request(requestOpts)
  req.on('response', function (res) {
    log.http(res.statusCode, url)
  })

  return req
}

function readCAFile (filename) {
  // The CA file can contain multiple certificates so split on certificate
  // boundaries.  [\S\s]*? is used to match everything including newlines.
  var ca = fs.readFileSync(filename, 'utf8')
  var re = /(-----BEGIN CERTIFICATE-----[\S\s]*?-----END CERTIFICATE-----)/g
  return ca.match(re)
}

module.exports = function (gyp, argv, callback) {
  return install(fs, gyp, argv).then(callback.bind(undefined, null), callback)
}
module.exports.test = {
  download,
  install,
  readCAFile
}
module.exports.usage = 'Install node development files for the specified node version.'
