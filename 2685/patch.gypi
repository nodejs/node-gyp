{
  'target_defaults': {
    'conditions': [
      [ 'OS=="win"', {
        'libraries': [ '-l<(node_root_dir)/Debug/node.lib' ]
      }]
    ]
  }
}
