Module = {};

Module.onRuntimeInitialized = function () {
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
//     _onMessageFromDebugger(x: number, y: number, pressed: number);
// };

let allDebuggerMessages;
let currentDebuggerMessage;

function mergeArray(arrayOne, arrayTwo) {
    if (arrayOne) {
        var mergedArray = new Uint8Array(arrayOne.length + arrayTwo.length);
        mergedArray.set(arrayOne);
        mergedArray.set(arrayTwo, arrayOne.length);
        return mergedArray;
    } else {
        return arrayTwo;
    }
}

function startToDebuggerMessage() {
    finishToDebuggerMessage();
}

function writeDebuggerBuffer(arr) {
    currentDebuggerMessage = mergeArray(
        currentDebuggerMessage,
        new Uint8Array(arr)
    );
}

function finishToDebuggerMessage() {
    if (currentDebuggerMessage) {
        allDebuggerMessages = mergeArray(
            allDebuggerMessages,
            currentDebuggerMessage
        );
        currentDebuggerMessage = undefined;
    }
}

onmessage = function (e) {
    if (e.data.assets) {
        const assets = e.data.assets;
        var ptr = Module._malloc(assets.length);
        Module.HEAPU8.set(assets, ptr);

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

    if (e.data.messageFromDebugger) {
        const messageFromDebugger = new Uint8Array(e.data.messageFromDebugger);
        var ptr = Module._malloc(messageFromDebugger.length);
        Module.HEAPU8.set(messageFromDebugger, ptr);

        Module._onMessageFromDebugger(ptr, messageFromDebugger.length);

        Module._free(ptr);
    }

    Module._mainLoop();

    const WIDTH = 480;
    const HEIGHT = 272;

    const data = {};

    var buf_addr = Module._getSyncedBuffer();
    if (buf_addr != 0) {
        data.screen = new Uint8ClampedArray(
            Module.HEAPU8.subarray(buf_addr, buf_addr + WIDTH * HEIGHT * 4)
        );
    }

    if (allDebuggerMessages) {
        data.messageToDebugger = allDebuggerMessages;
        allDebuggerMessages = undefined;
    }

    postMessage(data);
};
