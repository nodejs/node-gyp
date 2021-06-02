`npm` bundles its own, internal, copy of `node-gyp`. This internal copy is independent of any globally installed copy of node-gyp that
you may have installed via `npm install -g node-gyp`.

This means that while `node-gyp` doesn't get installed into your `$PATH` by default, npm still keeps its own copy to invoke when you
attempt to `npm install` a native add-on.

Sometimes, you may need to update npm's internal node-gyp to a newer version than what is installed. A simple `npm install -g node-gyp`
_won't_ do the trick since npm will still continue to use its internal copy over the global one.

So instead:

## Version of npm

We need to start by knowing your version of `npm`:
```bash
npm --version
```

## Linux, Mac OS X, Solaris, etc.

Unix is easy. Just run the following command. Use `sudo` if necessary.

If your npm is version ___7___, do:
```bash
$ [sudo] npm explore npm/node_modules/@npmcli/run-script -g -- npm_config_global=false npm install node-gyp@latest
```

Else if your npm is version ___less than 7___, do:
```bash
$ [sudo] npm explore npm/node_modules/npm-lifecycle -g -- npm install node-gyp@latest
```

## Windows

Windows is a bit trickier, since `npm` might be installed to the "Program Files" directory, which needs admin privileges in order to
modify on current Windows. Therefore, run the following commands __inside a `cmd.exe` started with "Run as Administrator"__:

First we need to find the location of `node`. If you don't already know the location that `node.exe` got installed to, then run:
```bash
$ where node
```

Now `cd` to the directory that `node.exe` is contained in e.g.:
```bash
$ cd "C:\Program Files\nodejs"
```

If your npm version is ___7___, do:
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