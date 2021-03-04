export enum Unit {
    UNIT_UNKNOWN = 255,
    UNIT_NONE = 0,
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
    UNIT_MINUTE
}

enum Fields {
    FIELD_ID_COMMENT = 1,

    FIELD_ID_START_TIME = 2,
    FIELD_ID_DURATION = 3,

    // If this field is equal to 1 then the first bit of the each row data
    // tells us if that row contains valid sample data  (1 - valid, 0 - invalid).
    // Default is 0.
    FIELD_ID_DATA_CONTAINS_SAMPLE_VALIDITY_BIT = 4,

    FIELD_ID_DATA_SIZE = 5, // no. of data rows

    FIELD_ID_BOOKMARKS_SIZE = 6, // no. of bookmarks

    FIELD_ID_X_UNIT = 10,
    FIELD_ID_X_STEP = 11,
    FIELD_ID_X_RANGE_MIN = 12,
    FIELD_ID_X_RANGE_MAX = 13,
    FIELD_ID_X_LABEL = 14,
    FIELD_ID_X_SCALE_TYPE = 15, // 0 - linear, 1 - logarithmic

    FIELD_ID_Y_UNIT = 30,
    FIELD_ID_Y_DATA_TYPE = 31, // default is DATA_TYPE_FLOAT
    FIELD_ID_Y_RANGE_MIN = 32,
    FIELD_ID_Y_RANGE_MAX = 33,
    FIELD_ID_Y_LABEL = 34,
    FIELD_ID_Y_CHANNEL_INDEX = 35,
    FIELD_ID_Y_SCALE_TYPE = 36, // 0 - linear, 1 - logarithmic
    FIELD_ID_Y_TRANSFORM_OFFSET = 37, // default is 0.0
    FIELD_ID_Y_TRANSFORM_SCALE = 38, // default is 1.0
    FIELD_ID_Y_LAST_FIELD,

    FIELD_ID_CHANNEL_MODULE_TYPE = 50,
    FIELD_ID_CHANNEL_MODULE_REVISION = 51
}

export enum DataType {
    DATA_TYPE_BIT, // supported
    DATA_TYPE_INT8,
    DATA_TYPE_UINT8,
    DATA_TYPE_INT16,
    DATA_TYPE_INT16_BE, // supported
    DATA_TYPE_UINT16,
    DATA_TYPE_UINT16_BE,
    DATA_TYPE_INT24,
    DATA_TYPE_INT24_BE, // supported
    DATA_TYPE_UINT24,
    DATA_TYPE_UINT24_BE,
    DATA_TYPE_INT32,
    DATA_TYPE_INT32_BE,
    DATA_TYPE_UINT32,
    DATA_TYPE_UINT32_BE,
    DATA_TYPE_INT64,
    DATA_TYPE_INT64_BE,
    DATA_TYPE_UINT64,
    DATA_TYPE_UINT64_BE,
    DATA_TYPE_FLOAT, // supported
    DATA_TYPE_FLOAT_BE,
    DATA_TYPE_DOUBLE,
    DATA_TYPE_DOUBLE_BE,
};

export enum ScaleType {
    LINEAR,
    LOGARITHMIC
}

export interface IDlogXAxis<UnitType> {
    unit: UnitType;
    step: number;
    scaleType: ScaleType;
    range: {
        min: number;
        max: number;
    };
    label: string;
}

export interface IDlogYAxis<UnitType> {
    dlogUnit: Unit;
    dataType: DataType;
    unit: UnitType;
    range?: {
        min: number;
        max: number;
    };
    label?: string;
    channelIndex: number;
    transformOffset: number;
    transformScale: number;
}

interface DlogBookmark {
    value: number;
    text: string;
}

export interface IDlog<UnitType> {
    version: number;
    comment?: string;
    xAxis: IDlogXAxis<UnitType>;
    yAxis: IDlogYAxis<UnitType>;
    yAxes: IDlogYAxis<UnitType>[];
    yAxisScaleType: ScaleType;
    dataOffset: number;

    bookmarks: DlogBookmark[];

    dataContainsSampleValidityBit: boolean;
    columnDataIndexes: number[];
    columnBitMask: number[];
    numBytesPerRow: number;

    length: number;

    // legacy, version 1
    startTime?: Date;
    duration: Number;
    hasJitterColumn: boolean;

    getValue(rowIndex: number, columnIndex: number): number;
}

const NUM_BYTES_PER_BOOKMARK_IN_INDEX = 8;

const DLOG_MAGIC1 = 0x2d5a4545;
const DLOG_MAGIC2 = 0x474f4c44;
const DLOG_VERSION1 = 0x0001;
const DLOG_VERSION2 = 0x0002;

export function decodeDlog<UnitType>(
    data: Uint8Array,
    getUnit: (unit: Unit) => UnitType
): IDlog<UnitType> | undefined {
    const buffer = Buffer.allocUnsafe(8);

    function readFloat(i: number) {
        buffer[0] = data[i];
        buffer[1] = data[i + 1];
        buffer[2] = data[i + 2];
        buffer[3] = data[i + 3];
        return buffer.readFloatLE(0);
    }

    function readDouble(i: number) {
        buffer[0] = data[i];
        buffer[1] = data[i + 1];
        buffer[2] = data[i + 2];
        buffer[3] = data[i + 3];
        buffer[4] = data[i + 4];
        buffer[5] = data[i + 5];
        buffer[6] = data[i + 6];
        buffer[7] = data[i + 7];
        return buffer.readDoubleLE(0);
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

    function readInt16BE(i: number) {
        buffer[0] = data[i];
        buffer[1] = data[i + 1];
        return buffer.readInt16BE(0);
    }

    function readInt24BE(i: number) {
        buffer[0] = data[i];
        buffer[1] = data[i + 1];
        buffer[1] = data[i + 1];
        buffer[3] = 0;
        return buffer.readInt32BE(0) >> 8;
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
                    dataType: DataType.DATA_TYPE_FLOAT,
                    unit: getUnit(Unit.UNIT_VOLT),
                    channelIndex: iChannel,
                    transformOffset: 0,
                    transformScale: 1.0
                });
            }

            if (columns & (2 << (4 * iChannel))) {
                yAxes.push({
                    dlogUnit: Unit.UNIT_AMPER,
                    dataType: DataType.DATA_TYPE_FLOAT,
                    unit: getUnit(Unit.UNIT_AMPER),
                    channelIndex: iChannel,
                    transformOffset: 0,
                    transformScale: 1.0
                });
            }

            if (columns & (4 << (4 * iChannel))) {
                yAxes.push({
                    dlogUnit: Unit.UNIT_WATT,
                    dataType: DataType.DATA_TYPE_FLOAT,
                    unit: getUnit(Unit.UNIT_WATT),
                    channelIndex: iChannel,
                    transformOffset: 0,
                    transformScale: 1.0
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
            } else if (fieldId === Fields.FIELD_ID_START_TIME) {
                startTime = new Date(readUInt32(offset) * 1000);
                offset += 4;
            } else if (fieldId === Fields.FIELD_ID_DURATION) {
                duration = readDouble(offset);
                offset += 8;
            } else if (fieldId === Fields.FIELD_ID_DATA_CONTAINS_SAMPLE_VALIDITY_BIT) {
                dataContainsSampleValidityBit = !!readUInt8(offset);
                offset++;
            } else if (fieldId === Fields.FIELD_ID_DATA_SIZE) {
                dataSize = readUInt32(offset);
                offset += 4;
            } else if (fieldId === Fields.FIELD_ID_BOOKMARKS_SIZE) {
                bookmarksSize = readUInt32(offset);
                offset += 4;
            } else if (fieldId === Fields.FIELD_ID_X_UNIT) {
                xAxis.unit = getUnit(readUInt8(offset));
                offset++;
            } else if (fieldId === Fields.FIELD_ID_X_STEP) {
                xAxis.step = readFloat(offset);
                offset += 4;
            } else if (fieldId === Fields.FIELD_ID_X_SCALE_TYPE) {
                xAxis.scaleType = readUInt8(offset);
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
                fieldId < Fields.FIELD_ID_Y_LAST_FIELD
            ) {
                let yAxisIndex = readUInt8(offset);
                offset++;

                yAxisIndex--;
                while (yAxisIndex >= yAxes.length) {
                    yAxes.push({
                        dlogUnit: yAxis.dlogUnit,
                        dataType: DataType.DATA_TYPE_FLOAT,
                        unit: yAxis.unit,
                        range: yAxis.range
                            ? {
                                  min: yAxis.range.min,
                                  max: yAxis.range.max
                              }
                            : undefined,
                        label: yAxis.label,
                        channelIndex: yAxis.channelIndex,
                        transformOffset: 0,
                        transformScale: 1.0
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
                } else if (fieldId === Fields.FIELD_ID_Y_DATA_TYPE) {
                    destYAxis.dataType = readUInt8(offset);
                    offset++;
                } else if (fieldId === Fields.FIELD_ID_Y_RANGE_MIN) {
                    destYAxis.range!.min = readFloat(offset);
                    offset += 4;
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
                } else if (fieldId === Fields.FIELD_ID_Y_TRANSFORM_OFFSET) {
                    destYAxis.transformOffset = readDouble(offset);
                    offset += 8;
                } else if (fieldId === Fields.FIELD_ID_Y_TRANSFORM_SCALE) {
                    destYAxis.transformScale = readDouble(offset);
                    offset += 8;
                } else {
                    // unknown field, skip
                    offset += fieldDataLength;
                }
            } else if (fieldId === Fields.FIELD_ID_Y_SCALE_TYPE) {
                yAxisScaleType = readUInt8(offset);
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
        scaleType: ScaleType.LINEAR
    };

    let yAxisDefined = false;
    let yAxis: IDlogYAxis<UnitType> = {
        dlogUnit: Unit.UNIT_UNKNOWN,
        dataType: DataType.DATA_TYPE_FLOAT,
        unit: getUnit(Unit.UNIT_UNKNOWN),
        range: {
            min: 0,
            max: 1
        },
        label: "",
        channelIndex: -1,
        transformOffset: 0,
        transformScale: 1.0
    };

    let yAxisScaleType = ScaleType.LINEAR;

    let yAxes: IDlogYAxis<UnitType>[] = [];

    let startTime = undefined;
    let duration = 0;
    let dataContainsSampleValidityBit = false;
    let hasJitterColumn = false;

    let dataSize = 0;
    let bookmarksSize = 0;

    if (version == 1) {
        xAxis.step = readFloat(16);

        readColumns();

        startTime = new Date(readUInt32(24) * 1000);
        hasJitterColumn = version === 1 ? !!(readUInt16(10) & 0x0001) : false;
    } else {
        readFields();
        hasJitterColumn = false;
    }

    //
    let hasIsValidBit = false;
    let columnDataIndexes: number[] = [];
    let columnBitMask: number[] = [];
    let numBytesPerRow: number = 0;

    for (let yAxisIndex = 0; yAxisIndex < yAxes.length; yAxisIndex++) {
        const yAxis = yAxes[yAxisIndex];
        if (yAxis.dataType != DataType.DATA_TYPE_FLOAT) {
            hasIsValidBit = true;
            break;
        }
    }

    let columnDataIndex = hasJitterColumn ? 1 : 0;
    let bitMask = 0;

    if (hasIsValidBit) {
        bitMask = 0x80;
    }

    for (let yAxisIndex = 0; yAxisIndex < yAxes.length; yAxisIndex++) {
        const yAxis = yAxes[yAxisIndex];

        if (yAxis.dataType == DataType.DATA_TYPE_BIT) {
            if (bitMask == 0) {
                bitMask = 0x80;
            } else {
                bitMask >>= 1;
            }

            columnDataIndexes[yAxisIndex] = columnDataIndex;
            columnBitMask[yAxisIndex] = bitMask;

            if (bitMask == 1) {
                columnDataIndex += 1;
                bitMask = 0;
            }
        } else {
            if (bitMask != 0) {
                columnDataIndex += 1;
                bitMask = 0;
            }

            columnDataIndexes[yAxisIndex] = columnDataIndex;

            if (yAxis.dataType == DataType.DATA_TYPE_INT16_BE) {
                columnDataIndex += 2;
            } else if (yAxis.dataType == DataType.DATA_TYPE_INT24_BE) {
                columnDataIndex += 3;
            } else if (yAxis.dataType == DataType.DATA_TYPE_FLOAT) {
                columnDataIndex += 4;
            } else {
                console.error("Unknown data type", yAxis.dataType);
            }
        }
    }

    if (bitMask != 0) {
        columnDataIndex += 1;
    }

    numBytesPerRow = columnDataIndex;

    const bookmarks: DlogBookmark[] = [];
    if (dataSize != 0) {
        let offset = dataOffset + dataSize * numBytesPerRow;
        let textOffset = offset + (bookmarksSize + 1) * NUM_BYTES_PER_BOOKMARK_IN_INDEX;
        for (let i = 0; i < bookmarksSize; i++) {
            let sampleIndex = readUInt32(offset);
            offset += 4;

            let textIndexStart = readUInt32(offset);
            offset += 4;

            let textIndexEnd = readUInt32(offset + 4);

            let text = readString(textOffset + textIndexStart, textOffset + textIndexEnd);
            bookmarks.push({
                value: sampleIndex * xAxis.step,
                text
            });
        }
    }

    //
    let length = dataSize != 0 ? dataSize : (data.length - dataOffset) / numBytesPerRow;

    if (!yAxisDefined) {
        yAxis = yAxes[0];
    }

    const getValue = (rowIndex: number, columnIndex: number) => {
        let offset = dataOffset + rowIndex * numBytesPerRow;

        if (!hasIsValidBit || (readUInt8(offset) & 0x80)) {
            offset += columnDataIndexes[columnIndex];

            const dataType = yAxes[columnIndex].dataType;

            if (dataType == DataType.DATA_TYPE_BIT) {
                return readUInt8(offset) & columnBitMask[columnIndex] ? 1.0 : 0.0;
            }
            if (dataType == DataType.DATA_TYPE_INT16_BE) {
                return yAxis.transformOffset + yAxis.transformScale * readInt16BE(offset);
            }
            if (dataType == DataType.DATA_TYPE_INT24_BE) {
                return yAxis.transformOffset + yAxis.transformScale * readInt24BE(offset);
            }

            if (yAxis.dataType == DataType.DATA_TYPE_FLOAT) {
                return readFloat(offset);
            }

            console.error("Unknown data type", yAxis.dataType);
        }

        return NaN;
    };

    return {
        version,
        comment,
        xAxis,
        yAxis,
        yAxisScaleType,
        yAxes,
        dataOffset,
        bookmarks,
        columnDataIndexes,
        columnBitMask,
        numBytesPerRow,
        length,
        startTime,
        duration,
        dataContainsSampleValidityBit,
        hasJitterColumn,
        getValue
    };
}
