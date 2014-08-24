On Windows XP/Vista/7, [node-gyp requires Python 2.7 and Visual Studio 2010](https://github.com/TooTallNate/node-gyp#installation)

According to the readme file in [Microsoft Visual C++ 2010 Service Pack 1 Compiler Update for the Windows SDK 7.1](http://www.microsoft.com/en-us/download/details.aspx?id=4422), _to ensure that your system has a supported configuration, uninstall the following products and then reinstall them in the order listed_:

1. [Visual C++ 2010 Express](http://www.microsoft.com/visualstudio/eng/downloads#d-2010-express) or Visual Studio 2010
1. [Windows SDK 7.1](http://www.microsoft.com/en-us/download/details.aspx?id=8279) Note: If you get error on installation, maybe [this link ](http://stackoverflow.com/questions/1901279/windows-7-sdk-installation-failure) will help you.
1. [Visual Studio 2010 SP1](http://www.microsoft.com/en-us/download/details.aspx?id=23691)
1. [Visual C++ 2010 SP1 Compiler Update for the Windows SDK 7.1](http://www.microsoft.com/en-us/download/details.aspx?id=4422)

On x64 environments, the last update in the list fixes errors about missing compilers and `error MSB4019: The imported project "C:\Microsoft.Cpp.Default.props" was not found.`


#### `LNK1181` file `kernel32.lib` not found
Easy Solution: try compiling using the `Windows SDK 7.1 Command Prompt` start menu shortcut.

Proper Solution: To properly fix the situation, you'll need to globally set some environment variables.  
To get their proper values, launch the `Windows SDK 7.1 Command Prompt`, then within the prompt get the value of the following variables: `PATH` (it adds some things to PATH, you can put these anywhere in the PATH list), `LIBPATH`, `LIB`, `PlatformToolset`, `WindowsSDKDir`, `sdkdir`, `TARGET_PLATFORM`, and `VS120COMNTOOLS`.  
Take their values, and put them in either your User or System variables. You can easily get to this menu by doing `Win+Pause/Break`, `Advanced System Settings`, and then `Environment Variables`.