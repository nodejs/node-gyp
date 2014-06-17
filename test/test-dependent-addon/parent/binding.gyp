{
  'targets': [{
    'target_name' : 'parent',
    'type' : 'static_library',
    'sources' : [
      'parent.cc'
    ],
    'dependencies' : [
      'node_modules/child/binding.gyp:child-static'
    ],
    'include_dirs' :[
      'node_modules/child'
    ]
  }]
}
