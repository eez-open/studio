import { BrowserWindow, ipcMain } from "electron";

////////////////////////////////////////////////////////////////////////////////

interface ITask {
    browserWindow?: BrowserWindow;
    sender: Electron.WebContents;
    params: IInputParams;
}

interface IInputParams {
    taskId: string;
    data: any;
}

interface IOutputParams {
    taskId: string;
    result: string | null;
}

////////////////////////////////////////////////////////////////////////////////

const tasks = new Map<string, ITask>();

////////////////////////////////////////////////////////////////////////////////

function processNextTask() {
    for (let taskEntry of tasks.entries()) {
        const task = taskEntry[1];
        if (!task.browserWindow) {
            var windowContructorParams: Electron.BrowserWindowConstructorOptions = {
                show: false
            };

            let browserWindow = new BrowserWindow(windowContructorParams);

            task.browserWindow = browserWindow;

            browserWindow.loadURL(`file://${__dirname}/../pdf-to-png/index.html`);

            browserWindow.once("ready-to-show", () => {
                browserWindow.webContents.send("pdf-to-png", task.params);
            });

            return;
        }
    }
}

ipcMain.on("pdf-to-png", (event: Electron.Event, params: IInputParams) => {
    tasks.set(params.taskId, {
        sender: event.sender,
        params
    });

    processNextTask();
});

ipcMain.on("pdf-to-png-done", (event: Electron.Event, params: IOutputParams) => {
    const task = tasks.get(params.taskId);
    if (task) {
        task.browserWindow!.close();
        task.sender.send(params.taskId, params);
        tasks.delete(params.taskId);
    }

    processNextTask();
});
