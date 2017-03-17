## Python Issues OSX

Make sure you are using the native Python version in OSX.  If you use a MacPorts of HomeBrew version, you may run into problems.

If you have issues with `execvp`, be sure to check your `$PYTHON` environment variable.  If it is not set to the native version, unset it and try again.

Notes: https://gist.github.com/erichocean/5177582

## npm ERR! `node-gyp rebuild`(Windows)
* just install the build tools from [here](http://landinghub.visualstudio.com/visual-cpp-build-tools)
PLease note the version as is required in below command e.g **2015** or **2017**
* Launch cmd, run `npm config set msvs_version 2015`
* restart and all is well 👍 

