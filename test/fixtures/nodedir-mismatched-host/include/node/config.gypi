# Test fixture: mimics the official Node release headers tarball, whose
# embedded config.gypi is produced on a Linux x64 / GCC build farm and ships
# unchanged to all platforms. The host-specific fields here MUST be
# overridden by process.config when running on a different host.
{
  'variables': {
    'host_arch': 'x64',
    'clang': 0,
    'llvm_version': '0.0',
    'gas_version': '2.38',
    'shlib_suffix': 'so.137',
    'build_with_electron': true
  }
}
