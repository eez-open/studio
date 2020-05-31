import { observable, action, runInAction } from "mobx";

import { fetchFileUrl, useConnection } from "instrument/bb3/helpers";
import { BB3Instrument } from "instrument/bb3/objects/BB3Instrument";

export interface ModuleFirmwareRelease {
    version: string;
    url: string;
}

export class Module {
    @observable
    busy: boolean;

    @observable
    firmwareVersion: string;

    constructor(
        public bb3Instrument: BB3Instrument,
        public slotIndex: number,
        public moduleType: string,
        public moduleRevision: string,
        firmwareVersion: string,
        public allReleases: ModuleFirmwareRelease[]
    ) {
        this.firmwareVersion = firmwareVersion;
    }

    @action
    setBusy(value: boolean) {
        this.busy = value;
    }

    async updateModuleFirmware(selectedFirmwareVersion: string) {
        const release = this.allReleases.find(
            release => release.version == selectedFirmwareVersion
        );

        if (!release) {
            return;
        }

        await useConnection(
            this,
            async connection => {
                const file = await fetchFileUrl(release.url);

                const uploadInstructions = Object.assign(
                    {},
                    connection.instrument.defaultFileUploadInstructions,
                    {
                        sourceData: file.fileData,
                        sourceFileType: "application/octet-stream",
                        destinationFileName: file.fileName,
                        destinationFolderPath: "/Updates"
                    }
                );

                await new Promise((resolve, reject) =>
                    connection.upload(uploadInstructions, resolve, reject)
                );

                connection.command(`DEBUG:DOWN:FIRM ${this.slotIndex},"/Updates/${file.fileName}"`);

                runInAction(() => {
                    this.firmwareVersion = selectedFirmwareVersion;
                });
            },
            true
        );
    }
}
