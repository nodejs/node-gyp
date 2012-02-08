
module.exports = exports = install

exports.usage = 'Install node development files for the specified node version'

/**
 * Module dependencies.
 */

var fs = require('fs')
  , tar = require('tar')
  , rm = require('rimraf')
  , path = require('path')
  , zlib = require('zlib')
  , mkdir = require('mkdirp')
  , request = require('request')
  , minimatch = require('minimatch')
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
  function cb () {
    if (cb.done) return
    cb.done = true
    callback.apply(null, arguments)
  }


  var version = parseFloat(argv[0] || gyp.opts.target)

  if (isNaN(version)) {
    return cb(new Error('You must specify a version to install (like "0.7")'))
  }
  if (version < 0.6) {
    return cb(new Error('Minimum target version is `0.6` or greater. Got: ' + version))
  }

  // TODO: Make ~/.node-gyp configurable
  var devDir = path.join(process.env.HOME, '.node-gyp', version.toString())

  // If '--ensure' was passed, then don't *always* install the version,
  // check if it is already installed, and only install when needed
  if (gyp.opts.ensure) {
    fs.stat(devDir, function (err, stat) {
      if (err) {
        if (err.code == 'ENOENT') {
          go()
        } else {
          callback(err)
        }
        return
      }
      gyp.verbose('version is already installed, not re-installing', version)
      callback()
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
    var tarballUrl = distUrl + '/v' + version.toFixed(1) + '.0/node-v' + version.toFixed(1) + '.0.tar.gz'
      , badDownload = false
      , parser = tar.Parse()

    gyp.info('downloading:', tarballUrl)

    request(tarballUrl, downloadError)
      .pipe(zlib.createGunzip())
      .pipe(parser)
    parser.on('entry', onEntry)
    parser.on('end', afterTarball)

    // something went wrong downloading the tarball?
    function downloadError (err, res) {
      if (err || res.statusCode != 200) {
        badDownload = true
        gyp.commands.remove([ version ], function (err2) {
          cb(err || new Error(res.statusCode + ' status code downloading tarball'))
        })
      }
    }

    // handle a file from the tarball
    function onEntry (entry) {
      var filename = entry.props.path
        , trimmed = install.trim(filename)

      if (!install.valid(trimmed)) {
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

      async++
      checkVersion(deref)

      if (version < 0.7) {
        // copy over gyp_addon, addon.gypi and common.gypi
        async++
        copyLegacy(deref)
      }

      if (win) {
        // need to download node.lib
        async++
        downloadNodeLib(deref)
      }

      if (win && version < 0.8) {
        // before node 0.8 we need to manually link to node.lib
        async++
        copy2685(deref)
      }

      function deref (err) {
        if (err) return cb(err)
        --async || cb()
      }
    }

    function checkVersion (done) {
      // now check the current version, if one isn't set, then "use"
      // this newly installed version
      gyp.verbose('now checking to see if a version needs to be set')
      gyp.commands.current([], function (err, cur) {
        if (err) return done(err)
        if (typeof cur == 'undefined') {
          gyp.verbose('there\'s no version currently in "use", setting to', version)
          gyp.commands.use([ version ], function (err) {
            if (err) return done(err)
            done()
          })
        } else {
          gyp.verbose('already set to another version, forget about it', cur)
          done()
        }
      })
    }

    function copyLegacy (done) {
      // node 0.6.x doesn't come with the needed addon.gypi or gyp_addon
      // files, so we must copy them over manually
      gyp.verbose('copying "legacy" development files for version', version)
      var legacyDir = path.join(__dirname, '..', 'legacy')
        , toolsDir = path.join(devDir, 'tools')
      gyp.verbose('using "legacy" dir', legacyDir)
      gyp.verbose('installing to "tools" dir', toolsDir)

      // get a listing of the files to copy
      fs.readdir(legacyDir, function (err, files) {
        if (err) return done(err)
        var count = files.length

        // copy each one over in parallel
        files.forEach(function (file) {
          // common.gypi is a special-case that goes in the root dir instead of
          // the "tools" dir
          var copyFrom = path.join(legacyDir, file)
            , copyTo = path.join(file == 'common.gypi' ? devDir : toolsDir, path.basename(file))
          gyp.verbose('copying from, to', copyFrom, copyTo)
          copy(copyFrom, copyTo, function (err) {
            // TODO: guard against multi-callbacks
            if (err) return done(err)
            --count || done()
          })
        })
      })
    }

    function downloadNodeLib (done) {
      gyp.verbose('on windows; need to download `node.lib`')
      var releaseDir = path.join(devDir, 'Release')
        , debugDir = path.join(devDir, 'Debug')
        , patchVersion = nodeLibMap[version] || '0'
        , nodeLibUrl = distUrl + '/v' + version.toFixed(1) + '.' + patchVersion + '/node.lib'
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

    function copy2685 (done) {
      gyp.verbose('need to install the patch gypi file for version', version)
      var patchPath = path.join(__dirname, '..', '2685', 'patch.gypi')
        , copyTo = path.join(devDir, 'tools', 'patch.gypi')
      gyp.verbose('patch.gypi', patchPath)
      gyp.verbose('copy to', copyTo)
      copy(patchPath, copyTo, done)
    }


  })

  }
}

function copy (from, to, cb) {
  var ws = fs.createWriteStream(to)
    , rs = fs.createReadStream(from)
  rs.on('error', cb)
  ws.on('error', cb)
  rs.pipe(ws)
  rs.on('end', function () {
    cb()
  })
}

install.valid = function valid (file) {
  return minimatch(file, '*.gypi')
    || minimatch(file, 'tools/*.gypi')
    || minimatch(file, 'tools/gyp_addon')
    || (minimatch(file, 'tools/gyp/**')
       && !minimatch(file, 'tools/gyp/test/**'))
    // header files
    || minimatch(file, 'src/*.h')
    || minimatch(file, 'deps/v8/include/**/*.h')
    || minimatch(file, 'deps/uv/include/**/*.h')
}


install.trim = function trim (file) {
  var firstSlash = file.indexOf('/')
  return file.substring(firstSlash + 1)
}
