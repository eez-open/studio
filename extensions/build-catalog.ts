import * as globby from "globby";
import * as decompress from "decompress";
import * as sharp from "sharp";
import { extname } from "path";
import { writeFile, createWriteStream } from "fs";
import * as archiver from "archiver";

const EXTENSION_REPOSITORIES = [
    {
        local: "../extensions",
        remote: "https://github.com/eez-open/studio/raw/master/extensions"
    },
    {
        local: "../instruments",
        remote: "https://github.com/eez-open/studio/raw/master/instruments"
    },
    {
        local: "../../psu-firmware/build/extensions",
        remote: "https://github.com/eez-open/psu-firmware/raw/stm32/build/extensions"
    }
];

function getRepositoryCatalogs() {
    return Promise.all(
        EXTENSION_REPOSITORIES.map(async repository => {
            const paths = await globby(repository.local + "/**/*.zip");

            return (await Promise.all(
                paths.map(async path => {
                    const files = await decompress(path);

                    const packageJsonFile = files.find(file => file.path === "package.json");
                    if (!packageJsonFile) {
                        return undefined;
                    }

                    const packageJson = JSON.parse(packageJsonFile.data.toString());

                    if (!packageJson["eez-studio"]) {
                        return undefined;
                    }

                    const imagePath = packageJson.image || "image.png";
                    const imageFile = files.find(file => file.path === imagePath);
                    if (imageFile) {
                        const ext = extname(imagePath).substr(1);
                        const imageData = await sharp(imageFile.data)
                            .resize(256)
                            .toBuffer();
                        const base64 = imageData.toString("base64");
                        packageJson.image = `data:image/${ext};base64,${base64}`;
                    }

                    packageJson.download = repository.remote + path.substr(repository.local.length);

                    return packageJson;
                })
            )).filter(x => !!x);
        })
    );
}

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
        const repositoryCatalogs = await getRepositoryCatalogs();
        const catalog = [].concat.apply([], repositoryCatalogs);
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
