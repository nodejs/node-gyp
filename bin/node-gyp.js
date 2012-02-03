#!/usr/bin/env node

/**
 * Set the title.
 */

process.title = 'node-gyp'

/**
 * Module dependencies.
 */

var gyp = require('../lib/node-gyp')()

/**
 * Process and execute the selected command.
 */

gyp.run(process.argv)
