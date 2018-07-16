export enum WaveformFormat {
    UNKNOWN,
    UINT8_ARRAY_OF_FLOATS,
    RIGOL_BYTE,
    RIGOL_WORD,
    CSV_STRING,
    EEZ_DLOG
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

const buffer = Buffer.allocUnsafe(4);

function readFloat(data: any, i: number) {
    buffer[0] = data[i];
    buffer[1] = data[i + 1];
    buffer[2] = data[i + 2];
    buffer[3] = data[i + 3];
    return buffer.readFloatLE(0);
}

export function initValuesAccesor(object: {
    // input
    format: WaveformFormat;
    values: any;
    offset: number;
    scale: number;
    // output
    length: number;
    value(value: number): number;
    waveformData(value: number): number;
}) {
    const values = object.values;
    const format = object.format;
    const offset = object.offset;
    const scale = object.scale;

    let length: number;
    let value: (value: number) => number;
    let waveformData: (value: number) => number;

    if (format === WaveformFormat.UINT8_ARRAY_OF_FLOATS) {
        length = Math.floor(values.length / 4);
        value = (index: number) => {
            const buffer = Buffer.allocUnsafe(4);
            buffer[0] = values[4 * index + 0];
            buffer[1] = values[4 * index + 1];
            buffer[2] = values[4 * index + 2];
            buffer[3] = values[4 * index + 3];
            return buffer.readFloatLE(0);
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
            return csvValues[index];
        };
        waveformData = value;
    } else if (format === WaveformFormat.EEZ_DLOG) {
        length = object.length;
        value = (index: number) => {
            return readFloat(values, offset + index * scale);
        };
        waveformData = value;
    } else {
        return;
    }

    object.length = length;
    object.value = value;
    object.waveformData = waveformData;
}
