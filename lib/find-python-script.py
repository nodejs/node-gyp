import sys;

if (sys.stdout.encoding != "utf-8" and sys.platform == "win32"):
    sys.stdout.reconfigure(encoding='utf-8')
    print(sys.executable)
else:
    print(sys.executable)