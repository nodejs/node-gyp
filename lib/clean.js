
module.exports = exports = clean

exports.usage = 'Removes any generated build files and the "out" dir'

/**
 * Module dependencies.
 */

var rm = require('rimraf')
  , glob = require('glob')
  , targets = [ 'out' ]

/**
 * Add the platform-specific targets to remove.
 */

if (process.platform == 'win32') {
  // Remove MSVC project files
  targets.push('*.sln')
  targets.push('*.vcxproj*')
} else {
  // Remove Makefile project files
  targets.push('Makefile')
  targets.push('*.Makefile')
  targets.push('*.target.mk')
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
            callback()
          }
        })

      })

      if (globCount === 0 && counter === 0) {
        // Nothing to clean!
        gyp.info('nothing to clean')
        callback()
      }
    })
  })

}
