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

    Module.locateFile = function (path, scriptDirectory) {
        if (scriptDirectory) return scriptDirectory + path;
        return __dirname + "/" + path;
    };

    runWasmModule(Module);

    return Module;
}

function runWasmModule(Module) {

