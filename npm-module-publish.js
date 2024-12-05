const fse = require("fs-extra");
const path = require("path");
const { spawn } = require("child_process");

const FOLDERS = ["packages", "libs", "resources"];
for (const folder of FOLDERS) {
    console.log(`Copy ${folder} to npm-module/${folder} ...`);
    fse.copySync(folder, `npm-module/${folder}`, { overwrite: true });
}

/*
console.log("Spawn npm publish ...");
const dir = spawn(
    process.platform == "win32" ? "npm.cmd" : "npm",
    ["publish"],
    { cwd: __dirname + path.sep + "npm-module", shell: true }
);

dir.stdout.on("data", data => console.log(data.toString()));
dir.stderr.on("data", data => console.log(data.toString()));

dir.on("error", err => console.log(err.toString()));

dir.on("close", code => {
    for (const folder of FOLDERS) {
        console.log(`Remove npm-module/${folder} ...`);
        fse.removeSync(`npm-module/${folder}`);
    }
});
*/
