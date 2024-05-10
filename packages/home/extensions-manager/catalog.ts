import { observable, runInAction, makeObservable } from "mobx";

import {
    getUserDataPath,
    fileExists,
    readJsObjectFromFile,
    writeJsObjectToFile
} from "eez-studio-shared/util-electron";

import * as notification from "eez-studio-ui/notification";

import { IExtension } from "eez-studio-shared/extensions/extension";

export const DEFAULT_EXTENSIONS_CATALOG_VERSION_DOWNLOAD_URL =
    "https://github.com/eez-open/studio-extensions/raw/master/build/catalog-version.json";

export const DEFAULT_EXTENSIONS_CATALOG_DOWNLOAD_URL =
    "https://github.com/eez-open/studio-extensions/raw/master/build/catalog.zip";

interface ICatalogVersion {
    lastModified: Date;
}

class ExtensionsCatalog {
    catalog: IExtension[] = [];
    catalogVersion: ICatalogVersion;

    constructor() {
        makeObservable(this, {
            catalog: observable
        });
    }

    load() {
        this._loadCatalog()
            .then(catalog => {
                runInAction(() => (this.catalog = catalog));
            })
            .catch(error =>
                notification.error(
                    `Failed to load extensions catalog (${error})`
                )
            );

        this._loadCatalogVersion()
            .then(catalogVersion => {
                runInAction(() => (this.catalogVersion = catalogVersion));

                this.checkNewVersionOfCatalog();
            })
            .catch(error =>
                notification.error(`Failed to load catalog version (${error})`)
            );
    }

    get catalogPath() {
        return getUserDataPath("catalog.json");
    }

    async _loadCatalog() {
        let catalogPath = this.catalogPath;
        if (!(await fileExists(catalogPath))) {
            return [];
        }
        return (await readJsObjectFromFile(catalogPath)) as IExtension[];
    }

    get catalogVersionPath() {
        return getUserDataPath("catalog-version.json");
    }

    async _loadCatalogVersion() {
        let catalogVersion;

        let catalogVersionPath = this.catalogVersionPath;
        if (await fileExists(catalogVersionPath)) {
            try {
                catalogVersion = await readJsObjectFromFile(catalogVersionPath);
                catalogVersion.lastModified = new Date(
                    catalogVersion.lastModified
                );
            } catch (err) {
                console.error(err);
            }
        }

        return catalogVersion;
    }

    async checkNewVersionOfCatalog(forceDownload: boolean = false) {
        try {
            const catalogVersion = await this.downloadCatalogVersion();

            console.log(catalogVersion, this.catalogVersion);

            if (
                !this.catalogVersion ||
                catalogVersion.lastModified > this.catalogVersion.lastModified
            ) {
                runInAction(() => (this.catalogVersion = catalogVersion));
                this.downloadCatalog();
            } else {
                // no new version
                if (forceDownload) {
                    this.downloadCatalog();
                    return true;
                }
                return false;
            }
        } catch (error) {
            console.error(error);
            notification.error(`Failed to download extensions catalog version`);
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
                catalogVersion.lastModified = new Date(
                    catalogVersion.lastModified
                );
                await writeJsObjectToFile(
                    this.catalogVersionPath,
                    catalogVersion
                );
                resolve(catalogVersion);
            });

            req.addEventListener("error", error => {
                console.error(
                    "Failed to download catalog-version.json for extensions",
                    error
                );
                reject(error);
            });

            req.send();
        });
    }

    downloadCatalog() {
        var req = new XMLHttpRequest();
        req.responseType = "arraybuffer";
        req.open("GET", DEFAULT_EXTENSIONS_CATALOG_DOWNLOAD_URL);

        const progressToastId = notification.info(
            "Downloading extensions catalog ...",
            {
                autoClose: false,
                hideProgressBar: false
            }
        );

        req.addEventListener("progress", event => {
            notification.update(progressToastId, {
                render: event.total
                    ? `Downloading extensions catalog: ${event.loaded} of ${event.total}`
                    : `Downloading extensions catalog: ${event.loaded}`
            });
        });

        req.addEventListener("load", async () => {
            const decompress = require("decompress");

            const files = await decompress(Buffer.from(req.response));

            const catalog = JSON.parse(files[0].data);

            runInAction(() => (this.catalog = catalog));

            await writeJsObjectToFile(this.catalogPath, this.catalog);

            notification.update(progressToastId, {
                type: notification.SUCCESS,
                render: `The latest extensions catalog successfully downloaded.`,
                autoClose: 5000
            });
        });

        req.addEventListener("error", error => {
            console.error("ExtensionsCatalog download error", error);
            notification.update(progressToastId, {
                type: notification.ERROR,
                render: `Failed to download extensions catalog.`,
                autoClose: 5000
            });
        });

        req.send();
    }
}

export const extensionsCatalog = new ExtensionsCatalog();
