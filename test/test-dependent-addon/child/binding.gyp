{
  'targets': [{
    'target_name' : 'child',
    'dependencies' : [
      'child-static'
    ]
  },
  {
    'target_name' : 'child-static',
    'type' : 'static_library',
    'sources' : [
      'child.cc'
    ]
  }]
}
