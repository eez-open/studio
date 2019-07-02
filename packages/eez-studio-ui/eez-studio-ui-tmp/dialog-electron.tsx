export function info(message: string, detail: string | undefined) {
    EEZStudio.electron.remote.dialog.showMessageBox(EEZStudio.electron.remote.getCurrentWindow(), {
        type: "info",
        title: "EEZ Studio",
        message: message,
        detail: detail,
        noLink: true,
        buttons: ["OK"]
    });
}

export function error(message: string, detail: string | undefined) {
    EEZStudio.electron.remote.dialog.showMessageBox(EEZStudio.electron.remote.getCurrentWindow(), {
        type: "error",
        title: "EEZ Studio",
        message: message,
        detail: detail,
        noLink: true,
        buttons: ["OK"]
    });
}

export function confirm(
    message: string,
    detail: string | undefined,
    callback: () => void,
    cancelCallback?: () => void
) {
    EEZStudio.electron.remote.dialog.showMessageBox(
        EEZStudio.electron.remote.getCurrentWindow(),
        {
            type: "question",
            title: "EEZ Studio",
            message: message,
            detail: detail,
            noLink: true,
            buttons: ["Yes", "No"],
            cancelId: 1
        },
        (buttonIndex: number) => {
            if (buttonIndex == 0) {
                callback();
            } else if (cancelCallback) {
                cancelCallback();
            }
        }
    );
}

export function confirmWithButtons(message: string, detail: string | undefined, buttons: string[]) {
    return new Promise<number>(resolve => {
        EEZStudio.electron.remote.dialog.showMessageBox(
            EEZStudio.electron.remote.getCurrentWindow(),
            {
                type: "question",
                title: "EEZ Studio",
                message: message,
                detail: detail,
                noLink: true,
                buttons: buttons || ["Yes", "No"],
                cancelId: 1
            },
            (buttonIndex: number) => {
                resolve(buttonIndex);
            }
        );
    });
}
