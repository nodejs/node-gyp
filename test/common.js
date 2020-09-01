const envPaths = require('env-paths')

module.exports.devDir = () => envPaths('node-nnabt', { suffix: '' }).cache
