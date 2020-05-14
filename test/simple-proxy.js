'use strict'

const http = require('http')
const https = require('https')

const port = parseInt(process.argv[2], 10)
const prefix = process.argv[3]
const upstream = process.argv[4]
let calls = 0

const server = http.createServer((req, res) => {
  if (req.url.indexOf(prefix) !== 0) {
    throw new Error(`request url [${req.url}] does not start with [${prefix}]`)
  }

  const upstreamUrl = `${upstream}${req.url.substring(prefix.length)}`
  https.get(upstreamUrl, (ures) => {
    ures.on('end', () => {
      if (++calls === 2) {
        server.close()
      }
    })
    ures.pipe(res)
  })
}).listen(port)
