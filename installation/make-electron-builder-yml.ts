import fs from "fs";
import path from "path";
import os from "os";

const YAML = require("json-to-pretty-yaml");

const packageJson = require("../package.json");

async function getExtraResource() {
    const extraResource: string[] = ["./resources/expression-grammar.pegjs"];

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

    let eezframeworkAmalgamation = (
        await fs.promises.readdir("./resources/eez-framework-amalgamation")
    ).map(file => ({
        from: "./resources/eez-framework-amalgamation/" + file,
        to: "eez-framework-amalgamation/" + file
    }));

    return [
        ...extraResources,
        ...lvImgConv9,
        ...eezframeworkAmalgamation,
        ...[
            {
                from: "./LICENSE.TXT",
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
    "!**/*.mjs.map",
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
    "!node_modules/koffi/doc",
    "!node_modules/tabulator-tables/src"
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
