import sys

if sys.version_info[0] == 2:
    from cStringIO import StringIO
    string_types = (basestring,)  # noqa: F821
    simple_types = types = (type(None), int, long, float, bool,  # noqa: F821
                            str, unicode, type, basestring)      # noqa: F821
    unicode_type = unicode  # noqa: F821
    compat_cmp = cmp        # noqa: F821
else:
    from io import StringIO
    string_types = (str, )
    simple_types = types = (type(None), int, float, bool, str, type)
    unicode_type = str

    def compat_cmp(x, y):

        if x == y:
            return 0

        if x < y:
            return -1

        return 1
