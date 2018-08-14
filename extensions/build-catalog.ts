import { writeFile, createWriteStream } from "fs";
import * as archiver from "archiver";

import { getCatalog } from "./catalog-enum";

function writeCatalog(catalog: any) {
    return new Promise((resolve, reject) => {
        writeFile("catalog.json", JSON.stringify(catalog, undefined, 4), "utf8", err => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

function zipCatalog() {
    return new Promise((resolve, reject) => {
        var output = createWriteStream("catalog.zip");

        var archive = archiver("zip", {
            zlib: {
                level: 9
            }
        });

        archive.on("warning", function(err: any) {
            console.warn(err);
        });

        archive.on("error", function(err: any) {
            reject(err);
        });

        archive.pipe(output);

        archive.file("catalog.json", {
            name: "catalog.json"
        });

        output.on("close", function() {
            resolve();
        });

        archive.finalize();
    });
}

function writeCatalogVersion(catalogVersion: any) {
    return new Promise((resolve, reject) => {
        writeFile(
            "catalog-version.json",
            JSON.stringify(catalogVersion, undefined, 4),
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
    try {
        const catalog = await getCatalog();
        await writeCatalog(catalog);

        await zipCatalog();

        const catalogVersion = {
            lastModified: new Date()
        };
        await writeCatalogVersion(catalogVersion);
    } catch (err) {
        console.error(err);
    }
})();
