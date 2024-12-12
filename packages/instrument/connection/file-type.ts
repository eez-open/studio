import { BrowserWindow, ipcMain } from "electron";

const fileType = require("file-type");

import * as notification from "eez-studio-ui/notification";

import { getFileNameExtension } from "eez-studio-shared/util-electron";
import { UNITS, PREFIXES } from "eez-studio-shared/units";

import { IActivityLogEntry } from "instrument/window/history/activity-log";
import type { FileState } from "instrument/connection/file-state";
import { decodeDlog } from "instrument/window/waveform/dlog-file";

export const SAMPLE_LENGTH = 4096;

export const MIME_EEZ_DLOG = "application/eez-dlog";
export const MIME_EEZ_LIST = "application/eez-list";
export const MIME_CSV = "text/csv";

export function detectFileType(
    data: string | Buffer | Uint8Array,
    fileName?: string
): {
    ext?: string;
    mime: string;
    comment?: string;
} {
    const dataSample = data instanceof Uint8Array ? data : getUint8Array(data);

    let type = isDlog(dataSample);
    if (type) {
        return type;
    }

    type = fileType(dataSample, "binary");

    if (type) {
        return type;
    }

    const csvMime = detectCSV(
        data instanceof Uint8Array ? Buffer.from(data) : data
    );
    if (csvMime) {
        return {
            ext: "csv",
            mime: csvMime
        };
    }

    let ext: string | undefined = undefined;
    if (fileName) {
        ext = getFileNameExtension(fileName);
        if (ext) {
            if (ext.toLowerCase() === "raw") {
                return {
                    ext,
                    mime: "application/eez-raw"
                };
            }
        }
    }

    return {
        ext,
        mime: "application/octet-stream"
    };
}

export function convertBmpToPng(data: string) {
    return new Promise<string>((resolve, reject) => {
        let browserWindow = new BrowserWindow({
            webPreferences: {
                nodeIntegration: true,
                webSecurity: false,
                webviewTag: true,
                nodeIntegrationInWorker: true,
                plugins: true,
                contextIsolation: false
            },
            show: false
        });
        require("@electron/remote/main").enable(browserWindow.webContents);

        browserWindow.webContents.once("dom-ready", () => {
            browserWindow.webContents.send("convertBmpToPng", data);

            const onConvertBmpToPngResult = (
                event: any,
                error: any,
                data: string
            ) => {
                if (browserWindow.webContents === event.sender) {
                    if (error) {
                        reject(error);
                    } else {
                        resolve(data);
                    }
                    browserWindow.close();
                    ipcMain.removeListener(
                        "convertBmpToPngResult",
                        onConvertBmpToPngResult
                    );
                }
            };

            ipcMain.on("convertBmpToPngResult", onConvertBmpToPngResult);
        });

        browserWindow.loadURL(`file://${__dirname}/convertBmpToPng.html`);
    });
}

function getUint8Array(data: string | Buffer) {
    if (typeof data === "string") {
        return new Uint8Array(
            Buffer.from(data.slice(0, SAMPLE_LENGTH), "binary")
        );
    } else {
        return new Uint8Array(data);
    }
}

function detectCSV(data: string | Buffer) {
    if (Buffer.isBuffer(data)) {
        data = data.toString("binary");
    }

    let lines = data.split("\n");
    if (lines.length === 0) {
        return undefined;
    }

    let numColumns: number | undefined = undefined;

    for (let line of lines) {
        line = line.trim();
        if (!line) {
            continue;
        }

        let numbers = line.split(",").map(number => number.trim());

        if (numColumns === undefined) {
            numColumns = numbers.length;
        } else {
            if (numColumns !== numbers.length) {
                return undefined;
            }
        }

        if (
            numbers.find(
                number => number !== "=" && !isFinite(parseFloat(number))
            )
        ) {
            return undefined;
        }
    }

    return numColumns == 3 ? MIME_EEZ_LIST : MIME_CSV;
}

export function checkMime(message: string, list: string[]) {
    try {
        const fileState: FileState = JSON.parse(message);
        if (
            fileState.state !== "success" &&
            fileState.state !== "upload-finish"
        ) {
            return false;
        }

        const mime =
            fileState &&
            (typeof fileState.fileType === "string"
                ? fileState.fileType
                : fileState.fileType && fileState.fileType.mime);

        return list.indexOf(mime) !== -1;
    } catch (err) {
        return false;
    }
}

function recognizeXAxisUnit(xAxisUnit: string): {
    unitName: keyof typeof UNITS;
    timeScale: number;
} {
    let unitName: keyof typeof UNITS = "time";
    let prefix: keyof typeof PREFIXES;
    for (prefix in PREFIXES) {
        if (xAxisUnit === `(${prefix}${UNITS[unitName].unitSymbol})`) {
            return {
                unitName: unitName as keyof typeof UNITS,
                timeScale: PREFIXES[prefix]
            };
        }
    }

    return {
        unitName,
        timeScale: 1
    };
}

function recognizeYAxisUnit(yAxisUnit: string): {
    unitName: keyof typeof UNITS;
    valueScale: number;
} {
    let unitName: keyof typeof UNITS;
    for (unitName in UNITS) {
        let prefix: keyof typeof PREFIXES;
        for (prefix in PREFIXES) {
            if (yAxisUnit === `(${prefix}${UNITS[unitName].unitSymbol})`) {
                return {
                    unitName: unitName as keyof typeof UNITS,
                    valueScale: PREFIXES[prefix]
                };
            }
        }
    }

    return {
        unitName: "unknown",
        valueScale: 1
    };
}

export async function extractColumnFromCSVHeuristically(
    data: string | Buffer,
    progressToastId: string | number
) {
    // Basically, recognizes CSV file that looks like this (exported from PicoScope):
    // Time,Channel C
    // (ms),(V)
    //
    // 0.00000000,143.46540000
    // 0.00006000,143.74010000
    // 0.00012000,143.19070000
    // 0.00018000,143.46540000
    // 0.00024000,143.19070000

    let lines;
    if (Buffer.isBuffer(data)) {
        lines = data.toString("utf8").split("\n");
    } else {
        lines = data.split("\n");
    }

    if (lines.length < 4) {
        return undefined;
    }

    // 1st line, i.e.: Time,Channel C
    let columns = lines[0].split(",").map(column => column.trim());
    if (columns[0] !== "Time") {
        return undefined;
    }
    let label = columns[1];

    // 2nd line, i.e.: (ms),(V)
    columns = lines[1].split(",").map(column => column.trim());
    const timeUnit = columns[0];
    const yAxisUnit = columns[1];

    const { timeScale } = recognizeXAxisUnit(timeUnit);

    const { unitName, valueScale } = recognizeYAxisUnit(yAxisUnit);

    // calc sampling rate
    let dt =
        parseFloat(lines[4].split(",")[0]) - parseFloat(lines[3].split(",")[0]);
    if (isNaN(dt)) {
        return undefined;
    }
    dt /= timeScale;
    let samplingRate = 1 / dt;

    // get y values
    let numbers = Buffer.alloc((lines.length - 3) * 8);
    for (let i = 3; i < lines.length; ++i) {
        const number = parseFloat(lines[i].split(",")[1]) * valueScale;

        if (isNaN(number)) {
            console.log(lines[i]);
        }

        numbers.writeDoubleLE(number, (i - 3) * 8);

        if (progressToastId != undefined && i % 100000 == 0) {
            const progress = (i / lines.length) * 0.9;

            notification.update(progressToastId, {
                progress
            });

            await new Promise(resolve => setTimeout(resolve, 0));
        }
    }

    return {
        data: numbers,
        samplingRate,
        unitName,
        color: UNITS[unitName].color,
        colorInverse: UNITS[unitName].colorInverse,
        label: label
    };
}

export function isDlog(dataSample: Uint8Array) {
    const dlog = decodeDlog(dataSample, unit => unit);
    if (dlog) {
        return {
            ext: "dlog",
            mime: MIME_EEZ_DLOG,
            comment: dlog.comment
        };
    }

    return undefined;
}

export function isDlogWaveform(activityLogEntry: IActivityLogEntry) {
    return checkMime(activityLogEntry.message, [MIME_EEZ_DLOG]);
}
