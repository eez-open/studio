let lz4_module: {
    _malloc: (size: number) => number;
    _free: (ptr: number) => void;
    HEAPU8: Uint8Array;
    _encodeBound: (size: number) => number;
    _encodeBlockHC: (
        srcPtr: number,
        dstPtr: number,
        srcSize: number,
        dstCapacity: number,
        compressionLevel: number
    ) => number;
};

export async function compress(buffer: Buffer, compressionLevel: number) {
    if (!lz4_module) {
        // load lz4 wasm module
        lz4_module = await new Promise<any>(resolve => {
            const lz4_module_constructor = require("project-editor/flow/runtime/lz4.js");
            const lz4_module = lz4_module_constructor(() => {
                resolve(lz4_module);
            });
        });
    }

    const srcPtr = lz4_module._malloc(buffer.length);
    lz4_module.HEAPU8.set(buffer, srcPtr);

    const dstCapacity = lz4_module._encodeBound(buffer.length);
    const dstPtr = lz4_module._malloc(dstCapacity);

    // console.time("lz4");
    const compressedSize: number = lz4_module._encodeBlockHC(
        srcPtr,
        dstPtr,
        buffer.length,
        dstCapacity,
        compressionLevel
    );
    // console.timeEnd("lz4");

    lz4_module._free(srcPtr);

    const compressedBuffer = Buffer.from(
        new Uint8Array(lz4_module.HEAPU8.buffer, dstPtr, compressedSize)
    );

    lz4_module._free(dstPtr);

    return { compressedBuffer, compressedSize };
}
