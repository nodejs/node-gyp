'use strict'
var addon = require('bindings')('hello');
exports.hello = function() { return addon.hello() }
