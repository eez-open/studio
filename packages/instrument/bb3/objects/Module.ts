import { observable, action, runInAction } from "mobx";

import { getConnection } from "instrument/window/connection";

import { fetchFileUrl } from "instrument/bb3/helpers";
import { BB3Instrument } from "instrument/bb3/objects/BB3Instrument";

export interface ModuleFirmwareRelease {
    version: string;
    url: string;
}

export class Module {
    @observable
    updateInProgress: boolean;

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
    setUpdateInProgress(value: boolean) {
        this.updateInProgress = value;
    }

    async updateModuleFirmware(selectedFirmwareVersion: string) {
        const release = this.allReleases.find(
            release => release.version == selectedFirmwareVersion
        );

        if (!release) {
            return;
        }

        const connection = getConnection(this.bb3Instrument.appStore);
        if (!connection.isConnected) {
            return;
        }

        this.setUpdateInProgress(true);

        connection.acquire(true);

        try {
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
        } finally {
            connection.release();
            this.setUpdateInProgress(false);
        }
    }
}
