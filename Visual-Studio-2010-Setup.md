On Windows XP/Vista/7, [node-gyp requires Python 2.3 and Visual Studio 2010](https://github.com/TooTallNate/node-gyp#installation)

According to the readme file in [Microsoft Visual C++ 2010 Service Pack 1 Compiler Update for the Windows SDK 7.1](http://www.microsoft.com/en-us/download/details.aspx?id=4422), _to ensure that your system has a supported configuration, uninstall the following products and then reinstall them in the order listed_:

1. [Visual Studio 2010](http://www.microsoft.com/visualstudio/eng/downloads#d-2010-express)
1. [Windows SDK 7.1](http://www.microsoft.com/en-us/download/details.aspx?id=8279) Note: If you get error on installation, maybe [this link ](http://stackoverflow.com/questions/1901279/windows-7-sdk-installation-failure) will help you.
1. [Visual Studio 2010 SP1](http://www.microsoft.com/en-us/download/details.aspx?id=23691)
1. [Visual C++ 2010 SP1 Compiler Update for the Windows SDK 7.1](http://www.microsoft.com/en-us/download/details.aspx?id=4422)

On x64 environments, the last update in the list fixes errors about missing compilers and `error MSB4019: The imported project "C:\Microsoft.Cpp.Default.props" was not found.`