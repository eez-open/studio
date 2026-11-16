// Run against the checkout's compiler and sources, without starting Electron.
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const out = process.argv[2] ? path.resolve(process.argv[2]) : fs.mkdtempSync(path.join(os.tmpdir(), 'eez-expression-tests-'));
fs.mkdirSync(out, { recursive: true });
for (const args of [
    [path.join(root, 'node_modules/typescript/bin/tsc'), '--project', path.join(root, 'tsconfig.json'), '--preserveSymlinks', 'true', '--outDir', path.join(out, 'compiled')],
    ['--test', path.join(__dirname, 'compiler.test.cjs')]
]) {
    const result = spawnSync(process.execPath, args, {
        cwd: root, stdio: 'inherit',
        env: { ...process.env, NODE_PATH: path.join(root, 'node_modules'), EEZ_TEST_BUILD_ROOT: path.join(out, 'compiled'), EEZ_TEST_OUTPUT: out }
    });
    if (result.status !== 0) process.exit(result.status || 1);
}
console.log('Test artifacts: ' + out);
