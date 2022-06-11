module["exports"] = function (postWorkerToRendererMessage) {

var Module = {};

Module.postWorkerToRendererMessage = postWorkerToRendererMessage;

Module.onRuntimeInitialized = function () {
    postWorkerToRendererMessage({ init: {} });
}

Module.print = function (args) {
    console.log("From WASM flow runtime:", args);
};

