`npm` bundles its own, internal, copy of `node-gyp`. This internal copy is independent of any globally installed copy of node-gyp that you may have installed via `npm install -g node-gyp`.

This means that while `node-gyp` doesn't get installed into your `$PATH` by default, npm still keeps its own copy to invoke when you attempt to `npm install` a native addon.

Sometimes, you may need to update npm's internal node-gyp to a newer version than what is installed. A simple `npm install -g node-gyp` _won't_ do the trick since npm will still continue to use its internal copy over the global one.

So instead:

## Linux, Mac OS X, Solaris, etc.

Unix is easy. Just run the following command. Use `sudo` if necessary.

``` bash
$ [sudo] npm explore npm -g -- npm install node-gyp@latest
```

## Windows

Windows is a bit tricker, since `npm` gets installed to the "Program Files" directory, which needs admin privileges in order to modify on current Windows. Therefore, run the following commands __inside a `cmd.exe` started with "Run as Administrator"__:

First we need to find the location of `node`. If you don't already know the location that `node.exe` got installed to, then run:

``` bash
$ npm install -g which
$ which node
```

As an alternative to the above, those on Windows Server 2003 and later (this includes Windows 7) can run:

``` bash
$ where node
```

Now `cd` to the directory that `node.exe` is contained in, and with `node_modules\npm` at the end. i.e.:

``` bash
$ cd "C:\Program Files\nodejs\node_modules\npm"
```

Now you can finally run:

``` bash
$ npm install -g node-gyp@latest
```

note: i found that the -g on windows 7 is not correct. It gets installed in C:\Users\<name>\AppData\Roaming\npm\node_modules\gyp which is not the directory where node is installed C:\Program Files (x86)\nodejs\node_modules\npm\node_modules\node-gyp\...