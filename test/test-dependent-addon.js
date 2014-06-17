var assert = require('assert');
var cp = require('child_process');
var rimraf = require('rimraf');
var path = require('path');

var parentDir = path.join(__dirname, 'test-dependent-addon', 'parent');
var childDir = path.join(__dirname, 'test-dependent-addon', 'child');

var cleanup = function(fn) {
  rimraf(path.join(parentDir, 'node_modules'), function() {
    rimraf(path.join(parentDir, 'build'), function() {
      rimraf(path.join(childDir, 'build'), fn);
    });
  });
};

cp.exec('npm install ../child', { cwd: parentDir }, function(err, out, stderr) {

  if (err) {
    return cleanup(function() {
      throw err;
    });
  }

  cp.exec('npm install', { cwd: parentDir, }, function(err, out2, stderr) {
    if (err) {
      return cleanup(function() {
        throw err;
      });
    }

    var child_compile_times = (out + out2).split('\n').filter(function(line) {
      return line.indexOf('CXX(target)') > -1;
    }).map(function(line) {
      return line.split('obj.target/').pop();
    }).reduce(function(val, line) {
      return (line === 'child-static/child.o') ? val + 1 : val;
    }, 0);

    assert.equal(child_compile_times, 1, 'should only compile once');
    cleanup();
  });
});
