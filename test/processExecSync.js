var fs = require('graceful-fs')
var child_process = require('child_process')
var exec = child_process.exec

function processExecSync(file, args, options) {
  var child, error, timeout, tmpdir, command, quote;
  command = makeCommand(file, args);

  /*
    this function emulates child_process.execSync for legacy node <= 0.10.x
    derived from https://github.com/gvarsanyi/sync-exec/blob/master/js/sync-exec.js
  */
  
  options = options || {};
  // init timeout
  timeout = Date.now() + options.timeout;
  // init tmpdir
  var os_temp_base = "/tmp";
  if(process.env.TMP){
    os_temp_base = process.env.TMP;
  }
  if(os_temp_base[os_temp_base.length - 1] !== "/"){
    os_temp_base += "/";
  }
  tmpdir = os_temp_base+'processExecSync.' + Date.now() + Math.random();
  fs.mkdirSync(tmpdir);
  // init command
  command = '(' + command + ' > ' + tmpdir + '/stdout 2> ' + tmpdir +
      '/stderr); echo $? > ' + tmpdir + '/status';
  // init child
  child = exec(command, options, function () {
      return;
  });
  while (true) {
    try {
      fs.readFileSync(tmpdir + '/status');
      break;
    } catch (ignore) {
    }
    if (Date.now() > timeout) {
      error = child;
      break;
    }
  }
  ['stdout', 'stderr', 'status'].forEach(function (file) {
    child[file] = fs.readFileSync(tmpdir + '/' + file, options.encoding);
    fs.unlinkSync(tmpdir + '/' + file);
  });
  // child.status = Number(child.status);
  // if (child.status !== 0) {
  //     error = child;
  // }
  try {
      fs.rmdirSync(tmpdir);
  } catch (ignore) {
  }
  if (error) {
      throw error;
  }
  return child.stdout;
}

module.exports = processExecSync;

function makeCommand(file, args){
  var command, quote;
  command = file
  if(args.length > 0){
    for(var i in args){
      command = command + " ";
      if(args[i][0] === "-"){
        command = command + args[i];
      }else{
        if(!quote){
          command = command + "\"";
          quote = true;  
        }
        command = command + args[i];
        if(quote){
          if(args.length === (parseInt(i) + 1)){
            command = command + "\"";
          }
        }
      }
    }
  }
  return command;
}