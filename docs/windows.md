# Using node-gyp on Windows

There are many things that can cause build errors on Windows. Sometimes `node-gyp` can be quite difficult to get to work properly when one is not familiar MSBuild or low-level compilation and linking processes.

Below are some common tips to help you get your `node_modules` building properly.

## _Environment Variables_
------------

### **GYP_MSVS_VERSION**

When in doubt, set the `GYP_MSVS_VERSION` environment variable to equal the version of Visual Studio you are currently using to facilitate builds. You can set the environment variable for your current command prompt session like so:

```
# For VS 2013
set GYP_MSVS_VERSION=2013

# Or for VS 2015
set GYP_MSVS_VERSION=2015
```

### **VCTargetsPath**

Sometimes you will get an error saying that `node-gyp` can't find `Microsoft.Cpp.Default.props` for a version like `v120` or `v140`. This can be fixed by setting the environment variable `VCTargetsPath`. You can set the environment variable for your current command prompt session like so:

```
set VCTargetsPath=C:\Program Files (x86)\MSBuild\Microsoft.Cpp\v4.0\V120\Microsoft.Cpp.Default.props
```

## _Config Values_
------------

### **msvs_version**

If `GYP_MSVS_VERSION` doesn't solve your problem, you can try one of the following (depending on if you use `yarn` or `npm`):

```
# if you are using npm
npm config set msvs_version 2013

# if you are using yarn
yarn config set msvs_version 2013
```

You can also follow those commands with the `--global` flag to make the config changes global.

### **msbuild_path**

Sometimes you may want to use tools from one version of Visual Studio, but `node-gyp` keeps trying to build with a different or more current version. You can set the config value `msbuild_path` to point directly to the version of the `MSBuild.exe` that you want to use with your build. You can try one of the following (depending on if you use `yarn` or `npm`):

```
# if you are using npm
npm config set msbuild_path "C:\Program Files (x86)\MSBuild\12.0\Bin\MSBuild.exe"

# if you are using yarn
yarn config set msbuild_path "C:\Program Files (x86)\MSBuild\12.0\Bin\MSBuild.exe"
```

You can also follow those commands with the `--global` flag to make the config changes global.