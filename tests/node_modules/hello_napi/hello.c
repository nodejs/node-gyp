#include <stddef.h>

#if !defined(__wasm__) || (defined(__EMSCRIPTEN__) || defined(__wasi__))
#include <assert.h>
#include <node_api.h>
#else
#define assert(x) do { if (!(x)) { __builtin_trap(); } } while (0)


__attribute__((__import_module__("napi")))
int napi_create_string_utf8(void* env,
                            const char* str,
                            size_t length,
                            void** result);

__attribute__((__import_module__("napi")))
int napi_create_function(void* env,
                        const char* utf8name,
                        size_t length,
                        void* cb,
                        void* data,
                        void** result);

__attribute__((__import_module__("napi")))
int napi_set_named_property(void* env,
                            void* object,
                            const char* utf8name,
                            void* value);
#ifdef __cplusplus
#define EXTERN_C extern "C" {
#else
#define EXTERN_C
#endif
#define NAPI_MODULE_INIT() \
  EXTERN_C __attribute__((visibility("default"))) void* napi_register_wasm_v1(void* env, void* exports)

typedef void* napi_env;
typedef void* napi_value;
typedef void* napi_callback_info;
#endif

static napi_value hello(napi_env env, napi_callback_info info) {
  napi_value greeting = NULL;
  assert(0 == napi_create_string_utf8(env, "world", -1, &greeting));
  return greeting;
}

NAPI_MODULE_INIT() {
  napi_value hello_function = NULL;
  assert(0 == napi_create_function(env, "hello", -1,
                                         hello, NULL, &hello_function));
  assert(0 == napi_set_named_property(env, exports, "hello", hello_function));
  return exports;
}
