'use strict'

const { test } = require('tap')
const fs = require('fs')
const path = require('path')
const http = require('http')
const https = require('https')
const { test: { readCAFile } } = require('../lib/install')
const Request = require('../lib/request-shim')

test('request over http', t => {
  t.plan(1)

  const server = http.createServer((_, res) => {
    res.end('ok')
    server.close()
  })

  const host = 'localhost'
  server.listen(0, host, () => {
    const { port } = server.address()

    const req = new Request({
      uri: `http://${host}:${port}`
    })

    req.on('response', res => {
      let body = ''
      res.setEncoding('utf8')
      res.on('data', data => {
        body += data
      })
      res.on('end', () => {
        t.strictEqual(body, 'ok')
      })
    })
  })
})

test('request over https with custom ca', t => {
  t.plan(2)

  const cert = fs.readFileSync(path.join(__dirname, 'fixtures/server.crt'), 'utf8')
  const key = fs.readFileSync(path.join(__dirname, 'fixtures/server.key'), 'utf8')

  const cafile = path.join(__dirname, '/fixtures/ca.crt')
  const ca = readCAFile(cafile)
  t.strictEqual(ca.length, 1)

  const options = { ca: ca, cert: cert, key: key }
  const server = https.createServer(options, (_, res) => {
    res.end('ok')
    server.close()
  })

  server.on('clientError', err => {
    throw err
  })

  const host = 'localhost'
  server.listen(0, host, () => {
    const { port } = server.address()

    const req = new Request({
      uri: `https://${host}:${port}`,
      ca
    })

    req.on('response', res => {
      let body = ''
      res.on('data', data => {
        body += data
      })
      res.on('end', () => {
        t.strictEqual(body, 'ok')
      })
    })
  })
})

test('request over http with proxy', t => {
  t.plan(1)

  const server = http.createServer((_, res) => {
    res.end('ok')
    pserver.close(() => {
      this.close()
    })
  })

  const pserver = http.createServer((_, res) => {
    res.end('proxy ok')
    server.close(() => {
      pserver.close()
    })
  })

  const host = 'localhost'
  server.listen(0, host, () => {
    const { port } = server.address()
    pserver.listen(port + 1, host, () => {
      const req = new Request({
        uri: `http://${host}:${port}`,
        proxy: `http://${host}:${port + 1}`
      })

      req.on('response', res => {
        let body = ''
        res.on('data', data => {
          body += data
        })
        res.on('end', () => {
          t.strictEqual(body, 'proxy ok')
        })
      })
    })
  })
})

test('request over redirected http', t => {
  t.plan(2)

  const server = http.createServer((req, res) => {
    if (req.url === '/') {
      res.writeHead(301, { location: '/redirect' })
      res.end()
    } else {
      t.strictEqual(req.url, '/redirect')
      res.end('redirect ok')
      server.close()
    }
  })

  const host = 'localhost'
  server.listen(0, host, () => {
    const { port } = server.address()

    const req = new Request({
      uri: `http://${host}:${port}`
    })

    req.on('response', res => {
      let body = ''
      res.on('data', data => {
        body += data
      })
      res.on('end', () => {
        t.strictEqual(body, 'redirect ok')
      })
    })
  })
})
