import {
    observable,
    computed,
    reaction,
    runInAction,
    action,
    autorun,
    toJS
} from "mobx";

import { stringCompare } from "eez-studio-shared/string";

import { InstrumentObject } from "instrument/instrument-object";
import { getConnection, Connection } from "instrument/window/connection";
import { InstrumentAppStore } from "instrument/window/app-store";

import { compareVersions } from "eez-studio-shared/util";
import {
    FIRMWARE_RELEASES_URL,
    MODULE_FIRMWARE_RELEASES_URL,
    PINOUT_PAGES
} from "instrument/bb3/conf";
import {
    fetchFileUrl,
    removeQuotes,
    useConnection
} from "instrument/bb3/helpers";
import { Module, ModuleFirmwareRelease } from "instrument/bb3/objects/Module";
import {
    Script,
    IScriptOnInstrument,
    getScriptsOnTheInstrument
} from "instrument/bb3/objects/Script";
import { ScriptsCatalog } from "instrument/bb3/objects/ScriptsCatalog";
import {
    List,
    IListOnInstrument,
    getListsOnTheInstrument
} from "instrument/bb3/objects/List";

import { IHistoryItem } from "instrument/window/history/item";

import * as notification from "eez-studio-ui/notification";

////////////////////////////////////////////////////////////////////////////////

interface IMcu {
    firmwareVersion: string | undefined;
    allReleases:
        | {
              assets: {
                  browser_download_url: string;
                  name: string;
              }[];
              tag_name: string;
          }[]
        | undefined;
    latestFirmwareVersion: string | undefined;
}

////////////////////////////////////////////////////////////////////////////////

function findLatestFirmwareReleases(bb3Instrument: BB3Instrument) {
    let req = new XMLHttpRequest();
    req.responseType = "json";
    req.open("GET", FIRMWARE_RELEASES_URL);

    req.addEventListener("load", async () => {
        if (Array.isArray(req.response)) {
            let latestReleaseVersion: string | undefined = undefined;
            for (const release of req.response) {
                if (
                    !release.prerelease &&
                    typeof release.tag_name == "string"
                ) {
                    if (
                        !latestReleaseVersion ||
                        compareVersions(
                            release.tag_name,
                            latestReleaseVersion
                        ) > 0
                    ) {
                        latestReleaseVersion = release.tag_name;
                    }
                }
            }

            if (latestReleaseVersion) {
                runInAction(() => {
                    bb3Instrument.mcu.allReleases = req.response.filter(
                        (release: any) => !release.prerelease
                    );
                    bb3Instrument.mcu.latestFirmwareVersion =
                        latestReleaseVersion;
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
            const moduleType = removeQuotes(
                await connection.query(`SYST:SLOT:MOD? ${i + 1}`)
            );
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
    @observable scripts: Script[] = [];
    @observable lists: List[] = [];

    // UI state
    @observable selectedScriptsCollectionType: ScriptsCollectionType;
    @observable refreshInProgress: boolean = false;
    @observable busy: boolean = false;

    @observable latestHistoryItem: IHistoryItem | undefined;

    @observable scriptsOnInstrumentFetchError: boolean = false;
    @observable listsOnInstrumentFetchError: boolean = false;

    @observable isUploadingMasterFirmware: boolean = false;

    terminate: () => void;

    constructor(
        public scriptsCatalog: ScriptsCatalog,
        public appStore: InstrumentAppStore,
        public instrument: InstrumentObject
    ) {
        const bb3Properties =
            instrument.custom[BB3Instrument.CUSTOM_PROPERTY_NAME];

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
                allReleases: undefined,
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
        const dispose1 = reaction(
            () => scriptsCatalog.scriptItems,
            state => {
                this.refreshScripts(this.scriptsOnInstrument);
            }
        );

        this.selectedScriptsCollectionType = "allScriptsCollection";

        this.refreshLists(bb3Properties?.listsOnInstrument ?? []);
        const dispose2 = reaction(
            () => this.appStore.instrumentLists.map(list => list.name),
            () => {
                this.refreshLists(this.listsOnInstrument);
            }
        );

        const dispose3 = reaction(
            () => ({
                timeOfLastRefresh: this.timeOfLastRefresh,
                mcu: toJS(this.mcu),
                modules: this.modules
                    ? this.modules.map(module => ({
                          slotIndex: module.slotIndex,
                          moduleType: module.moduleType,
                          moduleRevision: module.moduleRevision,
                          firmwareVersion: module.firmwareVersion,
                          allReleases: module.allReleases.map(release =>
                              toJS(release)
                          )
                      }))
                    : [],
                scriptsOnInstrument: toJS(this.scriptsOnInstrument),
                listsOnInstrument: toJS(this.listsOnInstrument)
            }),
            state => {
                instrument.setCustomProperty(
                    BB3Instrument.CUSTOM_PROPERTY_NAME,
                    state
                );
            }
        );

        const dispose4 = autorun(() => {
            if (getConnection(appStore).isConnected) {
                setTimeout(() => this.refresh(false), 50);
            }
        });

        const dispose5 = autorun(() => {
            if (appStore.history.items.length > 0) {
                const historyItem =
                    appStore.history.items[appStore.history.items.length - 1];
                const latestHistoryItem = this.latestHistoryItem;
                if (
                    !latestHistoryItem ||
                    latestHistoryItem.deleted ||
                    latestHistoryItem.id == historyItem.id ||
                    appStore.deletedItemsHistory.items.find(
                        historyItem => latestHistoryItem.id == historyItem.id
                    ) ||
                    historyItem.date >= latestHistoryItem.date
                ) {
                    runInAction(() => {
                        this.latestHistoryItem = historyItem;
                    });
                }
            }
        });

        this.terminate = () => {
            dispose1();
            dispose2();
            dispose3();
            dispose4();
            dispose5();
        };
    }

    @action setRefreshInProgress(value: boolean) {
        this.refreshInProgress = value;
    }

    get isTimeForRefresh() {
        // const CONF_REFRESH_EVERY_MS = 24 * 60 * 60 * 1000;
        // return (
        //     !this.timeOfLastRefresh ||
        //     new Date().getTime() - this.timeOfLastRefresh.getTime() >
        //         CONF_REFRESH_EVERY_MS
        // );
        return true;
    }

    async refresh(forceRefresh: boolean) {
        if (this.refreshInProgress) {
            return;
        }

        await useConnection(
            {
                bb3Instrument: this,
                setBusy: (value: boolean) => {
                    this.setRefreshInProgress(value);
                    runInAction(() => {
                        this.setBusy(value);
                    });
                }
            },
            async connection => {
                if (forceRefresh || this.isTimeForRefresh) {
                    findLatestFirmwareReleases(this);
                }

                this.scriptsCatalog.load();

                let firmwareVersion: string | undefined;
                let modules: Module[] | undefined;
                let scriptsOnInstrument: IScriptOnInstrument[] | undefined;
                let listsOnInstrument: IListOnInstrument[] | undefined;

                try {
                    firmwareVersion = removeQuotes(
                        await connection.query("SYST:CPU:FIRM?")
                    );
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
                        console.error(
                            "failed to get scripts on the instrument info",
                            err
                        );
                    }

                    try {
                        listsOnInstrument = await getListsOnTheInstrument(
                            connection
                        );
                    } catch (err) {
                        console.error(
                            "failed to get lists on the instrument info",
                            err
                        );
                    }
                }
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
            },
            false
        );
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
                    scripts.push(
                        new Script(this, undefined, catalogScriptItem)
                    );
                }
            }
        }

        for (let scriptOnInstrument of scriptsOnInstrument) {
            const script = scripts.find(
                script =>
                    script.catalogScriptItem?.name == scriptOnInstrument.name
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
        return this.scripts
            .slice()
            .sort((a, b) => stringCompare(a.name, b.name));
    }

    @computed
    get catalogScriptsCollection() {
        return this.allScriptsCollection.filter(
            script => script.catalogScriptItem
        );
    }

    @computed
    get instrumentScriptsCollection() {
        return this.allScriptsCollection.filter(
            script => script.scriptOnInstrument
        );
    }

    @computed
    get notInstalledCatalogScriptsCollection() {
        return this.allScriptsCollection.filter(
            script => script.catalogScriptItem && !script.scriptOnInstrument
        );
    }

    @computed
    get installedCatalogScriptsCollection() {
        return this.allScriptsCollection.filter(
            script => script.catalogScriptItem && script.scriptOnInstrument
        );
    }

    @computed
    get instrumentScriptsNotInCatalogCollection() {
        return this.allScriptsCollection.filter(
            script => !script.catalogScriptItem && script.scriptOnInstrument
        );
    }

    @computed
    get selectedScriptsCollection() {
        return this[this.selectedScriptsCollectionType];
    }

    @computed get canInstallAllScripts() {
        return (
            this.notInstalledCatalogScriptsCollection.length > 0 && !this.busy
        );
    }

    @action setBusy(value: boolean) {
        this.busy = value;
    }

    installAllScripts = async () => {
        if (this.canInstallAllScripts) {
            this.setBusy(true);
            try {
                for (const script of this
                    .notInstalledCatalogScriptsCollection) {
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
            const list = lists.find(
                list => list.studioList?.name == listOnInstrument.name
            );
            if (list) {
                list.listOnInstrument = listOnInstrument;
            } else {
                lists.push(new List(this, listOnInstrument, undefined));
            }
        }

        this.lists = lists;
    }

    @computed
    get sortedLists() {
        return this.lists
            .slice()
            .sort((a, b) => stringCompare(a.baseName, b.baseName));
    }

    @computed
    get listsOnInstrument() {
        return this.lists
            .filter(list => !!list.listOnInstrument)
            .map(list => list.listOnInstrument) as IListOnInstrument[];
    }

    @computed
    get canDownloadAllLists() {
        return (
            !this.busy &&
            this.lists.filter(
                list => list.instrumentVersionNewer || !list.studioList
            ).length > 0
        );
    }

    downloadAllLists = async () => {
        if (this.canDownloadAllLists) {
            this.setBusy(true);
            try {
                for (const list of this.sortedLists) {
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
        return (
            !this.busy &&
            this.lists.filter(
                list => list.studioVersionNewer || !list.listOnInstrument
            ).length > 0
        );
    }

    uploadAllLists = async () => {
        if (this.canUploadAllLists) {
            this.setBusy(true);
            try {
                for (const list of this.sortedLists) {
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

    async pngToJpg(url: string) {
        return new Promise<ArrayBuffer>((resolve, reject) => {
            const img = new Image();

            img.onload = () => {
                const canvas = document.createElement("canvas");
                const ctx = canvas.getContext("2d")!;
                canvas.height = img.naturalHeight;
                canvas.width = img.naturalWidth;
                ctx.drawImage(img, 0, 0);
                canvas.toBlob(
                    blob => {
                        resolve(blob!.arrayBuffer());
                    },
                    "image/jpeg",
                    1.0
                );
            };

            img.onerror = err => {
                console.error(err);
                reject(`Failed to load pinout image from "${url}"!`);
            };

            img.src = url;
        });
    }

    uploadPinoutPages = async () => {
        await useConnection(
            {
                bb3Instrument: this,
                setBusy: action((value: boolean) => {
                    runInAction(() => {
                        this.setBusy(value);
                    });
                })
            },
            async connection => {
                const rootFolders = await connection.query("MMEM:CAT?");
                if (rootFolders.indexOf(`"Docs,FOLD,0"`) === -1) {
                    await connection.command(`MMEM:MDIR "/Docs"`);
                }

                const progressToastId = notification.info(
                    "Uploading pinput pages ...",
                    {
                        autoClose: false,
                        hideProgressBar: false
                    }
                );

                for (let i = 0; i < PINOUT_PAGES.length; i++) {
                    notification.update(progressToastId, {
                        render: `Downloading ${PINOUT_PAGES[i].fileName}...`
                    });

                    const image = await this.pngToJpg(PINOUT_PAGES[i].url);

                    const uploadInstructions = Object.assign(
                        {},
                        connection.instrument.defaultFileUploadInstructions,
                        {
                            sourceData: image,
                            sourceFileType: "application/octet-stream",
                            destinationFileName: PINOUT_PAGES[i].fileName,
                            destinationFolderPath: "/Docs"
                        }
                    );

                    notification.update(progressToastId, {
                        render: `Uploading ${PINOUT_PAGES[i].fileName} ...`
                    });

                    await new Promise<void>((resolve, reject) =>
                        connection.upload(uploadInstructions, resolve, reject)
                    );
                }

                notification.update(progressToastId, {
                    type: notification.SUCCESS,
                    render: `Done.`,
                    autoClose: 1000
                });
            },
            false
        );
    };

    upgradeMasterFirmwareWithLocalFile = async () => {
        const result = await EEZStudio.remote.dialog.showOpenDialog(
            EEZStudio.remote.getCurrentWindow(),
            {
                properties: ["openFile"],
                filters: [
                    { name: "SREC files", extensions: ["srec"] },
                    { name: "All Files", extensions: ["*"] }
                ]
            }
        );
        const filePaths = result.filePaths;
        if (filePaths && filePaths[0]) {
            await useConnection(
                {
                    bb3Instrument: this,
                    setBusy: action((value: boolean) => {
                        this.isUploadingMasterFirmware = value;
                        this.setBusy(value);
                    })
                },
                async connection => {
                    const toastId = notification.info(
                        "Sending firmware file to the BB3, please wait ...",
                        {
                            autoClose: false
                        }
                    );

                    try {
                        await new Promise<void>((resolve, reject) => {
                            const uploadInstructions = Object.assign(
                                {},
                                connection.instrument
                                    .defaultFileUploadInstructions,
                                {
                                    sourceFilePath: filePaths[0],
                                    destinationFileName: "_o.s",
                                    destinationFolderPath: "/"
                                }
                            );

                            connection.upload(
                                uploadInstructions,
                                resolve,
                                reject
                            );
                        });

                        connection.command(`:MMEM:MOVE "/_o.s", "/o.s"`);

                        notification.update(toastId, {
                            type: notification.INFO,
                            render: `Restarting BB3...`,
                            autoClose: 1000
                        });

                        connection.command(":SYST:DEL 1000; :SYST:RES");

                        notification.update(toastId, {
                            type: notification.SUCCESS,
                            render: `Loading continues on the BB3 ...`,
                            autoClose: 1000
                        });
                    } catch (err) {
                        notification.update(toastId, {
                            type: notification.ERROR,
                            render: err.toString(),
                            autoClose: 1000
                        });
                    }
                },
                false
            );
        }
    };

    async upgradeMasterFirmwareToVersion(selectedFirmwareVersion: string) {
        const toastId = notification.info("Starting ...", {
            autoClose: false
        });

        const allReleases = this.mcu.allReleases;
        console.log(allReleases);
        if (!allReleases) {
            notification.update(toastId, {
                type: notification.ERROR,
                render: "Press Refresh button ...",
                autoClose: 1000
            });
            return;
        }

        const release = allReleases.find(
            release => release.tag_name == selectedFirmwareVersion
        );

        if (!release) {
            notification.update(toastId, {
                type: notification.ERROR,
                render: "Failed to obtain release informations from github.com ...",
                autoClose: 1000
            });
            return;
        }

        const asset = release.assets.find((asset: { name: string }) =>
            asset.name.endsWith(".srec")
        );

        if (!asset) {
            notification.update(toastId, {
                type: notification.ERROR,
                render: "Failed to obtain release asset informations from github.com ...",
                autoClose: 1000
            });
            return;
        }

        try {
            await useConnection(
                {
                    bb3Instrument: this,
                    setBusy: action((value: boolean) => {
                        this.isUploadingMasterFirmware = value;
                        this.setBusy(value);
                    })
                },
                async connection => {
                    try {
                        notification.update(toastId, {
                            type: notification.INFO,
                            render: "Downloading firmware file from the github.com, please wait ..."
                        });

                        const file = await fetchFileUrl(
                            asset.browser_download_url
                        );

                        notification.update(toastId, {
                            type: notification.INFO,
                            render: "Sending firmware file to the BB3, please wait ..."
                        });

                        await new Promise<void>((resolve, reject) => {
                            const uploadInstructions = Object.assign(
                                {},
                                connection.instrument
                                    .defaultFileUploadInstructions,
                                {
                                    sourceData: file.fileData,
                                    sourceFileType: "application/octet-stream",
                                    destinationFileName: "o.s",
                                    destinationFolderPath: "/"
                                }
                            );

                            connection.upload(
                                uploadInstructions,
                                resolve,
                                reject
                            );
                        });

                        notification.update(toastId, {
                            type: notification.INFO,
                            render: `Restarting BB3...`,
                            autoClose: 1000
                        });

                        connection.command(":SYST:DEL 1000; :SYST:RES");

                        notification.update(toastId, {
                            type: notification.SUCCESS,
                            render: `Loading continues on the BB3 ...`,
                            autoClose: 1000
                        });
                    } catch (err) {
                        notification.update(toastId, {
                            type: notification.ERROR,
                            render: err.toString(),
                            autoClose: 1000
                        });
                    }
                },
                true
            );
        } catch (err) {
            notification.update(toastId, {
                type: notification.ERROR,
                render: `Connection error: ${err.toString()}`,
                autoClose: 1000
            });
        }
    }
}
