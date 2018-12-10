import { writeFile, existsSync, mkdirSync } from "fs";
var request = require("request-promise-native");
var sha256 = require("sha256");

import * as Database from "better-sqlite3";

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

async function download(url: string, localPath: string, encoding: "utf8" | null) {
    const data = await request({
        method: "GET",
        url,
        encoding
    });

    await new Promise((resolve, reject) => {
        writeFile(localPath, data, "utf8", err => {
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
    if (!existsSync(extraResourcesPath)) {
        mkdirSync(extraResourcesPath);
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

    const db = new Database(__dirname + "/init_storage.db");
    const rows = db.prepare(`SELECT instrumentExtensionId FROM instrument`).all();

    const extensions: string[] = [];

    rows.push({
        instrumentExtensionId: "b278d8da-1c17-4baa-9837-1761b2481c2b"
    });

    for (const row of rows) {
        const instrumentExtensionId = row.instrumentExtensionId;

        let foundExtension: any;

        catalog.forEach((extension: any) => {
            if (extension.id === instrumentExtensionId) {
                if (
                    !foundExtension ||
                    compareVersions(extension.version, foundExtension.version) > 0
                ) {
                    foundExtension = extension;
                }
            }
        });

        if (!foundExtension) {
            console.warn(`Can't find extension ${instrumentExtensionId}`);
            return;
        }

        const extensionZipFileName = foundExtension.name + "-" + foundExtension.version + ".zip";
        const extensionZipFilePath = extraResourcesPath + "/" + extensionZipFileName;

        const extensionData = await download(foundExtension.download, extensionZipFilePath, null);

        if (sha256(extensionData) !== foundExtension.sha256) {
            console.log(sha256(extensionData));
            console.log(foundExtension.sha256);
            throw "Invalid hash for the extension zip file:" + extensionZipFileName;
        }

        extensions.push(extensionZipFilePath);
    }

    db.close();

    const extraResource = [
        __dirname + "/init_storage.db",
        extraResourcesPath + "/catalog-version.json",
        extraResourcesPath + "/catalog.json"
    ].concat(extensions);

    return extraResource;
}

function writeExtraResource(extraResource: any) {
    return new Promise((resolve, reject) => {
        writeFile(
            __dirname + "/extra-resource.json",
            JSON.stringify(extraResource, undefined, 4),
            "utf8",
            err => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            }
        );
    });
}

(async () => {
    const extraResource = await getExtraResource();
    await writeExtraResource(extraResource);
    process.exit();
})();
