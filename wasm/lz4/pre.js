module["exports"] = function (onRuntimeInitialized) {
    var Module = {};

    Module.onRuntimeInitialized = function () {
        onRuntimeInitialized();
    }

    Module.print = function (args) {
        console.log("From LZ4:", args);
    };

    Module.printErr = function (args) {
        console.error("From LZ4:", args);
    };

    Module.locateFile = function (path, scriptDirectory) {
        if (scriptDirectory) return scriptDirectory + path;
        return __dirname + "/" + path;
    };

    runWasmModule(Module);

    return Module;
}

function runWasmModule(Module) {

