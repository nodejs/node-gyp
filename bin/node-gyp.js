#!/usr/bin/env node

/**
 * Set the title.
 */

process.title = 'node-gyp'

/**
 * Module dependencies.
 */

var nopt = require('nopt')
  , knownOpts = {
        debug: Boolean
      , verbose: Boolean
    }
  , opts = nopt(knownOpts)

console.log(opts)
