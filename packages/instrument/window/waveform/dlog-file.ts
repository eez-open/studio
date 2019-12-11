import { IActivityLogEntry } from "eez-studio-shared/activity-log";
import {
    IUnit,
    TIME_UNIT,
    VOLTAGE_UNIT,
    CURRENT_UNIT,
    POWER_UNIT,
    UNITS
} from "eez-studio-shared/units";
import { roundNumber } from "eez-studio-shared/roundNumber";

import { MIME_EEZ_DLOG, checkMime } from "instrument/connection/file-type";

////////////////////////////////////////////////////////////////////////////////

enum Fields {
    FIELD_ID_X_UNIT = 10,
    FIELD_ID_X_STEP = 11,
    FIELD_ID_X_RANGE_MIN = 12,
    FIELD_ID_X_RANGE_MAX = 13,
    FIELD_ID_X_LABEL = 14,

    FIELD_ID_Y_UNIT = 30,
    FIELD_ID_Y_RANGE_MIN = 32,
    FIELD_ID_Y_RANGE_MAX = 33,
    FIELD_ID_Y_LABEL = 34,
    FIELD_ID_Y_CHANNEL_INDEX = 35,

    FIELD_ID_CHANNEL_MODULE_TYPE = 50,
    FIELD_ID_CHANNEL_MODULE_REVISION = 51
}

export interface IDlogXAxis {
    unit: IUnit;
    step: number;
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
    xAxis: IDlogXAxis;
    yAxes: IDlogYAxis[];
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

            if (fieldId === Fields.FIELD_ID_X_UNIT) {
                xAxis.unit = getUnit(readUInt8(offset));
                offset++;
            } else if (fieldId === Fields.FIELD_ID_X_STEP) {
                xAxis.step = readFloat(offset);
                offset += 4;
            } else if (fieldId === Fields.FIELD_ID_X_RANGE_MIN) {
                xAxis.range.min = readFloat(offset);
                offset += 4;
            } else if (fieldId === Fields.FIELD_ID_X_RANGE_MAX) {
                xAxis.range.max = readFloat(offset);
                offset += 4;
            } else if (fieldId === Fields.FIELD_ID_X_LABEL) {
                xAxis.label = "";
                for (let i = 0; i < fieldDataLength; i++) {
                    xAxis.label += readUInt8(offset);
                    offset++;
                }
            } else if (
                fieldId >= Fields.FIELD_ID_Y_UNIT &&
                fieldId <= Fields.FIELD_ID_Y_CHANNEL_INDEX
            ) {
                let yAxisIndex = readUInt8(offset);
                offset++;

                yAxisIndex--;
                while (yAxisIndex >= yAxes.length) {
                    yAxes.push({
                        unit: VOLTAGE_UNIT,
                        range: {
                            min: 0,
                            max: 1
                        },
                        label: "",
                        channelIndex: 0
                    });
                }

                fieldDataLength -= 1;

                if (fieldId === Fields.FIELD_ID_Y_UNIT) {
                    yAxes[yAxisIndex].unit = getUnit(readUInt8(offset));
                    offset++;
                } else if (fieldId === Fields.FIELD_ID_Y_RANGE_MIN) {
                    yAxes[yAxisIndex].range!.min = readFloat(offset);
                    offset += 4;
                } else if (fieldId === Fields.FIELD_ID_Y_RANGE_MAX) {
                    yAxes[yAxisIndex].range!.max = readFloat(offset);
                    offset += 4;
                } else if (fieldId === Fields.FIELD_ID_Y_LABEL) {
                    let label = "";
                    for (let i = 0; i < fieldDataLength; i++) {
                        label += readUInt8(offset);
                        offset++;
                    }
                    yAxes[yAxisIndex].label = label;
                } else if (fieldId === Fields.FIELD_ID_Y_CHANNEL_INDEX) {
                    yAxes[yAxisIndex].channelIndex = readUInt8(offset) - 1;
                    offset++;
                } else {
                    // unknown field, skip
                    offset += fieldDataLength;
                }
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

    let xAxis: IDlogXAxis = {
        unit: TIME_UNIT,
        step: 1,
        range: {
            min: 0,
            max: 1
        },
        label: ""
    };

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

    return {
        version,
        xAxis,
        yAxes,
        dataOffset,
        length,
        startTime,
        hasJitterColumn
    };
}

export function isDlog(dataSample: Uint8Array) {
    return !!decodeDlog(dataSample);
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

    let csv = "";
    for (let rowIndex = 0; rowIndex < dlog.length; rowIndex++) {
        for (let columnIndex = 0; columnIndex < dlog.yAxes.length; columnIndex++) {
            if (columnIndex > 0) {
                csv += ",";
            }
            csv += roundNumber(
                readFloat(
                    dlog.dataOffset +
                        4 * (rowIndex * numColumns + (dlog.hasJitterColumn ? 1 : 0) + columnIndex)
                ),
                6
            ).toString();
        }
        csv += "\n";
    }

    return Buffer.from(csv, "utf8");
}

export function isDlogWaveform(activityLogEntry: IActivityLogEntry) {
    return checkMime(activityLogEntry.message, [MIME_EEZ_DLOG]);
}
