import * as globby from "globby";
import * as decompress from "decompress";
import { extname } from "path";
import * as SharpModule from "sharp";

const EXTENSION_REPOSITORIES = [
    {
        local: __dirname + "/../extensions",
        remote: "https://github.com/eez-open/studio/raw/master/extensions"
    },
    {
        local: __dirname + "/../instruments",
        remote: "https://github.com/eez-open/studio/raw/master/instruments"
    },
    {
        local: __dirname + "/../../psu-firmware/build/extensions",
        remote: "https://github.com/eez-open/psu-firmware/raw/stm32/build/extensions"
    }
];

function getRepositoryCatalogs(withLocalPath: boolean) {
    return Promise.all(
        EXTENSION_REPOSITORIES.map(async repository => {
            let paths = await globby(repository.local + "/**/*.zip");
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

                    if (withLocalPath) {
                        if (withLocalPath) {
                            packageJson.localPath = path;
                        }
                    } else {
                        const imagePath = packageJson.image || "image.png";
                        const imageFile = files.find(file => file.path === imagePath);
                        if (imageFile) {
                            const ext = extname(imagePath).substr(1);
                            const sharp = require("sharp") as typeof SharpModule;
                            const imageData = await sharp(imageFile.data)
                                .resize(256)
                                .toBuffer();
                            const base64 = imageData.toString("base64");
                            packageJson.image = `data:image/${ext};base64,${base64}`;
                        }

                        packageJson.download =
                            repository.remote + path.substr(repository.local.length);
                    }

                    return packageJson;
                })
            )).filter(x => !!x);
        })
    );
}

export async function getCatalog(withLocalPath: boolean = false) {
    const repositoryCatalogs = await getRepositoryCatalogs(withLocalPath);

    let catalog = [].concat.apply([], repositoryCatalogs);

    catalog = catalog.sort((a: any, b: any) => {
        if (a.name < b.name) {
            return -1;
        }
        if (a.name > b.name) {
            return 1;
        }
        return 0;
    });

    return catalog;
}
