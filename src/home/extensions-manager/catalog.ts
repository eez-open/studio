import { observable, runInAction } from "mobx";
import * as path from "path";

import {
    isDev,
    getUserDataPath,
    fileExists,
    readJsObjectFromFile,
    writeJsObjectToFile
} from "shared/util";

import * as notification from "shared/ui/notification";

import { IExtension } from "shared/extensions/extension";

const DEFAULT_EXTENSIONS_CATALOG_DOWNLOAD_URL =
    "https://github.com/eez-open/studio/raw/master/extensions/catalog.zip";

class ExtensionsCatalog {
    @observable
    catalog: IExtension[] = [];

    constructor() {
        this.loadCatalog()
            .then(catalog => {
                runInAction(() => (this.catalog = catalog));
            })
            .catch(error => notification.error(`Failed to load catalog (${error})`));
    }

    get catalogPath() {
        return getUserDataPath("catalog.json");
    }

    async loadCatalog() {
        let catalogPath = this.catalogPath;
        if (!(await fileExists(catalogPath))) {
            if (isDev) {
                catalogPath = path.resolve(`${__dirname}/../../../extensions/catalog.json`);
            } else {
                catalogPath = process.resourcesPath! + "/catalog.json";
            }
        }
        return (await readJsObjectFromFile(catalogPath)) as IExtension[];
    }

    update() {
        var req = new XMLHttpRequest();
        req.responseType = "arraybuffer";
        req.open("GET", DEFAULT_EXTENSIONS_CATALOG_DOWNLOAD_URL);

        const progressToastId = notification.info("Downloading catalog ...", {
            autoClose: false,
            hideProgressBar: false
        });

        req.addEventListener("progress", event => {
            notification.update(progressToastId, {
                render: event.total
                    ? `Downloading catalog: ${event.loaded} of ${event.total}`
                    : `Downloading catalog: ${event.loaded}`
            });
        });

        req.addEventListener("load", async () => {
            const decompress = require("decompress");

            const files = await decompress(new Buffer(req.response));

            const catalog = JSON.parse(files[0].data);

            runInAction(() => (this.catalog = catalog));

            await writeJsObjectToFile(this.catalogPath, this.catalog);

            notification.update(progressToastId, {
                type: "success",
                render: `The latest catalog successfully downloaded.`,
                autoClose: 5000
            });
        });

        req.addEventListener("error", error => {
            console.error("ExtensionsCatalog download error", error);
            notification.update(progressToastId, {
                type: "error",
                render: `Failed to download catalog.`,
                autoClose: 5000
            });
        });

        req.send();
    }
}

export const extensionsCatalog = new ExtensionsCatalog();
