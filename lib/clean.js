
module.exports = exports = clean

exports.usage = 'Removes any generated build files and the "out" dir'

/**
 * Module dependencies.
 */

var rm = require('rimraf')
  , glob = require('glob')
  , asyncEmit = require('./util/asyncEmit')
  , createHook = require('./util/hook')
  , targets = []

/**
 * Add the platform-specific targets to remove.
 */

if (process.platform == 'win32') {
  // Remove MSVC project files
  targets.push('Debug')
  targets.push('Release')
  targets.push('*.sln')
  targets.push('*.vcxproj*')
} else {
  // Remove Makefile project files
  targets.push('out')
  targets.push('Makefile.gyp')
  targets.push('*.Makefile')
  targets.push('*.target.gyp.mk')
}
if (process.platform == 'solaris') {
  // Remoge the 'gyp-sun-tool' on Solaris
  targets.push('gyp-sun-tool')
}
if (process.platform == 'darwin') {
  // Remoge the 'gyp-mac-tool' on Darwin
  targets.push('gyp-mac-tool')
}


function clean (gyp, argv, callback) {

  // The list of files to be removed
  var files = []
    , globCount = targets.length
    , counter = 0
    , emitter

  createHook('gyp-clean.js', function (err, _e) {
    if (err) return callback(err)
    emitter = _e
    asyncEmit(emitter, 'before', function (err) {
      if (err) return callback(err)
      doClean()
    })
  })

  function doClean () {
    targets.forEach(function (target) {
      gyp.verbose('globbing', target)

      glob(target, function (err, result) {
        if (err) return callback(err)
        globCount--

        files.push.apply(files, result)
        result.forEach(function (file) {
          counter++
          gyp.verbose('removing', file)

          rm(file, function (err) {
            if (err) return callback(err)
            counter--
            gyp.verbose('removed', file)
            if (counter === 0) {
              gyp.verbose('done removing files', files)
              after()
            }
          })

        })

        if (globCount === 0 && counter === 0) {
          // Nothing to clean!
          gyp.info('nothing to clean')
          after()
        }
      })
    })
  }

  function after () {
    asyncEmit(emitter, 'after', function (err) {
      if (err) return callback(err)
      callback()
    })
  }

}
