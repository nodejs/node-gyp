import sys, codecs;

if (sys.stdout.encoding != "utf-8" and sys.platform == "win32"):
    if sys.version_info > (3, 7):
        sys.stdout.reconfigure(encoding='utf-8')
        print(sys.executable)
    else:
        sys.stdout = codecs.getwriter("utf8")(sys.stdout)
        print(sys.executable.decode("cp1251"))
else:
    print(sys.executable)