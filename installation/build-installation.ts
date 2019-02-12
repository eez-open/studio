import * as packager from "electron-packager";
const os = require("os");
const fs = require("fs");
const packageJson = require("../package.json");

async function getExtraResource() {
    return new Promise<string[]>((resolve, reject) => {
        fs.readFile(__dirname + "/extra-resource.json", "utf8", (err: any, data: string) => {
            if (err) {
                reject(err);
            } else {
                resolve(JSON.parse(data));
            }
        });
    });
}

function getIgnore() {
    const ignoreList = [
        "\\.gitignore",
        ".*.pdb",

        "^/\\.vscode",
        "^/\\.prettierrc",
        "^/tslint\\.json",
        "^/tsconfig\\.json",
        "^/tsconfig\\.dev\\.json",
        "^/npm-debug\\.log",
        "^/gulpfile\\.js",
        "^/package-lock\\.json",
        "^/\\.prettierignore",
        "^/\\.editorconfig",
        "^/notes\\.md",
        "^/watch-less\\.js",

        "^/docs",
        "^/extensions",
        "^/images",
        "^/instruments",
        "^/installation",
        "^/help",
        "^/test",

        "^/packages",

        "^/node_modules/better-sqlite3/build/Release/.*",
        "^/node_modules/usb/build/Release/.*",
        "^/node_modules/@serial-port/bindings/build/Release/.*",

        "^/node_modules/lzz-gyp/lzz-compiled/linux",
        "^/node_modules/lzz-gyp/lzz-compiled/osx",
        "^/node_modules/lzz-gyp/lzz-compiled/bsd",

        ".*\\.js\\.map"
    ];

    return ignoreList.map(ignorePattern => new RegExp(ignorePattern));
}

let icon;
if (os.platform() === "win32") {
    icon = "icon.ico";
} else if (os.platform() === "darwin") {
    icon = "icon.icns";
} else {
    icon = "dist/eez-studio-ui/_images/eez_logo.png";
}

(async () => {
    try {
        const options: packager.Options = {
            arch: "x64",
            asar: true,
            dir: ".",
            extraResource: await getExtraResource(),
            icon,
            ignore: getIgnore(),
            overwrite: true,
            platform: os.platform(),
            prune: true,

            appCopyright: "Copyright © 2018-present Envox d.o.o.",
            appVersion: packageJson.version
        };

        const appPaths = await packager(options);

        fs.copyFileSync("./LICENSE.TXT", appPaths[0] + "/LICENSE.EEZSTUDIO.TXT");
    } catch (err) {
        console.error(err);
    }

    process.exit();
})();
