'use strict'

const { describe, it } = require('mocha')
const assert = require('assert')
const path = require('path')
const gracefulFs = require('graceful-fs')
const cp = require('child_process')
const util = require('../lib/util')
const { platformTimeout } = require('./common')

const addonPath = path.resolve(__dirname, 'node_modules', 'hello_napi')
const nodeGyp = path.resolve(__dirname, '..', 'bin', 'node-gyp.js')

const execFileSync = (...args) => cp.execFileSync(...args).toString().trim()

const execFile = async (cmd, env) => {
  const [err,, stderr] = await util.execFile(process.execPath, cmd, {
    env: {
      ...process.env,
      NODE_GYP_NULL_LOGGER: undefined,
      ...env
    },
    encoding: 'utf-8'
  })
  return [err, stderr.toString().trim().split(/\r?\n/)]
}

function runHello (hostProcess = process.execPath) {
  const testCode = "console.log(require('hello_napi').hello())"
  return execFileSync(hostProcess, ['--experimental-wasi-unstable-preview1', '-e', testCode], { cwd: __dirname })
}

function executable (name) {
  return name + (process.platform === 'win32' ? '.exe' : '')
}

function getEnv (target) {
  const env = {
    GYP_CROSSCOMPILE: '1',
    AR_host: 'ar',
    CC_host: 'clang',
    CXX_host: 'clang++'
  }
  if (target === 'emscripten') {
    env.AR_target = 'emar'
    env.CC_target = 'emcc'
    env.CXX_target = 'em++'
  } else if (target === 'wasi') {
    env.AR_target = path.resolve(__dirname, '..', process.env.WASI_SDK_PATH, 'bin', executable('ar'))
    env.CC_target = path.resolve(__dirname, '..', process.env.WASI_SDK_PATH, 'bin', executable('clang'))
    env.CXX_target = path.resolve(__dirname, '..', process.env.WASI_SDK_PATH, 'bin', executable('clang++'))
  } else if (target === 'wasm') {
    env.AR_target = path.resolve(__dirname, '..', process.env.WASI_SDK_PATH, 'bin', executable('ar'))
    env.CC_target = path.resolve(__dirname, '..', process.env.WASI_SDK_PATH, 'bin', executable('clang'))
    env.CXX_target = path.resolve(__dirname, '..', process.env.WASI_SDK_PATH, 'bin', executable('clang++'))
    env.CFLAGS = '--target=wasm32'
  } else if (target === 'win-clang') {
    let vsdir = 'C:\\Program Files\\Microsoft Visual Studio\\2022\\Enterprise'
    if (!gracefulFs.existsSync(vsdir)) {
      vsdir = 'C:\\Program Files\\Microsoft Visual Studio\\2022\\Community'
    }
    const llvmBin = 'VC\\Tools\\Llvm\\x64\\bin'
    env.AR_target = path.join(vsdir, llvmBin, 'llvm-ar.exe')
    env.CC_target = path.join(vsdir, llvmBin, 'clang.exe')
    env.CXX_target = path.join(vsdir, llvmBin, 'clang++.exe')
    env.CFLAGS = '--target=wasm32'
  }
  return env
}

function quote (path) {
  if (path.includes(' ')) {
    return `"${path}"`
  }
}

describe('windows-cross-compile', function () {
  it('build simple node-api addon', async function () {
    if (process.platform !== 'win32') {
      return this.skip('This test is only for windows')
    }
    const env = getEnv('win-clang')
    if (!gracefulFs.existsSync(env.CC_target)) {
      return this.skip('Visual Studio Clang is not installed')
    }

    // handle bash whitespace
    env.AR_target = quote(env.AR_target)
    env.CC_target = quote(env.CC_target)
    env.CXX_target = quote(env.CXX_target)
    this.timeout(platformTimeout(1, { win32: 5 }))

    const cmd = [
      nodeGyp,
      'rebuild',
      '-C', addonPath,
      '--loglevel=verbose',
      `--nodedir=${addonPath}`,
      '--arch=wasm32',
      '--', '-f', 'make'
    ]
    const [err, logLines] = await execFile(cmd, env)
    const lastLine = logLines[logLines.length - 1]
    assert.strictEqual(err, null)
    assert.strictEqual(lastLine, 'gyp info ok', 'should end in ok')
    assert.strictEqual(runHello(), 'world')
  })
})
