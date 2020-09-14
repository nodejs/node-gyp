'use strict'

const { test } = require('tap')
const fs = require('fs')
const path = require('path')
const util = require('util')
const http = require('http')
const https = require('https')
const install = require('../lib/install')
const semver = require('semver')
const devDir = require('./common').devDir()
const rimraf = require('rimraf')
const gyp = require('../lib/node-gyp')
const log = require('npmlog')

log.level = 'warn'

test('download over http', (t) => {
  t.plan(2)

  const server = http.createServer((req, res) => {
    t.strictEqual(req.headers['user-agent'], `node-gyp v42 (node ${process.version})`)
    res.end('ok')
    server.close()
  })

  const host = 'localhost'
  return new Promise(resolve => server.listen(0, host, async () => {
    const { port } = server.address()
    const gyp = {
      opts: {},
      version: '42'
    }
    const url = `http://${host}:${port}`
    const res = await install.test.download(gyp, url)
    t.strictEqual(await res.text(), 'ok')
    resolve()
  }))
})

test('download over https with custom ca', async (t) => {
  t.plan(3)

  const [cert, key] = await Promise.all([
    fs.promises.readFile(path.join(__dirname, 'fixtures/server.crt'), 'utf8'),
    fs.promises.readFile(path.join(__dirname, 'fixtures/server.key'), 'utf8')
  ])

  const cafile = path.join(__dirname, '/fixtures/ca.crt')
  const ca = await install.test.readCAFile(cafile)
  t.strictEqual(ca.length, 1)

  const options = { ca: ca, cert: cert, key: key }
  const server = https.createServer(options, (req, res) => {
    t.strictEqual(req.headers['user-agent'], `node-gyp v42 (node ${process.version})`)
    res.end('ok')
    server.close()
  })

  server.on('clientError', (err) => { throw err })

  const host = 'localhost'
  return new Promise(resolve => server.listen(0, host, async () => {
    const { port } = server.address()
    const gyp = {
      opts: { cafile },
      version: '42'
    }
    const url = `https://${host}:${port}`
    const res = await install.test.download(gyp, url)
    t.strictEqual(await res.text(), 'ok')
    resolve()
  }))
})

test('download over http with proxy', (t) => {
  t.plan(2)

  const server = http.createServer((_, res) => {
    res.end('ok')
    pserver.close(() => { server.close() })
  })

  const pserver = http.createServer((req, res) => {
    t.strictEqual(req.headers['user-agent'], `node-gyp v42 (node ${process.version})`)
    res.end('proxy ok')
    server.close(() => { pserver.close() })
  })

  const host = 'localhost'
  return new Promise(resolve => server.listen(0, host, () => {
    const { port } = server.address()
    pserver.listen(port + 1, host, async () => {
      const gyp = {
        opts: {
          proxy: `http://${host}:${port + 1}`,
          noproxy: 'bad'
        },
        version: '42'
      }
      const url = `http://${host}:${port}`
      const res = await install.test.download(gyp, url)
      t.strictEqual(await res.text(), 'proxy ok')
      resolve()
    })
  }))
})

test('download over http with noproxy', (t) => {
  t.plan(2)

  const server = http.createServer((req, res) => {
    t.strictEqual(req.headers['user-agent'], `node-gyp v42 (node ${process.version})`)
    res.end('ok')
    pserver.close(() => { server.close() })
  })

  const pserver = http.createServer((_, res) => {
    res.end('proxy ok')
    server.close(() => { pserver.close() })
  })

  const host = 'localhost'
  return new Promise(resolve => server.listen(0, host, () => {
    const { port } = server.address()
    pserver.listen(port + 1, host, async () => {
      const gyp = {
        opts: {
          proxy: `http://${host}:${port + 1}`,
          noproxy: host
        },
        version: '42'
      }
      const url = `http://${host}:${port}`
      const res = await install.test.download(gyp, url)
      t.strictEqual(await res.text(), 'ok')
      resolve()
    })
  }))
})

test('download with missing cafile', async (t) => {
  t.plan(1)
  const gyp = {
    opts: { cafile: 'no.such.file' }
  }
  try {
    await install.test.download(gyp, {}, 'http://bad/')
  } catch (e) {
    t.ok(/no.such.file/.test(e.message))
  }
})

test('check certificate splitting', async (t) => {
  const cas = await install.test.readCAFile(path.join(__dirname, 'fixtures/ca-bundle.crt'))
  t.plan(2)
  t.strictEqual(cas.length, 2)
  t.notStrictEqual(cas[0], cas[1])
})

// only run this test if we are running a version of Node with predictable version path behavior

test('download headers (actual)', async (t) => {
  if (process.env.FAST_TEST ||
      process.release.name !== 'node' ||
      semver.prerelease(process.version) !== null ||
      semver.satisfies(process.version, '<10')) {
    return t.skip('Skipping actual download of headers due to test environment configuration')
  }

  t.plan(12)

  const expectedDir = path.join(devDir, process.version.replace(/^v/, ''))
  await util.promisify(rimraf)(expectedDir)

  const prog = gyp()
  prog.parseArgv([])
  prog.devDir = devDir
  log.level = 'warn'
  await util.promisify(install)(prog, [])

  const [data, list, contents] = await Promise.all([
    fs.promises.readFile(path.join(expectedDir, 'installVersion'), 'utf8'),
    fs.promises.readdir(path.join(expectedDir, 'include/node')),
    fs.promises.readFile(path.join(expectedDir, 'include/node/node_version.h'), 'utf8')
  ])

  t.strictEqual(data, '9\n', 'correct installVersion')

  t.ok(list.includes('common.gypi'))
  t.ok(list.includes('config.gypi'))
  t.ok(list.includes('node.h'))
  t.ok(list.includes('node_version.h'))
  t.ok(list.includes('openssl'))
  t.ok(list.includes('uv'))
  t.ok(list.includes('uv.h'))
  t.ok(list.includes('v8-platform.h'))
  t.ok(list.includes('v8.h'))
  t.ok(list.includes('zlib.h'))

  const lines = contents.split('\n')

  // extract the 3 version parts from the defines to build a valid version string and
  // and check them against our current env version
  const version = ['major', 'minor', 'patch'].reduce((version, type) => {
    const re = new RegExp(`^#define\\sNODE_${type.toUpperCase()}_VERSION`)
    const line = lines.find((l) => re.test(l))
    const i = line ? parseInt(line.replace(/^[^0-9]+([0-9]+).*$/, '$1'), 10) : 'ERROR'
    return `${version}${type !== 'major' ? '.' : 'v'}${i}`
  }, '')

  t.strictEqual(version, process.version)
})
