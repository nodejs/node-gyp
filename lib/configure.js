
module.exports = exports = configure

/**
 * Module dependencies.
 */

var path = require('path')
  , spawn = require('child_process').spawn

function configure (gyp, argv, callback) {
  console.error(gyp.opts)
  console.error(gyp.argv)
  console.error(gyp.command)

}
