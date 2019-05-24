module.exports.logWithPrefix = function logWithPrefix (log, prefix) {
  function setPrefix(logFunction) {
    return (...args) => logFunction.apply(null, [prefix, ...args])
  }
  return {
    silly: setPrefix(log.silly),
    verbose: setPrefix(log.verbose),
    info: setPrefix(log.info),
    warn: setPrefix(log.warn),
    error: setPrefix(log.error),
  }
}
