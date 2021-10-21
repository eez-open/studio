import electron from "electron";
import { isRenderer } from "eez-studio-shared/util-electron";
import { guid } from "eez-studio-shared/guid";
import { BrowserWindow } from "electron";

////////////////////////////////////////////////////////////////////////////////

export interface INotifySource {
    id: string;
    filterMessage?: (message: any, filterSpecification: any) => boolean;
    onNewTarget?: (
        targetId: string,
        filterSpecification: any,
        inProcessTarget: boolean
    ) => void;
}

interface INotifyTarget {
    sourceId: string;
    filterSpecification: any;
    callback?: (message: any) => void;
    targetWindowId?: number;
}

const sources = new Map<string, INotifySource>();
const targets = new Map<string, INotifyTarget>();

////////////////////////////////////////////////////////////////////////////////

function getBrowserWindow() {
    if (isRenderer()) {
        return EEZStudio.remote.BrowserWindow;
    } else {
        return electron.BrowserWindow;
    }
}

////////////////////////////////////////////////////////////////////////////////

export function registerSource(source: INotifySource) {
    sources.set(source.id, source);
}

export function unregisterSource(source: INotifySource) {
    sources.delete(source.id);
}

////////////////////////////////////////////////////////////////////////////////

export function sendMessage(
    source: INotifySource,
    message: any,
    sendToTargetId?: string
) {
    targets.forEach((target, targetId) => {
        if (
            target.sourceId === source.id &&
            (!sendToTargetId || sendToTargetId === targetId) &&
            (!source.filterMessage ||
                source.filterMessage(message, target.filterSpecification))
        ) {
            if (target.callback) {
                // notify target in this window
                target.callback(message);
            } else if (target.targetWindowId === -1) {
                sendSendMessage(EEZStudio.electron.ipcRenderer, {
                    targetId,
                    message
                });
            } else {
                let browserWindow =
                    target.targetWindowId !== undefined &&
                    getBrowserWindow().fromId(target.targetWindowId);
                if (browserWindow) {
                    // notify target in other windows
                    sendSendMessage(browserWindow.webContents, {
                        targetId,
                        message
                    });
                } else {
                    targets.delete(targetId);
                }
            }
        }
    });
}

////////////////////////////////////////////////////////////////////////////////

export function watch(
    sourceId: string,
    filterSpecification: any,
    callback: (message: any) => void
) {
    let targetId = guid();

    // add target to this window
    targets.set(targetId, {
        sourceId,
        filterSpecification,
        callback
    });

    if (!filterSpecification || !filterSpecification.skipInitialQuery) {
        let source = sources.get(sourceId);
        if (source && source.onNewTarget) {
            source.onNewTarget(targetId, filterSpecification, true);
        }
    }

    // add target to other windows
    let targetWindowId: number;
    if (isRenderer()) {
        targetWindowId = EEZStudio.remote.getCurrentWindow().id;
    } else {
        targetWindowId = -1;
    }

    getBrowserWindow()
        .getAllWindows()
        .forEach((window: BrowserWindow) => {
            if (window.id !== targetWindowId) {
                sendNotifyWatch(window.webContents, {
                    sourceId,
                    filterSpecification,
                    targetId,
                    targetWindowId
                });
            }
        });

    if (isRenderer()) {
        sendNotifyWatch(EEZStudio.electron.ipcRenderer, {
            sourceId,
            filterSpecification,
            targetId,
            targetWindowId
        });
    }

    return targetId;
}

export function unwatch(targetId: string) {
    targets.delete(targetId);
}

////////////////////////////////////////////////////////////////////////////////

interface INotifyWatchArgs {
    sourceId: string;
    filterSpecification: any;
    targetId: string;
    targetWindowId: number;
}

function sendNotifyWatch(
    webContents: Electron.WebContents | Electron.IpcRenderer,
    args: INotifyWatchArgs
) {
    webContents.send("notify/watch", args);
}

interface ISendMessageArgs {
    targetId: string;
    message: any;
}

function sendSendMessage(
    target: Electron.WebContents | Electron.IpcRenderer,
    args: ISendMessageArgs
) {
    target.send("notify/send-message", args);
}

let ipc: Electron.IpcRenderer | Electron.IpcMain;
if (isRenderer()) {
    ipc = EEZStudio.electron.ipcRenderer;
} else {
    ipc = electron.ipcMain;
}

ipc.on("notify/watch", function (event: any, args: INotifyWatchArgs) {
    targets.set(args.targetId, {
        sourceId: args.sourceId,
        filterSpecification: args.filterSpecification,
        targetWindowId: args.targetWindowId
    });

    let source = sources.get(args.sourceId);
    if (source && source.onNewTarget) {
        source.onNewTarget(args.targetId, args.filterSpecification, false);
    }
});

////////////////////////////////////////////////////////////////////////////////

ipc.on("notify/send-message", function (event: any, args: ISendMessageArgs) {
    targets.forEach((target, targetId) => {
        if (target.callback && targetId === args.targetId) {
            target.callback(args.message);
        }
    });
});

////////////////////////////////////////////////////////////////////////////////

ipc.on("notify/get-targets", function (event: any, windowId: number) {
    let targetWindowId: number;
    if (isRenderer()) {
        targetWindowId = EEZStudio.remote.getCurrentWindow().id;
    } else {
        targetWindowId = -1;
    }
    targets.forEach((target, targetId) => {
        if (target.callback) {
            sendNotifyWatch(getBrowserWindow().fromId(windowId)!.webContents, {
                sourceId: target.sourceId,
                filterSpecification: target.filterSpecification,
                targetId,
                targetWindowId
            });
        }
    });
});

if (isRenderer()) {
    let currentWindowId = EEZStudio.remote.getCurrentWindow().id;
    EEZStudio.remote.BrowserWindow.getAllWindows().forEach(window => {
        if (currentWindowId !== window.id) {
            window.webContents.send(
                "notify/get-targets",
                EEZStudio.remote.getCurrentWindow().id
            );
        }
    });

    EEZStudio.electron.ipcRenderer.send(
        "notify/get-targets",
        EEZStudio.remote.getCurrentWindow().id
    );
}
