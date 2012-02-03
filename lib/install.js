
module.exports = exports = install

/**
 * Module dependencies.
 */

var fs = require('fs')
  , tar = require('tar')
  , path = require('path')
  , zlib = require('zlib')
  , mkdir = require('mkdirp')
  , request = require('request')
  , minimatch = require('minimatch')
  , distUrl = 'http://nodejs.org/dist'

function install (gyp, argv, callback) {

  if (argv.length < 1) {
    return callback(new Error('need to specify a version'))
  }

  var version = parseFloat(argv[0])

  // first create the dir for the node dev files
  var devDir = path.join(process.env.HOME, '.node-gyp', version.toString())

  mkdir(devDir, function (err) {
    if (err) return callback(err)
    console.error('created:', devDir)

    // now download the node tarball
    // TODO: download the newest version instead of the .0 release
    var tarballUrl = distUrl + '/v' + version + '.0/node-v' + version + '.0.tar.gz'
    console.error('downloading:', tarballUrl)
    request(tarballUrl, downloadError)
      .pipe(zlib.createGunzip())
      .pipe(tar.Parse())
      .on('entry', onEntry)

    // something went wrong downloading the tarball?
    function downloadError (err, res) {
      if (err || res.statusCode != 200) {
        callback(err || new Error(res.statusCode + ' status code downloading tarball'))
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
        //console.error(devFileDir)
        mkdir.sync(devFileDir)
      }
      // TODO: Better File detection
      if (entry.props.type !== '0') {
        return
      }
      //console.error(trimmed, entry.props)

      // Finally save the file to the filesystem
      // TODO: Figure out why pipe() hangs here
      var ws = fs.createWriteStream(devFile, {
          mode: entry.props.mode
      })
      entry.on('data', function (b) {
        ws.write(b)
      })
      entry.on('end', function () {
        ws.end()
        console.error('saved:', devFile)
      })

    }
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
