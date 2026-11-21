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
    const input = {
        settings: {
            general: { projectVersion: 'v3', projectType: 'lvgl', lvglVersion: '9.5.0', flowSupport: true },
            build: { configurations: [{ name: 'Default' }], files: [] }
        },
        variables: {
            globalVariables: [
                ...['integer', 'float', 'double', 'boolean', 'string'].map((type, i) => variable('Native' + i, type, true)),
                variable('Ordinary', 'integer', false),
                variable('Unsupported', 'array:integer', true)
            ],
            structures: [], enums: []
        },
        actions: [{
            objID: randomUUID(), name: 'LocalFlow', implementationType: 'flow',
            userProperties: [], components: [], connectionLines: [],
            localVariables: [variable('Local', 'integer', true)]
        }],
        userPages: [], userWidgets: [], fonts: [], bitmaps: [], colors: [], themes: [],
        lvglStyles: { styles: [], defaultStyles: {} }, lvglGroups: { groups: [] }
    };
    const roundTrip = async data => {
        const store = ProjectStore.create({ type: 'project-editor' });
        try {
            await store.setProject(loadProject(store, data, true), undefined);
            const output = JSON.parse(getJSON(store));
            for (const item of output.variables.globalVariables) {
                assert.equal(item.native, item.name.startsWith('Native'), item.name);
            }
            assert.equal(output.actions[0].localVariables[0].native, false);
            return output;
        } finally {
            store.unmount();
        }
    };
    const first = await roundTrip(input);
    assert.deepEqual(await roundTrip(JSON.stringify(first)), first);
    return { passed: true, validNativeTypes: 5, ordinaryPreserved: true,
        unsupportedAndLocalDisabled: true, serializedAndReopened: true,
        noAssignableLists: true, noRenames: true };
};
