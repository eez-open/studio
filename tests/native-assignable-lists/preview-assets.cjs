// Runs inside Studio's real renderer, after its ProjectStore has loaded the fixture.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

exports.run = async (store, out) => {
    const { runInAction } = require('mobx');
    const { UserProperty, UserPropertyValues } = require('project-editor/flow/user-property');
    const { isPropertyHidden } = require('project-editor/core/object');
    const { replaceObjectReference } = require('project-editor/core/search');
    const { Section, createObject, getClassInfo, getJSON } = require('project-editor/store');
    const { NamedExpression } = require('project-editor/features/variable/variable');
    const { UniqueValueInput } = require('project-editor/ui-components/PropertyGrid/UniqueValueInput');
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
    const singleProperty = action.userProperties[0];
    const originalTargets = propertyValues.values[property.id];
    const originalSingle = propertyValues.values[singleProperty.id];
    const define = (name, parameters, expression) => store.addObject(
        store.project.variables.namedExpressions,
        createObject(store, { name, parameters, expression }, NamedExpression)
    );
    const alias = define('TargetAlias', 'target', 'target');
    define('ChooseTarget', 'condition, first, second', 'condition ? first : second');
    const indexAlias = define('IDX', '', '1');
    const at = define('At', 'index', 'Numbers[index]');
    define('RepeatTarget', 'target', 'Flag ? target : target');
    const mix = define('Mix', 'target', 'Flag ? Numbers[target] : target');
    const destination = define('DEST', '', 'OtherCount');
    define('READ_INDEX', '', '1');
    const variable = name => store.project.variables.globalVariables.find(target => target.name === name);
    const output = name => call.customOutputs.find(target => target.name === name);
    const rename = (declaration, name) => {
        replaceObjectReference(declaration, name);
        store.updateObject(declaration, { name });
    };
    const renameInPropertyGrid = async (declaration, name) => {
        const propertyInfo = getClassInfo(declaration).properties.find(item => item.name === 'name');
        const input = new UniqueValueInput({
            objects: [declaration], propertyInfo, value: declaration.name,
            changeValue: name => store.updateObject(declaration, { name })
        });
        input.context = store;
        input.onChange({ target: { value: name } });
        await input.commitChange();
        return input.error;
    };
    const assertRenameBlocked = async (declaration, name, expected) => {
        const before = getJSON(store);
        const { undoManager } = store;
        const undoBefore = [undoManager.combineCommands, undoManager.undoStack.length, undoManager.commands.length];
        const message = await renameInPropertyGrid(declaration, name);
        if (typeof expected === 'string') {
            assert.equal(message, expected);
        } else {
            assert.match(message, expected);
        }
        assert.equal(getJSON(store), before, 'blocked rename must preserve all declarations and references');
        assert.deepEqual(
            [undoManager.combineCommands, undoManager.undoStack.length, undoManager.commands.length],
            undoBefore, 'blocked rename must preserve pending undo commands'
        );
    };
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

        const indexOutput = output('Index');
        store.updateObject(indexOutput, { name: 'IDX' });
        const list = '[At(IDX), IDX, RepeatTarget(Port), ChooseTarget(Flag, Count, OtherCount), TargetAlias(Drive.Setpoint)]';
        const single = 'At(IDX)';
        try {
            runInAction(() => { propertyValues.values[singleProperty.id] = single; });
            assert.deepEqual(validateTargets(list), []);
            assert.ok(await store.buildAssets(), 'colliding names compile in both native properties');
            for (const [declaration, name, expectedList, expectedSingle] of [
                [indexOutput, 'OutputIndex', list.replace('), IDX,', '), OutputIndex,'), single],
                [indexAlias, 'ArrayPosition', list.replace('At(IDX)', 'At(ArrayPosition)'), 'At(ArrayPosition)'],
                [at, 'GetTarget', list.replace('At(IDX)', 'GetTarget(IDX)'), 'GetTarget(IDX)'],
                [output('Port'), 'OutputPort', list.replace('RepeatTarget(Port)', 'RepeatTarget(OutputPort)'), single],
                [variable('Port'), 'UnrelatedPort', list, single],
                [variable('Flag'), 'GlobalFlag', list.replace('ChooseTarget(Flag,', 'ChooseTarget(GlobalFlag,'), single],
                [output('Flag'), 'OutputFlag', list, single],
                [alias, 'RefTarget', list.replace('TargetAlias(', 'RefTarget('), single]
            ]) {
                const priorName = declaration.name;
                try {
                    rename(declaration, name);
                    assert.equal(propertyValues.values[property.id], expectedList, 'list rename ' + name);
                    assert.equal(propertyValues.values[singleProperty.id], expectedSingle, 'single rename ' + name);
                    assert.deepEqual(validateTargets(expectedList), [], 'validate after rename ' + name);
                } finally {
                    rename(declaration, priorName);
                }
                assert.equal(propertyValues.values[property.id], list);
                assert.equal(propertyValues.values[singleProperty.id], single);
            }

            // Keep an earlier unambiguous reference that could be changed before
            // the search reaches the shared source token.
            const earlier = 'Flag ? At(IDX) : IDX';
            runInAction(() => { propertyValues.values[singleProperty.id] = earlier; });
            assert.deepEqual(validateTargets('[Mix(IDX), Count]'), []);
            for (const declaration of [indexOutput, indexAlias]) {
                await assertRenameBlocked(declaration, 'NewIdx', /Mix\(IDX\).*different declarations/);
            }
            assert.equal(await renameInPropertyGrid(variable('Count'), 'RenamedCount'), undefined);
            assert.equal(propertyValues.values[property.id], '[Mix(IDX), RenamedCount]');
            rename(variable('RenamedCount'), 'Count');

            runInAction(() => { propertyValues.values[singleProperty.id] = 'Mix(IDX)'; });
            assert.deepEqual(validateTargets('[At(IDX), IDX]'), []);
            await assertRenameBlocked(indexOutput, 'NewIdx', /Mix\(IDX\).*different declarations/);
            runInAction(() => { propertyValues.values[singleProperty.id] = earlier; });

            store.updateObject(mix, { parameters: 'index, target', expression: 'Flag ? Numbers[index] : target' });
            assert.deepEqual(validateTargets('[Mix(IDX, IDX)]'), []);
            assert.equal(await renameInPropertyGrid(indexOutput, 'NewOutput'), undefined);
            assert.equal(propertyValues.values[property.id], '[Mix(IDX, NewOutput)]');
            rename(indexOutput, 'IDX');
            assert.equal(await renameInPropertyGrid(indexAlias, 'NewIndex'), undefined);
            assert.equal(propertyValues.values[property.id], '[Mix(NewIndex, IDX)]');
            rename(indexAlias, 'IDX');

            rename(indexOutput, 'OUT_A');
            assert.deepEqual(validateTargets('[DEST, OUT_A]'), []);
            const nameInUse = 'This name is already in use. Choose another.';
            await assertRenameBlocked(indexOutput, 'DEST', nameInUse);
            await assertRenameBlocked(destination, 'OUT_A', nameInUse);

            // Using the same name only as a read argument is harmless.
            assert.deepEqual(validateTargets('[At(READ_INDEX), OUT_A]'), []);
            assert.equal(await renameInPropertyGrid(indexOutput, 'READ_INDEX'), undefined);
            assert.equal(propertyValues.values[property.id], '[At(READ_INDEX), READ_INDEX]');
            assert.deepEqual(validateTargets(propertyValues.values[property.id]), []);
            rename(indexOutput, 'IDX');
        } finally {
            store.updateObject(indexOutput, { name: 'Index' });
        }
    } finally {
        runInAction(() => {
            propertyValues.values[property.id] = originalTargets;
            propertyValues.values[singleProperty.id] = originalSingle;
        });
    }
    const namedTargets = '[ChooseTarget(Flag, Count, OtherCount), Flag ? Text : OtherText, At(Index), ChooseTarget(Flag, TargetAlias(Drive.Setpoint), Setpoint), TargetAlias(Port)]';
    runInAction(() => {
        propertyValues.values[singleProperty.id] = 'TargetAlias(Count)';
        propertyValues.values[action.userProperties[2].id] = '[TargetAlias(Count), At(Index)]';
    });
    assert.deepEqual(validateTargets(namedTargets), []);
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
    fs.writeFileSync(path.join(out, 'completed.json'), JSON.stringify({
        passed: true, namedExpressionRenames: 8, blockedNameChanges: 5,
        splitArgumentsRenamable: true, readOnlyNameReuse: true, namedExpressionPreviewAssets: true
    }));
};
