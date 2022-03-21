Module = {};

Module.onRuntimeInitialized = function () {
    postMessage({ init: {} });
};

Module.print = function (args) {
    console.log("From WASM flow runtime", args);
};

WasmFlowRuntime = Module;
