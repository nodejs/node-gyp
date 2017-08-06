var test = require('tape')
var requireInject = require('require-inject');
var install = requireInject('../lib/install', {
  'request': function(opts) {
    return {
      opts: opts,
      on: function () {}
    };
  }
})

test('add proxy property when proxy is specified', function (t) {
  t.plan(2)

  var url = 'http://www.xyz.com';
  var gyp = {
    opts: {
      proxy: 'http://www.test.com'
    }
  }

  var req = install.test.download(gyp, {}, url)

  t.equal(req.opts.proxy, gyp.opts.proxy)
  t.equal(req.opts.uri, url)

})

test('when no_proxy = * omit proxy property', function (t) {
  t.plan(2)

  var url = 'http://www.xyz.com';
  var gyp = {
    opts: {
      proxy: 'http://www.test.com',
      no_proxy: '*'
    }
  }

  var req = install.test.download(gyp, {}, url)

  t.equal(req.opts.proxy, undefined)
  t.equal(req.opts.uri, url)

})

test('when no_proxy matches url omit proxy property', function (t) {
  t.plan(2)

  var url = 'http://www.xyz.com';
  var gyp = {
    opts: {
      proxy: 'http://www.test.com',
      no_proxy: 'xyz.com'
    }
  }

  var req = install.test.download(gyp, {}, url)

  t.equal(req.opts.proxy, undefined)
  t.equal(req.opts.uri, url)

})
