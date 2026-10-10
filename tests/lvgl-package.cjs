// Exercise the packaged application's normal --build-project entry point and
// installed resources, without using the development Electron entry point.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const executable = process.env.EEZ_PACKAGED_EXECUTABLE || path.join(root, "dist/linux-unpacked/eezstudio");
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "eez-package-test-"));
try {
    for (const mode of ["flow", "no-flow"]) {
        const fixture = JSON.parse(fs.readFileSync(path.join(root, "build/lvgl-regression/8.4.0", mode, "fixture.eez-project"), "utf8"));
        const dir = path.join(scratch, mode);
        fs.mkdirSync(dir);
        fixture.settings.build.destinationFolder = "generated";
        const section = name => "//${eez-studio " + name + "}";
        fixture.settings.build.files = [
            { fileName: "screens.c", template: '#include "screens.h"\n' + section("LVGL_SCREENS_DEF") },
            { fileName: "screens.h", template: [
                "#pragma once", section("LVGL_INCLUDE"),
                mode === "flow" ? '#include "eez-flow.h"' : "",
                "#define _(text) (text)", section("LVGL_FONTS_DECL"),
                section("LVGL_SCREENS_DECL"), section("LVGL_VARS_DECL")
            ].join("\n") }
        ];
        const file = path.join(dir, "fixture.eez-project");
        fs.writeFileSync(file, JSON.stringify(fixture));
        const args = ["--no-sandbox", "--user-data-dir=" + path.join(scratch, "profile"), "--build-project", file];
        const result = spawnSync(process.platform === "linux" ? "xvfb-run" : executable,
            process.platform === "linux" ? ["-a", executable, ...args] : args, {
            encoding: "utf8", timeout: 120000,
            env: { ...process.env, XDG_CONFIG_HOME: path.join(scratch, "config"), XDG_DATA_HOME: path.join(scratch, "data"), XDG_CACHE_HOME: path.join(scratch, "cache") }
        });
        const output = (result.stdout || "") + (result.stderr || "");
        assert.equal(result.status, 0, output);
        assert.match(output, /Build successfully finished/);
        assert.doesNotMatch(output, /Unhandled error:/);
        const generated = fs.readFileSync(path.join(dir, "generated/screens.c"), "utf8");
        if (mode === "flow") {
            assert.match(generated, /eez_flow_set_buttonmatrix_text/);
            const cpp = fs.readFileSync(path.join(dir, "generated/eez-flow.cpp"), "utf8");
            assert.match(cpp, /&buttonMatrixSetMap/);
        } else {
            assert.match(generated, /static bool eez_bm_set_text/);
            assert.match(generated, /get_var_hint\(\)/);
        }
        console.log("PASS: packaged --build-project and installed " + mode + " resources");
    }
} finally {
    fs.rmSync(scratch, { recursive: true, force: true });
}
