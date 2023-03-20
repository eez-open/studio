module["exports"] = function (postWorkerToRendererMessage) {
    var Module = {};

    Module.postWorkerToRendererMessage = postWorkerToRendererMessage;

    Module.onRuntimeInitialized = function () {
        postWorkerToRendererMessage({ init: {} });
    }

    Module.print = function (args) {
        console.log("From EEZ-WASM flow runtime:", args);
    };

    Module.printErr = function (args) {
        console.error("From EEZ-WASM flow runtime:", args);
    };

    runWasmModule(Module);

    return Module;
}

function runWasmModule(Module) {

