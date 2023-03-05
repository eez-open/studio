module["exports"] = function (postWorkerToRendererMessage) {
    var Module = {};

    Module.postWorkerToRendererMessage = postWorkerToRendererMessage;

    Module.onRuntimeInitialized = function () {
        postWorkerToRendererMessage({ init: {} });
    }

    Module.print = function (args) {
        console.log("From LVGL-WASM flow runtime:", args);
    };

    Module.printErr = function (args) {
        console.error("From LVGL-WASM flow runtime:", args);
    };

    Module.onRuntimeTerminate = function () {
        for (const propName in Module) {
            delete Module[propName];
        }
    };

    runWasmModule(Module);

    return Module;
}

function runWasmModule(Module) {

