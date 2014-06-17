#include <node.h>
#include <v8.h>

using namespace v8;

#include "child.h"

void init(Handle<Object> exports) {
  exports->Set(String::NewSymbol("hello"),
      FunctionTemplate::New(HelloWorld)->GetFunction());
}

NODE_MODULE(parent, init)
