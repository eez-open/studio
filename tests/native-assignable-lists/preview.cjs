// Use the source checkout after build-src and run the renderer in its own profile.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const out = process.argv[2] ? path.resolve(process.argv[2]) : fs.mkdtempSync(path.join(os.tmpdir(), 'eez-preview-tests-'));
const electron = process.env.EEZ_TEST_ELECTRON || require('electron');
fs.mkdirSync(out, { recursive: true });
const completed = path.join(out, 'completed.json');
if (fs.existsSync(completed)) fs.unlinkSync(completed);
(async () => {
    const project = path.join(out, 'preview.eez-project');
    fs.copyFileSync(path.join(__dirname, 'preview.eez-project'), project);
    fs.copyFileSync(path.join(__dirname, 'preview-drive.eez-project'), path.join(out, 'preview-drive.eez-project'));
    const log = fs.openSync(path.join(out, 'electron.log'), 'w');
    try {
        execFileSync(electron, [path.join(__dirname, 'preview-electron.cjs'), '--build-project', project,
            '--user-data-dir=' + path.join(out, 'profile')], {
            cwd: root, env: { ...process.env, EEZ_STUDIO_CLI_MODE: '1' },
            stdio: ['ignore', log, log], windowsHide: true, timeout: 60000
        });
    } finally {
        fs.closeSync(log);
    }
    assert.equal(JSON.parse(fs.readFileSync(completed)).passed, true, 'renderer assertions and export completed');
    assert.equal(JSON.parse(fs.readFileSync(path.join(out, 'project-types.json'))).length, 5);
    await require('./preview-wasm.cjs').run(root, out);
    console.log('Test artifacts: ' + out);
})().catch(error => { console.error(error); process.exitCode = 1; });
