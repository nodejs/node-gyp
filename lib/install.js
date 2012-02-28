
module.exports = exports = install

exports.usage = 'Install node development files for the specified node version.'

/**
 * Module dependencies.
 */

var fs = require('fs')
  , tar = require('tar')
  , rm = require('rimraf')
  , path = require('path')
  , zlib = require('zlib')
  , mkdir = require('mkdirp')
  , fstream = require('fstream')
  , request = require('request')
  , minimatch = require('minimatch')
  , nodeVersion = require('./util/node_version')
  , distUrl = 'http://nodejs.org/dist'
  , win = process.platform == 'win32'
  // a map for legacy releases:
  // 0.6.10 is the first 0.6 release to have node.lib
  // 0.7.2 is the first 0.7 release to have node.lib
  , nodeLibMap = {
        '0.6': 10
      , '0.7': 1
      // otherwise use the .0 patch release
    }

function install (gyp, argv, callback) {

  // ensure no double-callbacks happen
  function cb (err) {
    if (cb.done) return
    cb.done = true
    if (err) {
      gyp.verbose('got an error, rolling back install')
      // roll-back the install if anything went wrong
      gyp.commands.remove([ version ], function (err2) {
        callback(err)
      })
    } else {
      callback.apply(null, arguments)
    }
  }


  // Determine which node dev files minor version we are installing
  var version = nodeVersion.parse(argv[0] || gyp.opts.target)
  gyp.verbose('installing version', version)

  // "legacy" versions are 0.7 and 0.6
  var isLegacy = nodeVersion.lessThan(version, 0, 8)
  gyp.verbose('installing legacy version?', isLegacy)

  if (!version) {
    return callback(new Error('You must specify a version to install (like "0.7")'))
  }
  if (nodeVersion.lessThan(version, 0, 6)) {
    return callback(new Error('Minimum target version is `0.6` or greater. Got: ' + version))
  }


  // TODO: Make ~/.node-gyp configurable
  var devDir = path.join(process.env.HOME, '.node-gyp', version)

  // If '--ensure' was passed, then don't *always* install the version,
  // check if it is already installed, and only install when needed
  if (gyp.opts.ensure) {
    gyp.verbose('--ensure was passed, so won\'t reinstall if already installed')
    fs.stat(devDir, function (err, stat) {
      if (err) {
        if (err.code == 'ENOENT') {
          gyp.verbose('version not already installed, continuing with install', version)
          go()
        } else {
          callback(err)
        }
        return
      }
      gyp.verbose('version is already installed, need to check "installVersion"')
      var installVersionFile = path.resolve(devDir, 'installVersion')
      fs.readFile(installVersionFile, 'ascii', function (err, ver) {
        if (err && err.code != 'ENOENT') {
          return callback(err)
        }
        var installVersion = parseInt(ver, 10) || 0
        gyp.verbose('got "installVersion":', installVersion)
        gyp.verbose('needs "installVersion":', gyp.package.installVersion)
        if (installVersion < gyp.package.installVersion) {
          gyp.verbose('version is no good')
          go()
        } else {
          gyp.verbose('version is good')
          callback()
        }
      })
    })
  } else {
    go()
  }


  function go () {

  // first create the dir for the node dev files
  mkdir(devDir, function (err) {
    if (err) return cb(err)

    // TODO: Detect if it was actually created or if it already existed
    gyp.verbose('created:', devDir)

    // now download the node tarball
    // TODO: download the newest version instead of the .0 release
    var tarballUrl = distUrl + '/v' + version + '.0/node-v' + version + '.0.tar.gz'
      , badDownload = false
      , parser = tar.Parse()

    gyp.info('downloading:', tarballUrl)

    var requestOpts = { uri: tarballUrl }
    var proxyUrl = gyp.opts.proxy || process.env.http_proxy || process.env.HTTP_PROXY
    if (proxyUrl) {
      gyp.verbose('using proxy:', proxyUrl)
      requestOpts.proxy = proxyUrl
    }

    request(requestOpts, downloadError)
      .pipe(zlib.createGunzip())
      .pipe(parser)
    parser.on('entry', onEntry)
    parser.on('end', afterTarball)

    // something went wrong downloading the tarball?
    function downloadError (err, res) {
      if (err || res.statusCode != 200) {
        badDownload = true
        cb(err || new Error(res.statusCode + ' status code downloading tarball'))
      }
    }

    // handle a file from the tarball
    function onEntry (entry) {
      var filename = entry.props.path
        , trimmed = install.trim(filename)

      if (!valid(trimmed)) {
        // skip
        return
      }

      var dir = path.dirname(trimmed)
        , devFileDir = path.join(devDir, dir)
        , devFile = path.join(devDir, trimmed)

      if (dir !== '.') {
        // TODO: async
        // TODO: keep track of the dirs that have been created/checked so far
        //console.error(devFileDir)
        mkdir.sync(devFileDir)
      }
      // TODO: better "File" detection or use `fstream`
      if (entry.props.type !== '0') {
        return
      }
      //console.error(trimmed, entry.props)

      // Finally save the file to the filesystem
      // TODO: Figure out why pipe() hangs here or use `fstream`
      var ws = fs.createWriteStream(devFile, {
          mode: entry.props.mode
      })
      entry.on('data', function (b) {
        ws.write(b)
      })
      entry.on('end', function () {
        ws.end()
        gyp.verbose('saved file', devFile)
      })

    }

    function afterTarball () {
      if (badDownload) return
      gyp.verbose('done parsing tarball')
      var async = 0

      if (isLegacy) {
        // copy over the files from the `legacy` dir
        async++
        copyLegacy(deref)
      }

      if (win) {
        // need to download node.lib
        async++
        downloadNodeLib(deref)
      }

      if (async === 0) {
        // no async tasks required
        cb()
      }

      function deref (err) {
        if (err) return cb(err)
        --async || cb()
      }
    }

    function copyLegacy (done) {
      // legacy versions of node (< 0.8) require the legacy files to be copied
      // over since they contain many bugfixes from the current node build system
      gyp.verbose('copying "legacy" gyp configuration files for version', version)

      var legacyDir = path.resolve(__dirname, '..', 'legacy')
      gyp.verbose('using "legacy" dir', legacyDir)
      gyp.verbose('copying to "dev" dir', devDir)

      var reader = fstream.Reader({ path: legacyDir, type: 'Directory' })
        , writer = fstream.Writer({ path: devDir, type: 'Directory' })

      reader.on('entry', function onEntry (entry) {
        gyp.verbose('reading entry', entry.path)
        entry.on('entry', onEntry)
      })

      reader.on('error', done)
      writer.on('error', done)

      // Like `cp -rpf`
      reader.pipe(writer)

      reader.on('end', done)
    }

    function downloadNodeLib (done) {
      gyp.verbose('on Windows; need to download `node.lib`...')
      var releaseDir = path.join(devDir, 'Release')
        , debugDir = path.join(devDir, 'Debug')
        , patchVersion = nodeLibMap[version] || '0'
        , nodeLibUrl = distUrl + '/v' + version + '.' + patchVersion + '/node.lib'

      gyp.verbose('Release dir', releaseDir)
      gyp.verbose('Debug dir', debugDir)
      gyp.verbose('`node.lib` url', nodeLibUrl)
      // TODO: parallelize mkdirs
      mkdir(releaseDir, function (err) {
        if (err) return done(err)
        mkdir(debugDir, function (err) {
          if (err) return done(err)
          gyp.info('downloading `node.lib`', nodeLibUrl)
          // TODO: clean this mess up, written in a hastemode-9000
          var badDownload = false
          var res = request(nodeLibUrl, function (err, res) {
            if (err || res.statusCode != 200) {
              badDownload = true
              done(err || new Error(res.statusCode + ' status code downloading node.lib'))
            }
          })
          var releaseDirNodeLib = path.join(releaseDir, 'node.lib')
            , debugDirNodeLib = path.join(debugDir, 'node.lib')
            , rws = fs.createWriteStream(releaseDirNodeLib)
            , dws = fs.createWriteStream(debugDirNodeLib)
          gyp.verbose('streaming to', releaseDirNodeLib)
          gyp.verbose('streaming to', debugDirNodeLib)
          res.pipe(rws)
          res.pipe(dws)
          res.on('end', function () {
            if (badDownload) return
            done()
          })
        })
      })
    }


  })

  }

  /**
   * Checks if a given filename is "valid" for this installation.
   */

  function valid (file) {
      // header files
    return minimatch(file, 'src/*.h')
      || minimatch(file, 'deps/v8/include/**/*.h')
      || minimatch(file, 'deps/uv/include/**/*.h')
      // non-legacy versions of node also extract the gyp build files
      || (!isLegacy &&
            (minimatch(file, '*.gypi')
          || minimatch(file, 'tools/*.gypi')
          || minimatch(file, 'tools/gyp_addon')
          || (minimatch(file, 'tools/gyp/**') && !minimatch(file, 'tools/gyp/test/**'))
            )
         )
  }

}


install.trim = function trim (file) {
  var firstSlash = file.indexOf('/')
  return file.substring(firstSlash + 1)
}
