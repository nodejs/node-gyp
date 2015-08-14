/*
 * When this file is linked to a DLL, it sets up a delay-load hook that
 * intervenes when the DLL is trying to load 'node.exe' or 'iojs.exe'
 * dynamically. Instead of trying to locate the .exe file it'll just return
 * a handle to the process image.
 *
 * This allows compiled addons to work when node.exe or iojs.exe is renamed.
 */

#ifdef _MSC_VER

#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <Shlwapi.h>
#include <delayimp.h>
#include <string.h>

static FARPROC WINAPI load_exe_hook(unsigned int event, DelayLoadInfo* info) {

  if (event != dliNotePreLoadLibrary)
    return NULL;

  if (_stricmp(info->szDll, "iojs.exe") != 0 &&
      _stricmp(info->szDll, "node.exe") != 0 &&
      _stricmp(info->szDll, "node.dll") != 0)
    return NULL;

  // Get a handle to the current process executable.
  HMODULE processModule = GetModuleHandle(NULL);

  // Get the path to the executable.
  TCHAR processPath[_MAX_PATH];
  GetModuleFileName(processModule, processPath, _MAX_PATH);

  // Get the name of the current executable.
  LPSTR processName = PathFindFileName(processPath);

  // If the current process is node or iojs, then just return the proccess module.
  if (_stricmp(processName, "node.exe") == 0 ||
      _stricmp(processName, "iojs.exe") == 0) {
    return (FARPROC)processModule;
  }

  // If it is another process, attempt to load 'node.dll' from the same directory.
  PathRemoveFileSpec(processPath);
  PathAppend(processPath, "node.dll");

  HMODULE nodeDllModule = GetModuleHandle(processPath);
  if(nodeDllModule != NULL) {
    // This application has a node.dll in the same directory as the executable, use that.
    return (FARPROC)nodeDllModule;
  }

  // Fallback to the current executable, which must statically link to node.lib.
  return (FARPROC)processModule;
}

PfnDliHook __pfnDliNotifyHook2 = load_exe_hook;

#endif
