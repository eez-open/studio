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

export function htmlEncode(value: string) {
    return $("<div/>")
        .text(value)
        .html();
}

export function strToColor16(colorStr: string) {
    let color24: any;

    if (colorStr && colorStr[0] == "#") {
        color24 = parseInt(colorStr.substring(1), 16);
    }

    if (color24 === undefined || isNaN(color24)) {
        return NaN;
    }

    const r = (color24 & 0xff0000) >> 16;
    const g = (color24 & 0x00ff00) >> 8;
    const b = color24 & 0x0000ff;

    // rrrrrggggggbbbbb
    let color16 = ((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3);

    return color16;
}
