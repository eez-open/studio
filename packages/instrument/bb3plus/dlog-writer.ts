// DLOG file (version 2, see eez-bb3plus-cm5-firmware/src/bb3/dlog/dlog_file.h)
// of the scope traces, with the fields of a BB3+ recording from the module
// streams (dlog_record.cpp): a float column per analog trace, a bit column
// per pin of a bit field, the parts of the names and the colors of the
// columns, a validity bit in each row if there are bit columns.

import { DataType } from "eez-studio-ui/chart/DataType";
import { Unit } from "instrument/window/waveform/dlog-file";

const MAGIC1 = 0x2d5a4545; // "EEZ-"
const MAGIC2 = 0x474f4c44; // "DLOG"
const VERSION = 2;
const HEADER_SIZE = 16;

// the meta fields of dlog_file.h
const FIELD_ID_COMMENT = 1;
const FIELD_ID_START_TIME = 2;
const FIELD_ID_DURATION = 3;
const FIELD_ID_DATA_CONTAINS_SAMPLE_VALIDITY_BIT = 4;
const FIELD_ID_DATA_SIZE = 5;
const FIELD_ID_BOOKMARKS_SIZE = 6;
const FIELD_ID_X_UNIT = 10;
const FIELD_ID_X_STEP = 11;
const FIELD_ID_X_RANGE_MIN = 12;
const FIELD_ID_X_RANGE_MAX = 13;
const FIELD_ID_X_LABEL = 14;
const FIELD_ID_X_SCALE_TYPE = 15;
const FIELD_ID_Y_UNIT = 30;
const FIELD_ID_Y_DATA_TYPE = 31;
const FIELD_ID_Y_RANGE_MIN = 32;
const FIELD_ID_Y_RANGE_MAX = 33;
const FIELD_ID_Y_LABEL = 34;
const FIELD_ID_Y_SCALE_TYPE = 36;
const FIELD_ID_Y_TRANSFORM_OFFSET = 37;
const FIELD_ID_Y_TRANSFORM_SCALE = 38;
const FIELD_ID_Y_MODULE = 39;
const FIELD_ID_Y_SLOT = 40;
const FIELD_ID_Y_CHANNEL = 41;
const FIELD_ID_Y_SLOT_LABEL = 42;
const FIELD_ID_Y_CHANNEL_LABEL = 43;
const FIELD_ID_Y_PIN_LABEL = 44;
const FIELD_ID_Y_COLOR = 45;
const FIELD_ID_Y_CHANNEL_COLOR = 46;

export interface DlogColumn {
    // the samples of the trace, NaN where missing; a bit column is the bit
    // bitIndex of the values (a missing one is 0)
    values: Float32Array;
    bitIndex?: number;
    unit: Unit;
    // the full range of the values (a bit column 0 - 1)
    rangeMin: number;
    rangeMax: number;
    // the item label: "U", "AIN1", "DIN3"
    label: string;
    // the parts of the name and the colors (FIELD_ID_Y_MODULE ..), none
    // without a slot
    module?: string;
    slot?: number;
    // the module channel, from 1
    channel?: number;
    slotLabel?: string;
    channelLabel?: string;
    pinLabel?: string;
    color?: string;
    channelColor?: string;
}

export interface DlogParameters {
    comment: string;
    // UTC, seconds since 1970
    startTime: number;
    // seconds per row
    period: number;
    numRows: number;
    columns: DlogColumn[];
}

// the meta fields, as dlog_file::Writer writes them
class MetaWriter {
    parts: Buffer[] = [];

    private field(id: number, index: number | undefined, value: Buffer) {
        const header = Buffer.alloc(index == undefined ? 3 : 4);
        header.writeUInt16LE(header.length + value.length, 0);
        header.writeUInt8(id, 2);
        if (index != undefined) {
            header.writeUInt8(index, 3);
        }
        this.parts.push(header, value);
    }

    u8(id: number, value: number, index?: number) {
        this.field(id, index, Buffer.from([value]));
    }

    u32(id: number, value: number) {
        const buffer = Buffer.alloc(4);
        buffer.writeUInt32LE(value, 0);
        this.field(id, undefined, buffer);
    }

    float(id: number, value: number, index?: number) {
        const buffer = Buffer.alloc(4);
        buffer.writeFloatLE(value, 0);
        this.field(id, index, buffer);
    }

    double(id: number, value: number, index?: number) {
        const buffer = Buffer.alloc(8);
        buffer.writeDoubleLE(value, 0);
        this.field(id, index, buffer);
    }

    string(id: number, value: string, index?: number) {
        this.field(id, index, Buffer.from(value, "utf8"));
    }
}

const isBitColumn = (column: DlogColumn) => column.bitIndex != undefined;

export function encodeDlog(parameters: DlogParameters) {
    const { columns, numRows, period } = parameters;
    const validityBit = columns.some(isBitColumn);
    const duration = numRows * period;

    const meta = new MetaWriter();
    meta.string(FIELD_ID_COMMENT, parameters.comment);
    meta.u32(FIELD_ID_START_TIME, parameters.startTime);
    meta.double(FIELD_ID_DURATION, duration);
    meta.u8(FIELD_ID_DATA_CONTAINS_SAMPLE_VALIDITY_BIT, validityBit ? 1 : 0);
    meta.u32(FIELD_ID_DATA_SIZE, numRows);
    meta.u32(FIELD_ID_BOOKMARKS_SIZE, 0);
    meta.u8(FIELD_ID_X_UNIT, Unit.UNIT_SECOND);
    meta.float(FIELD_ID_X_STEP, period);
    meta.u8(FIELD_ID_X_SCALE_TYPE, 0);
    meta.float(FIELD_ID_X_RANGE_MIN, 0);
    meta.float(FIELD_ID_X_RANGE_MAX, duration);
    meta.string(FIELD_ID_X_LABEL, "");

    // no default Y axis (its unit is unknown), so every column has all its
    // fields, index 1 .. number of columns
    columns.forEach((column, i) => {
        const index = i + 1;
        meta.u8(FIELD_ID_Y_UNIT, column.unit, index);
        meta.u8(
            FIELD_ID_Y_DATA_TYPE,
            isBitColumn(column) ? DataType.DATA_TYPE_BIT : DataType.DATA_TYPE_FLOAT,
            index
        );
        meta.float(FIELD_ID_Y_RANGE_MIN, column.rangeMin, index);
        meta.float(FIELD_ID_Y_RANGE_MAX, column.rangeMax, index);
        meta.string(FIELD_ID_Y_LABEL, column.label, index);
        meta.double(FIELD_ID_Y_TRANSFORM_OFFSET, 0, index);
        meta.double(FIELD_ID_Y_TRANSFORM_SCALE, 1, index);
        if (column.slot) {
            meta.string(FIELD_ID_Y_MODULE, column.module ?? "", index);
            meta.u8(FIELD_ID_Y_SLOT, column.slot, index);
            meta.u8(FIELD_ID_Y_CHANNEL, column.channel ?? 0, index);
            meta.string(FIELD_ID_Y_SLOT_LABEL, column.slotLabel ?? "", index);
            meta.string(
                FIELD_ID_Y_CHANNEL_LABEL,
                column.channelLabel ?? "",
                index
            );
            if (column.pinLabel) {
                meta.string(FIELD_ID_Y_PIN_LABEL, column.pinLabel, index);
            }
            meta.string(FIELD_ID_Y_COLOR, column.color ?? "", index);
            meta.string(
                FIELD_ID_Y_CHANNEL_COLOR,
                column.channelColor ?? "",
                index
            );
        }
    });
    meta.u8(FIELD_ID_Y_SCALE_TYPE, 0);

    // the end of the meta fields, the rows start at a multiple of 4
    const metaSize = meta.parts.reduce((size, part) => size + part.length, 0);
    const metaEnd = HEADER_SIZE + metaSize + 2;
    const dataOffset = Math.ceil(metaEnd / 4) * 4;

    // A row: the validity bit, the bit columns from the most significant bit
    // of a byte down, a float column at the next byte, the row ends at the
    // end of a byte (dlog_file::Writer writeBit / flushBits).
    let rowSize = 0;
    {
        let mask = 0;
        const bit = () => {
            mask = mask == 0 ? 0x80 : mask >> 1;
            if (mask == 1) {
                rowSize++;
                mask = 0;
            }
        };
        const flush = () => {
            if (mask != 0) {
                rowSize++;
                mask = 0;
            }
        };
        if (validityBit) {
            bit();
        }
        for (const column of columns) {
            if (isBitColumn(column)) {
                bit();
            } else {
                flush();
                rowSize += 4;
            }
        }
        flush();
    }

    const file = Buffer.alloc(dataOffset + numRows * rowSize);
    file.writeUInt32LE(MAGIC1, 0);
    file.writeUInt32LE(MAGIC2, 4);
    file.writeUInt16LE(VERSION, 8);
    file.writeUInt16LE(columns.length, 10);
    file.writeUInt32LE(dataOffset, 12);
    let offset = HEADER_SIZE;
    for (const part of meta.parts) {
        part.copy(file, offset);
        offset += part.length;
    }
    // the U16 0 and the padding are already 0

    offset = dataOffset;
    let bits = 0;
    let mask = 0;
    const writeBit = (on: boolean) => {
        mask = mask == 0 ? 0x80 : mask >> 1;
        if (on) {
            bits |= mask;
        }
        if (mask == 1) {
            flushBits();
        }
    };
    const flushBits = () => {
        if (mask != 0) {
            file[offset++] = bits;
            bits = 0;
            mask = 0;
        }
    };
    for (let row = 0; row < numRows; row++) {
        if (validityBit) {
            // a row without any sample is not valid
            let valid = false;
            for (let i = 0; i < columns.length && !valid; i++) {
                valid = !isNaN(columns[i].values[row]);
            }
            writeBit(valid);
        }
        for (const column of columns) {
            const value = column.values[row];
            if (isBitColumn(column)) {
                writeBit(!isNaN(value) && ((value >> column.bitIndex!) & 1) != 0);
            } else {
                flushBits();
                file.writeFloatLE(value, offset);
                offset += 4;
            }
        }
        flushBits();
    }

    return file;
}
