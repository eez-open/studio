import { observable, computed, toJS, reaction, runInAction, action, autorun } from "mobx";

import { InstrumentObject } from "instrument/instrument-object";
import { getConnection, Connection } from "instrument/window/connection";
import { InstrumentAppStore } from "instrument/window/app-store";

import { compareVersions } from "eez-studio-shared/util";
import { FIRMWARE_RELEASES_URL, MODULE_FIRMWARE_RELEASES_URL } from "instrument/bb3/conf";
import { removeQuotes } from "instrument/bb3/helpers";
import { Module, ModuleFirmwareRelease } from "instrument/bb3/objects/Module";
import { Script } from "instrument/bb3/objects/Script";
import { ScriptsCatalog } from "instrument/bb3/objects/ScriptsCatalog";

import { IHistoryItem } from "instrument/window/history/item";

////////////////////////////////////////////////////////////////////////////////

interface IMcu {
    firmwareVersion: string | undefined;
    latestFirmwareVersion: string | undefined;
}

interface IScriptOnInstrument {
    name: string;
    version: string | undefined;
    files: string[];
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

async function getScriptsOnTheInstrument(
    connection: Connection,
    previousScriptsOnInstrument: IScriptOnInstrument[] | undefined
) {
    const filesInScriptsFolderAsOneString = await connection.query('MMEM:CAT? "/Scripts"');
    const filesInScriptsFolderAsArray = removeQuotes(filesInScriptsFolderAsOneString).split('","');

    const scripts: IScriptOnInstrument[] = [];

    filesInScriptsFolderAsArray.forEach(fileInfoLine => {
        const fileName = fileInfoLine.split(",")[0];
        if (fileName.toLowerCase().endsWith(".py")) {
            const scriptName = fileName.substring(0, fileName.length - 3);

            const previousScriptOnInstrument = previousScriptsOnInstrument
                ? previousScriptsOnInstrument.find(oldScript => oldScript.name == scriptName)
                : undefined;

            scripts.push({
                name: scriptName,
                version: previousScriptOnInstrument
                    ? previousScriptOnInstrument.version
                    : undefined,
                files: [fileName]
            });
        }
    });

    filesInScriptsFolderAsArray.forEach(fileInfoLine => {
        const fileName = fileInfoLine.split(",")[0];

        const indexOfExtension = fileName.indexOf(".");

        const fileNameWithoutExtension =
            indexOfExtension != -1 ? fileName.substr(0, indexOfExtension) : fileName;

        const script = scripts.find(script => script.name == fileNameWithoutExtension);

        if (script && script.files.indexOf(fileName) == -1) {
            script.files.push(fileName);
        }
    });

    return scripts;
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

    // UI state
    @observable selectedScriptsCollectionType: ScriptsCollectionType;
    @observable refreshInProgress: boolean = false;
    @observable installAllScriptsInProgress: boolean = false;

    @observable latestHistoryItem: IHistoryItem | undefined;

    @observable scriptsOnInstrumentFetchError: boolean = false;

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

        if (bb3Properties?.scriptsOnInstrument) {
            this.refreshScripts(bb3Properties.scriptsOnInstrument);
        } else {
            this.scripts = [];
        }

        this.selectedScriptsCollectionType = "allScriptsCollection";

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
                          allReleases: module.allReleases
                      }))
                    : [],
                scriptsOnInstrument: toJS(this.scriptsOnInstrument)
            }),
            state => {
                instrument.setCustomProperty(BB3Instrument.CUSTOM_PROPERTY_NAME, state);
            }
        );

        autorun(() => {
            if (getConnection(appStore).isConnected) {
                setTimeout(() => this.refresh(false), 100);
            }
        });

        reaction(
            () => scriptsCatalog.scriptItems,
            state => {
                this.refreshScripts(this.scriptsOnInstrument);
            }
        );

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
            }

            connection.release();

            /////

            runInAction(() => {
                this.timeOfLastRefresh = new Date();
                this.mcu.firmwareVersion = firmwareVersion;
                this.modules = modules;
            });

            if (scriptsOnInstrument) {
                this.scriptsOnInstrumentFetchError = false;
                this.refreshScripts(scriptsOnInstrument);
            } else {
                this.scriptsOnInstrumentFetchError = true;
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

        if (scriptsOnInstrument) {
            for (let scriptOnInstrument of scriptsOnInstrument) {
                const script = scripts.find(
                    script =>
                        script.catalogScriptItem &&
                        script.catalogScriptItem.name == scriptOnInstrument.name
                );

                if (script) {
                    script.scriptOnInstrument = scriptOnInstrument;
                } else {
                    scripts.push(new Script(this, scriptOnInstrument, undefined));
                }
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
        return (
            this.notInstalledCatalogScriptsCollection.length >= 2 &&
            !this.installAllScriptsInProgress
        );
    }

    @action setInstallAllScriptsInProgress(value: boolean) {
        this.installAllScriptsInProgress = value;
    }

    installAllScripts = async () => {
        if (this.canInstallAllScripts) {
            this.setInstallAllScriptsInProgress(true);

            for (const script of this.notInstalledCatalogScriptsCollection) {
                await script.install();
            }

            this.setInstallAllScriptsInProgress(false);
        }
    };
}
