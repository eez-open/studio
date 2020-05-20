import { observable, runInAction } from "mobx";

import { SCRIPTS_CATALOG_URL } from "instrument/bb3/conf";

export interface ICatalogScriptItemVersion {
    version: string;
    files: string[];
}

export interface ICatalogScriptItem {
    name: string;
    description: string;
    versions: ICatalogScriptItemVersion[];
}

export class ScriptsCatalog {
    @observable scriptItems: ICatalogScriptItem[] | undefined;
    @observable loadError: string | undefined;

    constructor() {}

    load() {
        let req = new XMLHttpRequest();
        req.responseType = "json";
        req.open("GET", SCRIPTS_CATALOG_URL);

        req.addEventListener("load", async () => {
            const scriptItems: ICatalogScriptItem[] = req.response;

            runInAction(() => {
                this.scriptItems = scriptItems;
                this.loadError = undefined;
            });
        });

        req.addEventListener("error", error => {
            console.error(error);

            runInAction(() => {
                this.scriptItems = undefined;
                this.loadError = error.toString();
            });
        });

        req.send();
    }
}
