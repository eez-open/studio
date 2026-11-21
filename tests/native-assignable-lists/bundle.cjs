// Tests the built Studio distribution, never a companion checkout's binaries.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const root = path.resolve(__dirname, '../..');
const build = path.join(root, 'build');
const load = Module._load;
Module._load = function (request, parent, isMain) {
    return load.call(this, request.startsWith('project-editor/') ? path.join(build, request + '.js') : request, parent, isMain);
};
(async () => {
    try {
        const binding = require(path.join(build, 'project-editor/flow/runtime/wasm-value.js'));
        const types = require(path.join(build, 'project-editor/build/value-types.js'));
        for (const name of ['eez_runtime', ...['8.4.0', '9.2.2', '9.3.0', '9.4.0', '9.5.0'].map(v => 'lvgl_runtime_v' + v)]) {
            const relative = 'project-editor/flow/runtime/wasm/' + name;
            const bytes = fs.readFileSync(path.join(build, relative + '.wasm'));
            assert.deepEqual(bytes, fs.readFileSync(path.join(root, 'packages', relative + '.wasm')), 'shipped WASM must match the tracked payload');
            assert.ok(WebAssembly.Module.exports(new WebAssembly.Module(bytes)).some(e => e.name === 'getValueForInspection'));
            const constructor = require(path.join(build, relative + '.js'));
            let runtime;
            await new Promise((resolve, reject) => {
                runtime = constructor(data => { if (data.init) resolve(); });
                setTimeout(() => reject(Error(name + ' initialization timeout')), 10000).unref();
            });
            assert.equal(typeof runtime._getValueForInspection, 'function', 'matching JavaScript export');
            const value = runtime._createIntValue(42);
            const reference = runtime._malloc(16);
            runtime.HEAPU8.fill(0, reference, reference + 16);
            runtime.HEAPU8[reference] = types.FLOW_VALUE_TYPE_VALUE_PTR;
            runtime.HEAPU32[(reference + 8) >> 2] = value;
            try {
                assert.deepEqual(binding.getValue(runtime, reference), { value: 42, valueType: 'integer' });
            } finally {
                runtime._free(reference);
                runtime._valueFree(value);
            }
            console.log('PASS shipped JS/WASM and actual inspector binding: ' + name);
        }
        const header = fs.readFileSync(path.join(root, 'resources/eez-framework-amalgamation/eez-flow.h'), 'utf8');
        const source = fs.readFileSync(path.join(root, 'resources/eez-framework-amalgamation/eez-flow.cpp'), 'utf8');
        for (const name of ['getUserPropertyReference', 'setUserPropertyReference', 'evalAssignableListExpression']) {
            assert.ok(header.includes(name) && source.includes(name), 'bundled C++ API: ' + name);
        }
    } finally { Module._load = load; }
})().catch(error => { console.error(error); process.exitCode = 1; });
