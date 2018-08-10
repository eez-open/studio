import { observable, computed, action } from "mobx";

import { IExtension } from "shared/extensions/extension";

const DEFAULT_EXTENSIONS_CATALOG_DOWNLOAD_URL =
    "https://github.com/eez-open/studio/raw/master/extensions/catalog.json";

enum ExtensionsCatalogStatus {
    EMPTY,
    DOWNLOADING,
    DOWNLOAD_SUCCESS,
    DOWNLOAD_ERROR
}

class ExtensionsCatalog {
    @observable
    status: ExtensionsCatalogStatus = ExtensionsCatalogStatus.EMPTY;

    @observable
    catalog: IExtension[] = [];

    @action
    download() {
        this.status = ExtensionsCatalogStatus.DOWNLOADING;

        fetch(DEFAULT_EXTENSIONS_CATALOG_DOWNLOAD_URL)
            .then(response => response.json())
            .then(
                action((catalog: any) => {
                    console.log("ExtensionsCatalog download success", catalog);
                    this.catalog = catalog;
                    this.status = ExtensionsCatalogStatus.DOWNLOAD_SUCCESS;
                })
            )
            .catch(
                action((reason: any) => {
                    console.error("ExtensionsCatalog download error", reason);
                    this.catalog = [];
                    this.status = ExtensionsCatalogStatus.DOWNLOAD_ERROR;
                })
            );
    }

    @computed
    get isDownloadFinished() {
        return (
            this.status === ExtensionsCatalogStatus.DOWNLOAD_SUCCESS ||
            this.status === ExtensionsCatalogStatus.DOWNLOAD_ERROR
        );
    }
}

export const extensionsCatalog = new ExtensionsCatalog();
