import { dialog, BrowserWindow, getCurrentWindow } from "@electron/remote";
import { ipcRenderer } from "electron";

function mnemonicLabel(label: string): string {
    const os = require("os");

    if (os.platform() != "win32") {
        return label.replace(/\(&&\w\)|&&/g, ""); // no mnemonic support on mac/linux
    }

    return label.replace(/&&/g, "&");
}

export async function confirmSave({
    saveCallback,
    dontSaveCallback,
    cancelCallback
}: {
    saveCallback: () => void;
    dontSaveCallback: () => void;
    cancelCallback: () => void;
}) {
    enum ConfirmResult {
        SAVE,
        DONT_SAVE,
        CANCEL
    }

    const saveButtton = {
        label: mnemonicLabel("&&Save"),
        result: ConfirmResult.SAVE
    };
    const dontSaveButton = {
        label: mnemonicLabel("Do&&n't Save"),
        result: ConfirmResult.DONT_SAVE
    };
    const cancelButton = { label: "Cancel", result: ConfirmResult.CANCEL };

    const os = require("os");

    const buttons: any[] = [];
    if (os.platform() == "win32") {
        buttons.push(saveButtton, dontSaveButton, cancelButton);
    } else if (os.platform() == "linux") {
        buttons.push(dontSaveButton, cancelButton, saveButtton);
    } else {
        buttons.push(saveButtton, cancelButton, dontSaveButton);
    }

    let opts: Electron.MessageBoxOptions = {
        type: "warning",
        title: document.title,
        message: "Do you want to save changes?",
        detail: "Your changes will be lost if you don't save them.",
        noLink: true,
        buttons: buttons.map(b => b.label),
        cancelId: buttons.indexOf(cancelButton)
    };

    if (os.platform() == "linux") {
        opts.defaultId = 2;
    }

    const result = await dialog.showMessageBox(getCurrentWindow(), opts);
    const buttonIndex = result.response;
    let choice = buttons[buttonIndex].result;
    if (choice == ConfirmResult.SAVE) {
        saveCallback();
    } else if (choice == ConfirmResult.DONT_SAVE) {
        dontSaveCallback();
    } else {
        cancelCallback();
    }
}

export function sendSimpleMessage(message: string, args: any) {
    BrowserWindow.getAllWindows().forEach(window => {
        window.webContents.send("shared/simple-message", {
            message,
            args
        });
    });
}

export function onSimpleMessage(
    message: string,
    callback: (args: any) => void
) {
    ipcRenderer.on(
        "shared/simple-message",
        (
            event: any,
            args: {
                message: string;
                args: any;
            }
        ) => {
            if (args.message === message) {
                callback(args.args);
            }
        }
    );
}

let reservedKeybindings: string[] | undefined = undefined;

function getReservedKeybindings() {
    if (!reservedKeybindings) {
        reservedKeybindings = ipcRenderer
            .sendSync("getReservedKeybindings")
            .concat([
                "Insert",
                "Delete",
                "Home",
                "End",
                "Pageup",
                "Pagedown",
                "Scrolllock",
                "Pause",
                "Arrowleft",
                "Arrowright",
                "Arrowup",
                "Arrowdown",
                "Backspace",
                "Tab",
                "Ctrl+C",
                "Ctrl+V"
            ]);
        console.log("Reserved keybindings", reservedKeybindings);
    }
    return reservedKeybindings!;
}

function keybindingEqual(keybinding1: string, keybinding2: string) {
    const keybinding1Parts = keybinding1.toLowerCase().split("+");
    const keybinding2Parts = keybinding2.toLowerCase().split("+");

    if (keybinding1Parts.length !== keybinding2Parts.length) {
        return false;
    }

    for (let i = 0; i < keybinding1Parts.length; i++) {
        if (keybinding2Parts.indexOf(keybinding1Parts[i]) === -1) {
            return false;
        }
    }

    return true;
}

export function isReserverdKeybinding(keybinding: string) {
    let reservedKeybindings = getReservedKeybindings();

    for (let i = 0; i < reservedKeybindings.length; i++) {
        if (keybindingEqual(keybinding, reservedKeybindings[i])) {
            return true;
        }
    }

    return false;
}
