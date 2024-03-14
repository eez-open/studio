import fs from "fs";
import path from "path";
import os from "os";

var request = require("request-promise-native");
var sha256 = require("sha256");
const YAML = require("json-to-pretty-yaml");

const packageJson = require("../package.json");

export const DEFAULT_EXTENSIONS_CATALOG_VERSION_DOWNLOAD_URL =
    "https://github.com/eez-open/studio-extensions/raw/master/build/catalog-version.json";

export const DEFAULT_EXTENSIONS_CATALOG_JSON_DOWNLOAD_URL =
    "https://github.com/eez-open/studio-extensions/raw/master/build/catalog.json";

export const DEFAULT_EXTENSIONS_CATALOG_ZIP_DOWNLOAD_URL =
    "https://github.com/eez-open/studio-extensions/raw/master/build/catalog.zip";

export function compareVersions(v1: string, v2: string) {
    const v1Parts = v1.split(".").map(x => parseInt(x));
    const v2Parts = v2.split(".").map(x => parseInt(x));

    for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); ++i) {
        if (isNaN(v1Parts[i])) {
            if (isNaN(v2Parts[i])) {
                return 0;
            }
            return -1;
        }

        if (isNaN(v2Parts[i])) {
            return 1;
        }

        if (v1Parts[i] < v2Parts[i]) {
            return -1;
        }

        if (v1Parts[i] > v2Parts[i]) {
            return 1;
        }
    }

    return 0;
}

async function download(
    url: string,
    localPath: string,
    encoding: "utf8" | null
) {
    const data = await request({
        method: "GET",
        url,
        encoding
    });

    await new Promise<void>((resolve, reject) => {
        fs.writeFile(localPath, data, "utf8", err => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });

    return data;
}

async function getExtraResource() {
    const extraResourcesPath = __dirname + "/extra-resources";
    if (!fs.existsSync(extraResourcesPath)) {
        fs.mkdirSync(extraResourcesPath);
    }

    await download(
        DEFAULT_EXTENSIONS_CATALOG_VERSION_DOWNLOAD_URL,
        extraResourcesPath + "/catalog-version.json",
        "utf8"
    );

    const catalogJSON = await download(
        DEFAULT_EXTENSIONS_CATALOG_JSON_DOWNLOAD_URL,
        extraResourcesPath + "/catalog.json",
        "utf8"
    );
    const catalog = JSON.parse(catalogJSON);

    await download(
        DEFAULT_EXTENSIONS_CATALOG_ZIP_DOWNLOAD_URL,
        extraResourcesPath + "/catalog.zip",
        null
    );

    const extensions: string[] = [];

    for (const instrumentExtensionId of [
        "b278d8da-1c17-4baa-9837-1761b2481c2b", // advanced-measurements-extension
        "687b6dee-2093-4c36-afb7-cfc7ea2bf262", // bb3
        "d0964223-a599-43f6-8aa2-4eb52f76a395" // h24005
    ]) {
        let foundExtension: any;

        catalog.forEach((extension: any) => {
            if (extension.id === instrumentExtensionId) {
                if (
                    !foundExtension ||
                    compareVersions(extension.version, foundExtension.version) >
                        0
                ) {
                    foundExtension = extension;
                }
            }
        });

        if (!foundExtension) {
            console.warn(`Can't find extension ${instrumentExtensionId}`);
            return;
        }

        const extensionZipFileName =
            foundExtension.name + "-" + foundExtension.version + ".zip";
        const extensionZipFilePath =
            extraResourcesPath + "/" + extensionZipFileName;

        const extensionData = await download(
            foundExtension.download,
            extensionZipFilePath,
            null
        );

        if (sha256(extensionData) !== foundExtension.sha256) {
            console.log(sha256(extensionData));
            console.log(foundExtension.sha256);
            throw (
                "Invalid hash for the extension zip file:" +
                extensionZipFileName
            );
        }

        extensions.push(
            "./installation/extra-resources/" + extensionZipFileName
        );
    }

    const extraResource = [
        "./installation/extra-resources/catalog-version.json",
        "./installation/extra-resources/catalog.json"
    ]
        .concat(extensions)
        .concat(["./resources/expression-grammar.pegjs"]);

    const extraResources = extraResource.map((extraResourcePath: string) => ({
        from: extraResourcePath,
        to: path.basename(extraResourcePath)
    }));

    let lvImgConv9 = (
        await fs.promises.readdir("./resources/lv_img_conv_9")
    ).map(file => ({
        from: "./resources/lv_img_conv_9/" + file,
        to: "lv_img_conv_9/" + file
    }));

    return [
        ...extraResources,
        ...lvImgConv9,
        ...[
            {
                from: "./LICENSE.txt",
                to: "."
            },
            {
                from: "./THIRD-PARTY-LICENSES.TXT",
                to: "."
            }
        ]
    ];
}

const productName = "EEZ Studio";

let files = [
    "build/**",
    "libs/**",
    "help/**",
    "icon.icns",
    "icon.ico",
    "LICENSE.TXT",
    "THIRD-PARTY-LICENSES.TXT",
    "node_modules/**",
    "!**/node_modules/*/{CHANGELOG.md,README.md,README,readme.md,readme}",
    "!**/node_modules/*/{test,__tests__,tests,powered-test,example,examples}",
    "!**/node_modules/*.d.ts",
    "!**/node_modules/.bin",
    "!**/*.js.map",
    "!**/*.css.map",
    "!**/*.ilk",
    "!**/*.lib",
    "!node_modules/**/*.obj",
    "!node_modules/**/*.iobj",
    "!node_modules/**/*.ipdb",
    "!node_modules/**/*.idb",
    "!node_modules/better-sqlite3/deps",
    "!node_modules/better-sqlite3/src",
    "!node_modules/better-sqlite3/docs",
    "!node_modules/better-sqlite3/build/Release/obj/**",
    "!node_modules/bootstrap/js",
    "!node_modules/bootstrap/scss",
    "!build/eez-studio-ui/_images/background.png",
    "!node_modules/plotly.js/dist/**",
    "!node_modules/plotly.js/src/**",
    "node_modules/plotly.js/dist/plotly.min.js",
    "!node_modules/mapbox-gl/dist/**",
    "!node_modules/mapbox-gl/src/**",
    "node_modules/mapbox-gl/dist/mapbox-gl.js",
    "!node_modules/xterm/src/**",
    "!node_modules/koffi/src",
    "!node_modules/koffi/doc"
    //"!node_modules/koffi/build/koffi/**"
];

files.push(
    `node_modules/koffi/build/koffi/${os.platform()}_${os.arch()}/koffi.node`
);

(async function () {
    const config: any = {
        appId: "hr.envox.eez.studio",
        copyright: "Copyright © 2022 Envox d.o.o.",
        productName,

        nodeGypRebuild: false,
        npmRebuild: false,
        buildDependenciesFromSource: true,

        files,

        extraResources: await getExtraResource(),

        fileAssociations: [
            {
                ext: "eez-project",
                name: "EEZ Studio Project",
                role: "Editor",
                mimeType: "application/x-eez-project"
            },
            {
                ext: "eez-dashboard",
                name: "EEZ Dashboard",
                role: "Editor",
                mimeType: "application/x-eez-dashboard"
            }
        ],

        mac: {
            target: [
                {
                    target: "dmg",
                    arch: ["x64", "arm64"]
                },
                {
                    target: "pkg",
                    arch: ["x64", "arm64"]
                },
                {
                    target: "zip",
                    arch: ["x64", "arm64"]
                }
            ],
            category: "public.app-category.utilities",
            bundleVersion: packageJson.version,
            icon: "./icon.icns",
            type: "distribution",
            hardenedRuntime: true,
            gatekeeperAssess: false,
            entitlements: "entitlements.mac.plist",
            entitlementsInherit: "entitlements.mac.plist"
        },

        dmg: {
            background: "build/eez-studio-ui/_images/background.png",
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
            target:
                process.arch == "arm"
                    ? [{ target: "deb", arch: ["armv7l"] }]
                    : ["deb", "AppImage", "rpm"],
            icon: "./icon.icns",
            category: "Utility",
            synopsis: packageJson.description,
            description:
                "EEZ Studio is a free and open source cross-platform low-code tool for embedded GUIs. Built-in EEZ Flow enables the creation of complex scenarios for test and measurement automation, and the Instruments feature offers remote control of multiple T&M equipment.",
            mimeTypes: ["application/x-eez-project"]
        }
    };

    let configYAML = YAML.stringify(config);
    fs.writeFileSync("electron-builder.yml", configYAML);

    config.npmRebuild = true;
    config.afterSign = "installation/notarize.js";

    configYAML = YAML.stringify(config);
    fs.writeFileSync("electron-builder-mac.yml", configYAML);
})();
