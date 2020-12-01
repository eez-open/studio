export enum Unit {
    UNIT_NONE = -1,
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
    UNIT_HERTZ,
    UNIT_MILLI_HERTZ,
    UNIT_KHERTZ,
    UNIT_MHERTZ,
    UNIT_JOULE,
    UNIT_FARAD,
    UNIT_MILLI_FARAD,
    UNIT_MICRO_FARAD,
    UNIT_NANO_FARAD,
    UNIT_PICO_FARAD,
    UNIT_MINUTES,
    UNIT_BIT
}

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

export interface IDlogXAxis<UnitType> {
    unit: UnitType;
    step: number;
    scale: Scale;
    range: {
        min: number;
        max: number;
    };
    label: string;
}

export interface IDlogYAxis<UnitType> {
    dlogUnit: Unit;
    unit: UnitType;
    range?: {
        min: number;
        max: number;
    };
    label?: string;
    channelIndex: number;
}

export interface IDlog<UnitType> {
    version: number;
    comment?: string;
    xAxis: IDlogXAxis<UnitType>;
    yAxis: IDlogYAxis<UnitType>;
    yAxes: IDlogYAxis<UnitType>[];
    yAxisScale: Scale;
    dataOffset: number;

    numFloatsPerRow: number;
    columnFloatIndexes: number[];

    length: number;

    // legacy, version 1
    startTime?: Date;
    hasJitterColumn: boolean;

    getValue(rowIndex: number, columnIndex: number): number;
}

const DLOG_MAGIC1 = 0x2d5a4545;
const DLOG_MAGIC2 = 0x474f4c44;
const DLOG_VERSION1 = 0x0001;
const DLOG_VERSION2 = 0x0002;

export function decodeDlog<UnitType>(
    data: Uint8Array,
    getUnit: (unit: Unit) => UnitType
): IDlog<UnitType> | undefined {
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

    function readColumns() {
        const columns = readUInt32(12);
        for (let iChannel = 0; iChannel < 8; iChannel++) {
            if (columns & (1 << (4 * iChannel))) {
                yAxes.push({
                    dlogUnit: Unit.UNIT_VOLT,
                    unit: getUnit(Unit.UNIT_VOLT),
                    channelIndex: iChannel
                });
            }

            if (columns & (2 << (4 * iChannel))) {
                yAxes.push({
                    dlogUnit: Unit.UNIT_AMPER,
                    unit: getUnit(Unit.UNIT_AMPER),
                    channelIndex: iChannel
                });
            }

            if (columns & (4 << (4 * iChannel))) {
                yAxes.push({
                    dlogUnit: Unit.UNIT_WATT,
                    unit: getUnit(Unit.UNIT_WATT),
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
                    yAxes.push({
                        dlogUnit: yAxis.dlogUnit,
                        unit: yAxis.unit,
                        range: yAxis.range
                            ? {
                                  min: yAxis.range.min,
                                  max: yAxis.range.max
                              }
                            : undefined,
                        label: yAxis.label,
                        channelIndex: yAxis.channelIndex
                    });
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
                    destYAxis.dlogUnit = readUInt8(offset);
                    destYAxis.unit = getUnit(destYAxis.dlogUnit);
                    offset++;
                } else if (fieldId === Fields.FIELD_ID_Y_RANGE_MIN) {
                    destYAxis.range!.min = readFloat(offset);
                    offset += 4;
                } else if (fieldId === Fields.FIELD_ID_Y_RANGE_MAX) {
                    destYAxis.range!.max = readFloat(offset);
                    offset += 4;
                } else if (fieldId === Fields.FIELD_ID_Y_LABEL) {
                    destYAxis.label = readString(
                        offset,
                        offset + fieldDataLength
                    );
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

    let xAxis: IDlogXAxis<UnitType> = {
        unit: getUnit(Unit.UNIT_SECOND),
        step: 1,
        range: {
            min: 0,
            max: 1
        },
        label: "",
        scale: Scale.LINEAR
    };

    let yAxisDefined = false;
    let yAxis: IDlogYAxis<UnitType> = {
        dlogUnit: Unit.UNIT_UNKNOWN,
        unit: getUnit(Unit.UNIT_UNKNOWN),
        range: {
            min: 0,
            max: 1
        },
        label: "",
        channelIndex: -1
    };

    let yAxisScale = Scale.LINEAR;

    let yAxes: IDlogYAxis<UnitType>[] = [];

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

    //
    let columnIndex = hasJitterColumn ? 1 : 0;
    let bitMask = 0;
    let columnFloatIndexes: number[] = [];

    for (let yAxisIndex = 0; yAxisIndex < yAxes.length; yAxisIndex++) {
        const yAxis = yAxes[yAxisIndex];

        columnFloatIndexes[yAxisIndex] = columnIndex;

        if (yAxis.dlogUnit === Unit.UNIT_BIT) {
            if (bitMask == 0) {
                bitMask = 0x8000;
            } else {
                bitMask >>= 1;
            }

            if (bitMask == 1) {
                columnIndex++;
                bitMask = 0;
            }
        } else {
            if (bitMask != 0) {
                columnIndex++;
                bitMask = 0;
            }

            columnIndex++;
        }
    }

    if (bitMask != 0) {
        columnIndex++;
    }

    let numFloatsPerRow = columnIndex;

    //
    let length = (data.length - dataOffset) / (numFloatsPerRow * 4);

    if (!yAxisDefined) {
        yAxis = yAxes[0];
    }

    const getValue = (rowIndex: number, columnIndex: number) => {
        const offset =
            dataOffset +
            4 * (rowIndex * numFloatsPerRow + columnFloatIndexes[columnIndex]);
        if (yAxes[columnIndex].dlogUnit == Unit.UNIT_BIT) {
            const data = readUInt32(offset);
            return data & (0x8000 >> yAxes[columnIndex].channelIndex)
                ? 1.0
                : 0.0;
        }
        return readFloat(offset);
    };

    return {
        version,
        comment,
        xAxis,
        yAxis,
        yAxisScale,
        yAxes,
        dataOffset,
        numFloatsPerRow,
        columnFloatIndexes,
        length,
        startTime,
        hasJitterColumn,
        getValue
    };
}
