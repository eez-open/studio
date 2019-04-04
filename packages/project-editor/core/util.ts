export function confirm(message: string, detail: string | undefined, callback: () => void) {
    EEZStudio.electron.remote.dialog.showMessageBox(
        EEZStudio.electron.remote.getCurrentWindow(),
        {
            type: "question",
            title: "Project Editor - EEZ Studio",
            message: message,
            detail: detail,
            noLink: true,
            buttons: ["Yes", "No"],
            cancelId: 1
        },
        function(buttonIndex) {
            if (buttonIndex == 0) {
                callback();
            }
        }
    );
}

export function info(message: string, detail?: string) {
    EEZStudio.electron.remote.dialog.showMessageBox(EEZStudio.electron.remote.getCurrentWindow(), {
        type: "info",
        title: "Project Editor - EEZ Studio",
        message: message,
        detail: detail,
        noLink: true,
        buttons: ["OK"],
        cancelId: 1
    });
}
