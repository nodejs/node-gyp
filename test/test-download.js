'use strict'

const { describe, it, after } = require('mocha')
const assert = require('assert')
const fs = require('fs/promises')
const path = require('path')
const http = require('http')
const https = require('https')
const install = require('../lib/install')
const { download, readCAFile } = require('../lib/download')
const { FULL_TEST, devDir, platformTimeout } = require('./common')
const gyp = require('../lib/node-gyp')
const certs = require('./fixtures/certs')

describe('download', function () {
  it('download over http', async function () {
    const server = http.createServer((req, res) => {
      assert.strictEqual(req.headers['user-agent'], `node-gyp v42 (node ${process.version})`)
      res.end('ok')
    })

    after(() => new Promise((resolve) => server.close(resolve)))

    const host = 'localhost'
    await new Promise((resolve) => server.listen(0, host, resolve))
    const { port } = server.address()
    const gyp = {
      opts: {},
      version: '42'
    }
    const url = `http://${host}:${port}`
    const res = await download(gyp, url)
    assert.strictEqual(await res.text(), 'ok')
  })

  it('download over https with custom ca', async function () {
    const cafile = path.join(__dirname, 'fixtures/ca.crt')
    const cacontents = certs['ca.crt']
    const cert = certs['server.crt']
    const key = certs['server.key']
    await fs.writeFile(cafile, cacontents, 'utf8')
    const ca = await readCAFile(cafile)

    assert.strictEqual(ca.length, 1)

    const options = { ca, cert, key }
    const server = https.createServer(options, (req, res) => {
      assert.strictEqual(req.headers['user-agent'], `node-gyp v42 (node ${process.version})`)
      res.end('ok')
    })

    after(async () => {
      await new Promise((resolve) => server.close(resolve))
      await fs.unlink(cafile)
    })

    server.on('clientError', (err) => { throw err })

    const host = 'localhost'
    await new Promise((resolve) => server.listen(0, host, resolve))
    const { port } = server.address()
    const gyp = {
      opts: { cafile },
      version: '42'
    }
    const url = `https://${host}:${port}`
    const res = await download(gyp, url)
    assert.strictEqual(await res.text(), 'ok')
  })

  it('download over http with proxy', async function () {
    const server = http.createServer((_, res) => {
      res.end('ok')
    })

    const pserver = http.createServer((req, res) => {
      assert.strictEqual(req.headers['user-agent'], `node-gyp v42 (node ${process.version})`)
      res.end('proxy ok')
    })

    after(() => Promise.all([
      new Promise((resolve) => server.close(resolve)),
      new Promise((resolve) => pserver.close(resolve))
    ]))

    const host = 'localhost'
    await new Promise((resolve) => server.listen(0, host, resolve))
    const { port } = server.address()
    await new Promise((resolve) => pserver.listen(port + 1, host, resolve))
    const gyp = {
      opts: {
        proxy: `http://${host}:${port + 1}`,
        noproxy: 'bad'
      },
      version: '42'
    }
    const url = `http://${host}:${port}`
    const res = await download(gyp, url)
    assert.strictEqual(await res.text(), 'proxy ok')
  })

  it('download over http with noproxy', async function () {
    const server = http.createServer((req, res) => {
      assert.strictEqual(req.headers['user-agent'], `node-gyp v42 (node ${process.version})`)
      res.end('ok')
    })

    const pserver = http.createServer((_, res) => {
      res.end('proxy ok')
    })

    after(() => Promise.all([
      new Promise((resolve) => server.close(resolve)),
      new Promise((resolve) => pserver.close(resolve))
    ]))

    const host = 'localhost'
    await new Promise((resolve) => server.listen(0, host, resolve))
    const { port } = server.address()
    await new Promise((resolve) => pserver.listen(port + 1, host, resolve))
    const gyp = {
      opts: {
        proxy: `http://${host}:${port + 1}`,
        noproxy: host
      },
      version: '42'
    }
    const url = `http://${host}:${port}`
    const res = await download(gyp, url)
    assert.strictEqual(await res.text(), 'ok')
  })

  it('download with missing cafile', async function () {
    const gyp = {
      opts: { cafile: 'no.such.file' }
    }
    try {
      await download(gyp, {}, 'http://bad/')
    } catch (e) {
      assert.ok(/no.such.file/.test(e.message))
    }
  })

  it('check certificate splitting', async function () {
    const cafile = path.join(__dirname, 'fixtures/ca-bundle.crt')
    const cacontents = certs['ca-bundle.crt']
    await fs.writeFile(cafile, cacontents, 'utf8')
    after(async () => {
      await fs.unlink(cafile)
    })
    const cas = await readCAFile(path.join(__dirname, 'fixtures/ca-bundle.crt'))
    assert.strictEqual(cas.length, 2)
    assert.notStrictEqual(cas[0], cas[1])
  })

  // only run this test if we are running a version of Node with predictable version path behavior

  it('download headers (actual)', async function () {
    if (!FULL_TEST) {
      return this.skip('Skipping actual download of headers due to test environment configuration')
    }

    this.timeout(platformTimeout(1, { win32: 5 }))

    const expectedDir = path.join(await devDir(), process.version.replace(/^v/, ''))
    await fs.rm(expectedDir, { recursive: true, force: true })

    const prog = gyp()
    prog.parseArgv([])
    prog.devDir = await devDir()
    await install(prog, [])

    const data = await fs.readFile(path.join(expectedDir, 'installVersion'), 'utf8')
    assert.strictEqual(data, '11\n', 'correct installVersion')

    const list = await fs.readdir(path.join(expectedDir, 'include/node'))
    assert.ok(list.includes('common.gypi'))
    assert.ok(list.includes('config.gypi'))
    assert.ok(list.includes('node.h'))
    assert.ok(list.includes('node_version.h'))
    assert.ok(list.includes('openssl'))
    assert.ok(list.includes('uv'))
    assert.ok(list.includes('uv.h'))
    assert.ok(list.includes('v8-platform.h'))
    assert.ok(list.includes('v8.h'))
    assert.ok(list.includes('zlib.h'))

    const lines = (await fs.readFile(path.join(expectedDir, 'include/node/node_version.h'), 'utf8')).split('\n')

    // extract the 3 version parts from the defines to build a valid version string and
    // and check them against our current env version
    const version = ['major', 'minor', 'patch'].reduce((version, type) => {
      const re = new RegExp(`^#define\\sNODE_${type.toUpperCase()}_VERSION`)
      const line = lines.find((l) => re.test(l))
      const i = line ? parseInt(line.replace(/^[^0-9]+([0-9]+).*$/, '$1'), 10) : 'ERROR'
      return `${version}${type !== 'major' ? '.' : 'v'}${i}`
    }, '')

    assert.strictEqual(version, process.version)
  })
})
