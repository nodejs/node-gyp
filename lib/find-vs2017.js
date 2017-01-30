module.exports = {
  locateMsbuild: locateMsbuild,
  locateVS2017: locateVS2017,
  getVS2017WinSDKVersion: getVS2017WinSDKVersion,
  setGypVS2017Env: setGypVS2017Env
}

var log = require('npmlog')
  , fs = require('fs')
  , path = require('path')
  , cp = require('child_process')
  , win = process.platform == 'win32'
  , msgFormat = require('util').format
  , findPython = require('./find-python')

var vs2017_install_path
  , vs2017_win_sdk_ver

function run_locate(gyp, callback) {
  if (!win) {
    return callback(null, '', '')
  }

  if (vs2017_install_path || vs2017_install_path === '') {
    return callback(null, vs2017_install_path, vs2017_win_sdk_ver)
  } 

  var python = gyp.opts.python || process.env.PYTHON || 'python2'
    , findvc_path = path.join(__dirname, '..', 'find_vs2017.py')

  findPython(python, locate_vc);    

  function locate_vc(err, python_bin) {
    if (err) {
      return callback(err)
    }

    log.verbose('find vs2017', 'obtaining vs2017 install path using script %s',
                findvc_path)
    cp.execFile(python_bin, [findvc_path], function(err, stdout, stderr) {
      if (err) {
        return callback(err)
      }
      if (stdout) {
        vs2017_install_path = stdout.split('\r\n')[0]
        log.verbose('find vs2017', 'found Visual Studio 2017 in %s', vs2017_install_path)
        get_sdk_version(python_bin)
      } else {
        log.verbose('find vs2017',
                    'no valid Visual Studio 2017 installation found')
        vs2017_install_path = ''
        vs2017_win_sdk_ver = ''
      }
    })
  }

  function get_sdk_version(python_bin) {
    log.verbose('find vs2017', 'obtaining installed Windows SDKs')
    cp.execFile(python_bin, [findvc_path, vs2017_install_path],
                function(err, stdout, stderr) {
      if (err) {
        return callback(err)
      }              
      if (stdout) {
        vs2017_win_sdk_ver = stdout.split('\r\n')[0]
        log.verbose('find vs2017', 'found VS2017 WinSDK %s', vs2017_win_sdk_ver)
      } else {
        log.verbose('find vs2017', 'no installed sdks found')
      }

      callback(null, vs2017_install_path, vs2017_win_sdk_ver)
    })
  }

}

function locateMsbuild(gyp, callback) {
  run_locate(gyp, function(err, vs_path, sdk) {
    if (err) {
      return callback(err)
    }
    if (vs_path === '') {
      return callback()
    }    
    var msbuild_location = path.join(vs_path, 'MSBuild',
                                     '15.0', 'Bin', 'MSBuild.exe')
    log.verbose('find vs2017', 'looking for msbuild in %s', msbuild_location)
    fs.access(msbuild_location, function(err) {
      callback(null, err ? null : msbuild_location)
    })
  })
}

function locateVS2017(gyp, callback) {
  run_locate(gyp, function(err, vs_path, sdk) {
    if (err) {
      callback(err)
    } else {
      callback(null, vs_path === '' ? null : vs_path)
    }
  })
}

function getVS2017WinSDKVersion(gyp, callback) {
  run_locate(gyp, function(err, vs_path, sdk) {
    if (err) {
      callback(err)
    } else {
      callback(null, sdk === '' ? null : sdk)
    }
  })
}

function setGypVS2017Env(gyp, callback) {
  locateVS2017(gyp, setPath)
    
  function setPath(err, vs_path) {
    if (err) {
      return callback(err)
    }
    if (vs_path) {
      process.env['vs2017_install'] = vs_path
      getVS2017WinSDKVersion(gyp, setSDK)
    } else {
      callback()
    }
  }

  function setSDK(err, sdk) {
    if (err) {
      return callback(err)
    }
    if (sdk) {
      process.env['vs2017_sdk'] = sdk
    }
    callback()
  }
}
