// Metadata adapters replace the Electron project store, not the expression
// parser, type checker, validation or bytecode compiler, which are real modules.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Module = require('node:module');
const root = path.resolve(__dirname, '../..');
const build = process.env.EEZ_TEST_BUILD_ROOT;
if (!build) throw new Error('Use run.cjs to compile this checkout first');
const types = ['boolean', 'integer', 'integer', 'string', 'string', 'array:integer', 'array:string'];
const names = ['Flag', 'Count', 'OtherCount', 'Text', 'OtherText', 'Counts', 'Texts'];
const globals = names.map((name, i) => ({ name, fullName: name, type: types[i] }));
const flow = { userPropertiesAndLocalVariables: [{ name: 'Local', type: 'integer' }] };
const component = { inputs: [], outputs: [], buildInputs: [], buildOutputs: [] };
const store = {
    projectTypeTraits: { isLVGL: true, isDashboard: false, isFirmware: false, isEezFlowLite: false, hasFlowSupport: true },
    typesStore: { createOpenType: () => 'any', getType: type => ({ kind: type.startsWith('array:') ? 'array' : 'basic', valueType: type }) }
};
const namedExpressions = new Map();
const project = {
    allGlobalVariables: globals,
    variables: { enumsMap: new Map(), structsMap: new Map(), namedExpressionsMap: namedExpressions },
    importAsList: [],
    _store: store
};
store.project = project;
const ProjectEditor = { getProject: () => project, getFlow: () => flow, getProjectStore: () => store };
for (const name of ['Text', 'MultilineText', 'Button', 'Checkbox', 'Radio']) ProjectEditor[name + 'WidgetClass'] = class {};
// These pure functions live in a UI module. Extract their compiled definitions
// verbatim to avoid loading React property-grid/Electron initialization.
const valueTypeSource = fs.readFileSync(path.join(build, 'project-editor/features/variable/value-type.js'), 'utf8');
const helpers = ['isNarrowIntegerType', 'isEnumType', 'isArrayType', 'getArrayElementTypeFromType', 'getStructTypeNameFromType', 'getStructureFromType', 'getEnumTypeNameFromType'];
const helperSource = ['ENUM_TYPE_REGEXP', 'STRUCT_TYPE_REGEXP', 'ARRAY_TYPE_REGEXP'].map(name => {
    const match = valueTypeSource.match(new RegExp('^const ' + name + ' = .*;', 'm'));
    if (!match) throw new Error('Missing type metadata predicate: ' + name);
    return match[0];
}).concat(helpers.map(name => {
    const match = valueTypeSource.match(new RegExp('^function ' + name + '\\([\\s\\S]*?^}', 'm'));
    if (!match) throw new Error('Missing type metadata helper: ' + name);
    return match[0];
})).join('\n');
const valueType = vm.runInNewContext(helperSource + '\n({' + helpers.join(',') + '})');
const nativeLoad = Module._load;
Module._load = function (request, parent, isMain) {
    if (request === 'project-editor/project-editor-interface') return { ProjectEditor };
    if (request === 'project-editor/features/variable/value-type') return valueType;
    if (request === 'project-editor/project/assets') return { IMPORT_AS_PREFIX: '.', findVariable: (_, name) => globals.find(v => v.fullName === name) };
    if (request === 'eez-studio-shared/util-electron') return { isDev: true };
    if (request === 'eez-studio-shared/util') return { sourceRootDir: () => path.join(root, 'packages') };
    if (request.startsWith('project-editor/')) return nativeLoad.call(this, path.join(build, request + '.js'), parent, isMain);
    return nativeLoad.call(this, request, parent, isMain);
};
const constants = [];
const typeIndexes = { integer: 7, boolean: 2, string: 13, 'array:integer': 65543, 'array:string': 65549, 'array:any': 15 };
const assets = {
    projectStore: store, rootProject: project, globalVariables: globals,
    getAssetIndexByAssetName: (_, name) => globals.findIndex(v => v.name === name) + 1,
    getConstantIndex: (value, type) => {
        let index = constants.findIndex(c => c.value === value && c.type === type);
        if (index < 0) { index = constants.length; constants.push({ value, type }); }
        return index;
    },
    getTypeIndex: type => { if (!(type in typeIndexes)) throw new Error('Unexpected fixture type ' + type); return typeIndexes[type]; }
};
module.exports = { component, assets, constants, typeIndexes, store, namedExpressions,
    ...require(path.join(build, 'project-editor/flow/assignable-list-support.js')),
    ...require(path.join(build, 'project-editor/flow/expression/assignable-list.js')),
    ...require(path.join(build, 'project-editor/flow/expression/build.js')) };
