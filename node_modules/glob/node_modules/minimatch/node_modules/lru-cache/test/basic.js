var test = require('tap').test
  , LRU = require('../')

test('basic', function (t) {
  var cache = new LRU(10)
  cache.set("key", "value")
  t.equal(cache.get("key"), "value")
  t.equal(cache.get("nada"), undefined)
  t.equal(cache.length, 1)
  t.equal(cache.maxLength, 10)
  t.end()
})

test('least recently set', function (t) {
  var cache = new LRU(2)
  cache.set("a", "A")
  cache.set("b", "B")
  cache.set("c", "C")
  t.equal(cache.get("c"), "C")
  t.equal(cache.get("b"), "B")
  t.equal(cache.get("a"), undefined)
  t.end()
})

test('lru recently gotten', function (t) {
  var cache = new LRU(2)
  cache.set("a", "A")
  cache.set("b", "B")
  cache.get("a")
  cache.set("c", "C")
  t.equal(cache.get("c"), "C")
  t.equal(cache.get("b"), undefined)
  t.equal(cache.get("a"), "A")
  t.end()
})

test('del', function (t) {
  var cache = new LRU(2)
  cache.set("a", "A")
  cache.del("a")
  t.equal(cache.get("a"), undefined)
  t.end()
})

test('maxLength', function (t) {
  var cache = new LRU(3)

  // test changing the maxLength, verify that the LRU items get dropped.
  cache.maxLength = 100
  for (var i = 0; i < 100; i ++) cache.set(i, i)
  t.equal(cache.length, 100)
  for (var i = 0; i < 100; i ++) {
    t.equal(cache.get(i), i)
  }
  cache.maxLength = 3
  t.equal(cache.length, 3)
  for (var i = 0; i < 97; i ++) {
    t.equal(cache.get(i), undefined)
  }
  for (var i = 98; i < 100; i ++) {
    t.equal(cache.get(i), i)
  }
  
  // now remove the maxLength restriction, and try again.
  cache.maxLength = "hello"
  for (var i = 0; i < 100; i ++) cache.set(i, i)
  t.equal(cache.length, 100)
  for (var i = 0; i < 100; i ++) {
    t.equal(cache.get(i), i)
  }
  // should trigger an immediate resize
  cache.maxLength = 3
  t.equal(cache.length, 3)
  for (var i = 0; i < 97; i ++) {
    t.equal(cache.get(i), undefined)
  }
  for (var i = 98; i < 100; i ++) {
    t.equal(cache.get(i), i)
  }
  t.end()
})

test('reset', function (t) {
  var cache = new LRU(10)
  cache.set("a", "A")
  cache.set("b", "B")
  cache.reset()
  t.equal(cache.length, 0)
  t.equal(cache.maxLength, 10)
  t.equal(cache.get("a"), undefined)
  t.equal(cache.get("b"), undefined)
  t.end()
})
