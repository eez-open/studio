import * as fs from "fs";
import * as path from "path";
import * as MobXModule from "mobx";
import * as MomentModule from "moment";
import * as GeometryModule from "eez-studio-shared/geometry";

import * as I10nModule from "eez-studio-shared/i10n";

import * as tinycolor from "tinycolor2";

export let app: Electron.App;
if (isRenderer()) {
    app = EEZStudio.electron.remote.app;
} else {
    app = require("electron").app;
}

export const isDev = /[\\/]node_modules[\\/]electron[\\/]/.test(process.execPath);

export function guid() {
    var d = new Date().getTime();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
        var r = (d + Math.random() * 16) % 16 | 0;
        d = Math.floor(d / 16);
        return (c == "x" ? r : (r & 0x7) | 0x8).toString(16);
    });
}

export function getUserDataPath(relativePath: string) {
    return app.getPath("userData") + path.sep + relativePath;
}

export function localPathToFileUrl(localPath: string) {
    return "file://" + localPath.replace(/(\\|\/)/g, "/");
}

export function zipExtract(zipFilePath: string, destFolderPath: string) {
    return new Promise((resolve, reject) => {
        const extract = require("extract-zip");
        extract(zipFilePath, { dir: destFolderPath }, function(err: any) {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

export function makeFolder(folderPath: string) {
    return new Promise(async (resolve, reject) => {
        let exists = await fileExists(folderPath);
        if (exists) {
            resolve();
        } else {
            await makeFolder(path.dirname(folderPath));
            fs.mkdir(folderPath, (err: any) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        }
    });
}

export function removeFolder(folderPath: string) {
    return new Promise((resolve, reject) => {
        const rimraf = require("rimraf");
        rimraf(folderPath, function() {
            resolve();
        });
    });
}

export function removeFile(filePath: string) {
    const { remove } = require("fs-extra");
    return remove(filePath);
}

export function renameFile(oldPath: string, newPath: string) {
    return new Promise((resolve, reject) => {
        fs.rename(oldPath, newPath, (err: any) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

export function fileExists(filePath: string) {
    return new Promise<boolean>((resolve, reject) => {
        fs.exists(filePath, (exists: boolean) => {
            resolve(exists);
        });
    });
}

export function copyFile(srcFilePath: string, destFilePath: string) {
    const { copy } = require("fs-extra");
    return copy(srcFilePath, destFilePath);
}

export function getFileSizeInBytes(filePath: string) {
    return new Promise<number>((resolve, reject) => {
        fs.stat(filePath, function(err: any, stats: any) {
            if (err) {
                reject(err);
            } else {
                resolve(stats.size);
            }
        });
    });
}

export function openFile(filePath: string) {
    return new Promise<any>((resolve, reject) => {
        fs.open(filePath, "r", (err: any, fd: any) => {
            if (err) {
                reject(err);
            } else {
                resolve(fd);
            }
        });
    });
}

export function readFile(
    fd: any,
    buffer: Buffer,
    offset: number,
    length: number,
    position: number
) {
    return new Promise<{ bytesRead: number; buffer: Buffer }>((resolve, reject) => {
        fs.read(
            fd,
            buffer,
            offset,
            length,
            position,
            (err: any, bytesRead: number, buffer: Buffer) => {
                if (err) {
                    reject(err);
                } else {
                    resolve({ bytesRead, buffer });
                }
            }
        );
    });
}

export function closeFile(fd: any) {
    return new Promise<any>((resolve, reject) => {
        fs.close(fd, (err: any) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

export function readTextFile(filePath: string) {
    return new Promise<string>((resolve, reject) => {
        fs.readFile(filePath, "utf8", (err: any, data: string) => {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        });
    });
}

export function readBinaryFile(filePath: string) {
    return new Promise<Buffer>((resolve, reject) => {
        fs.readFile(filePath, (err: any, data: Buffer) => {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        });
    });
}

export async function readJsObjectFromFile(filePath: string) {
    let data = await readTextFile(filePath);
    return JSON.parse(data);
}

interface ICsvColumnDefinition {
    id: string;
    digits: number;
}

export async function readCsvFile(filePath: string, columnDefinitions: ICsvColumnDefinition[]) {
    let data = await readTextFile(filePath);

    let result: any = {};
    columnDefinitions.forEach(columnDefinition => (result[columnDefinition.id] = []));

    let rows = data.split("\n");

    for (let row of rows) {
        row = row.trim();
        if (!row) {
            continue;
        }

        let columns = row.split(",");

        if (columns.length !== columnDefinitions.length) {
            return undefined;
        }

        for (let i = 0; i < columns.length; i++) {
            let value = columns[i];
            if (value !== "=") {
                let numValue = parseFloat(value);
                if (isNaN(numValue)) {
                    return undefined;
                }
                result[columnDefinitions[i].id].push(numValue);
            }
        }
    }

    return result;
}

export async function writeCsvFile(
    filePath: string,
    data: any,
    columnDefinitions: ICsvColumnDefinition[]
) {
    let rows = [];

    let n = data[columnDefinitions[0].id].length;
    for (let i = 1; i < columnDefinitions.length; i++) {
        n = Math.max(n, data[columnDefinitions[i].id].length);
    }

    for (let i = 0; i < n; i++) {
        let row = [];
        for (let j = 0; j < columnDefinitions.length; j++) {
            let columnDefinition = columnDefinitions[j];
            if (i < data[columnDefinition.id].length) {
                row.push(roundNumber(data[columnDefinition.id][i], columnDefinition.digits));
            } else {
                row.push("=");
            }
        }
        rows.push(row.join(","));
    }

    await writeTextFile(filePath, rows.join("\n"));
}

export async function writeTextFile(filePath: string, data: string) {
    await makeFolder(path.dirname(filePath));
    return new Promise<void>((resolve, reject) => {
        fs.writeFile(filePath, data, "utf8", (err: any) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

export async function writeJsObjectToFile(filePath: string, jsObject: any) {
    await writeTextFile(filePath, JSON.stringify(jsObject, undefined, 4));
}

export async function writeBinaryData(filePath: string, data: string | Buffer) {
    await makeFolder(path.dirname(filePath));
    return new Promise<void>((resolve, reject) => {
        fs.writeFile(filePath, data, "binary", (err: any) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

export function createEmptyFile(filePath: string) {
    fs.closeSync(fs.openSync(filePath, "w"));
}

export function readFolder(folderPath: string) {
    return new Promise<string[]>((resolve, reject) => {
        fs.readdir(folderPath, (err: any, files: string[]) => {
            if (err) {
                reject(err);
            } else {
                resolve(files.map(file => folderPath + "/" + file));
            }
        });
    });
}

export function parseXmlString(xmlString: string) {
    // remove UTF-8 BOM
    if (xmlString.startsWith("\ufeff")) {
        xmlString = xmlString.slice("\ufeff".length);
    }
    let parser = new DOMParser();
    return parser.parseFromString(xmlString, "text/xml");
}

export function addScript(src: string) {
    return new Promise(resolve => {
        let script = document.createElement("script");
        script.type = "text/javascript";
        script.src = src;
        script.onload = resolve;
        document.body.appendChild(script);
    });
}

export function addCssStylesheet(id: string, href: string) {
    if (!document.getElementById(id) && document.head) {
        let link = document.createElement("link");
        link.id = id;
        link.rel = "stylesheet";
        link.type = "text/css";
        link.href = href;
        document.head.appendChild(link);
    }
}

export function getBoundingClientRectOfChildNodes(element: Element) {
    const { BoundingRectBuilder } = require("eez-studio-shared/geometry") as typeof GeometryModule;
    let boundingRectBuilder = new BoundingRectBuilder();
    element.childNodes.forEach(node => {
        if (node instanceof Element) {
            boundingRectBuilder.addRect(getBoundingClientRectIncludingChildNodes(node));
        }
    });
    return boundingRectBuilder.getRect()!;
}

export function getBoundingClientRectIncludingChildNodes(element: Element) {
    const { BoundingRectBuilder } = require("eez-studio-shared/geometry") as typeof GeometryModule;
    let boundingRectBuilder = new BoundingRectBuilder();
    boundingRectBuilder.addRect(element.getBoundingClientRect());
    boundingRectBuilder.addRect(getBoundingClientRectOfChildNodes(element));
    return boundingRectBuilder.getRect()!;
}

export function formatBytes(a: number, b?: number) {
    if (a == 0) {
        return "0 Bytes";
    }
    var c = 1024,
        d = b || 2,
        e = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"],
        f = Math.floor(Math.log(a) / Math.log(c));
    return parseFloat((a / Math.pow(c, f)).toFixed(d)) + " " + e[f];
}

export function formatTransferSpeed(speed: number) {
    let ordinals = ["", "K", "M", "G", "T", "P", "E"];

    let bandwidth = speed * 8; // bits per second

    let rate = bandwidth;
    let ordinal = 0;
    while (rate > 1024) {
        rate /= 1024;
        ordinal++;
    }

    return `${Math.round(rate * 10) / 10} ${ordinals[ordinal]}b/s`;
}

export function getFileName(filePath: string) {
    return path.basename(filePath) as string;
}

export function getFileNameWithoutExtension(filePath: string) {
    let fileName = path.basename(filePath) as string;
    let i = fileName.lastIndexOf(".");
    if (i === -1) {
        return fileName;
    }

    return fileName.substring(0, i);
}

export function getFileNameExtension(filePath: string) {
    let fileName = path.basename(filePath) as string;
    let i = fileName.lastIndexOf(".");
    if (i === -1) {
        return undefined;
    }
    return fileName.substring(i + 1);
}

export function getValidFileNameFromFileName(fileName: string) {
    var validFileName = "";

    for (let i = 0; i < fileName.length; i++) {
        const codePoint = fileName.codePointAt(i);
        if (
            !codePoint ||
            codePoint < 32 ||
            codePoint === 127 ||
            codePoint > 255 ||
            '"*+,/:;<=>?\\[]|'.indexOf(fileName[i]) !== -1
        ) {
            validFileName += "_";
        } else {
            validFileName += fileName[i];
        }
    }

    return validFileName;
}

export function getShortFileName(filePath: string) {
    let fileNameWithoutExtension = getFileNameWithoutExtension(filePath)
        .replace(/[^\w]/g, "")
        .substring(0, 8)
        .toUpperCase();
    let extension = getFileNameExtension(filePath);

    if (extension === undefined) {
        return fileNameWithoutExtension;
    }

    return fileNameWithoutExtension + "." + extension.substring(0, 3).toUpperCase();
}

export function isValidFileName(fileName: string, shortFileName: boolean) {
    if (shortFileName) {
        if (!fileName.match(/^[\w\-.]+$/)) {
            return false;
        }

        let fileNameWithoutExtension = getFileNameWithoutExtension(fileName);
        if (fileNameWithoutExtension.length > 8) {
            return false;
        }

        let extension = getFileNameExtension(fileName);
        if (extension !== undefined && extension.length > 3) {
            return false;
        }

        return true;
    } else {
        return fileName === getValidFileNameFromFileName(fileName);
    }
}

export function isValidPath(path: string, shortFileName: boolean) {
    let parts = path.replace(/\\/g, "/").split("/");
    if (parts[0] === "") {
        parts.shift();
    }
    return !parts.find(part => !isValidFileName(part, shortFileName));
}

export async function getTempFilePath(options?: any) {
    return new Promise<string>((resolve, reject) => {
        const tmp = require("tmp");
        tmp.tmpName(options, function(err: any, path: string) {
            if (err) {
                reject(err);
            } else {
                resolve(path);
            }
        });
    });
}

export async function getTempDirPath(options?: any) {
    return new Promise<[string, () => void]>((resolve, reject) => {
        const tmp = require("tmp");
        tmp.dir(options, function(err: any, path: string, cleanupCallback: () => void) {
            if (err) {
                reject(err);
            } else {
                resolve([path, cleanupCallback] as [string, () => void]);
            }
        });
    });
}

export function objectClone<T>(a: T) {
    const { toJS } = require("mobx") as typeof MobXModule;
    return JSON.parse(
        JSON.stringify(toJS(a), (key: string, value: any) =>
            key.startsWith("$") ? undefined : value
        )
    );
}

export function objectEqual<T>(a: T, b: T) {
    var deepEqual = function(x: any, y: any) {
        if (x === y) {
            return true;
        }

        if (typeof x == "object" && x != null && (typeof y == "object" && y != null)) {
            if (Object.keys(x).length != Object.keys(y).length) {
                return false;
            }

            for (var prop in x) {
                if (y.hasOwnProperty(prop)) {
                    if (!deepEqual(x[prop], y[prop])) {
                        return false;
                    }
                } else {
                    return false;
                }
            }

            return true;
        }

        return false;
    };

    const { toJS } = require("mobx") as typeof MobXModule;
    const result = deepEqual(toJS(a), toJS(b));
    return result;
}

export function isRenderer() {
    // running in a web browser
    if (typeof process === "undefined") {
        return true;
    }

    // node-integration is disabled
    if (!process) {
        return true;
    }

    // We're in node.js somehow
    if (!process.type) {
        return false;
    }

    return process.type === "renderer";
}

export function clamp(value: number, min: number, max: number) {
    if (value < min) {
        return min;
    }
    if (value > max) {
        return max;
    }
    return value;
}

var moment: typeof MomentModule | undefined;
var localeData: MomentModule.Locale;
var localeWeekdays: string[];
var defaultDateFormat: string;
var defaultTimeFormat: string;
var defaultDateTimeFormat: string;

export function getMoment() {
    if (!moment) {
        moment = require("moment") as typeof MomentModule;
        require("moment-duration-format")(moment);
        const {
            getLocale,
            getDateFormat,
            getTimeFormat
        } = require("eez-studio-shared/i10n") as typeof I10nModule;
        const locale = getLocale();
        localeData = getMoment().localeData(locale);
        localeWeekdays = localeData.weekdays();
        moment.locale(locale);
        defaultDateFormat = getDateFormat();
        defaultTimeFormat = getTimeFormat();
        defaultDateTimeFormat = defaultDateFormat + " " + defaultTimeFormat;
    }
    return moment;
}

export function formatDateTimeLong(date: Date) {
    return getMoment()(date).format(defaultDateTimeFormat);
}

export function formatDate(date: Date, format?: string) {
    return getMoment()(date).format(format || defaultDateFormat);
}

export function formatDuration(duration: number) {
    return getMoment()
        .duration(duration)
        .format("d _, h _, m _, s _");
}

export function getFirstDayOfWeek() {
    return localeData.firstDayOfWeek();
}

export function getDayOfWeek(date: Date) {
    const dayFromSunday = date.getDay();
    let day = dayFromSunday - getFirstDayOfWeek();
    if (day < 0) {
        day = 7 + day;
    }
    return day;
}

export function getDayOfWeekName(dayOfWeek: number) {
    return localeWeekdays[dayOfWeek];
}

export function getWeekNumber(date: Date) {
    return getMoment()(date).week();
}

export function filterFloat(value: string) {
    if (/^(\-|\+)?([0-9]+(\.[0-9]+)?([eE][-+]?[0-9]+)?|Infinity)$/.test(value)) {
        return Number(value);
    }
    return NaN;
}

export function filterInteger(value: string) {
    if (/^(\-|\+)?[0-9]+$/.test(value)) {
        return Number(value);
    }
    return NaN;
}

export function roundNumber(value: number, digits: number) {
    if (digits < 0) {
        digits = 0;
    }
    return parseFloat(value.toFixed(digits));
}

let reservedKeybindings: string[] | undefined = undefined;

function getReservedKeybindings() {
    if (!reservedKeybindings) {
        reservedKeybindings = EEZStudio.electron.ipcRenderer
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

export function mnemonicLabel(label: string): string {
    const os = require("os");

    if (os.platform() != "win32") {
        return label.replace(/\(&&\w\)|&&/g, ""); // no mnemonic support on mac/linux
    }

    return label.replace(/&&/g, "&");
}

export function confirmSave({
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

    const saveButtton = { label: mnemonicLabel("&&Save"), result: ConfirmResult.SAVE };
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

    EEZStudio.electron.remote.dialog.showMessageBox(
        EEZStudio.electron.remote.getCurrentWindow(),
        opts,
        (buttonIndex: any) => {
            let choice = buttons[buttonIndex].result;
            if (choice == ConfirmResult.SAVE) {
                saveCallback();
            } else if (choice == ConfirmResult.DONT_SAVE) {
                dontSaveCallback();
            } else {
                cancelCallback();
            }
        }
    );
}

export async function delay(time: number) {
    return new Promise(resolve => setTimeout(resolve, time));
}

export const studioVersion = require("../../package.json").version;

export function compareVersions(v1: string, v2: string) {
    const v1Parts = v1.split(".").map(x => parseInt(x));
    const v2Parts = v2.split(".").map(x => parseInt(x));

    for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); ++i) {
        if (isNaN(v1Parts[i])) {
            if (isNaN(v2Parts[i])) {
                return 0;
            }
            return -1;
        }

        if (isNaN(v2Parts[i])) {
            return 1;
        }

        if (v1Parts[i] < v2Parts[i]) {
            return -1;
        }

        if (v1Parts[i] > v2Parts[i]) {
            return 1;
        }
    }

    return 0;
}

////////////////////////////////////////////////////////////////////////////////

export function sendSimpleMessage(message: string, args: any) {
    EEZStudio.electron.remote.BrowserWindow.getAllWindows().forEach(window => {
        window.webContents.send("shared/simple-message", {
            message,
            args
        });
    });
}

export function onSimpleMessage(message: string, callback: (args: any) => void) {
    EEZStudio.electron.ipcRenderer.on(
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

export function addAlphaToColor(color: string, alpha: number) {
    return tinycolor(color)
        .setAlpha(alpha)
        .toRgbString();
}

export function blendColor(fgColor: string, bgColor: string, alpha: number) {
    const fg = tinycolor(fgColor).toRgb();
    var added = [fg.r, fg.g, fg.b, alpha];

    const bg = tinycolor(bgColor).toRgb();
    var base = [bg.r, bg.g, bg.b, 1 - alpha];

    var mix = [];

    mix[3] = 1 - (1 - added[3]) * (1 - base[3]); // alpha

    mix[0] = Math.round(
        (added[0] * added[3]) / mix[3] + (base[0] * base[3] * (1 - added[3])) / mix[3]
    ); // red

    mix[1] = Math.round(
        (added[1] * added[3]) / mix[3] + (base[1] * base[3] * (1 - added[3])) / mix[3]
    ); // green

    mix[2] = Math.round(
        (added[2] * added[3]) / mix[3] + (base[2] * base[3] * (1 - added[3])) / mix[3]
    ); // blue

    return "rgba(" + mix.join(",") + ")";
}
