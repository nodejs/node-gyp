{
  'target_defaults': {
    'conditions': [
      [ 'OS=="win"', {
        'libraries': [ '-l<(node_root_dir)/$(Configuration)/node.lib' ]
      }]
    ]
  }
}
