// Install the real NSIS artifact and build projects with the installed app.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { createHash } = require("node:crypto");
const { spawnSync } = require("node:child_process");
assert.equal(process.platform, "win32");
const dist = path.resolve(__dirname, "../dist");
const installers = fs.readdirSync(dist).filter(name => name.endsWith(".exe"));
assert.equal(installers.length, 1, "Expected one Windows installer");
const installer = path.join(dist, installers[0]);
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "eez-installed-"));
const installed = path.join(scratch, "app");
function run(command, args, extra = {}) {
    const result = spawnSync(command, args, { encoding: "utf8", timeout: 240000, ...extra });
    assert.ifError(result.error);
    assert.equal(result.status, 0, `${command}\n${result.stdout || ""}\n${result.stderr || ""}`);
    if (result.stdout) process.stdout.write(result.stdout);
}
try {
    run(installer, ["/S", "/D=" + installed]);
    const executable = path.join(installed, "EEZ Studio.exe");
    assert(fs.existsSync(executable), "NSIS did not install EEZ Studio.exe");
    run(path.join(installed, "resources/app.asar.unpacked/node_modules/pngquant-bin/vendor/pngquant.exe"), ["--version"]);
    run(process.execPath, [path.join(__dirname, "lvgl-package.cjs")], {
        env: { ...process.env, EEZ_PACKAGED_EXECUTABLE: executable }
    });
    const hash = createHash("sha256").update(fs.readFileSync(installer)).digest("hex");
    fs.writeFileSync(installer + ".sha256", `${hash}  ${installers[0]}\n`);
    console.log(`PASS: NSIS installation, image converter and installed Flow/no-Flow CLI (${installers[0]})`);
} finally {
    fs.rmSync(scratch, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 });
}
