Module = {};

Module.onRuntimeInitialized = function () {
    console.log("onRuntimeInitialized");
    postMessage({ init: {} });
};

Module.print = function (args) {
    console.log(args);
};

// declare const WasmFlowRuntime: {
//     HEAPU8: Uint8Array;
//     _malloc(size: number): number;
//     _free(ptr: number): void;
//
//     _init(assets: number, assetsSize: number);
//     _mainLoop();
//     _getSyncedBuffer(): number;
//     _onMouseWheelEvent(wheelDeltaY: number, wheelClicked: number);
//     _onPointerEvent(x: number, y: number, pressed: number);
// };

onmessage = function (e) {
    let screen = 0;

    if (e.data.assets) {
        const assets = e.data.assets;
        var ptr = Module._malloc(assets.length);
        Module.HEAPU8.set(assets, ptr);
        console.log(e.data);
        Module._init(ptr, assets.length);
    }

    if (e.data.wheel) {
        if (e.data.wheel.deltaY != 0 || e.data.wheel.clicked != 0) {
            Module._onMouseWheelEvent(
                e.data.wheel.deltaY,
                e.data.wheel.clicked
            );
        }
    }

    if (e.data.pointerEvents) {
        for (let i = 0; i < e.data.pointerEvents.length; i++) {
            const pointerEvent = e.data.pointerEvents[i];
            Module._onPointerEvent(
                pointerEvent.x,
                pointerEvent.y,
                pointerEvent.pressed
            );
        }
    }

    Module._mainLoop();

    const WIDTH = 480;
    const HEIGHT = 272;

    var buf_addr = Module._getSyncedBuffer();
    if (buf_addr != 0) {
        screen = new Uint8ClampedArray(
            Module.HEAPU8.subarray(buf_addr, buf_addr + WIDTH * HEIGHT * 4)
        );
    }

    postMessage({
        screen
    });
};
