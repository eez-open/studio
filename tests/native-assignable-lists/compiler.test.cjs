const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const h = require('./harness.cjs');
const compile = expression => h.buildAssignableListExpression(h.assets, undefined, h.component, expression);
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
test('exports actual compiler output for native and WASM evaluation tests', () => {
    const cases = Object.fromEntries(['[Count, Text]', '[Flag ? Count : OtherCount]', '[Flag ? Text : OtherText]', '[(Flag ? Counts : Counts)[0]]'].map(expr => [expr, compile(expr)]));
    fs.writeFileSync(path.join(process.env.EEZ_TEST_OUTPUT, 'bytecode.json'), JSON.stringify({ cases, constants: h.constants, typeIndexes: h.typeIndexes }, null, 2));
    fs.writeFileSync(path.join(process.env.EEZ_TEST_OUTPUT, 'compiler-fixture.h'),
        'static std::vector<uint8_t> compiledCase(unsigned index) {\nstatic const std::vector<std::vector<uint16_t>> cases = {\n' +
        Object.values(cases).map(words => '{' + words.join(',') + '}').join(',\n') +
        '\n};\nstd::vector<uint8_t> result; for(auto w : cases.at(index)) { result.push_back(w & 255); result.push_back(w >> 8); } return result;\n}\n');
});
