// Frames of the BB3+ push port, see
// eez-bb3plus-cm5-firmware/src/bb3/push/push_protocol.h:
//
//     u32 length   of the type and the payload (little endian)
//     u8  type     FRAME_...
//         payload

export const PUSH_PORT = 5026;

export const FRAME_HEADER_SIZE = 5;

export const FRAME_SCPI_OUTPUT = 1;
export const FRAME_SCPI_DONE = 2;
export const FRAME_LOG = 3;
export const FRAME_DROPPED = 4;
export const FRAME_FIELD_CATALOG = 5;
export const FRAME_FIELD_VALUES = 6;
export const FRAME_SAMPLES = 7;
export const FRAME_SAMPLES_RANGE = 8;

// SUBScribe:FIELds interval limits, milliseconds
export const MIN_FIELDS_INTERVAL = 10;
export const MAX_FIELDS_INTERVAL = 10000;

// SUBScribe:SAMPles: the longest period (seconds) and the number of fields
// per connection
export const MAX_SAMPLES_PERIOD = 300;
export const MAX_SAMPLE_SUBSCRIPTIONS = 32;

// FRAME_SAMPLES: the header before the values
export const SAMPLES_HEADER_SIZE = 16;

// FRAME_SAMPLES_RANGE: the payload
export const SAMPLES_RANGE_SIZE = 11;

export const NUM_SLOTS = 5;

// Splits the received bytes into frames.
export class PushFrameParser {
    private buffer: Buffer = Buffer.alloc(0);

    append(data: Buffer) {
        this.buffer =
            this.buffer.length > 0 ? Buffer.concat([this.buffer, data]) : data;
    }

    // the next complete frame, undefined if there is none yet
    next(): { type: number; payload: Buffer } | undefined {
        for (;;) {
            if (this.buffer.length < FRAME_HEADER_SIZE) {
                return undefined;
            }
            const length = this.buffer.readUInt32LE(0);
            if (this.buffer.length < 4 + length) {
                return undefined;
            }
            if (length == 0) {
                // not a valid frame, skipped
                this.buffer = this.buffer.subarray(4);
                continue;
            }
            const type = this.buffer[4];
            const payload = this.buffer.subarray(FRAME_HEADER_SIZE, 4 + length);
            this.buffer = this.buffer.subarray(4 + length);
            return { type, payload };
        }
    }

    clear() {
        this.buffer = Buffer.alloc(0);
    }
}

export interface ScpiDone {
    durationUs: number;
    errors: number[];
}

// payload of FRAME_SCPI_DONE, undefined if it is not valid
export function parseScpiDone(payload: Buffer): ScpiDone | undefined {
    if (payload.length < 6) {
        return undefined;
    }
    const durationUs = payload.readUInt32LE(0);
    const numErrors = payload.readUInt16LE(4);
    if (payload.length < 6 + 2 * numErrors) {
        return undefined;
    }
    const errors: number[] = [];
    for (let i = 0; i < numErrors; i++) {
        errors.push(payload.readInt16LE(6 + 2 * i));
    }
    return { durationUs, errors };
}

// payload of FRAME_DROPPED: what BB3+ dropped since the last one
export function parseDropped(payload: Buffer) {
    if (payload.length < 8) {
        return { logRecords: 0, samples: 0 };
    }
    return {
        logRecords: payload.readUInt32LE(0),
        samples: payload.readUInt32LE(4)
    };
}

export interface SamplesFrame {
    slot: number;
    fieldIndex: number;
    generation: number;
    // the number of the first sample, from 0 at the start of the generation
    seq: number;
    // seconds per sample
    period: number;
    values: Float32Array;
}

// payload of FRAME_SAMPLES, undefined if it is not valid
export function parseSamples(payload: Buffer): SamplesFrame | undefined {
    if (payload.length < SAMPLES_HEADER_SIZE) {
        return undefined;
    }
    const count = payload.readUInt32LE(12);
    if (payload.length != SAMPLES_HEADER_SIZE + count * 4) {
        return undefined;
    }
    const values = new Float32Array(count);
    for (let i = 0; i < count; i++) {
        values[i] = payload.readFloatLE(SAMPLES_HEADER_SIZE + i * 4);
    }
    return {
        slot: payload[0],
        fieldIndex: payload.readUInt16LE(1),
        generation: payload[3],
        seq: payload.readUInt32LE(4),
        period: payload.readFloatLE(8),
        values
    };
}

// payload of FRAME_SAMPLES_RANGE: the full range of the values of a
// sampled field, what its stream can carry with the range and the
// calibration of the module in use; undefined if it is not valid
export function parseSamplesRange(
    payload: Buffer
): { slot: number; fieldIndex: number; min: number; max: number } | undefined {
    if (payload.length != SAMPLES_RANGE_SIZE) {
        return undefined;
    }
    const min = payload.readFloatLE(3);
    const max = payload.readFloatLE(7);
    if (!(min < max)) {
        return undefined;
    }
    return {
        slot: payload[0],
        fieldIndex: payload.readUInt16LE(1),
        min,
        max
    };
}

// the SCPI error numbers, e.g. "-113, -224"
export function formatScpiErrors(errors: number[]) {
    return errors.join(", ");
}
