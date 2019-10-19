# `node-gyp` - Node.js native addon build tool

`node-gyp` is a cross-platform command-line tool written in Node.js for
compiling native addon modules for Node.js. It contains a fork of the
[gyp](https://gyp.gsrc.io) project that was previously used by the Chromium
team and takes away the pain of dealing with the various differences in build
platforms.

Note that `node-gyp` is _not_ used to build Node.js itself.

Multiple target versions of Node.js are supported (i.e. `0.8`, ..., `4`, `5`, `6`,
etc.), regardless of what version of Node.js is actually installed on your system
(`node-gyp` downloads the necessary development files or headers for the target version).

## Features

 * Easy to use, consistent interface
 * Same commands to build your module on every platform
 * Supports multiple target versions of Node.js

## Installation

You can install with `npm`:

``` bash
$ npm install -g node-gyp
```

You will also need to install:

NOTE: node-gyp is compatible with Python v2.7, v3.5, v3.6, or v3.7. If the
Python to use is not explicitly configured (see "Configuring Python Dependency"
below) it will attempt to find a compatible Python executable.

### On Unix

   * `Python v2.7, v3.5, v3.6, or v3.7`
   * `make`
   * A proper C/C++ compiler toolchain, like [GCC](https://gcc.gnu.org)

### On macOS

   * `Python v2.7, v3.5, v3.6, or v3.7`
   * [Xcode](https://developer.apple.com/xcode/download/)
     * You also need to install the `XCode Command Line Tools` by running `xcode-select --install`. Alternatively, if you already have the full Xcode installed, you can find them under the menu `Xcode -> Open Developer Tool -> More Developer Tools...`. This step will install `clang`, `clang++`, and `make`.

### On Windows

Install the current version of Python from the [Microsoft Store package](https://docs.python.org/3/using/windows.html#the-microsoft-store-package).

#### Option 1

Install all the required tools and configurations using Microsoft's [windows-build-tools](https://github.com/felixrieseberg/windows-build-tools) using `npm install --global --production windows-build-tools` from an elevated PowerShell or CMD.exe (run as Administrator).

#### Option 2

Install tools and configuration manually:
   * Install Visual C++ Build Environment: [Visual Studio Build Tools](https://visualstudio.microsoft.com/thank-you-downloading-visual-studio/?sku=BuildTools)
   (using "Visual C++ build tools" workload) or [Visual Studio 2017 Community](https://visualstudio.microsoft.com/pl/thank-you-downloading-visual-studio/?sku=Community)
   (using the "Desktop development with C++" workload)
   * Launch cmd, `npm config set msvs_version 2017`

   If the above steps didn't work for you, please visit [Microsoft's Node.js Guidelines for Windows](https://github.com/Microsoft/nodejs-guidelines/blob/master/windows-environment.md#compiling-native-addon-modules) for additional tips.

   To target native ARM64 Node.js on Windows 10 on ARM, add the components "Visual C++ compilers and libraries for ARM64" and "Visual C++ ATL for ARM64".

### Configuring Python Dependency

If you have multiple Python versions installed, you can identify which Python
version `node-gyp` uses by setting the `--python` variable:

``` bash
$ node-gyp <command> --python /path/to/executable/python
```

If `node-gyp` is called by way of `npm`, *and* you have multiple versions of
Python installed, then you can set `npm`'s 'python' config key to the appropriate
value:

``` bash
$ npm config set python /path/to/executable/python
```

If the `PYTHON` environment variable is set to the path of a Python executable,
it will be used if it is a compatible Python.

If the `NODE_GYP_FORCE_PYTHON` environment variable is set to the path of a
Python executable, it will be used instead of any of the other configured or
builtin Python search paths. If its not a compatible Python, no further
searching will be done.

## How to Use

To compile your native addon, first go to its root directory:

``` bash
$ cd my_node_addon
```

The next step is to generate the appropriate project build files for the current
platform. Use `configure` for that:

``` bash
$ node-gyp configure
```

Auto-detection fails for Visual C++ Build Tools 2015, so `--msvs_version=2015`
needs to be added (not needed when run by npm as configured above):
``` bash
$ node-gyp configure --msvs_version=2015
```

__Note__: The `configure` step looks for a `binding.gyp` file in the current
directory to process. See below for instructions on creating a `binding.gyp` file.

Now you will have either a `Makefile` (on Unix platforms) or a `vcxproj` file
(on Windows) in the `build/` directory. Next, invoke the `build` command:

``` bash
$ node-gyp build
```

Now you have your compiled `.node` bindings file! The compiled bindings end up
in `build/Debug/` or `build/Release/`, depending on the build mode. At this point,
you can require the `.node` file with Node.js and run your tests!

__Note:__ To create a _Debug_ build of the bindings file, pass the `--debug` (or
`-d`) switch when running either the `configure`, `build` or `rebuild` commands.

## The `binding.gyp` file

A `binding.gyp` file describes the configuration to build your module, in a
JSON-like format. This file gets placed in the root of your package, alongside
`package.json`.

A barebones `gyp` file appropriate for building a Node.js addon could look like:

```python
{
  "targets": [
    {
      "target_name": "binding",
      "sources": [ "src/binding.cc" ]
    }
  ]
}
```

Some additional resources for addons and writing `gyp` files:

 * ["Going Native" a nodeschool.io tutorial](http://nodeschool.io/#goingnative)
 * ["Hello World" node addon example](https://github.com/nodejs/node/tree/master/test/addons/hello-world)
 * [gyp user documentation](https://gyp.gsrc.io/docs/UserDocumentation.md)
 * [gyp input format reference](https://gyp.gsrc.io/docs/InputFormatReference.md)
 * [*"binding.gyp" files out in the wild* wiki page](https://github.com/nodejs/node-gyp/wiki/%22binding.gyp%22-files-out-in-the-wild)


## Commands

`node-gyp` responds to the following commands:

| **Command**   | **Description**
|:--------------|:---------------------------------------------------------------
| `help`        | Shows the help dialog
| `build`       | Invokes `make`/`msbuild.exe` and builds the native addon
| `clean`       | Removes the `build` directory if it exists
| `configure`   | Generates project build files for the current platform
| `rebuild`     | Runs `clean`, `configure` and `build` all in a row
| `install`     | Installs Node.js header files for the given version
| `list`        | Lists the currently installed Node.js header versions
| `remove`      | Removes the Node.js header files for the given version


## Command Options

`node-gyp` accepts the following command options:

| **Command**                       | **Description**
|:----------------------------------|:------------------------------------------
| `-j n`, `--jobs n`                | Run `make` in parallel. The value `max` will use all available CPU cores
| `--target=v6.2.1`                 | Node.js version to build for (default is `process.version`)
| `--silly`, `--loglevel=silly`     | Log all progress to console
| `--verbose`, `--loglevel=verbose` | Log most progress to console
| `--silent`, `--loglevel=silent`   | Don't log anything to console
| `debug`, `--debug`                | Make Debug build (default is `Release`)
| `--release`, `--no-debug`         | Make Release build
| `-C $dir`, `--directory=$dir`     | Run command in different directory
| `--make=$make`                    | Override `make` command (e.g. `gmake`)
| `--thin=yes`                      | Enable thin static libraries
| `--arch=$arch`                    | Set target architecture (e.g. ia32)
| `--tarball=$path`                 | Get headers from a local tarball
| `--devdir=$path`                  | SDK download directory (default is OS cache directory)
| `--ensure`                        | Don't reinstall headers if already present
| `--dist-url=$url`                 | Download header tarball from custom URL
| `--proxy=$url`                    | Set HTTP proxy for downloading header tarball
| `--cafile=$cafile`                | Override default CA chain (to download tarball)
| `--nodedir=$path`                 | Set the path to the node source code
| `--python=$path`                  | Set path to the Python binary
| `--msvs_version=$version`         | Set Visual Studio version (Windows only)
| `--solution=$solution`            | Set Visual Studio Solution version (Windows only)

## Configuration

### Environment variables

Use the form `npm_config_OPTION_NAME` for any of the command options listed
above (dashes in option names should be replaced by underscores).

For example, to set `devdir` equal to `/tmp/.gyp`, you would:

Run this on Unix:

```bash
$ export npm_config_devdir=/tmp/.gyp
```

Or this on Windows:

```console
> set npm_config_devdir=c:\temp\.gyp
```

### `npm` configuration

Use the form `OPTION_NAME` for any of the command options listed above.

For example, to set `devdir` equal to `/tmp/.gyp`, you would run:

```bash
$ npm config set [--global] devdir /tmp/.gyp
```

**Note:** Configuration set via `npm` will only be used when `node-gyp`
is run via `npm`, not when `node-gyp` is run directly.

## License

Apache License
                           Version 2.0, January 2004
                        https://www.apache.org/licenses/

   TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION

   1. Definitions.

      "License" shall mean the terms and conditions for use, reproduction,
      and distribution as defined by Sections 1 through 9 of this document.

      "Licensor" shall mean the copyright owner or entity authorized by
      the copyright owner that is granting the License.

      "Legal Entity" shall mean the union of the acting entity and all
      other entities that control, are controlled by, or are under common
      control with that entity. For the purposes of this definition,
      "control" means (i) the power, direct or indirect, to cause the
      direction or management of such entity, whether by contract or
      otherwise, or (ii) ownership of fifty percent (50%) or more of the
      outstanding shares, or (iii) beneficial ownership of such entity.

      "You" (or "Your") shall mean an individual or Legal Entity
      exercising permissions granted by this License.

      "Source" form shall mean the preferred form for making modifications,
      including but not limited to software source code, documentation
      source, and configuration files.

      "Object" form shall mean any form resulting from mechanical
      transformation or translation of a Source form, including but
      not limited to compiled object code, generated documentation,
      and conversions to other media types.

      "Work" shall mean the work of authorship, whether in Source or
      Object form, made available under the License, as indicated by a
      copyright notice that is included in or attached to the work
      (an example is provided in the Appendix below).

      "Derivative Works" shall mean any work, whether in Source or Object
      form, that is based on (or derived from) the Work and for which the
      editorial revisions, annotations, elaborations, or other modifications
      represent, as a whole, an original work of authorship. For the purposes
      of this License, Derivative Works shall not include works that remain
      separable from, or merely link (or bind by name) to the interfaces of,
      the Work and Derivative Works thereof.

      "Contribution" shall mean any work of authorship, including
      the original version of the Work and any modifications or additions
      to that Work or Derivative Works thereof, that is intentionally
      submitted to Licensor for inclusion in the Work by the copyright owner
      or by an individual or Legal Entity authorized to submit on behalf of
      the copyright owner. For the purposes of this definition, "submitted"
      means any form of electronic, verbal, or written communication sent
      to the Licensor or its representatives, including but not limited to
      communication on electronic mailing lists, source code control systems,
      and issue tracking systems that are managed by, or on behalf of, the
      Licensor for the purpose of discussing and improving the Work, but
      excluding communication that is conspicuously marked or otherwise
      designated in writing by the copyright owner as "Not a Contribution."

      "Contributor" shall mean Licensor and any individual or Legal Entity
      on behalf of whom a Contribution has been received by Licensor and
      subsequently incorporated within the Work.

   2. Grant of Copyright License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      copyright license to reproduce, prepare Derivative Works of,
      publicly display, publicly perform, sublicense, and distribute the
      Work and such Derivative Works in Source or Object form.

   3. Grant of Patent License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      (except as stated in this section) patent license to make, have made,
      use, offer to sell, sell, import, and otherwise transfer the Work,
      where such license applies only to those patent claims licensable
      by such Contributor that are necessarily infringed by their
      Contribution(s) alone or by combination of their Contribution(s)
      with the Work to which such Contribution(s) was submitted. If You
      institute patent litigation against any entity (including a
      cross-claim or counterclaim in a lawsuit) alleging that the Work
      or a Contribution incorporated within the Work constitutes direct
      or contributory patent infringement, then any patent licenses
      granted to You under this License for that Work shall terminate
      as of the date such litigation is filed.

   4. Redistribution. You may reproduce and distribute copies of the
      Work or Derivative Works thereof in any medium, with or without
      modifications, and in Source or Object form, provided that You
      meet the following conditions:

      (a) You must give any other recipients of the Work or
          Derivative Works a copy of this License; and

      (b) You must cause any modified files to carry prominent notices
          stating that You changed the files; and

      (c) You must retain, in the Source form of any Derivative Works
          that You distribute, all copyright, patent, trademark, and
          attribution notices from the Source form of the Work,
          excluding those notices that do not pertain to any part of
          the Derivative Works; and

      (d) If the Work includes a "NOTICE" text file as part of its
          distribution, then any Derivative Works that You distribute must
          include a readable copy of the attribution notices contained
          within such NOTICE file, excluding those notices that do not
          pertain to any part of the Derivative Works, in at least one
          of the following places: within a NOTICE text file distributed
          as part of the Derivative Works; within the Source form or
          documentation, if provided along with the Derivative Works; or,
          within a display generated by the Derivative Works, if and
          wherever such third-party notices normally appear. The contents
          of the NOTICE file are for informational purposes only and
          do not modify the License. You may add Your own attribution
          notices within Derivative Works that You distribute, alongside
          or as an addendum to the NOTICE text from the Work, provided
          that such additional attribution notices cannot be construed
          as modifying the License.

      You may add Your own copyright statement to Your modifications and
      may provide additional or different license terms and conditions
      for use, reproduction, or distribution of Your modifications, or
      for any such Derivative Works as a whole, provided Your use,
      reproduction, and distribution of the Work otherwise complies with
      the conditions stated in this License.

   5. Submission of Contributions. Unless You explicitly state otherwise,
      any Contribution intentionally submitted for inclusion in the Work
      by You to the Licensor shall be under the terms and conditions of
      this License, without any additional terms or conditions.
      Notwithstanding the above, nothing herein shall supersede or modify
      the terms of any separate license agreement you may have executed
      with Licensor regarding such Contributions.

   6. Trademarks. This License does not grant permission to use the trade
      names, trademarks, service marks, or product names of the Licensor,
      except as required for reasonable and customary use in describing the
      origin of the Work and reproducing the content of the NOTICE file.

   7. Disclaimer of Warranty. Unless required by applicable law or
      agreed to in writing, Licensor provides the Work (and each
      Contributor provides its Contributions) on an "AS IS" BASIS,
      WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
      implied, including, without limitation, any warranties or conditions
      of TITLE, NON-INFRINGEMENT, MERCHANTABILITY, or FITNESS FOR A
      PARTICULAR PURPOSE. You are solely responsible for determining the
      appropriateness of using or redistributing the Work and assume any
      risks associated with Your exercise of permissions under this License.

   8. Limitation of Liability. In no event and under no legal theory,
      whether in tort (including negligence), contract, or otherwise,
      unless required by applicable law (such as deliberate and grossly
      negligent acts) or agreed to in writing, shall any Contributor be
      liable to You for damages, including any direct, indirect, special,
      incidental, or consequential damages of any character arising as a
      result of this License or out of the use or inability to use the
      Work (including but not limited to damages for loss of goodwill,
      work stoppage, computer failure or malfunction, or any and all
      other commercial damages or losses), even if such Contributor
      has been advised of the possibility of such damages.

   9. Accepting Warranty or Additional Liability. While redistributing
      the Work or Derivative Works thereof, You may choose to offer,
      and charge a fee for, acceptance of support, warranty, indemnity,
      or other liability obligations and/or rights consistent with this
      License. However, in accepting such obligations, You may act only
      on Your own behalf and on Your sole responsibility, not on behalf
      of any other Contributor, and only if You agree to indemnify,
      defend, and hold each Contributor harmless for any liability
      incurred by, or claims asserted against, such Contributor by reason
      of your accepting any such warranty or additional liability.

   END OF TERMS AND CONDITIONS

   APPENDIX: How to apply the Apache License to your work.

      To apply the Apache License to your work, attach the following
      boilerplate notice, with the fields enclosed by brackets "[]"
      replaced with your own identifying information. (Don't include
      the brackets!)  The text should be enclosed in the appropriate
      comment syntax for the file format. We also recommend that a
      file or class name and description of purpose be included on the
      same "printed page" as the copyright notice for easier
      identification within third-party archives.

   Copyright 2019 Rolando Gopez Lacuata.

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       https://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.

