## Versions of `node-gyp` that are earlier than v11.x.x

Please look thru your error log for the string `gyp info using node-gyp@` and if that version number is less than the [current release of node-gyp](https://github.com/nodejs/node-gyp/releases) then __please upgrade__ using [these instructions](https://github.com/nodejs/node-gyp/blob/main/docs/Updating-npm-bundled-node-gyp.md) and then try your command again.

## `node-sass` is deprecated

Please be aware that the package [`node-sass` is deprecated](https://github.com/sass/node-sass#node-sass) so you should actively seek alternatives.  You can try:
```
npm uninstall node-sass
npm install sass --save
# or ...
npm install --global node-sass@latest
```
`node-sass` projects _may_ work by downgrading to Node.js v14 but [that release is end-of-life](https://github.com/nodejs/release#release-schedule).

In any case, please avoid opening new `node-sass` issues on this repo because we [cannot help much](https://github.com/nodejs/node-gyp/issues?q=is%3Aissue+label%3A%22Node+Sass+--%3E+Dart+Sass%22).

## `ffi-napi` is no longer maintained

* node-ffi-napi/node-ffi-napi#269

There are a couple of workarounds (https://koffi.dev or `node-ffi-rs`) on that issue but using `ffi-napi` or its forks has proven problematic on modern versions of operating systems, Node.js, node-gyp, and Python.

In any case, please avoid opening new `ffi-napi` issues on this repo because we [cannot help much](https://github.com/nodejs/node-gyp/issues?q=label%3Affi-napi).
