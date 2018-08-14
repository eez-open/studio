import { writeFile } from "fs";
import * as Database from "better-sqlite3";

import { getCatalog } from "../extensions/catalog-enum";

async function getExtraResource() {
    const catalog = await getCatalog(true);

    const db = new Database(__dirname + "/init_storage.db");
    const rows = db.prepare(`SELECT instrumentExtensionId FROM instrument`).all();

    const extensions: string[] = [];

    rows.forEach(row => {
        const instrumentExtensionId = row.instrumentExtensionId;

        const extension = catalog.find((extension: any) => extension.id === instrumentExtensionId);
        if (!extension) {
            throw `Can't find extension ${instrumentExtensionId}`;
        }

        extensions.push(extension.localPath);
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
