// Runs inside Studio's real renderer, after its ProjectStore has loaded the fixture.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

exports.run = async (store, out) => {
    const { runInAction } = require('mobx');
    const { UserProperty, UserPropertyValues } = require('project-editor/flow/user-property');
    const { isPropertyHidden } = require('project-editor/core/object');
    const { replaceObjectReference } = require('project-editor/core/search');
    const { Section } = require('project-editor/store');
    const { BuildEezFlowLite } = require('project-editor/eez-flow-lite/build');
    const { ASSIGNABLE_LIST_RUNTIME_ERROR } = require('project-editor/flow/assignable-list-support');
    const action = store.project.actions.find(a => a.name === 'ReferenceAction');
    const property = action.userProperties[1];
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
            assert.equal(isPropertyHidden(property, option), false, projectType + ' existing switch remains visible');
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
    const invalidDeclarations = [
        [action, 'implementationType', 'flow'],
        [general, 'flowSupport', false],
        [property, 'type', 'integer'],
        [property, 'assignable', true]
    ];
    for (const [object, key, invalidValue] of invalidDeclarations) {
        const originalValue = object[key];
        try {
            store.updateObject(object, { [key]: invalidValue });
            const messages = [];
            UserProperty.classInfo.check(property, messages);
            assert.equal(messages.length, 1, key + ' declaration error');
            assert.match(messages[0].text, /Assignable lists require/);
            assert.equal(isPropertyHidden(property, option), false, key + ' switch can be cleared');
            assert.equal(await store.buildAssets(), undefined, key + ' must stop the ordinary build');
            assert.equal(store.outputSectionsStore.getSection(Section.OUTPUT).numErrors, 1);
            store.updateObject(property, { assignableList: false });
            assert.equal(isPropertyHidden(property, option), true, key + ' impossible to re-enable in an invalid declaration');
        } finally {
            store.updateObject(object, { [key]: originalValue });
        }
        assert.equal(property.assignableList, false, key + ' repair must leave the switch off');
        assert.equal(isPropertyHidden(property, option), false, key + ' a valid declaration can opt in again');
        store.updateObject(property, { assignableList: true });
    }
    const call = store.project.userPages[0].components.find(component =>
        component.action === 'ReferenceAction'
    );
    const propertyValues = call.userPropertyValues;
    const originalTargets = propertyValues.values[property.id];
    const validateTargets = expression => {
        runInAction(() => { propertyValues.values[property.id] = expression; });
        const messages = [];
        UserPropertyValues.classInfo.check(propertyValues, messages);
        return messages.map(message => message.text);
    };
    try {
        assert.deepEqual(validateTargets('[Drive.Setpoint]'), [], 'imported global');
        assert.deepEqual(validateTargets(originalTargets), [], 'conditional imported global');
        for (const expression of ['[Drive.Missing]', '[Flag ? Drive.Missing : Setpoint]']) {
            assert.match(validateTargets(expression).join('\n'), /Unknown variable 'Missing' in import 'Drive'/);
        }
        await store.buildAssets();
        assert.ok(store.outputSectionsStore.getSection(Section.OUTPUT).numErrors > 0, 'missing target fails ordinary build');

        const expression = '[Flag ? Port : OtherCount, Numbers[Index], Drive.Setpoint, Setpoint]';
        const variable = name => store.project.variables.globalVariables.find(target => target.name === name);
        const output = name => call.customOutputs.find(target => target.name === name);
        const rename = (declaration, name) => {
            replaceObjectReference(declaration, name);
            store.updateObject(declaration, { name });
        };
        for (const [declaration, newName, expected] of [
            [variable('Port'), 'GlobalPort', expression],
            [output('Port'), 'OutputPort', '[Flag ? OutputPort : OtherCount, Numbers[Index], Drive.Setpoint, Setpoint]'],
            [variable('Flag'), 'GlobalFlag', '[GlobalFlag ? Port : OtherCount, Numbers[Index], Drive.Setpoint, Setpoint]'],
            [output('Flag'), 'OutputFlag', expression],
            [variable('Index'), 'ArrayIndex', '[Flag ? Port : OtherCount, Numbers[ArrayIndex], Drive.Setpoint, Setpoint]'],
            [output('Index'), 'OutputIndex', expression],
            [variable('Setpoint'), 'LocalSetpoint', '[Flag ? Port : OtherCount, Numbers[Index], Drive.Setpoint, LocalSetpoint]']
        ]) {
            assert.deepEqual(validateTargets(expression), []);
            const priorName = declaration.name;
            try {
                rename(declaration, newName);
                assert.equal(propertyValues.values[property.id], expected, 'rename ' + newName);
            } finally {
                rename(declaration, priorName);
            }
        }
    } finally {
        runInAction(() => { propertyValues.values[property.id] = originalTargets; });
    }
    const result = await store.buildAssets();
    assert.equal(store.outputSectionsStore.getSection(Section.OUTPUT).numErrors, 0);
    assert.ok(result.GUI_ASSETS_DATA && result.GUI_ASSETS_DATA_MAP_JS, 'real preview build assets');
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
