
/**
 * Helper functions for parsing and testing node versions.
 * Just plain `parseFloat` doesn't work in case there's ever a "x.10" release,
 * which would be parsed as x.1 when represented as a Number.
 */

var regexp = /^(\d+)\.(\d+)/

/**
 * Accepts a String like "v0.10.4" and returns a String
 * containing the major and minor versions ("0.10").
 */

exports.parse = function parse (str) {
  str = String(str)
  if (str[0] === 'v') {
    str = str.substring(1)
  }
  return str.match(regexp)[0]
}

/**
 * Accepts a major-minor version string (from `parseVersion`) and a major
 * and minor Number value to test that the given version is less that the
 * specified version. Returns true or false.
 */

exports.lessThan = function lessThan (ver, major, minor) {
  var exec = regexp.exec(ver)
    , inMaj = parseInt(exec[1])
    , inMin = parseInt(exec[2])
  if (inMaj > major) return false
  return inMin < minor
}
