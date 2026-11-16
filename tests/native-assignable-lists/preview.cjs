// Use the source checkout after build-src. Temporarily hook only its compiled
// CLI build entry, restoring it even if Electron or the assertions fail.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const out = process.argv[2] ? path.resolve(process.argv[2]) : fs.mkdtempSync(path.join(os.tmpdir(), 'eez-preview-tests-'));
const entry = path.join(root, 'build/home/build-project.js');
const original = fs.readFileSync(entry, 'utf8');
const electron = process.env.EEZ_TEST_ELECTRON || require('electron');
const prefix = process.env.EEZ_TEST_PACKAGED_HOST ? [] : [root];
fs.mkdirSync(out, { recursive: true });
const completed = path.join(out, 'completed.json');
if (fs.existsSync(completed)) fs.unlinkSync(completed);
(async () => {
    assert.ok(!original.includes('EEZ_NATIVE_REFERENCE_TEST'), 'unfinished previous test hook');
    const match = /await (\w+)\.build\(\)/.exec(original);
    assert.ok(match, 'unrecognized Studio CLI build entry');
    const helper = path.join(__dirname, 'preview-assets.cjs');
    const project = path.join(out, 'preview.eez-project');
    fs.copyFileSync(path.join(__dirname, 'preview.eez-project'), project);
    try {
        fs.writeFileSync(entry, original.replace(match[0], '(process.env.EEZ_NATIVE_REFERENCE_TEST?await require(' +
            JSON.stringify(helper) + ').run(' + match[1] + '):' + match[0] + ')'));
        const log = fs.openSync(path.join(out, 'electron.log'), 'w');
        try {
            execFileSync(electron, [...prefix, '--build-project', project, '--user-data-dir=' + path.join(out, 'profile')], {
                cwd: root, env: { ...process.env, EEZ_NATIVE_REFERENCE_TEST: out },
                stdio: ['ignore', log, log], windowsHide: true, timeout: 60000
            });
        } finally { fs.closeSync(log); }
    } finally { fs.writeFileSync(entry, original); }
    assert.equal(JSON.parse(fs.readFileSync(completed)).passed, true, 'renderer assertions and export completed');
    assert.equal(JSON.parse(fs.readFileSync(path.join(out, 'project-types.json'))).length, 5);
    await require('./preview-wasm.cjs').run(root, out);
    console.log('Test artifacts: ' + out);
})().catch(error => { console.error(error); process.exitCode = 1; });
