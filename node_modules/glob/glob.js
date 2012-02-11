module.exports = glob

var fs = require("graceful-fs")
, minimatch = require("minimatch")
, Minimatch = minimatch.Minimatch
, inherits = require("inherits")
, EE = require("events").EventEmitter
, FastList = require("fast-list")
, path = require("path")
, isDir = {}

// Globbing is a *little* bit different than just matching, in some
// key ways.
//
// First, and importantly, it matters a great deal whether a pattern
// is "absolute" or "relative".  Absolute patterns are patterns that
// start with / on unix, or a full device/unc path on windows.
//
// Second, globs interact with the actual filesystem, so being able
// to stop searching as soon as a match is no longer possible is of
// the utmost importance.  It would not do to traverse a large file
// tree, and then eliminate all but one of the options, if it could
// be possible to skip the traversal early.

// Get a Minimatch object from the pattern and options.  Then, starting
// from the options.root or the cwd, read the dir, and do a partial
// match on all the files if it's a dir, or a regular match if it's not.


function glob (pattern, options, cb) {
  if (typeof options === "function") cb = options, options = {}
  if (!options) options = {}

  if (typeof options === "number") {
    deprecated()
    return
  }

  var m = new Glob(pattern, options, cb)

  if (options.sync) {
    return m.found
  } else {
    return m
  }
}

glob.fnmatch = deprecated

function deprecated () {
  throw new Error("glob's interface has changed. Please see the docs.")
}

glob.sync = globSync
function globSync (pattern, options) {
  if (typeof options === "number") {
    deprecated()
    return
  }

  options = options || {}
  options.sync = true
  return glob(pattern, options)
}


glob.Glob = Glob
inherits(Glob, EE)
function Glob (pattern, options, cb) {
  if (!(this instanceof Glob)) {
    return new Glob(pattern, options, cb)
  }

  if (typeof cb === "function") {
    this.on("error", cb)
    this.on("end", function (matches) { cb(null, matches) })
  }

  options = options || {}

  if (!options.hasOwnProperty("maxDepth")) options.maxDepth = 1000
  if (!options.hasOwnProperty("maxLength")) options.maxLength = 4096

  var cwd = this.cwd = options.cwd =
    options.cwd || process.cwd()

  this.root = options.root =
    options.root || path.resolve(cwd, "/")

  if (!pattern) {
    throw new Error("must provide pattern")
  }

  var mm = this.minimatch = new Minimatch(pattern, options)
  options = this.options = mm.options
  pattern = this.pattern = mm.pattern

  this.error = null
  this.aborted = false

  this.matches = new FastList()
  EE.call(this)
  var me = this

  this._checkedRoot = false

  // if we have any patterns starting with /, then we need to
  // start at the root.  If we don't, then we can take a short
  // cut and just start at the cwd.
  var start = this.cwd
  for (var i = 0, l = this.minimatch.set.length; i < l; i ++) {
    if (this.minimatch.set[i].absolute) {
      start = this.root
      break
    }
  }

  if (me.options.debug) {
    console.error("start =", start)
  }

  this._process(start, 1, this._finish.bind(this))
}

Glob.prototype._finish = _finish
function _finish () {
  var me = this
  if (me.options.debug) {
    console.error("!!! GLOB top level cb", me)
  }
  if (me.options.nonull && me.matches.length === 0) {
    return me.emit("end", [pattern])
  }

  var found = me.found = me.matches.slice()

  found = me.found = found.map(function (m) {
    if (m.indexOf(me.options.cwd) === 0) {
      m = m.substr(me.options.cwd.length + 1)
    }
    return m
  })

  if (!me.options.mark) return next()

  // mark all directories with a /.
  // This may involve some stat calls for things that are unknown.
  var needStat = []
  found = me.found = found.map(function (f) {
    if (isDir[f] === undefined) needStat.push(f)
    else if (isDir[f] && f.slice(-1) !== "/") f += "/"
    return f
  })
  var c = needStat.length
  if (c === 0) return next()

  var stat = me.options.follow ? "stat" : "lstat"
  needStat.forEach(function (f) {
    if (me.options.sync) {
      try {
        afterStat(f)(null, fs[stat + "Sync"](f))
      } catch (er) {
        afterStat(f)(er)
      }
    } else fs[stat](f, afterStat(f))
  })

  function afterStat (f) { return function (er, st) {
    // ignore errors.  if the user only wants to show
    // existing files, then set options.stat to exclude anything
    // that doesn't exist.
    if (st && st.isDirectory() && f.substr(-1) !== "/") {
      var i = found.indexOf(f)
      if (i !== -1) {
        found.splice(i, 1, f + "/")
      }
    }
    if (-- c <= 0) return next()
  }}

  function next () {
    if (!me.options.nosort) {
      found = found.sort(alphasort)
    }
    me.emit("end", found)
  }
}

function alphasort (a, b) {
  a = a.toLowerCase()
  b = b.toLowerCase()
  return a > b ? 1 : a < b ? -1 : 0
}

Glob.prototype.abort = abort
function abort () {
  this.aborted = true
  this.emit("abort")
}


Glob.prototype._process = _process
function _process (f, depth, cb) {
  if (this.aborted) return cb()

  var me = this

  // if f matches, then it's a match.  emit it, move on.
  // if it *partially* matches, then it might be a dir.
  //
  // possible optimization: don't just minimatch everything
  // against the full pattern.  if a bit of the pattern is
  // not magical, it'd be good to reduce the number of stats
  // that had to be made.  so, in the pattern: "a/*/b", we could
  // readdir a, then stat a/<child>/b in all of them.
  //
  // however, that'll require a lot of muddying between minimatch
  // and glob, and at least for the time being, it's kind of nice to
  // keep them a little bit separate.

  // if this thing is a match, then add to the matches list.
  var match = me.minimatch.match(f)
  if (!match) {
    if (me.options.debug) {
      console.error("not a match", f)
    }
    return me._processPartial(f, depth, cb)
  }

  if (match) {
    if (me.options.debug) {
      console.error(" %s matches %s", f, me.pattern)
    }
    // make sure it exists if asked.
    if (me.options.stat) {
      var stat = me.options.follow ? "stat" : "lstat"
      if (me.options.sync) {
        try {
          afterStat(f)(null, fs[stat + "Sync"](f))
        } catch (ex) {
          afterStat(f)(ex)
        }
      } else fs[stat](f, afterStat(f))
    } else if (me.options.sync) {
      emitMatch()
    } else {
      process.nextTick(emitMatch)
    }

    return

    function afterStat (f) { return function (er, st) {
      if (er) return cb()
      isDir[f] = st.isDirectory()
      emitMatch()
    }}

    function emitMatch () {
      if (me.options.debug) {
        console.error("emitting match", f)
      }
      me.matches.push(f)
      me.emit("match", f)
      // move on, since it might also be a partial match
      // eg, a/**/c matches both a/c and a/c/d/c
      me._processPartial(f, depth, cb)
    }
  }

}


Glob.prototype._processPartial = _processPartial
function _processPartial (f, depth, cb) {
  if (this.aborted) return cb()

  var me = this

  var partial = me.minimatch.match(f, true)
  if (!partial) {
    if (me.options.debug) {
      console.error("not a partial", f)
    }

    // if not a match or partial match, just move on.
    return cb()
  }

  // partial match
  // however, this only matters if it's a dir.
  //if (me.options.debug)
  if (me.options.debug) {
    console.error("got a partial", f)
  }
  me.emit("partial", f)

  me._processDir(f, depth, cb)
}

Glob.prototype._processDir = _processDir
function _processDir (f, depth, cb) {
  if (this.aborted) return cb()

  // If we're already at the maximum depth, then don't read the dir.
  if (depth >= this.options.maxDepth) return cb()

  // if the path is at the maximum length, then don't proceed, either.
  if (f.length >= this.options.maxLength) return cb()

  // now the fun stuff.
  // if it's a dir, then we'll read all the children, and process them.
  // if it's not a dir, or we can't access it, then it'll fail.
  // We log a warning for EACCES and EPERM, but ENOTDIR and ENOENT are
  // expected and fine.
  cb = this._afterReaddir(f, depth, cb)
  if (this.options.sync) return this._processDirSync(f, depth, cb)
  fs.readdir(f, cb)
}

Glob.prototype._processDirSync = _processDirSync
function _processDirSync (f, depth, cb) {
  try {
    cb(null, fs.readdirSync(f))
  } catch (ex) {
    cb(ex)
  }
}

Glob.prototype._afterReaddir = _afterReaddir
function _afterReaddir (f, depth, cb) {
  var me = this
  return function afterReaddir (er, children) {
    if (er) switch (er.code) {
      case "UNKNOWN": // probably too deep
      case "ENOTDIR": // completely expected and normal.
        isDir[f] = false
        return cb()
      case "ENOENT":  // should never happen.
      default: // some other kind of problem.
        if (!me.options.silent) console.error("glob error", er)
        if (me.options.strict) return cb(er)
        return cb()
    }

    // at this point, we know it's a dir, so save a stat later if
    // mark is set.
    isDir[f] = true

    me._processChildren(f, depth, children, cb)
  }
}

Glob.prototype._processChildren = _processChildren
function _processChildren (f, depth, children, cb) {
  var me = this

  // note: the file ending with / might match, but only if
  // it's a directory, which we know it is at this point.
  // For example, /a/b/ or /a/b/** would match /a/b/ but not
  // /a/b.  Note: it'll get the trailing "/" strictly based
  // on the "mark" param, but that happens later.
  // This is slightly different from bash's glob.
  if (!me.minimatch.match(f) && me.minimatch.match(f + "/")) {
    me.matches.push(f)
    me.emit("match", f)
  }

  if (-1 === children.indexOf(".")) children.push(".")
  if (-1 === children.indexOf("..")) children.push("..")

  var count = children.length
  if (me.options.debug) {
    console.error("count=%d %s", count, f, children)
  }

  if (count === 0) {
    if (me.options.debug) {
      console.error("no children?", children, f)
    }
    return then()
  }

  children.forEach(function (c) {
    if (f === "/") c = f + c
    else c = f + "/" + c

    if (me.options.debug) {
      console.error(" processing", c)
    }
    me._process(c, depth + 1, then)
  })

  function then (er) {
    count --
    if (me.options.debug) {
      console.error("%s THEN %s", f, count, count <= 0 ? "done" : "not done")
    }
    if (me.error) return
    if (er) return me.emit("error", me.error = er)
    if (count <= 0) cb()
  }
}
