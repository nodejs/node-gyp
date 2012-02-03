
module.exports = exports = configure

function configure (gyp, argv, callback) {
  console.error(gyp.opts.argv.remain)
  console.error(gyp.argv)
  console.error(gyp.command)

  
}
