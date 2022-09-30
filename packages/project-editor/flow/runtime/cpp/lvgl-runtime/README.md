How to build?

```
source ~/emsdk/emsdk_env.sh
export EMSCRIPTEN=/home/mvladic/emsdk/upstream/emscripten

mkdir -p packages/project-editor/flow/runtime/cpp/lvgl-runtime/build
cd packages/project-editor/flow/runtime/cpp/lvgl-runtime/build
emcmake cmake ..
emmake make -j4
```
