import { observable, computed, action, runInAction } from "mobx";

import { compareVersions } from "eez-studio-shared/util";

import { getConnection, Connection } from "instrument/window/connection";

import { BB3Instrument } from "instrument/bb3/objects/BB3Instrument";
import {
    ICatalogScriptItem,
    ICatalogScriptItemVersion
} from "instrument/bb3/objects/ScriptsCatalog";

interface IScriptOnInstrument {
    name: string;
    version: string | undefined;
    files: string[];
}

interface IScriptFile {
    fileName: string;
    fileData: string | ArrayBuffer;
}

function fetchScriptFiles(catalogScriptItemVersion: ICatalogScriptItemVersion) {
    return Promise.all(
        catalogScriptItemVersion.files.map(
            fileUri =>
                new Promise<IScriptFile>((resolve, reject) => {
                    let req = new XMLHttpRequest();
                    req.responseType = "blob";
                    req.open("GET", fileUri);

                    req.addEventListener("load", () => {
                        const decodedFileUri = decodeURIComponent(fileUri);
                        const lastPathSeparatorIndex = decodedFileUri.lastIndexOf("/");
                        const fileName = decodedFileUri.substr(lastPathSeparatorIndex + 1);

                        const reader = new FileReader();

                        reader.addEventListener("loadend", function () {
                            if (!reader.result) {
                                reject("no file data");
                            } else {
                                resolve({ fileName, fileData: reader.result });
                            }
                        });

                        reader.readAsArrayBuffer(req.response);
                    });

                    req.addEventListener("error", error => {
                        reject(error);
                    });

                    req.send();
                })
        )
    );
}

async function uploadScriptFilesToInstrument(connection: Connection, files: IScriptFile[]) {
    for (const file of files) {
        await new Promise((resolve, reject) => {
            const sourceFileType = file.fileName.toLowerCase().endsWith(".py")
                ? "text/x-python"
                : "application/octet-stream";

            const uploadInstructions = Object.assign(
                {},
                connection.instrument.defaultFileUploadInstructions,
                {
                    sourceData: file.fileData,
                    sourceFileType,
                    destinationFileName: file.fileName,
                    destinationFolderPath: "/Scripts"
                }
            );

            connection.upload(uploadInstructions, resolve, reject);
        });
    }
}

export class Script {
    @observable scriptOnInstrument: IScriptOnInstrument | undefined;
    @observable busy: boolean = false;

    // private
    @observable _selectedVersion: string | undefined;

    constructor(
        public bb3Instrument: BB3Instrument,
        scriptOnInstrument: IScriptOnInstrument | undefined,
        public catalogScriptItem: ICatalogScriptItem | undefined
    ) {
        this.scriptOnInstrument = scriptOnInstrument;
    }

    @computed
    get selectedVersion() {
        if (this._selectedVersion != undefined) {
            return this._selectedVersion;
        }

        if (this.scriptOnInstrument && this.scriptOnInstrument.version) {
            return this.scriptOnInstrument.version;
        } else if (this.catalogScriptItem) {
            return this.catalogScriptItem.versions[0].version;
        }

        return undefined;
    }

    set selectedVersion(value: string | undefined) {
        runInAction(() => {
            this._selectedVersion = value;
        });
    }

    @computed
    get name() {
        if (this.catalogScriptItem) {
            return this.catalogScriptItem.name;
        }
        return this.scriptOnInstrument!.name;
    }

    @computed
    get description() {
        if (this.catalogScriptItem) {
            return this.catalogScriptItem.description;
        }
        return "";
    }

    @computed
    get versions() {
        if (this.catalogScriptItem) {
            return this.catalogScriptItem.versions;
        }
        return undefined;
    }

    @computed
    get isInstalled() {
        return !!this.scriptOnInstrument;
    }

    @action setBusy(value: boolean) {
        this.busy = value;
    }

    @computed
    get canInstall() {
        return !this.isInstalled;
    }

    install = async () => {
        const catalogScriptItem = this.catalogScriptItem;
        if (!catalogScriptItem) {
            return;
        }

        const selectedVersion = this.selectedVersion;
        if (!selectedVersion) {
            return;
        }

        const catalogScriptItemVersion = catalogScriptItem.versions.find(
            version => version.version == selectedVersion
        );
        if (!catalogScriptItemVersion) {
            return;
        }

        const connection = getConnection(this.bb3Instrument.appStore);
        if (!connection.isConnected) {
            return;
        }

        this.setBusy(true);

        connection.acquire(true);

        try {
            const files = await fetchScriptFiles(catalogScriptItemVersion);

            await uploadScriptFilesToInstrument(connection, files);

            runInAction(() => {
                this.scriptOnInstrument = {
                    name: catalogScriptItem.name,
                    version: selectedVersion,
                    files: files.map(file => file.fileName)
                };
            });
        } catch (error) {
            console.error(error);
        }

        connection.release();

        this.setBusy(false);
    };

    @computed
    get canUninstall() {
        return this.isInstalled;
    }

    uninstall = () => {
        const scriptOnInstrument = this.scriptOnInstrument;
        if (!scriptOnInstrument) {
            return;
        }

        const connection = getConnection(this.bb3Instrument.appStore);
        if (!connection.isConnected) {
            return;
        }

        this.setBusy(true);

        connection.acquire(true);

        for (const file of scriptOnInstrument.files) {
            connection.command(`MMEM:DEL "/Scripts/${file}"`);
        }

        connection.release();

        runInAction(() => {
            this.scriptOnInstrument = undefined;
        });

        this.setBusy(false);
    };

    @computed
    get canUpdate() {
        return (
            this.scriptOnInstrument &&
            this.selectedVersion &&
            (!this.scriptOnInstrument.version ||
                compareVersions(this.scriptOnInstrument.version, this.selectedVersion) > 0)
        );
    }

    update = () => {};

    @computed
    get canReplace() {
        return (
            this.scriptOnInstrument &&
            this.selectedVersion &&
            this.scriptOnInstrument.version &&
            compareVersions(this.scriptOnInstrument.version, this.selectedVersion) < 0
        );
    }

    replace = () => {};
}
