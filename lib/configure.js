
module.exports = exports = configure

/**
 * Module dependencies.
 */

var fs = require('fs')
  , path = require('path')
  , glob = require('glob')
  , win = process.platform == 'win32'

exports.usage = 'Generates ' + (win ? 'MSVC project files' : 'a Makefile') + ' for the current module'

function configure (gyp, argv, callback) {

  var python = gyp.opts.python || 'python'
    , next = win ? go : cleanupMakefile
    , version

  if (gyp.opts.target) {
    // if '--target=x.x' was given, then ensure that version is installed
    version = parseFloat(gyp.opts.target)
    gyp.opts.ensure = true
    gyp.commands.install([ version ], next)
  } else {
    // otherwise look up the 'current' version
    gyp.commands.current([], function (err, _version) {
      if (err) return callback(err)
      if (!_version) return callback(new Error('No dev files installed. Run `node-gyp use x.x` where "x.x" is a node version like "0.7"'))
      version = _version
      next()
    })
  }

  /**
   * Removes any existing Makefile.gyp file, if it exists.
   * Fixes: https://github.com/TooTallNate/node-gyp/issues/18
   */

  function cleanupMakefile (err) {
    if (err) return callback(err)
    gyp.verbose('checking for Makefile.gyp')
    fs.stat('Makefile.gyp', function (err, stat) {
      if (err) {
        if (err.code == 'ENOENT') {
          // No Makefile.gyp, we're good
          gyp.verbose('no Makefile.gyp exists, continuing with "configure"')
          go()
        } else {
          // Some other error, report it
          callback(err)
        }
        return
      }
      // Makefile.gyp exists, gotta remove it
      gyp.verbose('found a Makefile.gyp file, removing')
      fs.unlink('Makefile.gyp', function (err) {
        if (err) return callback(err)
        gyp.verbose('removed the Makefile.gyp file successfully')
        go()
      })
    })
  }

  function go (err) {
    if (err) return callback(err)

    var target = String(version)
      , devDir = path.join(process.env.HOME, '.node-gyp', target)
      , gyp_addon = path.join(devDir, 'tools', 'gyp_addon')

    if (win && version < 0.8) {
      gyp.verbose('on Windows and target version is less than 0.8; applying #2685 patch')
      // if < 0.8, we need to manually apply the patch at joyent/node#2685,
      // since it got merged somewhere in 0.7.x.
      argv.push('-Dnode_root_dir=' + devDir)
      argv.push('-I')
      argv.push(path.join(devDir, 'tools', 'patch.gypi'))
    }

    if (!win && version < 0.8) {
      gyp.verbose('on Unix and target version is less than 0.8; applying #2722 patch')
      argv.push('-I')
      argv.push(path.join(devDir, 'tools', 'patch2722.gypi'))
    }

    if (!win && !~argv.indexOf('-f') && !~argv.indexOf('--format')) {
      gyp.verbose('gyp format was not specified; forcing "make"')
      // use a 'gyp' suffix on the Makefile, as to not overwrite an existing one
      argv.unshift('.gyp')
      argv.unshift('--suffix')
      // force the 'make' target for non-Windows
      argv.unshift('make')
      argv.unshift('-f')
    }

    var hasArch = argv.some(function (arg) {
      return arg.indexOf('-Dtarget_arch') === 0
    })
    // was --arch specified?
    if (!hasArch && gyp.opts.arch) {
      gyp.verbose('using the architecture specified by --arch', gyp.opts.arch)
      argv.push('-Dtarget_arch=' + gyp.opts.arch)
      hasArch = true
    }

    // this may need to be tweaked for windows and stuff, we'll see...
    if (!hasArch) {
      // on < 0.8 the target_arch variable is set to ia32 by default unless
      // overridden, so we have to explicitly specify the arch here
      gyp.verbose('target arch not specified, using the current host architecture', process.arch)
      argv.push('-Dtarget_arch=' + process.arch)
      gyp.opts.arch = process.arch
      hasArch = true
    }

    // execute `gyp_addon` from the current target node version
    argv.unshift(gyp_addon)
    var cp = gyp.spawn(python, argv)

    cp.on('exit', function (code, signal) {
      if (code !== 0) {
        callback(new Error('`gyp_addon` failed with exit code: ' + code))
      } else if (process.platform == 'darwin' && gyp.opts.arch != 'ia32') {
        // XXX: Add a version check here when node upgrades gyp to a version that
        // fixes this
        remove_i386()
      } else {
        callback()
      }
    })

  }

  /**
   * Removes the lines that contain '-arch i386' from any generated
   * *.target.gyp.mk files. This works around a nasty gyp bug where they
   * hard-code these flags in for some reason.
   */

  function remove_i386 () {
    glob('*.target.gyp.mk', function (err, files) {
      if (err) return callback(err)
      var count = files.length
      if (count === 0) return callback()
      files.forEach(function (filename) {
        remove_i386single(filename, function (err) {
          if (err) return callback(err)
          --count || callback()
        })
      })
    })
  }

  function remove_i386single (filename, done) {
    gyp.verbose('removing "-arch i386" flag from', filename)
    var rs = fs.createReadStream(filename)
      , lines = []
    rs.setEncoding('utf8')
    emitLines(rs)
    rs.on('line', function (line) {
      // ignore lines containing the bad flag
      if (!~line.indexOf('-arch i386')) {
        lines.push(line)
      }
    })
    rs.on('end', function () {
      // now save the file back with the offending lines removed
      fs.writeFile(filename, lines.join('\n'), function (err) {
        if (err) return done(err)
        done()
      })
    })
  }

}


/**
 * A quick little thingy that takes a Stream instance and makes it emit 'line'
 * events when a newline is encountered.
 */

function emitLines (stream) {
  var backlog = ''
  stream.on('data', function (data) {
    backlog += data
    var n = backlog.indexOf('\n')
    // got a \n? emit one or more 'line' events
    while (~n) {
      stream.emit('line', backlog.substring(0, n))
      backlog = backlog.substring(n + 1)
      n = backlog.indexOf('\n')
    }
  })
  stream.on('end', function () {
    if (backlog) {
      stream.emit('line', backlog)
    }
  })
}
