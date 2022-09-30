How to build?

```
source ~/emsdk/emsdk_env.sh
export EMSCRIPTEN=/home/mvladic/emsdk/upstream/emscripten

mkdir -p packages/project-editor/flow/runtime/cpp/eez-runtime/build/emscripten
cd packages/project-editor/flow/runtime/cpp/eez-runtime/build/emscripten
cmake -DCMAKE_TOOLCHAIN_FILE=../../cmake/Emscripten.cmake -DCMAKE_BUILD_TYPE=Debug -G "Unix Makefiles" ../..
make
```
