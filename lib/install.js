
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
    var tarballUrl = distUrl + '/v' + version + '.0/node-v' + version + '.0.tar.gz'
      , badDownload = false
      , parser = tar.Parse()

    gyp.info('downloading:', tarballUrl)

    request(tarballUrl, downloadError)
      .pipe(zlib.createGunzip())
      .pipe(parser)
    parser.on('entry', onEntry)
    parser.on('end', function () {
      if (!badDownload) {
        gyp.verbose('done parsing tarball')
        cb()
      }
    })

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
      // TODO: better File detection And/Or use `fstream`
      if (entry.props.type !== '0') {
        return
      }
      //console.error(trimmed, entry.props)

      // Finally save the file to the filesystem
      // TODO: Figure out why pipe() hangs here And/Or use `fstream`
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
  })

  }
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
