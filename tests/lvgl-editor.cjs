const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
exports.run = async () => {
    const { ProjectStore, loadProject, objectToJson, getClassInfo } = require("project-editor/store");
    const { ProjectEditor } = require("project-editor/project-editor-interface");
    const { LVGLTextareaWidget } = require("project-editor/lvgl/widgets/Textarea");
    const { LVGLButtonMatrixWidget } = require("project-editor/lvgl/widgets/ButtonMatrix");
    const { LVGLMatrixButton, buttonMatrixButtonsProperty } = require("project-editor/lvgl/button-matrix");
    const { actionDefinitions, LVGLActionType } = require("project-editor/lvgl/actions");
    const { evalConstantExpression } = require("project-editor/flow/expression");
    const store = ProjectStore.create({ type: "read-only" });
    const raw = JSON.parse(objectToJson(store.getNewProject()));
    for (const feature of ProjectEditor.extensions) {
        if (raw[feature.key] == undefined) raw[feature.key] = feature.create();
    }
    Object.assign(raw.settings.general, { projectType: "lvgl", projectVersion: "v3", lvglVersion: "8.4.0", flowSupport: true, displayWidth: 320, displayHeight: 240 });
    raw.settings.build.generateSourceCodeForEezFramework = true;
    raw.lvglStyles = { styles: [] };
    raw.userPages = [{ name: "main", left: 0, top: 0, width: 320, height: 240, components: [
        { ...LVGLTextareaWidget.classInfo.defaultValue, type: "LVGLTextareaWidget", identifier: "input", placeholder: "旧工程提示" },
        { ...LVGLTextareaWidget.classInfo.defaultValue, type: "LVGLTextareaWidget", identifier: "dynamic_input", placeholder: '"动态提示"', placeholderType: "expression", passwordBullet: "*", passwordMode: true },
        { ...LVGLTextareaWidget.classInfo.defaultValue, type: "LVGLTextareaWidget", identifier: "translated_input", placeholder: "Translate me", placeholderType: "translated-literal" },
        { ...LVGLButtonMatrixWidget.classInfo.defaultValue, type: "LVGLButtonMatrixWidget", identifier: "keys", buttons: [
            { text: "LV_SYMBOL_OK", width: 1 },
            { newLine: true },
            { text: 'LVGL.LV_SYMBOL_OK + " OK"', textType: "expression", width: 2, ctrlCheckable: true }
        ] },
        { type: "LVGLActionComponent", left: 0, top: 260, width: 180, height: 40, actions: [
            { action: "buttonMatrixSetMap", object: "keys", objectType: "literal", buttons: [
                { text: "A", width: 1, ctrlDisabled: true },
                { newLine: true },
                { text: "LVGL.LV_SYMBOL_CLOSE", textType: "expression", width: 2 }
            ] }
        ] }
    ] }];
    delete raw.userPages[0].components[0].placeholderType;
    delete raw.userPages[0].components[0].passwordBullet;
    const missingPlaceholder = { ...LVGLTextareaWidget.classInfo.defaultValue, type: "LVGLTextareaWidget", identifier: "missing_placeholder" };
    delete missingPlaceholder.placeholder;
    delete missingPlaceholder.placeholderType;
    raw.userPages[0].components.push(missingPlaceholder);
    const fixturePath = path.join(require("node:os").tmpdir(), "lvgl-regression.eez-project");
    fs.writeFileSync(fixturePath, JSON.stringify(raw));
    await store.openFile(fixturePath);
    const project = store.project;
    const screen = project.userPages[0].lvglScreenWidget;
    const [legacy, dynamic, translated, matrix] = screen.children;
    assert.equal(legacy.placeholderType, "literal");
    assert.equal(legacy.passwordBullet, "");
    assert.equal(screen.children.find(c => c.identifier === "missing_placeholder").placeholder, "");
    assert.equal(matrix.buttons[0].textType, "literal");
    assert.equal(matrix.buttons[0].text, "LV_SYMBOL_OK");
    assert.equal(matrix.buttons[1].textType, "literal");
    assert(matrix.buttons[2] instanceof LVGLMatrixButton);
    const types = getClassInfo(legacy).properties.find(p => p.name === "placeholderType").enumItems(legacy);
    assert.deepEqual(types.map(p => p.id), ["literal", "translated-literal", "expression"]);
    const action = project.userPages[0].components.find(c => c.type === "LVGLActionComponent").actions[0];
    assert(action instanceof LVGLActionType);
    const actionButtons = getClassInfo(action).properties.find(p => p.name === "buttons");
    assert.equal(actionButtons.typeClass, buttonMatrixButtonsProperty.typeClass);
    assert.equal(actionButtons.showArrayCollapsedByDefaultInPropertyGrid, true);
    assert.deepEqual(LVGLButtonMatrixWidget.classInfo.getAdditionalFlowProperties(matrix).map(p => p.name), ["buttons[2].text"]);
    assert.equal(evalConstantExpression(project, matrix.buttons[2].text).value, "\uf00c OK");
    const saved = objectToJson(project);
    const reloaded = loadProject(store, saved, true);
    assert.equal(reloaded.userPages[0].lvglScreenWidget.children[1].placeholderType, "expression");
    assert.equal(reloaded.userPages[0].lvglScreenWidget.children[3].buttons[2].textType, "expression");
    assert.equal(reloaded.userPages[0].components.find(c => c.type === "LVGLActionComponent").actions[0].buttons[2].width, 2);
    const ids = actionDefinitions.filter(a => a.id >= 65).sort((a, b) => a.id - b.id);
    assert.deepEqual(ids.map(a => a.id), [65, 66, 67, 68, 69, 70, 71, 72, 73]);
    assert.deepEqual(ids.slice(0, 6).map(a => a.group), Array(6).fill("Textarea"));
    assert.equal(ids[7].group, "ButtonMatrix");
    const { Assets } = require("project-editor/build/assets");
    const assets = new Assets(project, undefined, "buildFiles");
    const props = action.getBuildProperties(assets);
    assert.equal(props.length, 7);
    assert.equal(props[1].expression, '"A"');
    assert.equal(props[3].expression, '"\\n"');
    assert.equal(props[4].expression, "0");
    assert.equal(props[5].expression, "LVGL.LV_SYMBOL_CLOSE");
    await assets.lvglBuild.firstPassFinish();
    const c = await assets.lvglBuild.buildScreensDef();
    assert.match(c, /lv_textarea_set_placeholder_text\(obj, _\("Translate me"\)\)/);
    assert.match(c, /eez_flow_set_buttonmatrix_text\(/);
    assert.match(c, /Failed to evaluate Placeholder in Textarea widget/);
    const out = path.join(__dirname, "../build/lvgl-regression");
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, "screens-flow.c"), c);
    fs.writeFileSync(path.join(out, "fixture.eez-project"), saved);
    assert(assets.getComponentPropertyIndex(dynamic, "placeholder") >= 0);
    assert(assets.getComponentPropertyIndex(matrix, "buttons[2].text") >= 0);

    // Use the real editor command/clipboard infrastructure for nested objects.
    const { cloneObjectWithNewObjIds, objectToClipboardData } = require("project-editor/store/clipboard");
    const editable = ProjectStore.create({ type: "project-editor" });
    await editable.openFile(fixturePath);
    const editMatrix = editable.project.userPages[0].lvglScreenWidget.children[3];
    const editAction = editable.project.userPages[0].components.find(c => c.type === "LVGLActionComponent").actions[0];
    const button = editMatrix.buttons[2];
    const oldText = button.text;
    editable.updateObject(button, { text: "LVGL.LV_SYMBOL_CLOSE" });
    assert.equal(button.text, "LVGL.LV_SYMBOL_CLOSE");
    editable.undoManager.undo();
    assert.equal(button.text, oldText);
    editable.undoManager.redo();
    assert.equal(button.text, "LVGL.LV_SYMBOL_CLOSE");
    const copiedAction = cloneObjectWithNewObjIds(editable, editAction);
    assert(copiedAction.buttons[2] instanceof LVGLMatrixButton);
    assert.equal(copiedAction.buttons[1].newLine, true);
    assert.equal(copiedAction.buttons[2].textType, "expression");
    assert.notEqual(copiedAction.objID, editAction.objID);
    const clipboard = JSON.parse(objectToClipboardData(editable, editAction));
    assert.equal(JSON.parse(clipboard.object).buttons[2].textType, "expression");
    const extra = cloneObjectWithNewObjIds(editable, button);
    const count = editAction.buttons.length;
    editable.addObject(editAction.buttons, extra);
    assert.equal(editAction.buttons.length, count + 1);
    editable.undoManager.undo();
    assert.equal(editAction.buttons.length, count);
    editable.undoManager.redo();
    assert.equal(editAction.buttons.length, count + 1);
    editable.deleteObject(extra);
    assert.equal(editAction.buttons.length, count);
    editable.undoManager.undo();
    assert.equal(editAction.buttons.length, count + 1);
    editable.undoManager.setCombineCommands(true);
    editable.updateObject(button, { width: 3 });
    editable.updateObject(extra, { width: 4 });
    editable.undoManager.setCombineCommands(false);
    assert.deepEqual([button.width, extra.width], [3, 4]);
    editable.undoManager.undo();
    assert.deepEqual([button.width, extra.width], [2, 2]);
    for (const invalid of [{ width: 1.5 }, { text: "missing_variable" }, { textType: "literal", text: "\n" }]) {
        editable.updateObject(button, invalid);
        const errors = [];
        LVGLMatrixButton.classInfo.check(button, errors);
        assert(errors.length > 0);
        editable.undoManager.undo();
    }
    const textInfo = LVGLMatrixButton.classInfo.properties.find(p => p.name === "text");
    assert.equal(textInfo.hideInPropertyGrid(editMatrix.buttons[1]), true);
    console.log("PASS: nested command undo/redo, clipboard cloning, grouped edits and validation");

    // Real editor preview, using each bundled engine, not a mocked code facade.
    const { LVGLPageEditorRuntime } = require("project-editor/lvgl/page-runtime");
    const canvas = document.createElement("canvas");
    for (const version of ["8.4.0", "9.2.2", "9.3.0", "9.4.0", "9.5.0"]) {
        project.settings.general.lvglVersion = version;
        const runtime = new LVGLPageEditorRuntime(project.userPages[0], canvas.getContext("2d"), {});
        let wasm;
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(Error("WASM preview init timeout: " + version)), 30000);
            wasm = require(path.join(__dirname, "../build/project-editor/flow/runtime/wasm/lvgl_runtime_v" + version + ".js"))(message => {
                if (message.init) { clearTimeout(timeout); resolve(); }
            });
        });
        runtime.wasm = wasm;
        wasm._init(0, 0, 0, 0, 320, 240, false, 0, false);
        const parent = wasm._lv_obj_create(0);
        const code = runtime.toLVGLCode;
        code.startWidget(dynamic, parent);
        dynamic.toLVGLCode(code);
        const textObj = code.objectAccessor;
        code.endWidget();
        assert.equal(wasm.UTF8ToString(wasm._lv_textarea_get_placeholder_text(textObj)), "动态提示");
        assert.equal(wasm.UTF8ToString(wasm._lv_textarea_get_password_bullet(textObj)), "*");
        code.startWidget(matrix, parent);
        matrix.toLVGLCode(code);
        const matrixObj = code.objectAccessor;
        code.endWidget();
        const getText = version.startsWith("9.") ? wasm._lv_buttonmatrix_get_button_text : wasm._lv_btnmatrix_get_btn_text;
        assert.equal(wasm.UTF8ToString(getText(matrixObj, 0)), "LV_SYMBOL_OK");
        assert.equal(wasm.UTF8ToString(getText(matrixObj, 1)), "\uf00c OK");
        (wasm._lv_obj_delete || wasm._lv_obj_del)(parent);
        runtime.freeAllButtonMatrixBuffers();
        console.log("PASS: editor preview " + version);
    }

    // Without Flow, keep the established Variable selector and generated getters.
    const noFlow = JSON.parse(saved);
    noFlow.settings.general.flowSupport = false;
    noFlow.settings.general.lvglVersion = "8.4.0";
    noFlow.userPages[0].components = noFlow.userPages[0].components.filter(c => c.type === "LVGLScreenWidget");
    noFlow.userPages[0].components[0].children[1].placeholder = "hint";
    noFlow.userPages[0].components[0].children[3].buttons[2].text = "key_label";
    noFlow.variables.globalVariables = [
        { name: "hint", type: "string", defaultValue: '"Hint"', native: true },
        { name: "key_label", type: "string", defaultValue: '"Key"', native: true }
    ];
    const noFlowPath = path.join(out, "fixture-no-flow.eez-project");
    fs.writeFileSync(noFlowPath, JSON.stringify(noFlow));
    const noFlowStore = ProjectStore.create({ type: "read-only" });
    await noFlowStore.openFile(noFlowPath);
    const noFlowProject = noFlowStore.project;
    const noFlowTypes = getClassInfo(noFlowProject.userPages[0].lvglScreenWidget.children[1]).properties.find(p => p.name === "placeholderType").enumItems(noFlowProject.userPages[0].lvglScreenWidget.children[1]);
    assert.equal(noFlowTypes.find(item => item.id === "expression").label, "Variable");
    const noFlowAssets = new Assets(noFlowProject, undefined, "buildFiles");
    await noFlowAssets.lvglBuild.firstPassFinish();
    const noFlowC = await noFlowAssets.lvglBuild.buildScreensDef();
    assert.match(noFlowC, /get_var_hint\(\)/);
    assert.match(noFlowC, /get_var_key_label\(\)/);
    assert.match(noFlowC, /static bool eez_bm_set_text/);
    assert.doesNotMatch(noFlowC, /eez_flow_set_buttonmatrix_text\(/);
    fs.writeFileSync(path.join(out, "screens-no-flow.c"), noFlowC);
    console.log("PASS: no-Flow Variable mode and standalone C helper generation");
    console.log("PASS: migration, save/reopen, property/action metadata, nested expressions and Flow C generation");
};
