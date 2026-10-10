const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const versions = ["8.4.0", "9.2.2", "9.3.0", "9.4.0", "9.5.0"];

async function until(condition, runtime, description) {
    const deadline = Date.now() + 15000;
    while (!condition()) {
        assert(!runtime.error, String(runtime.error));
        assert(Date.now() < deadline, "Timed out: " + description);
        await new Promise(resolve => setTimeout(resolve, 20));
    }
}

exports.run = async () => {
    const { ProjectStore, objectToJson, Section } = require("project-editor/store");
    const { buildAssets } = require("project-editor/build/assets");
    const { WasmRuntime } = require("project-editor/flow/runtime/wasm-runtime");
    const { LVGLTextareaWidget } = require("project-editor/lvgl/widgets/Textarea");
    const { LVGLLabelWidget } = require("project-editor/lvgl/widgets/Label");
    const { runInAction } = require("mobx");
    const out = path.join(__dirname, "../build/lvgl-regression");
    const base = JSON.parse(fs.readFileSync(path.join(out, "fixture.eez-project"), "utf8"));
    const rawScreen = base.userPages[0].components.find(c => c.type === "LVGLScreenWidget");
    Object.assign(rawScreen.children.find(c => c.identifier === "dynamic_input"), {
        placeholder: "hint", text: "hint", textType: "expression"
    });
    rawScreen.children.find(c => c.identifier === "keys").buttons[2].text = "key_label";
    // Keep a second matrix to exercise bindings unaffected by Set Map.
    const boundKeys = structuredClone(rawScreen.children.find(c => c.identifier === "keys"));
    boundKeys.objID = randomUUID();
    boundKeys.identifier = "bound_keys";
    rawScreen.children.push(boundKeys);
    rawScreen.children.push(
        { ...LVGLTextareaWidget.classInfo.defaultValue, type: "LVGLTextareaWidget", identifier: "edit_key", text: "key_label", textType: "expression" },
        { ...LVGLLabelWidget.classInfo.defaultValue, type: "LVGLLabelWidget", identifier: "copied_label", text: "copied", textType: "expression" },
        { ...LVGLLabelWidget.classInfo.defaultValue, type: "LVGLLabelWidget", identifier: "selected_label", text: "selected", textType: "expression" },
        { ...LVGLLabelWidget.classInfo.defaultValue, type: "LVGLLabelWidget", identifier: "button_text_label", text: "button_text", textType: "expression" }
    );
    base.variables.globalVariables = [
        { name: "hint", type: "string", defaultValue: '"bound hint"', native: false },
        { name: "key_label", type: "string", defaultValue: '"bound key"', native: false },
        { name: "copied", type: "string", defaultValue: '""', native: false },
        { name: "selected", type: "integer", defaultValue: "-1", native: false },
        { name: "button_text", type: "string", defaultValue: '""', native: false }
    ];
    const action = base.userPages[0].components.find(c => c.type === "LVGLActionComponent");
    const mapAction = action.actions[0];
    mapAction.buttons[2].text = 'LVGL.LV_SYMBOL_CLOSE + " " + key_label';
    const set = (name, prop, value) => ({ action: name, object: "input", objectType: "literal", [prop]: value, [prop + "Type"]: "literal" });
    action.actions = [
        set("textareaSetText", "text", "hello 世界"),
        set("textareaSetOneLine", "enabled", true),
        set("textareaSetPasswordBullet", "bullet", "*"),
        set("textareaSetPasswordMode", "enabled", true),
        set("textareaSetPlaceholderText", "text", "action placeholder"),
        { action: "textareaGetText", object: "input", objectType: "literal", result: "copied" },
        mapAction,
        { action: "buttonMatrixGetSelectedButton", object: "keys", objectType: "literal", result: "selected" },
        { action: "buttonMatrixGetButtonText", object: "keys", objectType: "literal", buttonID: 0, buttonIDType: "literal", result: "button_text" },
        { action: "buttonMatrixGetButtonText", object: "keys", objectType: "literal", buttonID: "0 + 1", buttonIDType: "expression", result: "button_text" }
    ];
    const start = { objID: randomUUID(), type: "StartActionComponent", left: 400, top: 0, width: 40, height: 40 };
    base.userPages[0].components.push(start);
    base.userPages[0].connectionLines = [{ source: start.objID, output: "@seqout", target: action.objID, input: "@seqin" }];

    for (const version of versions) {
        for (const flow of [true, false]) {
            const raw = structuredClone(base);
            raw.settings.general.lvglVersion = version;
            raw.settings.general.flowSupport = flow;
            if (flow) {
                const keys = raw.userPages[0].components.find(c => c.type === "LVGLScreenWidget").children.find(c => c.identifier === "keys");
                Object.assign(keys.buttons[0], { text: "LVGL.LV_SYMBOL_BACKSPACE", textType: "expression" });
            }
            if (!flow) {
                raw.userPages[0].components = raw.userPages[0].components.filter(c => c.type === "LVGLScreenWidget");
                raw.userPages[0].connectionLines = [];
                const screen = raw.userPages[0].components[0];
                screen.children = screen.children.filter(c => !["edit_key", "copied_label", "selected_label", "button_text_label"].includes(c.identifier));
                Object.assign(screen.children.find(c => c.identifier === "dynamic_input"), { text: "", textType: "literal" });
                raw.variables.globalVariables = raw.variables.globalVariables.slice(0, 2).map(v => ({ ...v, native: true }));
            }
            const dir = path.join(out, version, flow ? "flow" : "no-flow");
            fs.mkdirSync(dir, { recursive: true });
            const file = path.join(dir, "fixture.eez-project");
            fs.writeFileSync(file, JSON.stringify(raw));
            const store = ProjectStore.create({ type: "read-only" });
            await store.openFile(file);
            const result = await buildAssets(store.project, undefined, undefined, "buildFiles");
            assert.equal(store.outputSectionsStore.getSection(Section.OUTPUT).numErrors, 0, "Project build errors: " + version);
            const declarations = [
                '#pragma once\n#include "lvgl.h"',
                flow ? '#include "eez-flow.h"' : "",
                '#ifdef __cplusplus\nextern "C" {\n#endif',
                "const char *test_translate(const char *text);\n#define _(text) test_translate(text)",
                result.LVGL_SCREENS_DECL,
                result.LVGL_FONTS_DECL,
                result.LVGL_VARS_DECL,
                flow ? result.GUI_ASSETS_DECL : "",
                '#ifdef __cplusplus\n}\n#endif'
            ].join("\n");
            fs.writeFileSync(path.join(dir, "screens.h"), declarations);
            fs.writeFileSync(path.join(dir, "screens.c"), '#include "screens.h"\n' + result.LVGL_SCREENS_DEF);
            if (flow) {
                fs.writeFileSync(path.join(dir, "assets.c"), '#include "screens.h"\n' + result.GUI_ASSETS_DEF);
                const indexes = result.GUI_ASSETS_DATA_MAP_JS.globalVariables;
                fs.writeFileSync(path.join(dir, "bindings.h"), indexes.map(v => `#define TEST_${v.name.toUpperCase()}_INDEX ${v.index}`).join("\n"));
            }
            fs.writeFileSync(file, objectToJson(store.project));
            console.log(`PASS: generated complete ${flow ? "Flow" : "no-Flow"} C fixture ${version}`);
            if (!flow) continue;

            // Run the actual saved project through Studio's runtime/asset compiler.
            const runtime = new WasmRuntime(store);
            runInAction(() => { store.runtime = runtime; });
            runtime.startRuntime(false);
            try {
                const children = store.project.userPages[0].lvglScreenWidget.children;
                const input = children.find(c => c.identifier === "input");
                const dynamic = children.find(c => c.identifier === "dynamic_input");
                const matrix = children.find(c => c.identifier === "keys");
                const boundMatrix = children.find(c => c.identifier === "bound_keys");
                const keyInput = children.find(c => c.identifier === "edit_key");
                const copied = children.find(c => c.identifier === "copied_label");
                const selected = children.find(c => c.identifier === "selected_label");
                const buttonText = children.find(c => c.identifier === "button_text_label");
                await until(() => input._lvglObj && matrix._lvglObj, runtime, "screen creation " + version);
                const wasm = runtime.worker.wasm;
                const label = widget => wasm.UTF8ToString(wasm._lv_label_get_text(widget._lvglObj));
                const edit = (widget, value) => {
                    const ptr = wasm.stringToNewUTF8(value);
                    wasm._lv_textarea_set_text(widget._lvglObj, ptr);
                    wasm._free(ptr);
                };
                await until(() => copied._lvglObj && label(copied) === "hello 世界", runtime, "nine actions " + version);
                assert.equal(label(selected), "65535");
                assert.equal(label(buttonText), "\uf00d bound key");
                assert.equal(wasm._lv_textarea_get_one_line(input._lvglObj), 1);
                assert.equal(wasm._lv_textarea_get_password_mode(input._lvglObj), 1);
                assert.equal(wasm.UTF8ToString(wasm._lv_textarea_get_password_bullet(input._lvglObj)), "*");
                assert.equal(wasm.UTF8ToString(wasm._lv_textarea_get_placeholder_text(input._lvglObj)), "action placeholder");
                runtime.lgvlPageRuntime.lvglScreenTick();
                assert.equal(wasm.UTF8ToString(wasm._lv_textarea_get_placeholder_text(dynamic._lvglObj)), "bound hint");
                const getText = version.startsWith("9.") ? wasm._lv_buttonmatrix_get_button_text : wasm._lv_btnmatrix_get_btn_text;
                assert.equal(wasm.UTF8ToString(getText(matrix._lvglObj, 0)), "A");
                assert.equal(wasm.UTF8ToString(getText(boundMatrix._lvglObj, 1)), "bound key");
                edit(dynamic, "");
                edit(keyInput, "");
                runtime.lgvlPageRuntime.lvglScreenTick();
                assert.equal(wasm.UTF8ToString(wasm._lv_textarea_get_placeholder_text(dynamic._lvglObj)), "");
                assert.equal(wasm.UTF8ToString(getText(boundMatrix._lvglObj, 1)), " ");
                edit(dynamic, "new hint");
                edit(keyInput, "\uf00c new");
                runtime.lgvlPageRuntime.lvglScreenTick();
                assert.equal(wasm.UTF8ToString(wasm._lv_textarea_get_placeholder_text(dynamic._lvglObj)), "new hint");
                assert.equal(wasm.UTF8ToString(getText(boundMatrix._lvglObj, 1)), "\uf00c new");
                edit(input, "changed");
                runtime.lgvlPageRuntime.lvglScreenTick();
                assert.equal(label(copied), "hello 世界");
                // Repeated ticks and variable changes must never restore the old symbol/map.
                for (let i = 0; i < 20; i++) runtime.lgvlPageRuntime.lvglScreenTick();
                assert.equal(wasm.UTF8ToString(getText(matrix._lvglObj, 0)), "A");
                assert.equal(wasm.UTF8ToString(getText(matrix._lvglObj, 1)), "\uf00d bound key");
                assert.equal(label(buttonText), "\uf00d bound key");
                assert(!runtime.error, String(runtime.error));
                console.log("PASS: Studio Run, nine compiled actions and live empty/non-empty bindings " + version);
            } finally {
                await runtime.stopRuntime(false);
                runInAction(() => { store.runtime = undefined; });
            }
        }
    }
};
