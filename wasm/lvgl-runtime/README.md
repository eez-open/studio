How to build?

```
source ~/emsdk/emsdk_env.sh
export EMSCRIPTEN=/home/mvladic/emsdk/upstream/emscripten

mkdir -p packages/project-editor/flow/runtime/cpp/lvgl-runtime/v8.3/build
cd packages/project-editor/flow/runtime/cpp/lvgl-runtime/v8.3/build
emcmake cmake ..
emmake make -j4

mkdir -p packages/project-editor/flow/runtime/cpp/lvgl-runtime/v9.0/build
cd packages/project-editor/flow/runtime/cpp/lvgl-runtime/v9.0/build
emcmake cmake ..
emmake make -j4
```
