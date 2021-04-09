import * as notification from "eez-studio-ui/notification";

import { getConnection, Connection } from "instrument/window/connection";
import { BB3Instrument } from "./objects/BB3Instrument";

export function removeQuotes(str: string) {
    if (str.length >= 2 && str[0] == '"' && str[str.length - 1] == '"') {
        return str.substr(1, str.length - 2);
    }
    return str;
}

export function openLink(url: string) {
    const { shell } = require("electron");
    shell.openExternal(url);
}

export interface IFetchedFile {
    fileName: string;
    fileData: string | ArrayBuffer;
}

export function fetchFileUrl(fileUrl: string) {
    return new Promise<IFetchedFile>((resolve, reject) => {
        let req = new XMLHttpRequest();
        req.responseType = "blob";
        req.open("GET", fileUrl);

        req.addEventListener("load", () => {
            const decodedFileUri = decodeURIComponent(fileUrl);
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
    });
}

export async function useConnection(
    obj: {
        bb3Instrument: BB3Instrument;
        setBusy(value: boolean): void;
    },
    callback: (connection: Connection) => Promise<void>,
    traceEnabled: boolean
) {
    const connection = getConnection(obj.bb3Instrument.appStore);
    if (!connection.isConnected) {
        return;
    }

    obj.setBusy(true);
    try {
        await connection.acquire(traceEnabled);
        try {
            await callback(connection);
        } finally {
            connection.release();
        }
    } catch (err) {
        notification.error(err.toString());
    } finally {
        obj.setBusy(false);
    }
}
