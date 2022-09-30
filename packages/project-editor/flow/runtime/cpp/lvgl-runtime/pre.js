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

var canvas = document.createElement('canvas');

// TODO
canvas.setAttribute("width", 800);
canvas.setAttribute("height", 480);
Module.canvas = canvas;
document.body.appendChild(canvas);

// TODO
function setWindowTitle(arg) {
    console.log("setWindowTitle", arg);
}
