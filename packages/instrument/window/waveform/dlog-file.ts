import { IActivityLogEntry } from "eez-studio-shared/activity-log";
import {
    IUnit,
    TIME_UNIT,
    VOLTAGE_UNIT,
    CURRENT_UNIT,
    POWER_UNIT,
    UNKNOWN_UNIT,
    UNITS
} from "eez-studio-shared/units";
import { roundNumber } from "eez-studio-shared/roundNumber";

import * as I10nModule from "eez-studio-shared/i10n";

import { MIME_EEZ_DLOG, checkMime } from "instrument/connection/file-type";

////////////////////////////////////////////////////////////////////////////////

enum Fields {
    FIELD_ID_COMMENT = 1,

    FIELD_ID_X_UNIT = 10,
    FIELD_ID_X_STEP = 11,
    FIELD_ID_X_RANGE_MIN = 12,
    FIELD_ID_X_RANGE_MAX = 13,
    FIELD_ID_X_LABEL = 14,
    FIELD_ID_X_SCALE = 15,

    FIELD_ID_Y_UNIT = 30,
    FIELD_ID_Y_RANGE_MIN = 32,
    FIELD_ID_Y_RANGE_MAX = 33,
    FIELD_ID_Y_LABEL = 34,
    FIELD_ID_Y_CHANNEL_INDEX = 35,
    FIELD_ID_Y_SCALE = 36,

    FIELD_ID_CHANNEL_MODULE_TYPE = 50,
    FIELD_ID_CHANNEL_MODULE_REVISION = 51
}

export enum Scale {
    LINEAR,
    LOGARITHMIC
}

export interface IDlogXAxis {
    unit: IUnit;
    step: number;
    scale: Scale;
    range: {
        min: number;
        max: number;
    };
    label: string;
}

export interface IDlogYAxis {
    unit: IUnit;
    range?: {
        min: number;
        max: number;
    };
    label?: string;
    channelIndex: number;
}

export interface IDlog {
    version: number;
    comment?: string;
    xAxis: IDlogXAxis;
    yAxis: IDlogYAxis;
    yAxes: IDlogYAxis[];
    yAxisScale: Scale;
    dataOffset: number;
    length: number;

    // legacy, version 1
    startTime?: Date;
    hasJitterColumn: boolean;
}

const DLOG_MAGIC1 = 0x2d5a4545;
const DLOG_MAGIC2 = 0x474f4c44;
const DLOG_VERSION1 = 0x0001;
const DLOG_VERSION2 = 0x0002;

export function decodeDlog(data: Uint8Array): IDlog | undefined {
    const buffer = Buffer.allocUnsafe(4);

    function readFloat(i: number) {
        buffer[0] = data[i];
        buffer[1] = data[i + 1];
        buffer[2] = data[i + 2];
        buffer[3] = data[i + 3];
        return buffer.readFloatLE(0);
    }

    function readUInt8(i: number) {
        buffer[0] = data[i];
        return buffer.readUInt8(0);
    }

    function readString(start: number, end: number) {
        return new Buffer(data.slice(start, end)).toString();
    }

    function readUInt16(i: number) {
        buffer[0] = data[i];
        buffer[1] = data[i + 1];
        return buffer.readUInt16LE(0);
    }

    function readUInt32(i: number) {
        buffer[0] = data[i];
        buffer[1] = data[i + 1];
        buffer[2] = data[i + 2];
        buffer[3] = data[i + 3];
        return buffer.readUInt32LE(0);
    }

    function getUnit(unit: number) {
        enum FirmwareUnit {
            UNIT_UNKNOWN,
            UNIT_VOLT,
            UNIT_MILLI_VOLT,
            UNIT_AMPER,
            UNIT_MILLI_AMPER,
            UNIT_MICRO_AMPER,
            UNIT_WATT,
            UNIT_MILLI_WATT,
            UNIT_SECOND,
            UNIT_MILLI_SECOND,
            UNIT_CELSIUS,
            UNIT_RPM,
            UNIT_OHM,
            UNIT_KOHM,
            UNIT_MOHM,
            UNIT_PERCENT,
            UNIT_FREQUENCY,
            UNIT_JOULE
        }

        if (unit === FirmwareUnit.UNIT_VOLT) {
            return UNITS.volt;
        } else if (unit === FirmwareUnit.UNIT_AMPER) {
            return UNITS.ampere;
        } else if (unit === FirmwareUnit.UNIT_WATT) {
            return UNITS.watt;
        } else if (unit === FirmwareUnit.UNIT_SECOND) {
            return UNITS.time;
        } else if (unit === FirmwareUnit.UNIT_JOULE) {
            return UNITS.joule;
        } else {
            return UNITS.unknown;
        }
    }

    function readColumns() {
        const columns = readUInt32(12);
        for (let iChannel = 0; iChannel < 8; iChannel++) {
            if (columns & (1 << (4 * iChannel))) {
                yAxes.push({
                    unit: VOLTAGE_UNIT,
                    channelIndex: iChannel
                });
            }

            if (columns & (2 << (4 * iChannel))) {
                yAxes.push({
                    unit: CURRENT_UNIT,
                    channelIndex: iChannel
                });
            }

            if (columns & (4 << (4 * iChannel))) {
                yAxes.push({
                    unit: POWER_UNIT,
                    channelIndex: iChannel
                });
            }
        }
    }

    function readFields() {
        let offset = 16;
        while (offset < dataOffset) {
            const fieldLength = readUInt16(offset);
            if (fieldLength == 0) {
                break;
            }

            offset += 2;

            const fieldId = readUInt8(offset);
            offset++;

            let fieldDataLength = fieldLength - 2 - 1;

            if (fieldId === Fields.FIELD_ID_COMMENT) {
                comment = readString(offset, offset + fieldDataLength);
                offset += fieldDataLength;
            } else if (fieldId === Fields.FIELD_ID_X_UNIT) {
                xAxis.unit = getUnit(readUInt8(offset));
                offset++;
            } else if (fieldId === Fields.FIELD_ID_X_STEP) {
                xAxis.step = readFloat(offset);
                offset += 4;
            } else if (fieldId === Fields.FIELD_ID_X_SCALE) {
                xAxis.scale = readUInt8(offset);
                offset++;
            } else if (fieldId === Fields.FIELD_ID_X_RANGE_MIN) {
                xAxis.range.min = readFloat(offset);
                offset += 4;
            } else if (fieldId === Fields.FIELD_ID_X_RANGE_MAX) {
                xAxis.range.max = readFloat(offset);
                offset += 4;
            } else if (fieldId === Fields.FIELD_ID_X_LABEL) {
                xAxis.label = readString(offset, offset + fieldDataLength);
                offset += fieldDataLength;
            } else if (
                fieldId >= Fields.FIELD_ID_Y_UNIT &&
                fieldId <= Fields.FIELD_ID_Y_CHANNEL_INDEX
            ) {
                let yAxisIndex = readUInt8(offset);
                offset++;

                yAxisIndex--;
                while (yAxisIndex >= yAxes.length) {
                    yAxes.push(Object.assign({}, yAxis));
                }

                fieldDataLength -= 1;

                let destYAxis;
                if (yAxisIndex >= 0) {
                    destYAxis = yAxes[yAxisIndex];
                } else {
                    yAxisDefined = true;
                    destYAxis = yAxis;
                }

                if (fieldId === Fields.FIELD_ID_Y_UNIT) {
                    destYAxis.unit = getUnit(readUInt8(offset));
                    offset++;
                } else if (fieldId === Fields.FIELD_ID_Y_RANGE_MIN) {
                    destYAxis.range!.min = readFloat(offset);
                    offset += 4;
                } else if (fieldId === Fields.FIELD_ID_Y_RANGE_MAX) {
                    destYAxis.range!.max = readFloat(offset);
                    offset += 4;
                } else if (fieldId === Fields.FIELD_ID_Y_LABEL) {
                    destYAxis.label = readString(offset, offset + fieldDataLength);
                    offset += fieldDataLength;
                } else if (fieldId === Fields.FIELD_ID_Y_CHANNEL_INDEX) {
                    destYAxis.channelIndex = readUInt8(offset) - 1;
                    offset++;
                } else {
                    // unknown field, skip
                    offset += fieldDataLength;
                }
            } else if (fieldId === Fields.FIELD_ID_Y_SCALE) {
                yAxisScale = readUInt8(offset);
                offset++;
            } else if (fieldId === Fields.FIELD_ID_CHANNEL_MODULE_TYPE) {
                readUInt8(offset); // channel index
                offset++;
                readUInt16(offset); // module type
                offset += 2;
            } else if (fieldId == Fields.FIELD_ID_CHANNEL_MODULE_REVISION) {
                readUInt8(offset); // channel index
                offset++;
                readUInt16(offset); // module revision
                offset += 2;
            } else {
                // unknown field, skip
                offset += fieldDataLength;
            }
        }
    }

    if (readUInt32(0) !== DLOG_MAGIC1) {
        return undefined;
    }

    if (readUInt32(4) !== DLOG_MAGIC2) {
        return undefined;
    }

    const version = readUInt16(8);
    if (version !== DLOG_VERSION1 && version !== DLOG_VERSION2) {
        return undefined;
    }

    let dataOffset = version == 1 ? 28 : readUInt32(12);

    let comment: string | undefined = undefined;

    let xAxis: IDlogXAxis = {
        unit: TIME_UNIT,
        step: 1,
        range: {
            min: 0,
            max: 1
        },
        label: "",
        scale: Scale.LINEAR
    };

    let yAxisDefined = false;
    let yAxis: IDlogYAxis = {
        unit: UNKNOWN_UNIT,
        range: {
            min: 0,
            max: 1
        },
        label: "",
        channelIndex: -1
    };

    let yAxisScale = Scale.LINEAR;

    let yAxes: IDlogYAxis[] = [];

    let startTime = undefined;
    let hasJitterColumn = false;

    if (version == 1) {
        xAxis.step = readFloat(16);

        readColumns();

        startTime = new Date(readUInt32(24) * 1000);
        hasJitterColumn = version === 1 ? !!(readUInt16(10) & 0x0001) : false;
    } else {
        readFields();
        startTime = undefined;
        hasJitterColumn = false;
    }

    let length = (data.length - dataOffset) / (((hasJitterColumn ? 1 : 0) + yAxes.length) * 4);

    if (!yAxisDefined) {
        yAxis = yAxes[0];
    }

    return {
        version,
        comment,
        xAxis,
        yAxis,
        yAxisScale,
        yAxes,
        dataOffset,
        length,
        startTime,
        hasJitterColumn
    };
}

export function isDlog(dataSample: Uint8Array) {
    const dlog = decodeDlog(dataSample);
    if (dlog) {
        return {
            ext: "dlog",
            mime: MIME_EEZ_DLOG,
            comment: dlog.comment
        };
    }

    return undefined;
}

export function convertDlogToCsv(data: Uint8Array) {
    const dlog = decodeDlog(data);
    if (!dlog) {
        return undefined;
    }

    const buffer = Buffer.allocUnsafe(4);

    function readFloat(i: number) {
        buffer[0] = data[i];
        buffer[1] = data[i + 1];
        buffer[2] = data[i + 2];
        buffer[3] = data[i + 3];
        return buffer.readFloatLE(0);
    }

    const numColumns = (dlog.hasJitterColumn ? 1 : 0) + dlog.yAxes.length;

    const { getLocale } = require("eez-studio-shared/i10n") as typeof I10nModule;

    const locale = getLocale();

    // determine CSV separator depending of locale usage of ","
    let separator;
    if ((0.1).toLocaleString(locale).indexOf(",") != -1) {
        separator = ";";
    } else {
        separator = ",";
    }

    // first row contains column names
    let csv = "";

    if (dlog.xAxis.label) {
        csv += dlog.xAxis.label;
    } else {
        csv += dlog.xAxis.unit.name;
    }

    for (let columnIndex = 0; columnIndex < dlog.yAxes.length; columnIndex++) {
        csv += separator;
        if (dlog.yAxes[columnIndex].label) {
            csv += dlog.yAxes[columnIndex].label;
        } else {
            csv += dlog.yAxes[columnIndex].unit.name;
        }
    }

    csv += "\n";

    //
    for (let rowIndex = 0; rowIndex < dlog.length; rowIndex++) {
        csv += roundNumber(rowIndex * dlog.xAxis.step, 6).toLocaleString(locale);
        for (let columnIndex = 0; columnIndex < dlog.yAxes.length; columnIndex++) {
            csv += separator;
            csv += roundNumber(
                readFloat(
                    dlog.dataOffset +
                        4 * (rowIndex * numColumns + (dlog.hasJitterColumn ? 1 : 0) + columnIndex)
                ),
                6
            ).toLocaleString(locale);
        }
        csv += "\n";
    }

    return Buffer.from(csv, "utf8");
}

export function isDlogWaveform(activityLogEntry: IActivityLogEntry) {
    return checkMime(activityLogEntry.message, [MIME_EEZ_DLOG]);
}
