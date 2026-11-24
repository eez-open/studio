const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const h = require('./harness.cjs');
const compile = expression => h.buildAssignableListExpression(h.assets, undefined, h.component, expression);

for (const family of ['isFirmware', 'isDashboard', 'isLVGL']) {
    test('supports full Flow runtime: ' + family, () => {
        const traits = { hasFlowSupport: true, isFirmware: false, isDashboard: false, isLVGL: false, isEezFlowLite: false, [family]: true };
        assert.equal(h.supportsAssignableLists(traits), true);
    });
}
for (const [name, overrides] of [
    ['EEZ GUI Lite inheriting firmware traits', { isFirmware: true, isEezFlowLite: true }],
    ['project without Flow', { hasFlowSupport: false }],
    ['unsupported runtime family', { isLVGL: false }]
]) {
    test('rejects unsupported runtime before compiling: ' + name, () => {
        const previous = h.store.projectTypeTraits;
        h.store.projectTypeTraits = { ...previous, ...overrides };
        try {
            assert.equal(h.supportsAssignableLists(h.store.projectTypeTraits), false);
            assert.throws(() => compile('[Count]'), error => String(error) === h.ASSIGNABLE_LIST_RUNTIME_ERROR);
        } finally {
            h.store.projectTypeTraits = previous;
        }
    });
}
test('different list items keep independent destination types', () => {
    assert.deepEqual(h.parseAssignableListExpression(h.component, '[Count, Text]').map(n => n.valueType), ['integer', 'string']);
    const words = compile('[Count, Text]');
    assert.equal(words[0], h.ASSIGNABLE_LIST_MARKER);
    assert.ok(words.includes(0xf000));
});
for (const expression of ['[Flag ? Count : OtherCount]', '[Flag ? Text : OtherText]', '[Flag ? (Flag ? Count : OtherCount) : OtherCount]', '[(Flag ? Counts : Counts)[0]]', '[Counts[Flag ? 0 : 1]]', '[]']) {
    test('accepts ' + expression, () => assert.doesNotThrow(() => compile(expression)));
}
for (const expression of ['[Flag ? Count : Text]', '[Flag ? Text : Count]', '[Flag ? (Flag ? Count : Text) : OtherCount]', '[(Flag ? Counts : Texts)[0]]']) {
    test('rejects differently typed conditional destinations ' + expression, () => {
        assert.throws(() => compile(expression), /Both destinations.*same type/);
    });
}
for (const expression of ['Count', '[1]', '[Count + 1]', '[Missing]', '[Flag ? Count : 1]']) {
    test('rejects invalid destination ' + expression, () => assert.throws(() => compile(expression)));
}
test('ordinary array expression keeps value-array encoding', () => {
    const words = h.buildExpression(h.assets, undefined, h.component, '[Count, OtherCount]');
    assert.notEqual(words[0], h.ASSIGNABLE_LIST_MARKER);
});
test('named expressions expand to independent destinations inside a list', () => {
    const namedExpressions = h.namedExpressions;
    for (const [name, parameterNames, expression] of [
        ['CurrentTarget', [], 'Count'],
        ['ChooseTarget', ['when', 'first', 'second'], 'when ? first : second'],
        ['IndexOffset', ['index'], 'index + 1']
    ]) {
        namedExpressions.set(name, { name, parameterNames, expression });
    }
    try {
        assert.deepEqual(
            compile('[CurrentTarget, ChooseTarget(Flag, Count, OtherCount), Counts[IndexOffset(0)]]'),
            compile('[Count, Flag ? Count : OtherCount, Counts[0 + 1]]')
        );
        assert.throws(() => compile('[ChooseTarget(Flag, Count, Text)]'), /Both destinations.*same type/);
        assert.throws(() => compile('[IndexOffset(0)]'), /Every item.*assignable/);
        assert.throws(() => compile('[IndexOffset()]'), /expects 1 argument/);
    } finally {
        namedExpressions.clear();
    }
});
test('named expressions shadow outputs only in read positions of native targets', () => {
    const { namedExpressions, component } = h;
    const outputs = [{ name: 'IDX', type: 'integer' }, { name: 'COND', type: 'boolean' }];
    component.outputs = outputs;
    component.buildOutputs = outputs;
    for (const [name, parameterNames, expression] of [
        ['IDX', [], '0'],
        ['COND', [], 'Flag'],
        ['At', ['index'], 'Counts[index]'],
        ['Select', ['condition', 'left', 'right'], 'condition ? left : right'],
        ['Alias', ['target'], 'target'],
        ['Mix', ['target'], 'Flag ? Counts[target] : target']
    ]) {
        namedExpressions.set(name, { name, parameterNames, expression });
    }
    const compileSingle = expression =>
        h.buildAssignableExpression(h.assets, undefined, component, expression);
    try {
        assert.equal(h.parseAssignableListExpression(component, '[IDX]')[0].identifierType, 'output');
        for (const [original, expanded] of [
            ['Counts[IDX]', 'Counts[0]'],
            ['At(IDX)', 'Counts[0]'],
            ['COND ? Count : OtherCount', 'Flag ? Count : OtherCount'],
            ['Select(COND, Count, OtherCount)', 'Flag ? Count : OtherCount'],
            ['Alias(Alias(IDX))', 'IDX'],
            ['Select(COND, IDX, OtherCount)', 'Flag ? IDX : OtherCount'],
            ['Mix(IDX)', 'Flag ? Counts[0] : IDX']
        ]) {
            assert.deepEqual(compileSingle(original), compileSingle(expanded), original);
            assert.deepEqual(compile('[' + original + ']'), compile('[' + expanded + ']'), original);
        }
    } finally {
        component.outputs = [];
        component.buildOutputs = [];
        namedExpressions.clear();
    }
});
test('exports actual compiler output for native and WASM evaluation tests', () => {
    const cases = Object.fromEntries(['[Count, Text]', '[Flag ? Count : OtherCount]', '[Flag ? Text : OtherText]', '[(Flag ? Counts : Counts)[0]]'].map(expr => [expr, compile(expr)]));
    fs.writeFileSync(path.join(process.env.EEZ_TEST_OUTPUT, 'bytecode.json'), JSON.stringify({ cases, constants: h.constants, typeIndexes: h.typeIndexes }, null, 2));
    fs.writeFileSync(path.join(process.env.EEZ_TEST_OUTPUT, 'compiler-fixture.h'),
        'static std::vector<uint8_t> compiledCase(unsigned index) {\nstatic const std::vector<std::vector<uint16_t>> cases = {\n' +
        Object.values(cases).map(words => '{' + words.join(',') + '}').join(',\n') +
        '\n};\nstd::vector<uint8_t> result; for(auto w : cases.at(index)) { result.push_back(w & 255); result.push_back(w >> 8); } return result;\n}\n');
});
