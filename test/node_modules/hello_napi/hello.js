const path = require('path')
const fs = require('fs')

const addon = (function () {
  const entry = (() => {
    try {
      return require.resolve('./build/Release/hello.node')
    } catch (_) {
      return require.resolve('./build/Release/hello.wasm')
    }
  })()
  
  const ext = path.extname(entry)
  if (ext === '.node') {
    return require(entry)
  }

  if (ext === '.wasm') {
    const values = [undefined, undefined, null, false, true, global, {}]
    const module = new WebAssembly.Module(fs.readFileSync(entry))
    const instance = new WebAssembly.Instance(module, {
      napi: {
        napi_create_string_utf8: (env, str, len, ret) => {
          let end = str
          const buffer = new Uint8Array(instance.exports.memory.buffer)
          while (buffer[end]) end++
          values.push(new TextDecoder().decode(buffer.slice(str, end)))
          new DataView(instance.exports.memory.buffer).setInt32(ret, values.length - 1, true)
          return 0
        },
        napi_create_function: (env, name, len, fn, data, ret) => {
          values.push(function () {
            return values[instance.exports.__indirect_function_table.get(fn)(env, 0)]
          })
          new DataView(instance.exports.memory.buffer).setInt32(ret, values.length - 1, true)
          return 0
        },
        napi_set_named_property: (env, obj, key, val) => {
          const buffer = new Uint8Array(instance.exports.memory.buffer)
          let end = key
          while (buffer[end]) end++
          const k = new TextDecoder().decode(buffer.slice(key, end))
          values[obj][k] = values[val]
          return 0
        }
      }
    })
    const newExports = values[instance.exports.napi_register_wasm_v1(1, 6)]
    if (newExports) {
      values[6] = newExports
    }
    return values[6]
  }
  throw new Error('Failed to initialize Node-API wasm module')
})()

exports.hello = function() { return addon.hello() }
