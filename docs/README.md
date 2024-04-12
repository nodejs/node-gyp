## Versions of `node-gyp` that are earlier than v10.x.x

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

In any case, please avoid opening new `node-sass` issues on this repo because we [cannot help much](https://github.com/nodejs/node-gyp/issues?q=is%3Aissue+label%3A%22Node+Sass+--%3E+Dart+Sass%22+).

## `node-pre-gyp` is no longer maintained

* mapbox/node-pre-gyp#657

Support in the `abi_crosswalk.json` file ends at Node.js v17 but [that release is end-of-life](https://github.com/nodejs/release#release-schedule).

In any case, please avoid opening new `node-pre-gyp` issues on this repo because we [cannot help much](https://github.com/nodejs/node-gyp/issues?q=is%3Aissue+label%3A%22node-pre-gyp+is+unmaintained%22).

Unsupported __WORKAROUND__ for versions of Node.js > v17
```
npm ci  # mapbox/node-pre-gyp
npm run update-crosswalk
# npm audit  # Currently fails on a `Severity: critical` issue
```
