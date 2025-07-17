{
  'variables': {
    # OS: 'emscripten' | 'wasi' | 'unknown' | 'wasm'
    'clang': 1,
    'target_arch%': 'wasm32',
    'stack_size%': 1048576,
    'initial_memory%': 16777216,
    'max_memory%': 2147483648,
  },

  'target_defaults': {
    'type': 'executable',

    'defines': [
      'BUILDING_NODE_EXTENSION',
      '__STDC_FORMAT_MACROS',
    ],

    'cflags': [
      '-Wall',
      '-Wextra',
      '-Wno-unused-parameter',
      '--target=wasm32-unknown-unknown',
    ],
    'cflags_cc': [
      '-fno-rtti',
      '-fno-exceptions',
      '-std=c++17'
    ],
    'ldflags': [
      '--target=wasm32-unknown-unknown',
    ],

    'xcode_settings': {
      # WARNING_CFLAGS == cflags
      # OTHER_CFLAGS == cflags_c
      # OTHER_CPLUSPLUSFLAGS == cflags_cc
      # OTHER_LDFLAGS == ldflags

      'CLANG_CXX_LANGUAGE_STANDARD': 'c++17',
      'GCC_ENABLE_CPP_RTTI': 'NO',
      'GCC_ENABLE_CPP_EXCEPTIONS': 'NO',
      'WARNING_CFLAGS': [
        '-Wall',
        '-Wextra',
        '-Wno-unused-parameter',
        '--target=wasm32-unknown-unknown'
      ],
      'OTHER_LDFLAGS': [ '--target=wasm32-unknown-unknown' ],
    },

    'default_configuration': 'Release',
    'configurations': {
      'Debug': {
        'defines': [ 'DEBUG', '_DEBUG' ],
        'cflags': [ '-g', '-O0' ],
        'ldflags': [ '-g', '-O0' ],
        'xcode_settings': {
          'WARNING_CFLAGS': [ '-g', '-O0' ],
          'OTHER_LDFLAGS': [ '-g', '-O0' ],
        },
      },
      'Release': {
        'cflags': [ '-O3' ],
        'ldflags': [ '-O3', '-Wl,--strip-debug' ],
        'xcode_settings': {
          'WARNING_CFLAGS': [ '-O3' ],
          'OTHER_LDFLAGS': [ '-O3', '-Wl,--strip-debug' ],
        },
      }
    },

    'target_conditions': [
      ['_type=="executable"', {

        'product_extension': 'wasm',

        'ldflags': [
          '-Wl,--export-dynamic',
          '-Wl,--export=napi_register_wasm_v1',
          '-Wl,--export-if-defined=node_api_module_get_api_version_v1',
          '-Wl,--import-undefined',
          '-Wl,--export-table',
          '-Wl,-zstack-size=<(stack_size)',
          '-Wl,--initial-memory=<(initial_memory)',
          '-Wl,--max-memory=<(max_memory)',
          '-nostdlib',
          '-Wl,--no-entry',
        ],
        'xcode_settings': {
          'OTHER_LDFLAGS': [
            '-Wl,--export-dynamic',
            '-Wl,--export=napi_register_wasm_v1',
            '-Wl,--export-if-defined=node_api_module_get_api_version_v1',
            '-Wl,--import-undefined',
            '-Wl,--export-table',
            '-Wl,-zstack-size=<(stack_size)',
            '-Wl,--initial-memory=<(initial_memory)',
            '-Wl,--max-memory=<(max_memory)',
            '-nostdlib',
            '-Wl,--no-entry',
          ],
        },
        'defines': [
          'PAGESIZE=65536'
        ],
      }],
    ],
  }
}
