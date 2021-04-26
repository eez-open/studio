import { build } from "electron-builder";
import { Platform } from "electron-builder";
import * as fs from "fs";
import * as path from "path";

const packageJson = require("../package.json");

async function getExtraResource() {
    return new Promise<string[]>((resolve, reject) => {
        fs.readFile(
            __dirname + "/extra-resource.json",
            "utf8",
            (err: any, data: string) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(
                        JSON.parse(data).map((extraResourcePath: string) => ({
                            from: extraResourcePath,
                            to: path.basename(extraResourcePath)
                        }))
                    );
                }
            }
        );
    });
}

(async () => {
    const productName = "EEZ Studio";

    let files = [
        "dist/**",
        "libs/**",
        "icon.icns",
        "icon.ico",
        "LICENSE.TXT",
        "node_modules/**",
        "!**/node_modules/*/{CHANGELOG.md,README.md,README,readme.md,readme}",
        "!**/node_modules/*/{test,__tests__,tests,powered-test,example,examples}",
        "!**/node_modules/*.d.ts",
        "!**/node_modules/.bin",
        "!**/*.js.map",
        "!dist/project-editor/webstudio-bundle.js",
        "!dist/project-editor/webstudio.html",
        "!**/*.ilk",
        "!**/*.lib",
        "!node_modules/better-sqlite3/build/Release/obj",
        "!dist/eez-studio-ui/_images/background.png",
        "!node_modules/plotly.js/dist/**",
        "!node_modules/plotly.js/src/**",
        "node_modules/plotly.js/dist/plotly.min.js",
        "!node_modules/mapbox-gl/dist/**",
        "!node_modules/mapbox-gl/src/**",
        "node_modules/mapbox-gl/dist/mapbox-gl.js"
    ];

    // if (Platform.current() === Platform.WINDOWS) {
    //     files = files.concat([
    //         "!**/node_modules/better-sqlite3/build/Release",
    //         "!**/node_modules/usb/build/Release",
    //         "!**/node_modules/@serial-port/bindings/build/Release",
    //         "!**/node_modules/lzz-gyp/lzz-compiled/linux",
    //         "!**/node_modules/lzz-gyp/lzz-compiled/osx",
    //         "!**/node_modules/lzz-gyp/lzz-compiled/bsd"
    //     ]);
    // }

    // Promise is returned
    build({
        targets: Platform.current().createTarget(),

        config: {
            appId: "hr.envox.eez.studio",
            copyright: "Copyright © 2018-present Envox d.o.o.",
            productName,

            directories: {
                output: "builder-output"
            },

            nodeGypRebuild: false,
            npmRebuild: false,

            files,

            extraResources: await getExtraResource(),

            fileAssociations: [
                {
                    ext: "eez-project",
                    name: "EEZ Studio Project",
                    role: "Editor",
                    mimeType: "application/x-eez-project"
                }
            ],

            mac: {
                target: ["dmg", "pkg", "zip", "dir"],
                category: "public.app-category.utilities",
                bundleVersion: packageJson.version,
                icon: "./icon.icns",
                type: "distribution"
            },

            dmg: {
                background: "dist/eez-studio-ui/_images/background.png",
                iconSize: 160,
                iconTextSize: 12,
                window: {
                    width: 660,
                    height: 400
                },
                contents: [
                    {
                        x: 180,
                        y: 170,
                        type: "file"
                    },
                    {
                        x: 480,
                        y: 170,
                        type: "link",
                        path: "/Applications"
                    }
                ]
            },

            pkg: {
                license: "LICENSE.TXT"
            },

            win: {
                target: ["nsis"], // [, "squirrel", "portable", "zip"],
                icon: "./icon.ico"
            },

            nsis: {
                installerIcon: "./icon.ico",
                license: "LICENSE.TXT",
                warningsAsErrors: false,
                shortcutName: productName
            },

            linux: {
                target: ["deb", "rpm", "AppImage", "snap"],
                icon: "./icon.icns",
                category: "Utility",
                synopsis: packageJson.description,
                description:
                    "The EEZ Studio is an open source cross-platform modular visual tool aimed to address various programming and management tasks for EEZ H24005 programmable power supply, EEZ Bench Box 3 and other test and measurement instruments that support SCPI.",
                mimeTypes: ["application/x-eez-project"]
            },

            snap: {
                grade: "devel"
            }
        }
    })
        .then(() => {
            // handle result
        })
        .catch(error => {
            // handle error
        });
})();
