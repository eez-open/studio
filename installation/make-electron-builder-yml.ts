import fs from "fs";
import path from "path";

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
        .concat(["./resources/expression-grammar.pegjs"])
        .concat(["./resources/project-templates/*"]);

    const extraResources = extraResource.map((extraResourcePath: string) => ({
        from: extraResourcePath,
        to: path.basename(extraResourcePath)
    }));

    let projectTemplates = (
        await fs.promises.readdir("./resources/project-templates")
    )
        .filter(
            file =>
                file.endsWith(".eez-project") ||
                file.endsWith(".eez-project-ui-state")
        )
        .map(file => ({
            from: "./resources/project-templates/" + file,
            to: "project-templates/" + file
        }));

    return [...extraResources, ...projectTemplates];
}

const productName = "EEZ Studio";

let files = [
    "build/**",
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
    "!**/*.css.map",
    "!**/*.ilk",
    "!**/*.lib",
    "!node_modules/better-sqlite3/build/Release/obj",
    "!node_modules/better-sqlite3/build/Release/*.iobj",
    "!node_modules/better-sqlite3/build/Release/*.ipdb",
    "!node_modules/better-sqlite3/deps",
    "!node_modules/better-sqlite3/src",
    "!node_modules/better-sqlite3/docs",
    "!node_modules/bootstrap/js",
    "!node_modules/bootstrap/scss",
    "!node_modules/ffi-napi/deps",
    "!node_modules/ffi-napi/src",
    "!build/eez-studio-ui/_images/background.png",
    "!node_modules/plotly.js/dist/**",
    "!node_modules/plotly.js/src/**",
    "node_modules/plotly.js/dist/plotly.min.js",
    "!node_modules/mapbox-gl/dist/**",
    "!node_modules/mapbox-gl/src/**",
    "node_modules/mapbox-gl/dist/mapbox-gl.js",
    "!node_modules/xterm/src/**"
];

(async function () {
    const config = {
        appId: "hr.envox.eez.studio",
        copyright: "Copyright © 2022 Envox d.o.o.",
        productName,

        nodeGypRebuild: true,
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
                    arch: ["universal"]
                },
                {
                    target: "pkg",
                    arch: ["universal"]
                },
                {
                    target: "zip",
                    arch: ["universal"]
                }
            ],
            category: "public.app-category.utilities",
            bundleVersion: packageJson.version,
            icon: "./icon.icns",
            type: "distribution"
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
                "The EEZ Studio is an open source cross-platform modular visual tool for communication with various T&M instruments that allows simple data acquisition, analysis, presentation and archiving. Flow Editor allows easy creation of complex scenarios for testing and measurement automation.",
            mimeTypes: ["application/x-eez-project"]
        }
    };

    const configYAML = YAML.stringify(config);
    fs.writeFileSync("electron-builder.yml", configYAML);
})();
