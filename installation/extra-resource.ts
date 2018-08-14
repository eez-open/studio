import { writeFile } from "fs";
import * as Database from "better-sqlite3";

import { getCatalog } from "../extensions/catalog-enum";

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

async function getExtraResource() {
    const catalog = await getCatalog(true);

    const db = new Database(__dirname + "/init_storage.db");
    const rows = db.prepare(`SELECT instrumentExtensionId FROM instrument`).all();

    const extensions: string[] = [];

    rows.push({
        instrumentExtensionId: "b278d8da-1c17-4baa-9837-1761b2481c2b"
    });

    rows.forEach(row => {
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
            throw `Can't find extension ${instrumentExtensionId}`;
        }

        extensions.push(foundExtension.localPath);
    });

    db.close();

    const extraResource = [
        __dirname + "/init_storage.db",
        __dirname + "/../extensions/catalog-version.json",
        __dirname + "/../extensions/catalog.json"
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
