# Updating the npm-bundled version of node-gyp

**Note: These instructions are (only) tested and known to work with npm 8 and older.**

**Note: These instructions will be undone if you reinstall or upgrade npm or node! For a more permanent (and simpler) solution, see [Force-npm-to-use-global-node-gyp.md](Force-npm-to-use-global-node-gyp.md). (npm 6 or older only!)**

[Many issues](https://github.com/nodejs/node-gyp/issues?q=label%3A"ERR!+node-gyp+-v+<%3D+v9.x.x") are opened by users who are
not running a [current version of node-gyp](https://github.com/nodejs/node-gyp/releases).

`npm` bundles its own, internal, copy of `node-gyp`. This internal copy is independent of any globally installed copy of node-gyp that
may have been installed via `npm install -g node-gyp`.

This means that while `node-gyp` doesn't get installed into your `$PATH` by default, npm still keeps its own copy to invoke when you
attempt to `npm install` a native add-on.

Sometimes, you may need to update npm's internal node-gyp to a newer version than what is installed. A simple `npm install -g node-gyp`
_won't_ do the trick since npm will continue to use its internal copy over the global one.

So instead:

## Version of npm

We need to start by knowing your version of `npm`:
```bash
npm --version
```

## Linux, macOS, Solaris, etc.

Unix is easy. Just run the following command.

If your npm is version ___7 or higher___, do:
```bash
$ npm explore npm/node_modules/@npmcli/run-script -g -- npm_config_global=false npm install node-gyp@latest
```

Else if your npm is version ___less than 7___, do:
```bash
$ npm explore npm/node_modules/npm-lifecycle -g -- npm install node-gyp@latest
```

If the command fails with a permissions error, please try `sudo` and then the command.

If you are using `nvm` and the logs indicate no change of the `node-gyp` version, you might need to specify the `node` version, for example do:
```bash
$ cd /home/user/.nvm/versions/node/v18.13.0/node_modules/npm/node_modules/@npmcli/run-script
$ npm install node-gyp@latest
```


## Windows

Windows is a bit trickier, since `npm` might be installed in the "Program Files" directory, which needs admin privileges to modify current Windows. Therefore, run the following commands __inside a `cmd.exe` started with "Run as Administrator"__:

First, we need to find the location of `node`. If you don't already know the location that `node.exe` got installed to, then run:
```bash
$ where node
```

Now `cd` to the directory that `node.exe` is contained in e.g.:
```bash
$ cd "C:\Program Files\nodejs"
```

If your npm version is ___7 or higher___, do:
```bash
cd node_modules\npm\node_modules\@npmcli\run-script
```

Else if your npm version is ___less than 7___, do:
```bash
cd node_modules\npm\node_modules\npm-lifecycle
```

Finish by running:
```bash
$ npm install node-gyp@latest
```
