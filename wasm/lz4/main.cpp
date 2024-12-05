#include <emscripten.h>

#include "lz4hc.h"

#define EM_PORT_API(rettype) rettype EMSCRIPTEN_KEEPALIVE

extern "C" EM_PORT_API(int) encodeBound(int inputSize) {
    return LZ4_compressBound(inputSize);
}

extern "C" EM_PORT_API(int) encodeBlockHC(const char* src, char* dst, int srcSize, int dstCapacity, int compressionLevel) {
    return LZ4_compress_HC(src, dst, srcSize, dstCapacity, compressionLevel);
}
