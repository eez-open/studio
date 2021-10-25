import { observable, computed, action, runInAction } from "mobx";

import { compareVersions } from "eez-studio-shared/util";

import {
    fetchFileUrl,
    IFetchedFile,
    removeQuotes,
    useConnection
} from "instrument/bb3/helpers";
import { BB3Instrument } from "instrument/bb3/objects/BB3Instrument";
import {
    ICatalogScriptItem,
    ICatalogScriptItemVersion
} from "instrument/bb3/objects/ScriptsCatalog";
import { ConnectionBase } from "instrument/connection/connection-base";

export interface IScriptOnInstrument {
    name: string;
    version: string | undefined;
    files: string[];
}

export async function getScriptsOnTheInstrument(
    connection: ConnectionBase,
    previousScriptsOnInstrument: IScriptOnInstrument[] | undefined
) {
    const filesInFolderAsOneString = await connection.query(
        'MMEM:CAT? "/Scripts"'
    );
    const filesInFolderAsArray = removeQuotes(filesInFolderAsOneString).split(
        '","'
    );

    const scripts: IScriptOnInstrument[] = [];

    filesInFolderAsArray.forEach(fileInfoLine => {
        const fileName = fileInfoLine.split(",")[0];
        if (fileName.toLowerCase().endsWith(".py")) {
            const scriptName = fileName.substring(0, fileName.length - 3);

            const previousScriptOnInstrument = previousScriptsOnInstrument
                ? previousScriptsOnInstrument.find(
                      oldScript => oldScript.name == scriptName
                  )
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

    filesInFolderAsArray.forEach(fileInfoLine => {
        const fileName = fileInfoLine.split(",")[0];

        const indexOfExtension = fileName.indexOf(".");

        const fileNameWithoutExtension =
            indexOfExtension != -1
                ? fileName.substr(0, indexOfExtension)
                : fileName;

        const script = scripts.find(
            script => script.name == fileNameWithoutExtension
        );

        if (script && script.files.indexOf(fileName) == -1) {
            script.files.push(fileName);
        }
    });

    return scripts;
}

function fetchScriptFiles(catalogScriptItemVersion: ICatalogScriptItemVersion) {
    return Promise.all(catalogScriptItemVersion.files.map(fetchFileUrl));
}

async function uploadScriptFilesToInstrument(
    connection: ConnectionBase,
    files: IFetchedFile[]
) {
    for (const file of files) {
        await new Promise<void>((resolve, reject) => {
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

        if (this.latestVersion) {
            return this.latestVersion.version;
        } else if (this.scriptOnInstrument && this.scriptOnInstrument.version) {
            return this.scriptOnInstrument.version;
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
            return this.catalogScriptItem.versions.slice().reverse();
        }
        return undefined;
    }

    @computed
    get latestVersion() {
        if (this.versions) {
            return this.versions[0];
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

        await useConnection(
            this,
            async connection => {
                const files = await fetchScriptFiles(catalogScriptItemVersion);

                await uploadScriptFilesToInstrument(connection, files);

                runInAction(() => {
                    this.scriptOnInstrument = {
                        name: catalogScriptItem.name,
                        version: selectedVersion,
                        files: files.map(file => file.fileName)
                    };
                });
            },
            true
        );
    };

    @computed
    get canUninstall() {
        return this.isInstalled;
    }

    uninstall = async () => {
        const scriptOnInstrument = this.scriptOnInstrument;
        if (!scriptOnInstrument) {
            return;
        }

        await useConnection(
            this,
            async connection => {
                for (const file of scriptOnInstrument.files) {
                    connection.command(`MMEM:DEL "/Scripts/${file}"`);
                }

                runInAction(() => {
                    this.scriptOnInstrument = undefined;
                    if (!this.catalogScriptItem) {
                        this.bb3Instrument.scripts.splice(
                            this.bb3Instrument.scripts.indexOf(this),
                            1
                        );
                    }
                });
            },
            true
        );
    };

    @computed
    get canUpdate() {
        return (
            this.scriptOnInstrument &&
            this.selectedVersion &&
            this.scriptOnInstrument.version &&
            compareVersions(
                this.selectedVersion,
                this.scriptOnInstrument.version
            ) > 0
        );
    }

    update = () => {
        this.replace();
    };

    @computed
    get canReplace() {
        return (
            this.scriptOnInstrument &&
            this.selectedVersion &&
            this.scriptOnInstrument.version &&
            compareVersions(
                this.selectedVersion,
                this.scriptOnInstrument.version
            ) < 0
        );
    }

    replace = async () => {
        await this.uninstall();
        await this.install();
    };
}
