export enum WaveformFormat {
    UNKNOWN,
    FLOATS_32BIT,
    RIGOL_BYTE,
    RIGOL_WORD,
    CSV_STRING,
    EEZ_DLOG,
    JS_NUMBERS,
    FLOATS_64BIT
}

function getCsvValues(valuesArray: any) {
    var values = new Buffer(valuesArray.buffer).toString("binary");

    if (!values || !values.split) {
        return [];
    }
    let lines = values.split("\n").map(line => line.split(",").map(value => parseFloat(value)));
    if (lines.length === 1) {
        return lines[0];
    }
    return lines.map(line => line[0]);
}

const buffer = Buffer.allocUnsafe(8);

function readFloat(data: any, i: number) {
    buffer[0] = data[i];
    buffer[1] = data[i + 1];
    buffer[2] = data[i + 2];
    buffer[3] = data[i + 3];
    return buffer.readFloatLE(0);
}

function readDouble(data: any, i: number) {
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

export function initValuesAccesor(
    object: {
        // input
        format: WaveformFormat;
        values: any;
        offset: number;
        scale: number;
        // output
        length: number;
        value(value: number): number;
        waveformData(value: number): number;
    },
    disableNaNs: boolean = false
) {
    const values = object.values;
    const format = object.format;
    const offset = object.offset;
    const scale = object.scale;

    let length: number;
    let value: (value: number) => number;
    let waveformData: (value: number) => number;

    if (format === WaveformFormat.FLOATS_32BIT) {
        length = Math.floor(values.length / 4);
        value = (index: number) => {
            return offset + readFloat(values, 4 * index) * scale;
        };
        waveformData = value;
    } else if (format === WaveformFormat.FLOATS_64BIT) {
        length = Math.floor(values.length / 8);
        value = (index: number) => {
            return offset + readDouble(values, 8 * index) * scale;
        };
        waveformData = value;
    } else if (format === WaveformFormat.RIGOL_BYTE) {
        length = values.length;
        waveformData = (index: number) => {
            return values[index];
        };
        value = (index: number) => {
            return offset + waveformData(index) * scale;
        };
    } else if (format === WaveformFormat.RIGOL_WORD) {
        length = Math.floor(values.length / 2);
        waveformData = (index: number) => {
            return values[index];
        };
        value = (index: number) => {
            return offset + waveformData(index) * scale;
        };
    } else if (format === WaveformFormat.CSV_STRING) {
        const csvValues = getCsvValues(values);
        length = csvValues.length;
        value = (index: number) => {
            return offset + csvValues[index] * scale;
        };
        waveformData = value;
    } else if (format === WaveformFormat.EEZ_DLOG) {
        length = object.length;
        if (length === undefined) {
            length = values.length;
        }
        value = (index: number) => {
            return readFloat(values, offset + index * scale);
        };
        waveformData = value;
    } else if (format === WaveformFormat.JS_NUMBERS) {
        length = object.length;
        value = (index: number) => {
            return values[offset + index * scale];
        };
        waveformData = value;
    } else {
        return;
    }

    object.length = length;

    if (format === WaveformFormat.EEZ_DLOG && disableNaNs) {
        object.value = (index: number) => {
            let x = value(index);
            if (!isNaN(x)) {
                return x;
            }

            // find first non NaN on left or right
            const nLeft = index;
            const nRight = length - index - 1;

            const n = Math.min(nLeft, nRight);

            let k;
            for (k = 1; k <= n; ++k) {
                // check left
                x = value(index - k);
                if (!isNaN(x)) {
                    return x;
                }

                // check right
                x = value(index + k);
                if (!isNaN(x)) {
                    return x;
                }
            }

            if (nLeft > nRight) {
                index -= k;
                for (; index >= 0; --index) {
                    // check left
                    x = value(index);
                    if (!isNaN(x)) {
                        return x;
                    }
                }
            } else if (nLeft < nRight) {
                index += k;
                for (; index < length; ++index) {
                    // check right
                    x = value(index);
                    if (!isNaN(x)) {
                        return x;
                    }
                }
            }

            // give up
            return NaN;
        };
    } else {
        object.value = value;
    }

    object.waveformData = waveformData;
}
