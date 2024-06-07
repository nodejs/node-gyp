'use strict'

const { describe, it } = require('mocha')
const assert = require('assert')
const path = require('path')
const cp = require('child_process')
const util = require('../lib/util')
const { platformTimeout } = require('./common')

const wasmAddonPath = path.resolve(__dirname, 'node_modules', 'hello_wasm')
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

function runWasm (hostProcess = process.execPath) {
  const testCode = "console.log(require('hello_wasm').hello())"
  return execFileSync(hostProcess, ['--experimental-wasi-unstable-preview1', '-e', testCode], { cwd: __dirname })
}

function executable (name) {
  return name + (process.platform === 'win32' ? '.exe' : '')
}

function getWasmEnv (target) {
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
  }
  return env
}

describe('wasm', function () {
  it('build simple node-api addon to wasm (wasm32-emscripten)', async function () {
    if (!process.env.EMSDK) {
      return this.skip('emsdk not found')
    }
    this.timeout(platformTimeout(1, { win32: 5 }))

    const cmd = [
      nodeGyp,
      'rebuild',
      '-C', wasmAddonPath,
      '--loglevel=verbose',
      '--arch=wasm32',
      `--nodedir=${path.dirname(require.resolve('emnapi'))}`,
      '--', '-f', 'make'
    ]
    const [err, logLines] = await execFile(cmd, getWasmEnv('emscripten'))
    const lastLine = logLines[logLines.length - 1]
    assert.strictEqual(err, null)
    assert.strictEqual(lastLine, 'gyp info ok', 'should end in ok')
    assert.strictEqual(runWasm(), 'world')
  })

  it('build simple node-api addon to wasm (wasm32-wasip1)', async function () {
    if (!process.env.WASI_SDK_PATH) {
      return this.skip('wasi-sdk not found')
    }
    this.timeout(platformTimeout(1, { win32: 5 }))

    const cmd = [
      nodeGyp,
      'rebuild',
      '-C', wasmAddonPath,
      '--loglevel=verbose',
      '--arch=wasm32',
      `--nodedir=${path.dirname(require.resolve('emnapi'))}`,
      '--', '-f', 'make'
    ]
    const [err, logLines] = await execFile(cmd, getWasmEnv('wasi'))
    const lastLine = logLines[logLines.length - 1]
    assert.strictEqual(err, null)
    assert.strictEqual(lastLine, 'gyp info ok', 'should end in ok')
    assert.strictEqual(runWasm(), 'world')
  })

  it('build simple node-api addon to wasm (wasm32-unknown-unknown)', async function () {
    if (!process.env.WASI_SDK_PATH) {
      return this.skip('wasi-sdk not found')
    }
    this.timeout(platformTimeout(1, { win32: 5 }))

    const cmd = [
      nodeGyp,
      'rebuild',
      '-C', wasmAddonPath,
      '--loglevel=verbose',
      '--arch=wasm32',
      `--nodedir=${path.dirname(require.resolve('emnapi'))}`,
      '--', '-f', 'make'
    ]
    const [err, logLines] = await execFile(cmd, getWasmEnv('wasm'))
    const lastLine = logLines[logLines.length - 1]
    assert.strictEqual(err, null)
    assert.strictEqual(lastLine, 'gyp info ok', 'should end in ok')
    assert.strictEqual(runWasm(), 'world')
  })
})
