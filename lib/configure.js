
module.exports = configure

function configure (argv) {

  /**
   * Module dependencies.
   */

  var nopt = require('nopt')
    , knownOpts = {
          debug: Boolean    // Debug build
        , verbose: Boolean  // verbose mode, print commands
        , target: Number    // target node version to compile the module for
      }
    , opts = nopt(knownOpts)

  console.log(opts)

}
