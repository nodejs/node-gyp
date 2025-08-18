#include <nan.h>

NAN_METHOD(Method) {
  info.GetReturnValue().Set(Nan::New("world").ToLocalChecked());
}

NAN_MODULE_INIT(Init) {
  Nan::SetMethod(target, "hello", Method);
}

NODE_MODULE(hello, Init)
