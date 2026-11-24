// Run in a Studio renderer after npm run build-src. Uses the real ProjectStore
// and serializer; no assignable lists, refactoring or generated assets are used.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

exports.run = async function () {
    const { loadProjectEditor } = require('project-editor/project-editor-loader');
    await loadProjectEditor();
    const { ProjectStore, getJSON, loadProject } = require('project-editor/store');
    const variable = (name, type, native) => ({
        objID: randomUUID(), name, type, native, persistent: false,
        defaultValue: type === 'string' ? '""' : type === 'boolean' ? 'false' : type === 'array:integer' ? '[1]' : '0'
    });
    const nativeGlobals = ['integer', 'float', 'double', 'boolean', 'string']
        .map((type, index) => variable('Native' + index, type, true));
    const ordinary = variable('Ordinary', 'integer', false);
    const unsupported = variable('Unsupported', 'array:integer', true);
    const local = variable('Local', 'integer', true);
    const describe = ({ name, type, native }) => ({ name, type, native });
    const expectedGlobals = [
        ...nativeGlobals, ordinary, { ...unsupported, native: false }
    ].map(describe);
    const expectedLocals = [{ ...local, native: false }].map(describe);
    const input = {
        settings: {
            general: { projectVersion: 'v3', projectType: 'lvgl', lvglVersion: '9.5.0', flowSupport: true },
            build: { configurations: [{ name: 'Default' }], files: [] }
        },
        variables: {
            globalVariables: [
                ...nativeGlobals, ordinary, unsupported
            ],
            structures: [], enums: []
        },
        actions: [{
            objID: randomUUID(), name: 'LocalFlow', implementationType: 'flow',
            userProperties: [], components: [], connectionLines: [],
            localVariables: [local]
        }],
        userPages: [], userWidgets: [], fonts: [], bitmaps: [], colors: [], themes: [],
        lvglStyles: { styles: [], defaultStyles: {} }, lvglGroups: { groups: [] }
    };
    const roundTrip = async data => {
        const store = ProjectStore.create({ type: 'project-editor' });
        try {
            await store.setProject(loadProject(store, data, true), undefined);
            const output = JSON.parse(getJSON(store));
            assert.deepEqual(
                output.variables.globalVariables.map(describe),
                expectedGlobals, 'serialized global variables'
            );
            assert.deepEqual(
                output.actions.map(action => ({
                    name: action.name,
                    localVariables: action.localVariables.map(describe)
                })),
                [{ name: 'LocalFlow', localVariables: expectedLocals }],
                'serialized actions and local variables'
            );
            return output;
        } finally {
            store.unmount();
        }
    };
    const first = await roundTrip(input);
    assert.deepEqual(await roundTrip(JSON.stringify(first)), first);
    const validNativeTypes = first.variables.globalVariables.filter(item => item.native).length;
    return { passed: true, validNativeTypes, ordinaryPreserved: true,
        unsupportedAndLocalDisabled: true, serializedAndReopened: true,
        noAssignableLists: true, noRenames: true };
};
