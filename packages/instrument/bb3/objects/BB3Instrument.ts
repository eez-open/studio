import { observable, computed, reaction, runInAction, action, autorun, toJS } from "mobx";

import { InstrumentObject } from "instrument/instrument-object";
import { getConnection, Connection } from "instrument/window/connection";
import { InstrumentAppStore } from "instrument/window/app-store";

import { compareVersions } from "eez-studio-shared/util";
import { FIRMWARE_RELEASES_URL, MODULE_FIRMWARE_RELEASES_URL } from "instrument/bb3/conf";
import { removeQuotes } from "instrument/bb3/helpers";
import { Module, ModuleFirmwareRelease } from "instrument/bb3/objects/Module";
import {
    Script,
    IScriptOnInstrument,
    getScriptsOnTheInstrument
} from "instrument/bb3/objects/Script";
import { ScriptsCatalog } from "instrument/bb3/objects/ScriptsCatalog";
import { List, IListOnInstrument, getListsOnTheInstrument } from "instrument/bb3/objects/List";

import { IHistoryItem } from "instrument/window/history/item";

////////////////////////////////////////////////////////////////////////////////

interface IMcu {
    firmwareVersion: string | undefined;
    latestFirmwareVersion: string | undefined;
}

////////////////////////////////////////////////////////////////////////////////

function findLatestFirmwareReleases(bb3Instrument: BB3Instrument) {
    let req = new XMLHttpRequest();
    req.responseType = "json";
    req.open("GET", FIRMWARE_RELEASES_URL);

    req.addEventListener("load", async () => {
        if (Array.isArray(req.response)) {
            let latestRealeaseVersion: string | undefined = undefined;
            for (const release of req.response) {
                if (typeof release.tag_name == "string") {
                    if (
                        !latestRealeaseVersion ||
                        compareVersions(release.tag_name, latestRealeaseVersion) > 1
                    ) {
                        latestRealeaseVersion = release.tag_name;
                    }
                }
            }

            if (latestRealeaseVersion) {
                runInAction(() => {
                    bb3Instrument.mcu.latestFirmwareVersion = latestRealeaseVersion;
                });
            } else {
                console.error("not found latest release version");
            }
        }
    });

    req.addEventListener("error", error => {
        console.error(error);
    });

    req.send();
}

function getModuleFirmwareReleases(moduleType: string) {
    return new Promise<ModuleFirmwareRelease[]>((resolve, reject) => {
        // TODO this is exception, DCM224 shares the same repository with DCM220,
        //      in the future this could be changed
        if (moduleType.toUpperCase() == "DCM224") {
            moduleType = "DCM220";
        }

        let req = new XMLHttpRequest();
        req.responseType = "json";
        req.open("GET", MODULE_FIRMWARE_RELEASES_URL(moduleType));

        req.addEventListener("load", async () => {
            if (Array.isArray(req.response)) {
                resolve(
                    req.response.map((release: any) => ({
                        version: release.tag_name.startsWith("v")
                            ? release.tag_name.substr(1)
                            : release.tag_name,
                        url: release.assets[0].browser_download_url
                    }))
                );
            } else {
                // TODO better error handling
                resolve([]);
            }
        });

        req.addEventListener("error", error => {
            console.error(error);
            // TODO better error handling
            resolve([]);
        });

        req.send();
    });
}

async function getModulesInfoFromInstrument(
    bb3Instrument: BB3Instrument,
    firmwareVersion: string,
    connection: Connection,
    forceRefresh: boolean
) {
    let modules: Module[] = [];

    if (compareVersions(firmwareVersion, "1.0") > 0) {
        const numSlots = await connection.query("SYST:SLOT?");
        for (let i = 0; i < numSlots; i++) {
            const moduleType = removeQuotes(await connection.query(`SYST:SLOT:MOD? ${i + 1}`));
            if (moduleType) {
                const moduleRevision = removeQuotes(
                    await connection.query(`SYST:SLOT:VERS? ${i + 1}`)
                );
                const firmwareVersion = removeQuotes(
                    await connection.query(`SYST:SLOT:FIRM? ${i + 1}`)
                );

                let allReleases: ModuleFirmwareRelease[];
                if (bb3Instrument.isTimeForRefresh || forceRefresh) {
                    allReleases = await getModuleFirmwareReleases(moduleType);
                } else {
                    const module = bb3Instrument.modules?.find(
                        module =>
                            module.moduleType == moduleType &&
                            module.allReleases &&
                            module.allReleases.length > 0
                    );
                    if (module) {
                        allReleases = module.allReleases;
                    } else {
                        allReleases = [];
                    }
                }

                modules.push(
                    new Module(
                        bb3Instrument,
                        i + 1,
                        moduleType,
                        moduleRevision,
                        firmwareVersion,
                        allReleases
                    )
                );
            }
        }
    }

    return modules;
}

////////////////////////////////////////////////////////////////////////////////

type ScriptsCollectionType =
    | "allScriptsCollection"
    | "catalogScriptsCollection"
    | "instrumentScriptsCollection"
    | "notInstalledCatalogScriptsCollection"
    | "installedCatalogScriptsCollection"
    | "instrumentScriptsNotInCatalogCollection";

export class BB3Instrument {
    static CUSTOM_PROPERTY_NAME = "bb3";

    @observable timeOfLastRefresh: Date | undefined;
    @observable mcu: IMcu;
    @observable modules: Module[] | undefined;
    @observable scripts: Script[];
    @observable lists: List[];

    // UI state
    @observable selectedScriptsCollectionType: ScriptsCollectionType;
    @observable refreshInProgress: boolean = false;
    @observable busy: boolean = false;

    @observable latestHistoryItem: IHistoryItem | undefined;

    @observable scriptsOnInstrumentFetchError: boolean = false;
    @observable listsOnInstrumentFetchError: boolean = false;

    constructor(
        public scriptsCatalog: ScriptsCatalog,
        public appStore: InstrumentAppStore,
        instrument: InstrumentObject
    ) {
        const bb3Properties = instrument.custom[BB3Instrument.CUSTOM_PROPERTY_NAME];

        if (bb3Properties?.timeOfLastRefresh) {
            this.timeOfLastRefresh = new Date(bb3Properties.timeOfLastRefresh);
        } else {
            this.timeOfLastRefresh = undefined;
        }

        if (bb3Properties?.mcu) {
            this.mcu = bb3Properties.mcu;
        } else {
            this.mcu = {
                firmwareVersion: undefined,
                latestFirmwareVersion: undefined
            };
        }

        if (bb3Properties?.modules) {
            this.modules = bb3Properties.modules.map(
                (module: Module) =>
                    new Module(
                        this,
                        module.slotIndex,
                        module.moduleType,
                        module.moduleRevision,
                        module.firmwareVersion,
                        module.allReleases || []
                    )
            );
        } else {
            this.modules = [];
        }

        this.refreshScripts(bb3Properties?.scriptsOnInstrument ?? []);
        reaction(
            () => scriptsCatalog.scriptItems,
            state => {
                this.refreshScripts(this.scriptsOnInstrument);
            }
        );

        this.selectedScriptsCollectionType = "allScriptsCollection";

        this.refreshLists(bb3Properties?.listsOnInstrument ?? []);
        reaction(
            () => this.appStore.instrumentLists.map(list => list.name),
            () => {
                this.refreshLists(this.listsOnInstrument);
            }
        );

        reaction(
            () => ({
                timeOfLastRefresh: this.timeOfLastRefresh,
                mcu: toJS(this.mcu),
                modules: this.modules
                    ? this.modules.map(module => ({
                          slotIndex: module.slotIndex,
                          moduleType: module.moduleType,
                          moduleRevision: module.moduleRevision,
                          firmwareVersion: module.firmwareVersion,
                          allReleases: module.allReleases.map(release => toJS(release))
                      }))
                    : [],
                scriptsOnInstrument: toJS(this.scriptsOnInstrument),
                listsOnInstrument: toJS(this.listsOnInstrument)
            }),
            state => {
                instrument.setCustomProperty(BB3Instrument.CUSTOM_PROPERTY_NAME, state);
            }
        );

        autorun(() => {
            if (getConnection(appStore).isConnected) {
                setTimeout(() => this.refresh(false), 50);
            }
        });

        autorun(() => {
            if (appStore.history.items.length > 0) {
                const historyItem = appStore.history.items[appStore.history.items.length - 1];
                if (!this.latestHistoryItem || historyItem.date >= this.latestHistoryItem.date) {
                    runInAction(() => {
                        this.latestHistoryItem = historyItem;
                    });
                }
            }
        });
    }

    @action setRefreshInProgress(value: boolean) {
        this.refreshInProgress = value;
    }

    get isTimeForRefresh() {
        const CONF_REFRESH_EVERY_MS = 24 * 60 * 60 * 1000;
        return (
            !this.timeOfLastRefresh ||
            new Date().getTime() - this.timeOfLastRefresh.getTime() > CONF_REFRESH_EVERY_MS
        );
    }

    async refresh(forceRefresh: boolean) {
        if (this.refreshInProgress) {
            return;
        }

        this.setRefreshInProgress(true);
        try {
            if (forceRefresh || this.isTimeForRefresh) {
                findLatestFirmwareReleases(this);
            }

            this.scriptsCatalog.load();

            /////

            const connection = getConnection(this.appStore);
            if (!connection.isConnected) {
                return;
            }

            connection.acquire(false);

            let firmwareVersion: string | undefined;
            let modules: Module[] | undefined;
            let scriptsOnInstrument: IScriptOnInstrument[] | undefined;
            let listsOnInstrument: IListOnInstrument[] | undefined;

            try {
                firmwareVersion = removeQuotes(await connection.query("SYST:CPU:FIRM?"));
            } catch (err) {
                console.error("failed to get firmware version", err);
            }

            if (firmwareVersion) {
                try {
                    modules = await getModulesInfoFromInstrument(
                        this,
                        firmwareVersion,
                        connection,
                        forceRefresh
                    );
                } catch (err) {
                    console.error("failed to get slots info", err);
                }

                try {
                    scriptsOnInstrument = await getScriptsOnTheInstrument(
                        connection,
                        this.scriptsOnInstrument
                    );
                } catch (err) {
                    console.error("failed to get scripts on the instrument info", err);
                }

                try {
                    listsOnInstrument = await getListsOnTheInstrument(connection);
                } catch (err) {
                    console.error("failed to get lists on the instrument info", err);
                }
            }

            connection.release();

            /////

            runInAction(() => {
                this.timeOfLastRefresh = new Date();
                this.mcu.firmwareVersion = firmwareVersion;
                this.modules = modules;
                this.scriptsOnInstrumentFetchError = !scriptsOnInstrument;
                this.listsOnInstrumentFetchError = !listsOnInstrument;
            });

            if (scriptsOnInstrument) {
                this.refreshScripts(scriptsOnInstrument);
            }

            if (listsOnInstrument) {
                this.refreshLists(listsOnInstrument);
            }
        } finally {
            this.setRefreshInProgress(false);
        }
    }

    @action
    refreshScripts(scriptsOnInstrument: IScriptOnInstrument[]) {
        const scripts: Script[] = [];

        if (this.scriptsCatalog.scriptItems) {
            for (let catalogScriptItem of this.scriptsCatalog.scriptItems) {
                const script = this.scripts.find(
                    script => script.catalogScriptItem == catalogScriptItem
                );
                if (script) {
                    scripts.push(script);
                    script.scriptOnInstrument = undefined;
                } else {
                    scripts.push(new Script(this, undefined, catalogScriptItem));
                }
            }
        }

        for (let scriptOnInstrument of scriptsOnInstrument) {
            const script = scripts.find(
                script => script.catalogScriptItem?.name == scriptOnInstrument.name
            );

            if (script) {
                script.scriptOnInstrument = scriptOnInstrument;
            } else {
                scripts.push(new Script(this, scriptOnInstrument, undefined));
            }
        }

        this.scripts = scripts;
    }

    @computed
    get scriptsOnInstrument() {
        return this.scripts
            .filter(script => !!script.scriptOnInstrument)
            .map(script => script.scriptOnInstrument) as IScriptOnInstrument[];
    }

    @computed
    get allScriptsCollection() {
        return this.scripts;
    }

    @computed
    get catalogScriptsCollection() {
        return this.scripts.filter(script => script.catalogScriptItem);
    }

    @computed
    get instrumentScriptsCollection() {
        return this.scripts.filter(script => script.scriptOnInstrument);
    }

    @computed
    get notInstalledCatalogScriptsCollection() {
        return this.scripts.filter(
            script => script.catalogScriptItem && !script.scriptOnInstrument
        );
    }

    @computed
    get installedCatalogScriptsCollection() {
        return this.scripts.filter(script => script.catalogScriptItem && script.scriptOnInstrument);
    }

    @computed
    get instrumentScriptsNotInCatalogCollection() {
        return this.scripts.filter(
            script => !script.catalogScriptItem && script.scriptOnInstrument
        );
    }

    @computed
    get selectedScriptsCollection() {
        return this[this.selectedScriptsCollectionType];
    }

    @computed get canInstallAllScripts() {
        return this.notInstalledCatalogScriptsCollection.length >= 2 && !this.busy;
    }

    @action setBusy(value: boolean) {
        this.busy = value;
    }

    installAllScripts = async () => {
        if (this.canInstallAllScripts) {
            this.setBusy(true);
            try {
                for (const script of this.notInstalledCatalogScriptsCollection) {
                    await script.install();
                }
            } finally {
                this.setBusy(false);
            }
        }
    };

    @action
    refreshLists(listsOnInstrument: IListOnInstrument[]) {
        const lists: List[] = [];

        for (let studioList of this.appStore.instrumentLists) {
            const list = this.lists.find(list => list.studioList == studioList);
            if (list) {
                lists.push(list);
                list.listOnInstrument = undefined;
            } else {
                lists.push(new List(this, undefined, studioList));
            }
        }

        for (let listOnInstrument of listsOnInstrument) {
            const list = lists.find(list => list.studioList?.name == listOnInstrument.name);
            if (list) {
                list.listOnInstrument = listOnInstrument;
            } else {
                lists.push(new List(this, listOnInstrument, undefined));
            }
        }

        this.lists = lists;
    }

    @computed
    get listsOnInstrument() {
        return this.lists
            .filter(list => !!list.listOnInstrument)
            .map(list => list.listOnInstrument) as IListOnInstrument[];
    }

    @computed
    get canDownloadAllLists() {
        return !this.busy && this.lists.filter(list => list.instrumentVersionNewer).length > 1;
    }

    downloadAllLists = async () => {
        if (this.canDownloadAllLists) {
            this.setBusy(true);
            try {
                for (const list of this.lists) {
                    if (list.instrumentVersionNewer) {
                        await list.download();
                    }
                }
            } finally {
                this.setBusy(false);
            }
        }
    };

    @computed
    get canUploadAllLists() {
        return !this.busy && this.lists.filter(list => list.studioVersionNewer).length > 1;
    }

    uploadAllLists = async () => {
        if (this.canUploadAllLists) {
            this.setBusy(true);
            try {
                for (const list of this.lists) {
                    if (list.studioVersionNewer) {
                        await list.upload();
                    }
                }

                this.setBusy(false);
            } finally {
                this.setBusy(false);
            }
        }
    };
}
