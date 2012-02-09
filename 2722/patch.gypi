{
  'target_defaults': {
    'conditions': [
      [ 'OS=="freebsd" or OS=="openbsd" or OS=="solaris" or (OS=="linux" and target_arch!="ia32")', {
        'cflags': [ '-fPIC' ]
      }]
    ]
  }
}
