// Runs inside Studio's real renderer, after its ProjectStore has loaded the fixture.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

exports.run = async store => {
    const { runInAction } = require('mobx');
    const { UserProperty } = require('project-editor/flow/user-property');
    const { BuildEezFlowLite } = require('project-editor/eez-flow-lite/build');
    const { ASSIGNABLE_LIST_RUNTIME_ERROR } = require('project-editor/flow/assignable-list-support');
    const property = store.project.actions.find(a => a.name === 'ReferenceAction').userProperties[1];
    const option = UserProperty.classInfo.properties.find(p => p.name === 'assignableList');
    const general = store.project.settings.general;
    const saved = { projectType: general.projectType, flowSupport: general.flowSupport };
    const checks = [];
    try {
        for (const [projectType, flowSupport, supported] of [
            ['lvgl', true, true], ['firmware', true, true], ['dashboard', true, true],
            ['eez-gui-lite', true, false], ['lvgl', false, false]
        ]) {
            runInAction(() => Object.assign(general, { projectType, flowSupport }));
            assert.equal(option.disabled(property), !supported, projectType + ' option availability');
            const messages = [];
            UserProperty.classInfo.check(property, messages);
            assert.equal(messages.some(m => m.text === ASSIGNABLE_LIST_RUNTIME_ERROR), !supported, projectType + ' validation');
            if (projectType === 'eez-gui-lite') {
                assert.equal(store.projectTypeTraits.isEezFlowLite, true);
                assert.throws(() => new BuildEezFlowLite(store.project).buildUserActionsDecl({ line() {} }),
                    { message: ASSIGNABLE_LIST_RUNTIME_ERROR });
            }
            checks.push({ projectType, flowSupport, supported });
        }
    } finally {
        runInAction(() => Object.assign(general, saved));
    }
    const result = await store.buildAssets();
    assert.ok(result.GUI_ASSETS_DATA && result.GUI_ASSETS_DATA_MAP_JS, 'real preview build assets');
    const out = process.env.EEZ_NATIVE_REFERENCE_TEST;
    fs.writeFileSync(path.join(out, 'preview-assets.bin'), Buffer.from(result.GUI_ASSETS_DATA));
    fs.writeFileSync(path.join(out, 'assets-map.json'), JSON.stringify(result.GUI_ASSETS_DATA_MAP_JS, null, 2));
    fs.writeFileSync(path.join(out, 'project-types.json'), JSON.stringify(checks, null, 2));
    const generated = path.join(out, 'generated');
    fs.mkdirSync(generated, { recursive: true });
    // Keep both optional libraries enabled so the exported C++ can be compared
    // to the bundled source before configuration-specific cleanup.
    await require('project-editor/lvgl/build').generateSourceCodeForEezFramework(store.project, generated, true);
    assert.ok(fs.readFileSync(path.join(generated, 'eez-flow.cpp'), 'utf8').includes('evalAssignableListExpression'),
        'the real LVGL exporter must copy the reference-aware runtime');
    assert.ok(fs.readFileSync(path.join(generated, 'eez-flow.h'), 'utf8').includes('setUserPropertyReference'),
        'the real LVGL exporter must copy the public reference API');
    assert.equal(fs.readFileSync(path.join(generated, 'eez-flow.cpp'), 'utf8').replace(/\r/g, ''),
        fs.readFileSync(path.resolve(__dirname, '../../resources/eez-framework-amalgamation/eez-flow.cpp'), 'utf8').replace(/\r/g, ''),
        'the exporter must use this checkout\'s bundled runtime');
    fs.writeFileSync(path.join(out, 'completed.json'), JSON.stringify({ passed: true }));
};
