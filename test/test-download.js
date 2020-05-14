'use strict'

const test = require('tap').test
const { promisify } = require('util')
const fs = require('fs').promises
const fsOLD = require('fs')
const path = require('path')
const http = require('http')
const https = require('https')
const semver = require('semver')
const rimraf = promisify(require('rimraf'))
const log = require('npmlog')
const bl = require('bl')

const install = require('../lib/install')
const devDir = require('./common').devDir()
const gyp = require('../lib/node-gyp')

log.level = 'warn'

test('download over http', (t) => {
  t.plan(3)

  const server = http.createServer((req, res) => {
    t.strictEqual(req.headers['user-agent'],
      `node-gyp v42 (node ${process.version})`)
    res.end('ok')
    server.close()
  })

  const host = 'localhost'
  server.listen(0, host, () => {
    const port = server.address().port
    const gyp = {
      opts: {},
      version: '42'
    }
    const url = `http://${host}:${port}`
    const req = install.test.download(gyp, {}, url)
    req.on('response', (res) => {
      res.pipe(bl((err, body) => {
        t.error(err)
        t.strictEqual(body.toString(), 'ok')
      }))
    })
  })
})

test('download over https with custom ca', (t) => {
  let cert, key

  t.test('setup', async (t) => {
    cert = await fs.readFile(path.join(__dirname, 'fixtures/server.crt'), 'utf8')
    key = await fs.readFile(path.join(__dirname, 'fixtures/server.key'), 'utf8')
  })

  return t.test('run', (t) => {
    t.plan(4)
    const cafile = path.join(__dirname, '/fixtures/ca.crt')
    const ca = install.test.readCAFile(cafile)
    t.strictEqual(ca.length, 1)

    const options = { ca, cert, key }
    const server = https.createServer(options, (req, res) => {
      t.strictEqual(req.headers['user-agent'],
        `node-gyp v42 (node ${process.version})`)
      res.end('ok')
      server.close()
    })

    server.on('clientError', (err) => {
      throw err
    })

    const host = 'localhost'
    server.listen(8000, host, () => {
      const port = server.address().port
      const gyp = {
        opts: { cafile: cafile },
        version: '42'
      }
      const url = `https://${host}:${port}`
      const req = install.test.download(gyp, {}, url)
      req.on('response', (res) => {
        res.pipe(bl((err, body) => {
          t.error(err)
          t.strictEqual(body.toString(), 'ok')
        }))
      })
    })
  })
})

test('download over http with proxy', (t) => {
  t.plan(3)

  const server = http.createServer((req, res) => {
    t.strictEqual(req.headers['user-agent'],
      `node-gyp v42 (node ${process.version})`)
    res.end('ok')
    pserver.close(() => server.close())
  })

  const pserver = http.createServer((req, res) => {
    t.strictEqual(req.headers['user-agent'],
      `node-gyp v42 (node ${process.version})`)
    res.end('proxy ok')
    server.close(() => pserver.close())
  })

  const host = 'localhost'
  server.listen(0, host, () => {
    const port = server.address().port
    pserver.listen(port + 1, host, () => {
      const gyp = {
        opts: {
          proxy: `http://${host}:${port + 1}`
        },
        version: '42'
      }
      const url = `http://${host}:${port}`
      const req = install.test.download(gyp, {}, url)
      req.on('response', (res) => {
        res.pipe(bl((err, body) => {
          t.error(err)
          t.strictEqual(body.toString(), 'proxy ok')
        }))
      })
    })
  })
})

test('download over http with noproxy', (t) => {
  t.plan(3)

  const server = http.createServer((req, res) => {
    t.strictEqual(req.headers['user-agent'],
      `node-gyp v42 (node ${process.version})`)
    res.end('ok')
    pserver.close(() => server.close())
  })

  const pserver = http.createServer((req, res) => {
    t.strictEqual(req.headers['user-agent'],
      `node-gyp v42 (node ${process.version})`)
    res.end('proxy ok')
    server.close(() => pserver.close())
  })

  const host = 'localhost'
  server.listen(0, host, () => {
    const port = server.address().port
    pserver.listen(port + 1, host, () => {
      const gyp = {
        opts: {
          proxy: `http://${host}:${(port + 1)}`,
          noproxy: 'localhost'
        },
        version: '42'
      }
      const url = `http://${host}:${port}`
      const req = install.test.download(gyp, {}, url)
      req.on('response', (res) => {
        res.pipe(bl((err, body) => {
          t.error(err)
          t.strictEqual(body.toString(), 'ok')
        }))
      })
    })
  })
})

test('download with missing cafile', (t) => {
  t.plan(1)
  const gyp = {
    opts: { cafile: 'no.such.file' }
  }

  t.throws(() => { install.test.download(gyp, {}, 'http://bad/') }, /no.such.file/)
})

test('check certificate splitting', (t) => {
  const cas = install.test.readCAFile(path.join(__dirname, 'fixtures/ca-bundle.crt'))
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

  t.plan(16)

  const expectedDir = path.join(devDir, process.version.replace(/^v/, ''))
  await rimraf(expectedDir)

  const prog = gyp()
  prog.parseArgv([])
  prog.devDir = devDir
  log.level = 'warn'

  return new Promise((resolve, reject) => { // TODO: removeme
    install(prog, [], (err) => {
      t.error(err)

      fsOLD.readFile(path.join(expectedDir, 'installVersion'), 'utf8', (err, data) => {
        t.error(err)
        t.strictEqual(data, '9\n', 'correct installVersion')
      })

      fsOLD.readdir(path.join(expectedDir, 'include/node'), (err, list) => {
        t.error(err)

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
      })

      fsOLD.readFile(path.join(expectedDir, 'include/node/node_version.h'), 'utf8', (err, contents) => {
        t.error(err)

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
        resolve()
      })
    })
  })
})
