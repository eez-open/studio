import { build, Platform } from "electron-builder";
const fs = require("fs");

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

(async () => {
    // Promise is returned
    build({
        targets: Platform.current().createTarget(),
        config: {
            appId: "hr.envox.eez.studio",
            copyright: "Copyright © 2018-present Envox d.o.o.",
            directories: {
                output: "builder-output"
            },

            files: [
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
                "!**/node_modules/better-sqlite3/build/Release",
                "!**/node_modules/usb/build/Release",
                "!**/node_modules/@serial-port/bindings/build/Release",
                "!**/node_modules/lzz-gyp/lzz-compiled/linux",
                "!**/node_modules/lzz-gyp/lzz-compiled/osx",
                "!**/node_modules/lzz-gyp/lzz-compiled/bsd",

                "!**/*.js.map"
            ],

            extraResources: await getExtraResource(),

            fileAssociations: [
                {
                    ext: "eez-project",
                    name: "EEZ Studio Project",
                    role: "Editor"
                }
            ],

            mac: {
                target: ["dmg", "pkg", "zip"],
                category: "public.app-category.utilities",
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
                target: ["nsis" /*, "portable", "zip"*/],
                icon: "./icon.ico"
            },
            nsis: {
                installerIcon: "./icon.ico",
                license: "LICENSE.TXT",
                warningsAsErrors: false
            },
            linux: {
                target: ["AppImage", "deb", "rpm", "snap"],
                icon: "dist/eez-studio-ui/_images/eez_logo.png",
                category: "Utility"
            },
            snap: {
                grade: "stable",
                summary: "Cross-platform visual development tool and SCPI instrument controller."
            },
            publish: {
                provider: "github",
                owner: "notable",
                releaseType: "release",
                publishAutoUpdate: true
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
