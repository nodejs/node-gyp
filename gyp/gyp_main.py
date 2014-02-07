#!/usr/bin/env python

# Copyright (c) 2009 Google Inc. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

import sys

# TODO(mark): sys.path manipulation is some temporary testing stuff.
try:
  import os.path
  sys.path = [ os.path.join(os.path.dirname(sys.argv[0]), 'pylib') ] + sys.path
  import gyp
except ImportError, e:
  import gyp

if __name__ == '__main__':
  sys.exit(gyp.script_main())
