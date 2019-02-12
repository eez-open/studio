import { isRenderer } from "eez-studio-shared/util-electron";
import { guid } from "eez-studio-shared/guid";

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
    if (EEZStudio.windowType === "shared/service") {
        // this is service process (renderer)

        // waiting for the new task
        EEZStudio.electron.ipcRenderer.on(
            NEW_TASK_CHANNEL,
            (event: Electron.Event, task: ITask) => {
                function send(taskResult: ITaskResult) {
                    // send result back to calling process
                    EEZStudio.electron.ipcRenderer.sendTo(
                        task.windowId,
                        TASK_DONE_CHANNEL + task.taskId,
                        taskResult
                    );
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

            if (!executeInsideMainProcess) {
                serviceWindow = EEZStudio.electron.remote.BrowserWindow.getAllWindows().find(
                    window => window.webContents.getURL().endsWith("shared/service.html")
                );
            }

            if (executeInsideMainProcess || serviceWindow) {
                return (inputParams: I) => {
                    return new Promise<O>((resolve, reject) => {
                        const taskId = guid();

                        EEZStudio.electron.ipcRenderer.once(
                            TASK_DONE_CHANNEL + taskId,
                            (event: Electron.Event, taskResult: ITaskResult) => {
                                // result received from service process
                                if (taskResult.error) {
                                    reject(taskResult.error);
                                } else {
                                    resolve(taskResult.result);
                                }
                            }
                        );

                        const task: ITask = {
                            windowId: EEZStudio.electron.remote.getCurrentWindow().id,
                            taskId,
                            serviceName,
                            inputParams
                        };

                        if (executeInsideMainProcess) {
                            // send task to main process
                            EEZStudio.electron.ipcRenderer.send(NEW_TASK_CHANNEL, task);
                        } else {
                            // send task to service process
                            serviceWindow!.webContents.send(NEW_TASK_CHANNEL, task);
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
        show: false
    };
    let browserWindow = new BrowserWindow(windowContructorParams);
    browserWindow.loadURL(`file://${__dirname}/../eez-studio-shared/service.html`);

    // waiting for the new task
    ipcMain.on(NEW_TASK_CHANNEL, (event: Electron.Event, task: ITask) => {
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
    });
}
