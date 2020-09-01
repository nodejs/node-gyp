'use strict'

function rebuild (nnabt, argv, callback) {
  nnabt.todo.push(
    { name: 'clean', args: [] }
    , { name: 'configure', args: argv }
    , { name: 'build', args: [] }
  )
  process.nextTick(callback)
}

module.exports = rebuild
module.exports.usage = 'Runs "clean", "configure" and "build" all at once'
