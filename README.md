node-gyp
=========
### Node.js native addon build tool

`node-gyp` is a cross-platform command-line tool written in Node.js for compiling
native addon modules for Node.js, which takes away the pain of dealing with the
various differences in build platforms.

Multiple target versions of node are supported (i.e. `0.7`, `0.8`, `1.0`, etc.),
even if those versions of node are not installed on your system (`node-gyp`
downloads the necessary development files for the target version).

#### Features:

 * Easy to use, consistent interface
 * Same commands to build your module on every platform
 * Supports multiple target versions of Node


How to Use
----------

The first step is to install. With `npm`, invoke:

``` bash
$ npm install -g node-gyp
```

To compile your native addon, first go to its root directory:

``` bash
$ cd my_node_addon
```

From here, you can invoke the `node-gyp` executable. The next step is to generate
the appropriate project build files for the current platform. Use `configure` for
that:

``` bash
$ node-gyp configure --target=0.7
```

After that command you will have either a `Makefile` (on Unix platforms) or a
`vcxproj` file (on Windows) in the current directory. Next invoke the `build`
step:

``` bash
$ node-gyp build
```

Now you have your compiled `.node` bindings file! The compiled bindings end up in
`out/Debug` or `out/Release`, depending on the build mode. At this point you can
require the `.node` file with Node and run your tests!

-------------------

__(Optional)__ Copy the compiled bindings into an appropriate directory for
runtime loading detection (with [node-bindings][]), using the `copy` command:

``` bash
$ node-gyp copy
```

So for example, if you are on a 64-bit OS X machine and your target node version
is `0.7`, then the `copy` command above would move the bindings from
`out/Release/bindings.gyp` to `compiled/0.7/darwin/x64/bindings.node`.


Commands
--------

`node-gyp` responds to the following commands:

 * `configure` - Generates project build files for the current platform
 * `build` - Invokes `make`/`msbuild.exe` and builds the native addon
 * `copy` - Copies a compiled bindings to an appropriate dir for runtime detection
 * `install` - Installs node developmenet files for the given version


License
-------

(The MIT License)

Copyright (c) 2012 Nathan Rajlich &lt;nathan@tootallnate.net&gt;

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.


[node-bindings]: https://github.com/TooTallNate/node-bindings
