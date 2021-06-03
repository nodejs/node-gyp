const fs = require('fs')
const path = require('path')

/** recursively delete files, symlinks (without following them) and dirs */
module.exports = function rmRecSync (pth) {
  pth = path.normalize(pth)

  rm(pth)

  function rm (pth) {
    const pathStat = fs.statSync(pth)
    // trick with lstat is used to avoid following symlinks (especially junctions on windows)
    if (pathStat.isDirectory() && !fs.lstatSync(pth).isSymbolicLink()) {
      fs.readdirSync(pth).forEach((nextPath) => rm(path.join(pth, nextPath)))
      fs.rmdirSync(pth)
    } else {
      fs.unlinkSync(pth)
    }
  }
}
