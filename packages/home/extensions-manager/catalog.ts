import { observable, runInAction } from "mobx";
import * as path from "path";

import {
    isDev,
    getUserDataPath,
    fileExists,
    readJsObjectFromFile,
    writeJsObjectToFile
} from "eez-studio-shared/util";

import * as notification from "eez-studio-ui/notification";

import { IExtension } from "eez-studio-shared/extensions/extension";

const DEFAULT_EXTENSIONS_CATALOG_VERSION_DOWNLOAD_URL =
    "https://github.com/eez-open/studio/raw/master/extensions/catalog-version.json";

const DEFAULT_EXTENSIONS_CATALOG_DOWNLOAD_URL =
    "https://github.com/eez-open/studio/raw/master/extensions/catalog.zip";

interface ICatalogVersion {
    lastModified: Date;
}

class ExtensionsCatalog {
    @observable
    catalog: IExtension[] = [];
    catalogVersion: ICatalogVersion;

    constructor() {
        this.loadCatalog()
            .then(catalog => {
                runInAction(() => (this.catalog = catalog));
            })
            .catch(error => notification.error(`Failed to load catalog (${error})`));

        this.loadCatalogVersion()
            .then(catalogVersion => {
                runInAction(() => (this.catalogVersion = catalogVersion));
                this.checkNewVersionOfCatalog();
            })
            .catch(error => notification.error(`Failed to load catalog version (${error})`));
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

    get catalogVersionPath() {
        return getUserDataPath("catalog-version.json");
    }

    async loadCatalogVersion() {
        let catalogVersionPath = this.catalogVersionPath;
        if (!(await fileExists(catalogVersionPath))) {
            if (isDev) {
                catalogVersionPath = path.resolve(
                    `${__dirname}/../../../extensions/catalog-version.json`
                );
            } else {
                catalogVersionPath = process.resourcesPath! + "/catalog-version.json";
            }
        }
        const catalogVersion = await readJsObjectFromFile(catalogVersionPath);

        catalogVersion.lastModified = new Date(catalogVersion.lastModified);

        return catalogVersion;
    }

    async checkNewVersionOfCatalog() {
        try {
            const catalogVersion = await this.downloadCatalogVersion();

            if (catalogVersion.lastModified > this.catalogVersion.lastModified) {
                runInAction(() => (this.catalogVersion = catalogVersion));
                this.downloadCatalog();
            } else {
                // no new version
                return false;
            }
        } catch (error) {
            notification.error(`Failed to download catalog version (${error})`);
        }

        return true;
    }

    downloadCatalogVersion() {
        return new Promise<ICatalogVersion>((resolve, reject) => {
            var req = new XMLHttpRequest();
            req.responseType = "json";
            req.open("GET", DEFAULT_EXTENSIONS_CATALOG_VERSION_DOWNLOAD_URL);

            req.addEventListener("load", async () => {
                const catalogVersion = req.response;
                catalogVersion.lastModified = new Date(catalogVersion.lastModified);
                await writeJsObjectToFile(this.catalogVersionPath, catalogVersion);
                resolve(catalogVersion);
            });

            req.addEventListener("error", error => {
                console.error("Failed to download catalog-version.json", error);
                reject(error);
            });

            req.send();
        });
    }

    downloadCatalog() {
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
                type: notification.SUCCESS,
                render: `The latest catalog successfully downloaded.`,
                autoClose: 5000
            });
        });

        req.addEventListener("error", error => {
            console.error("ExtensionsCatalog download error", error);
            notification.update(progressToastId, {
                type: notification.ERROR,
                render: `Failed to download catalog.`,
                autoClose: 5000
            });
        });

        req.send();
    }
}

export const extensionsCatalog = new ExtensionsCatalog();
