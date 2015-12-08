'use strict'

var http = require('http')
var test = require('tape')
var install = require('../lib/install')

test('download over http', function (t) {
  t.plan(2)

  var server = http.createServer(function (req, res) {
    t.strictEqual(req.headers['user-agent'],
                  'node-gyp v42 (node ' + process.version + ')')
    res.end('ok')
    server.close()
  })

  var host = '127.0.0.1'
  server.listen(0, host, function () {
    var port = this.address().port
    var gyp = {
      opts: {},
      version: '42',
    }
    var url = 'http://' + host + ':' + port
    var req = install.test.download(gyp, {}, url)
    req.on('response', function (res) {
      var body = ''
      res.setEncoding('utf8')
      res.on('data', function(data) {
        body += data
      })
      res.on('end', function() {
        t.strictEqual(body, 'ok')
      })
    })
  })
})
