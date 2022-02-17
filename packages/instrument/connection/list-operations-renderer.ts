import { toJS } from "mobx";
import { ipcRenderer } from "electron";
import { getCurrentWindow } from "@electron/remote";

////////////////////////////////////////////////////////////////////////////////

let resolveCallback: ((result: any) => void) | undefined;
let rejectCallback: ((result: any) => void) | undefined;

////////////////////////////////////////////////////////////////////////////////

export async function getList(instrumentId: string, channelIndex: number) {
    return new Promise<any>((resolve, reject) => {
        resolveCallback = resolve;
        rejectCallback = reject;

        getListRenderer(instrumentId, channelIndex, getCurrentWindow().id);
    });
}

function getListRenderer(
    instrumentId: string,
    channelIndex: number,
    callbackWindowId: number
) {
    ipcRenderer.send("instrument/connection/get-list", {
        instrumentId,
        channelIndex,
        callbackWindowId
    });
}

////////////////////////////////////////////////////////////////////////////////

export async function sendList(
    instrumentId: string,
    channelIndex: number,
    listName: string,
    listData: any
) {
    return new Promise<any>((resolve, reject) => {
        resolveCallback = resolve;
        rejectCallback = reject;

        sendListRenderer(
            instrumentId,
            channelIndex,
            listName,
            listData,
            getCurrentWindow().id
        );
    });
}

function sendListRenderer(
    instrumentId: string,
    channelIndex: number,
    listName: string,
    listData: any,
    callbackWindowId: number
) {
    ipcRenderer.send("instrument/connection/send-list", {
        instrumentId,
        channelIndex,
        listName,
        listData: toJS(listData),
        callbackWindowId
    });
}

////////////////////////////////////////////////////////////////////////////////

ipcRenderer.on(
    "instrument/connection/list-operation-result",
    (event: any, args: any) => {
        if (args.error) {
            if (rejectCallback) {
                rejectCallback(args.error);
            }
        } else {
            if (resolveCallback) {
                resolveCallback(args);
            }
        }
        rejectCallback = undefined;
        resolveCallback = undefined;
    }
);
