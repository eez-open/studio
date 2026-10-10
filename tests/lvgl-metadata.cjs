// Independent ABI gate: never reorder existing action IDs, including in binaries.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const catalogText = fs.readFileSync(path.join(root, "packages/project-editor/lvgl/actions-catalog.tsx"), "utf8");
const ids = new Map();
for (const match of catalogText.matchAll(/registerAction\(\{\s*id: (\d+),\s*name: "([^"]+)"/g)) {
    const id = Number(match[1]);
    assert(!ids.has(id), "Duplicate action ID " + id);
    ids.set(id, match[2]);
}
const cpp = fs.readFileSync(path.join(root, "resources/eez-framework-amalgamation/eez-flow.cpp"), "utf8");
const table = cpp.match(/static ActionType actions\[\] = \{([\s\S]+?)\n\};/)[1];
const names = [...table.matchAll(/&([a-zA-Z0-9_]+)/g)].map(m => m[1]);
// Frozen from Studio e09d8df12e31ca96c7b760543976cf85721610ec.
const legacyNames = require("./lvgl-legacy-action-ids.json");
assert.deepEqual(names.slice(0, legacyNames.length), legacyNames, "Existing action IDs changed");
assert.equal(ids.size, names.length);
for (const [id, name] of ids) assert.equal(names[id], name, "Action ABI mismatch at " + id);
assert.equal(names[64], "objGetDisplayY");
assert.equal(names[65], "textareaGetText");
assert.equal(names[71], "buttonMatrixGetSelectedButton");
assert.equal(names[72], "buttonMatrixSetMap");
assert.equal(names[73], "buttonMatrixGetButtonText");
(async () => {
    for (const version of ["8.4.0", "9.2.2", "9.3.0", "9.4.0", "9.5.0"]) {
        const base = path.join(root, "packages/project-editor/flow/runtime/wasm/lvgl_runtime_v" + version);
        assert(WebAssembly.validate(fs.readFileSync(base + ".wasm")));
        let wasm;
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(Error("WASM init timeout: " + version)), 30000);
            wasm = require(base + ".js")(message => {
                if (message.init) { clearTimeout(timeout); resolve(); }
            });
        });
        for (const func of ["eez_flow_set_buttonmatrix_text", "eez_flow_set_buttonmatrix_map", "lv_textarea_get_text", "lv_textarea_set_placeholder_text", "lv_textarea_set_password_bullet"]) {
            assert.equal(typeof wasm["_" + func], "function", version + ": missing " + func);
        }
        assert.equal(wasm._eez_test_lvgl_actions, undefined, "Test code leaked into release");
    }
    console.log("PASS: 74 catalog/engine action IDs and five updated runtime exports");
})().catch(error => { console.error(error); process.exitCode = 1; });
