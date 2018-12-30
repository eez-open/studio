import { BrowserWindow, ipcMain } from "electron";

const fileType = require("file-type");

import { getFileNameExtension } from "eez-studio-shared/util";
import { UNITS } from "eez-studio-shared/units";

import { FileState } from "instrument/connection/file-state";

export const SAMPLE_LENGTH = 4096;

export const MIME_EEZ_DLOG = "application/eez-dlog";

function getUint8Array(data: string | Buffer) {
    if (typeof data === "string") {
        return new Uint8Array(new Buffer(data.slice(0, SAMPLE_LENGTH), "binary"));
    } else {
        return new Uint8Array(data);
    }
}

function isDlog(dataSample: Uint8Array) {
    const DLOG_MAGIC1 = 0x2d5a4545;
    const DLOG_MAGIC2 = 0x474f4c44;
    const DLOG_VERSION = 0x0001;

    let i = 0;

    function isEqual16(value: number) {
        const result =
            dataSample[i] === (value & 0xff) && dataSample[i + 1] === ((value >> 8) & 0xff);

        i += 2;

        return result;
    }

    function isEqual32(value: number) {
        const result =
            dataSample[i] === (value & 0xff) &&
            dataSample[i + 1] === ((value >> 8) & 0xff) &&
            dataSample[i + 2] === ((value >> 16) & 0xff) &&
            dataSample[i + 3] === value >> 24;

        i += 4;

        return result;
    }

    return isEqual32(DLOG_MAGIC1) && isEqual32(DLOG_MAGIC2) && isEqual16(DLOG_VERSION);
}

export function detectFileType(data: string | Buffer, fileName?: string) {
    const dataSample = getUint8Array(data);

    if (isDlog(dataSample)) {
        return {
            ext: "dlog",
            mime: MIME_EEZ_DLOG
        };
    }

    let type = fileType(dataSample, "binary");

    if (type) {
        return type;
    }

    if (isSimpleCSV(data)) {
        return {
            ext: "csv",
            mime: "text/csv"
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
            show: false
        });

        browserWindow.webContents.once("dom-ready", () => {
            browserWindow.webContents.send("convertBmpToPng", data);

            const onConvertBmpToPngResult = (event: any, error: any, data: string) => {
                if (browserWindow.webContents === event.sender) {
                    if (error) {
                        reject(error);
                    } else {
                        resolve(data);
                    }
                    browserWindow.close();
                    ipcMain.removeListener("convertBmpToPngResult", onConvertBmpToPngResult);
                }
            };

            ipcMain.on("convertBmpToPngResult", onConvertBmpToPngResult);
        });

        browserWindow.loadURL(`file://${__dirname}/convertBmpToPng.html`);
    });
}

function isSimpleCSV(data: string | Buffer) {
    if (data instanceof Buffer) {
        data = data.toString("binary");
    }

    // is CSV file?
    let lines = data.split("\n");
    if (lines.length === 0) {
        return false;
    }
    for (let line of lines) {
        let numbers = line.split(",");
        if (numbers.find(number => number !== "=" && isNaN(parseFloat(number)))) {
            return false;
        }
    }
    return true;
}

export function checkMime(message: string, list: string[]) {
    const fileState: FileState = JSON.parse(message);
    if (fileState.state !== "success" && fileState.state !== "upload-finish") {
        return false;
    }

    const mime =
        fileState &&
        (typeof fileState.fileType === "string"
            ? fileState.fileType
            : fileState.fileType && fileState.fileType.mime);

    return list.indexOf(mime) !== -1;
}

export function extractColumnFromCSVHeuristically(data: string | Buffer) {
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
    if (data instanceof Buffer) {
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

    let timeUnitInMs = timeUnit === "(ms)";

    let unitName: keyof typeof UNITS;
    let valueScale = 1;
    if (yAxisUnit === "(V)") {
        unitName = "voltage";
    } else if (yAxisUnit === "(mV)") {
        unitName = "voltage";
        valueScale = 0.001;
    } else if (yAxisUnit === "(A)") {
        unitName = "current";
    } else if (yAxisUnit === "(mA)") {
        unitName = "current";
        valueScale = 0.001;
    } else if (yAxisUnit === "(W)") {
        unitName = "power";
    } else if (yAxisUnit === "(mW)") {
        unitName = "power";
        valueScale = 0.001;
    } else {
        unitName = "unknown";
    }

    // calc sampling rate
    let dt = parseFloat(lines[4].split(",")[0]) - parseFloat(lines[3].split(",")[0]);
    if (isNaN(dt)) {
        return undefined;
    }
    if (timeUnitInMs) {
        dt /= 1000;
    }
    let samplingRate = 1 / dt;

    // get y values
    let numbers = new Buffer((lines.length - 3) * 8);
    for (let i = 3; i < lines.length; ++i) {
        const number = parseFloat(lines[i].split(",")[1]) * valueScale;
        numbers.writeDoubleLE(number, (i - 3) * 8);
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
