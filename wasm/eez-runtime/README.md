How to build?

```
source ~/emsdk/emsdk_env.sh
export EMSCRIPTEN=/home/mvladic/emsdk/upstream/emscripten

mkdir -p wasm/eez-runtime/build
cd wasm/eez-runtime/build
emcmake cmake ..
make -j8
```
