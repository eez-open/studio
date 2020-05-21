import { observable, computed, toJS, reaction, runInAction, action, autorun } from "mobx";

import { InstrumentObject } from "instrument/instrument-object";
import { getConnection, Connection } from "instrument/window/connection";
import { InstrumentAppStore } from "instrument/window/app-store";

import { compareVersions } from "eez-studio-shared/util";
import { FIRMWARE_RELEASES_URL } from "instrument/bb3/conf";
import { removeQuotes } from "instrument/bb3/helpers";
import { Script } from "instrument/bb3/objects/Script";
import { ScriptsCatalog } from "instrument/bb3/objects/ScriptsCatalog";

import { IHistoryItem } from "instrument/window/history/item";

////////////////////////////////////////////////////////////////////////////////

interface IMcu {
    firmwareVersion: string;
}

interface ISlot {
    model: string;
    version: string;
}

type ISlots = (ISlot | undefined)[];

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
                    bb3Instrument.latestFirmwareVersion = latestRealeaseVersion;
                });
            } else {
                console.error("not found latest release version");

                runInAction(() => {
                    bb3Instrument.latestFirmwareVersion = undefined;
                });
            }
        }
    });

    req.addEventListener("error", error => {
        console.error(error);

        runInAction(() => {
            bb3Instrument.latestFirmwareVersion = undefined;
        });
    });

    req.send();
}

async function getModulesInfoFromInstrument(connection: Connection) {
    let slots: ISlots = [];
    const numChannels = await connection.query("SYST:CHAN?");
    for (let i = 0; i < numChannels; i++) {
        connection.command("INST CH" + (i + 1));
        const slotIndex = await connection.query("SYST:CHAN:SLOT?");
        const model = removeQuotes(await connection.query("SYST:CHAN:MOD?"));
        const version = removeQuotes(await connection.query("SYST:CHAN:VERS?"));
        slots[slotIndex - 1] = {
            model,
            version
        };
    }
    return slots;
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

    @observable mcu: IMcu;
    @observable slots: ISlots;
    @observable scripts: Script[];

    // UI state
    @observable selectedScriptsCollectionType: ScriptsCollectionType;
    @observable refreshInProgress: boolean = false;
    @observable installAllScriptsInProgress: boolean = false;

    @observable latestFirmwareVersion: string | undefined;

    @observable latestHistoryItem: IHistoryItem | undefined;

    constructor(
        public scriptsCatalog: ScriptsCatalog,
        public appStore: InstrumentAppStore,
        instrument: InstrumentObject
    ) {
        const bb3Properties = instrument.custom[BB3Instrument.CUSTOM_PROPERTY_NAME];

        if (bb3Properties?.mcu) {
            this.mcu = bb3Properties.mcu;
        } else {
            this.mcu = {
                firmwareVersion: ""
            };
        }

        if (bb3Properties?.slots) {
            this.slots = bb3Properties.slots;
        } else {
            this.slots = [];
        }

        if (bb3Properties?.scriptsOnInstrument) {
            this.refreshScripts(bb3Properties.scriptsOnInstrument);
        } else {
            this.scripts = [];
        }

        this.selectedScriptsCollectionType = "allScriptsCollection";

        reaction(
            () => ({
                mcu: toJS(this.mcu),
                slots: toJS(this.slots),
                scriptsOnInstrument: toJS(this.scriptsOnInstrument)
            }),
            state => {
                instrument.setCustomProperty(BB3Instrument.CUSTOM_PROPERTY_NAME, state);
            }
        );

        autorun(() => {
            if (getConnection(appStore).isConnected) {
                setTimeout(() => this.refresh(), 100);
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
                        console.log(this.latestHistoryItem);
                    });
                }
            }
        });
    }

    @action setRefreshInProgress(value: boolean) {
        this.refreshInProgress = value;
    }

    async refresh() {
        if (this.refreshInProgress) {
            return;
        }

        this.setRefreshInProgress(true);
        try {
            findLatestFirmwareReleases(this);

            this.scriptsCatalog.load();

            /////

            const connection = getConnection(this.appStore);
            if (!connection.isConnected) {
                return;
            }

            connection.acquire(false);

            const firmwareVersion = removeQuotes(await connection.query("SYST:CPU:FIRM?"));
            const slots = await getModulesInfoFromInstrument(connection);
            const scriptsOnInstrument = await getScriptsOnTheInstrument(
                connection,
                this.scriptsOnInstrument
            );

            connection.release();

            /////

            runInAction(() => {
                this.mcu.firmwareVersion = firmwareVersion;
                this.slots = slots;
            });

            this.refreshScripts(scriptsOnInstrument);
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
