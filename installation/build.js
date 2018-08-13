const packager = require("electron-packager");
const os = require("os");
const fs = require("fs");
const path = require("path");

function getExtensions() {
    var walkSync = function(dir, fileList) {
        fileList = fileList || [];

        fs.readdirSync(dir).forEach(function(fileName) {
            const filePath = dir + "/" + fileName;
            if (fs.statSync(filePath).isDirectory()) {
                fileList = walkSync(filePath, fileList);
            } else {
                if (filePath.toLowerCase().endsWith(".zip")) {
                    fileList.push(filePath);
                }
            }
        });

        return fileList;
    };

    const extensions = walkSync("instruments");

    extensions.push("../psu-firmware/eez_h24005_r3b4.zip");
    extensions.push("../psu-firmware/eez_h24005_r5b12.zip");
    extensions.push("../psu-firmware/eez_h24005_simulator.zip");

    return extensions;
}

const extensions = []; // getExtensions();
const extraResource = ["installation/init_storage.db", "extensions/catalog.json"].concat(
    extensions
);

const ignore = [
    "\\.gitignore",
    ".*.pdb",

    "^/\\.vscode",
    "^/\\.prettierrc",
    "^/tslint\\.json",
    "^/npm-debug\\.log",
    "^/gulpfile\\.js",
    "^/package-lock\\.json",
    "^/\\.prettierignore",
    "^/\\.editorconfig",
    "^/notes\\.md",
    "^/watch-less\\.js",
    "^/wipe-dependencies\\.js",

    "^/docs",
    "^/extensions",
    "^/images",
    "^/instruments",
    "^/installation",
    "^/help",
    "^/test",

    "^/src/tsconfig\\.dev\\.json",
    "^/src/tsconfig\\.json",
    "^/src/.*\\.ts",
    "^/src/.*\\.tsx",
    "^/src/.*\\.js\\.map",
    "^/src/.*\\.less",

    "^/node_modules/better-sqlite3/build/Release/obj.*",
    "^/node_modules/lzz-gyp/lzz-compiled/linux",
    "^/node_modules/lzz-gyp/lzz-compiled/osx",
    "^/node_modules/lzz-gyp/lzz-compiled/bsd"
];

const options = {
    dir: ".",
    platform: os.platform(),
    arch: "x64",
    asar: false,
    prune: true,
    overwrite: true,
    icon: "icon.ico",
    extraResource,
    ignore
};

packager(options).then(async appPaths => {
    fs.copyFileSync("./LICENSE.TXT", appPaths + "/LICENSE.EEZSTUDIO.TXT");
});
