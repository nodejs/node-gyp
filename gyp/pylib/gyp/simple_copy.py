# Copyright 2014 Google Inc. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

"""A clone of the default copy.deepcopy that doesn't handle cyclic
structures or complex types except for dicts and lists. This is
because gyp copies so large structure that small copy overhead ends up
taking seconds in a project the size of Chromium."""

from gyp.compat import simple_types


class CopyError(Exception):
  pass

__all__ = ["Error", "deepcopy"]

def deepcopy(x):
  """Deep copy operation on gyp objects such as strings, ints, dicts
  and lists. More than twice as fast as copy.deepcopy but much less
  generic."""

  try:
    return _deepcopy_dispatch[type(x)](x)
  except KeyError:
    raise CopyError('Unsupported type %s for deepcopy. Use copy.deepcopy ' +
                'or expand simple_copy support.' % type(x))

_deepcopy_dispatch = d = {}

def _deepcopy_atomic(x):
  return x

for x in simple_types:
  d[x] = _deepcopy_atomic

def _deepcopy_list(x):
  return [deepcopy(a) for a in x]
d[list] = _deepcopy_list

def _deepcopy_dict(x):
  y = {}
  for key, value in x.items():
    y[deepcopy(key)] = deepcopy(value)
  return y
d[dict] = _deepcopy_dict

del d
