import { observable, runInAction, makeObservable } from "mobx";

import {
    getUserDataPath,
    fileExists,
    readJsObjectFromFile,
    writeJsObjectToFile
} from "eez-studio-shared/util-electron";

import * as notification from "eez-studio-ui/notification";

import type { ExampleProject } from "project-editor/project/ui/Wizard";

export const EEZ_PROJECT_EXAMPLES_REPOSITORY =
    "https://github.com/eez-open/eez-project-examples";

const CATALOG_VERSION_DOWNLOAD_URL =
    "https://github.com/eez-open/eez-project-examples/raw/master/build/catalog-version.json";

const CATALOG_DOWNLOAD_URL =
    "https://github.com/eez-open/eez-project-examples/raw/master/build/catalog.zip";

interface ICatalogVersion {
    lastModified: Date;
}

class ExamplesCatalog {
    catalogAtStart: ExampleProject[];

    catalog: ExampleProject[] = [];
    catalogVersion: ICatalogVersion;

    onNewCatalog: () => void | undefined;

    constructor() {
        makeObservable(this, {
            catalogAtStart: observable,
            catalog: observable
        });
    }

    async load() {
        try {
            const catalog = await this._loadCatalog();
            runInAction(() => {
                if (!this.catalogAtStart) {
                    this.catalogAtStart = catalog;
                }
                this.catalog = catalog;
            });
        } catch (error) {
            notification.error(
                `Failed to load eez-project examples catalog (${error})`
            );
        }

        try {
            const catalogVersion = await this._loadCatalogVersion();
            runInAction(() => (this.catalogVersion = catalogVersion));
            this.checkNewVersionOfCatalog();
        } catch (error) {
            notification.error(`Failed to load catalog version (${error})`);
        }
    }

    get catalogPath() {
        return getUserDataPath("examples-catalog.json");
    }

    async _loadCatalog() {
        let catalogPath = this.catalogPath;
        if (await fileExists(catalogPath)) {
            return (await readJsObjectFromFile(
                catalogPath
            )) as ExampleProject[];
        }
        return [] as ExampleProject[];
    }

    get catalogVersionPath() {
        return getUserDataPath("examples-catalog-version.json");
    }

    async _loadCatalogVersion() {
        let catalogVersionPath = this.catalogVersionPath;
        if (await fileExists(catalogVersionPath)) {
            try {
                const catalogVersion = await readJsObjectFromFile(
                    catalogVersionPath
                );
                catalogVersion.lastModified = new Date(
                    catalogVersion.lastModified
                );
                return catalogVersion;
            } catch (err) {
                console.error(err);
            }
        }
        return undefined;
    }

    async checkNewVersionOfCatalog() {
        try {
            const catalogVersion = await this.downloadCatalogVersion();

            if (
                !this.catalogVersion ||
                catalogVersion.lastModified > this.catalogVersion.lastModified
            ) {
                runInAction(() => (this.catalogVersion = catalogVersion));
                this.downloadCatalog();
            } else {
                // no new version
                return false;
            }
        } catch (error) {
            console.error(error);
            notification.error(
                `Failed to download eez-project examples catalog version`
            );
        }

        return true;
    }

    downloadCatalogVersion() {
        return new Promise<ICatalogVersion>((resolve, reject) => {
            var req = new XMLHttpRequest();
            req.responseType = "json";
            req.open("GET", CATALOG_VERSION_DOWNLOAD_URL);

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
                    "Failed to download catalog-version.json for eez-project examples",
                    error
                );
                reject(error);
            });

            req.send();
        });
    }

    downloadCatalog() {
        console.log("downloadCatalog");

        var req = new XMLHttpRequest();
        req.responseType = "arraybuffer";
        req.open("GET", CATALOG_DOWNLOAD_URL);

        const progressToastId = notification.info(
            "Downloading eez-project examples catalog ...",
            {
                autoClose: false,
                hideProgressBar: false
            }
        );

        req.addEventListener("progress", event => {
            notification.update(progressToastId, {
                render: event.total
                    ? `Downloading eez-project examples catalog: ${event.loaded} of ${event.total}`
                    : `Downloading eez-project examples catalog: ${event.loaded}`
            });
        });

        req.addEventListener("load", async () => {
            const decompress = require("decompress");

            const files = await decompress(Buffer.from(req.response));

            const catalog = JSON.parse(files[0].data);

            runInAction(() => {
                this.catalog = catalog;
            });

            if (this.onNewCatalog) {
                this.onNewCatalog();
            }

            await writeJsObjectToFile(this.catalogPath, this.catalog);

            notification.update(progressToastId, {
                type: notification.SUCCESS,
                render: `The latest eez-project examples catalog successfully downloaded.`,
                autoClose: 5000
            });
        });

        req.addEventListener("error", error => {
            console.error("eez-project examples catalog download error", error);
            notification.update(progressToastId, {
                type: notification.ERROR,
                render: `Failed to download eez-project examples catalog.`,
                autoClose: 5000
            });
        });

        req.send();
    }
}

export const examplesCatalog = new ExamplesCatalog();
