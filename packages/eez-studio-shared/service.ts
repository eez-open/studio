import type * as ElectronModule from "electron";
import type * as ElectronRemoteModule from "@electron/remote";
import { toJS } from "mobx";

import { isRenderer } from "eez-studio-shared/util-electron";
import { guid } from "eez-studio-shared/guid";
import { sourceRootDir } from "eez-studio-shared/util";

// Execute given function in service process.
// There is exactly one service process, created
// by the main process at the beginning of
// application execution.

const NEW_TASK_CHANNEL = "shared/service/new-task";
const TASK_DONE_CHANNEL = "shared/service/task-done/";

interface ITask {
    windowId: number;
    taskId: string;
    serviceName: string;
    inputParams: any;
}

interface ITaskResult {
    result?: any;
    error?: any;
}

export let service: <I, O>(
    serviceName: string,
    serviceImplementation: (inputParams: I) => Promise<O>, // given function
    executeInsideMainProcess?: boolean
) => (inputParams: I) => Promise<O> = <I, O>(
    serviceName: string,
    serviceImplementation: (inputParams: I) => Promise<O>
) => {
    return serviceImplementation;
};

if (isRenderer()) {
    const { ipcRenderer } = require("electron") as typeof ElectronModule;

    if (window.location.pathname.endsWith("service.html")) {
        // this is service process (renderer)

        // waiting for the new task
        ipcRenderer.on(
            NEW_TASK_CHANNEL,
            (event: Electron.Event, task: ITask) => {
                function send(taskResult: ITaskResult) {
                    const { BrowserWindow } =
                        require("@electron/remote") as typeof ElectronRemoteModule;

                    const originWindow = BrowserWindow.getAllWindows().find(
                        window => window.id === task.windowId
                    );

                    if (originWindow) {
                        // send result back to calling process
                        originWindow.webContents.send(
                            TASK_DONE_CHANNEL + task.taskId,
                            taskResult
                        );
                    }
                }

                function sendResult(result: any) {
                    send({ result });
                }

                function sendError(error: any) {
                    send({ error });
                }

                try {
                    const serviceImplementation: (
                        inputParams: any
                    ) => Promise<any> = require(task.serviceName).default;

                    serviceImplementation(task.inputParams)
                        .then(sendResult)
                        .catch(sendError);
                } catch (error) {
                    sendError(error);
                }
            }
        );
    } else {
        // this is calling process (renderer)

        service = <I, O>(
            serviceName: string,
            serviceImplementation: (inputParams: I) => Promise<O>,
            executeInsideMainProcess?: boolean
        ) => {
            let serviceWindow: Electron.BrowserWindow | undefined;

            const { BrowserWindow, getCurrentWindow } =
                require("@electron/remote") as typeof ElectronRemoteModule;

            if (!executeInsideMainProcess) {
                serviceWindow = BrowserWindow.getAllWindows().find(window =>
                    window.webContents.getURL().endsWith("shared/service.html")
                );
            }

            if (executeInsideMainProcess || serviceWindow) {
                return (inputParams: I) => {
                    return new Promise<O>((resolve, reject) => {
                        const taskId = guid();

                        ipcRenderer.once(
                            TASK_DONE_CHANNEL + taskId,
                            (
                                event: Electron.Event,
                                taskResult: ITaskResult
                            ) => {
                                // result received from service process
                                if (taskResult.error) {
                                    reject(taskResult.error);
                                } else {
                                    resolve(taskResult.result);
                                }
                            }
                        );

                        const task: ITask = {
                            windowId: getCurrentWindow().id,
                            taskId,
                            serviceName,
                            inputParams: toJS(inputParams)
                        };

                        if (executeInsideMainProcess) {
                            // send task to main process
                            ipcRenderer.send(NEW_TASK_CHANNEL, task);
                        } else {
                            // send task to service process
                            serviceWindow!.webContents.send(
                                NEW_TASK_CHANNEL,
                                task
                            );
                        }
                    });
                };
            } else {
                // service window not found, just return serviceImplementation
                // so calling process will execute service implementation function
                return serviceImplementation;
            }
        };
    }
} else {
    // this is main proccess
    const { BrowserWindow, ipcMain } = require("electron");

    // create service process
    var windowContructorParams: Electron.BrowserWindowConstructorOptions = {
        webPreferences: {
            nodeIntegration: true,
            webSecurity: false,
            webviewTag: true,
            nodeIntegrationInWorker: true,
            plugins: true,
            contextIsolation: false
        },
        show: false
    };
    let browserWindow = new BrowserWindow(windowContructorParams);
    require("@electron/remote/main").enable(browserWindow.webContents);
    browserWindow.loadURL(
        `file://${sourceRootDir()}/eez-studio-shared/service.html`
    );

    // waiting for the new task
    ipcMain.on(
        NEW_TASK_CHANNEL,
        (event: Electron.IpcMainEvent, task: ITask) => {
            function send(taskResult: ITaskResult) {
                // send result back to calling process
                event.sender.send(TASK_DONE_CHANNEL + task.taskId, taskResult);
            }

            function sendResult(result: any) {
                send({ result });
            }

            function sendError(error: any) {
                send({ error });
            }

            try {
                const serviceImplementation: (
                    inputParams: any
                ) => Promise<any> = require(task.serviceName).default;

                serviceImplementation(task.inputParams)
                    .then(sendResult)
                    .catch(sendError);
            } catch (error) {
                sendError(error);
            }
        }
    );
}
