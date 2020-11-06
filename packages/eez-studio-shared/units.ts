import { roundNumber } from "eez-studio-shared/roundNumber";
import { filterFloat } from "eez-studio-shared/validation-filters";

////////////////////////////////////////////////////////////////////////////////

export interface IUnit {
    name: string;
    color: string;
    colorInverse: string;
    unitSymbol: string;
    units: number[]; // @todo rename this
    precision: number;
    roundValue: (value: number) => number;
    formatValue: (value: number, precision?: number) => string;
    parseValue: (value: string) => number | null;
    clone(): IUnit;
}

////////////////////////////////////////////////////////////////////////////////

interface IUnitConfig {
    name: string;
    color: string;
    colorInverse: string;
    unitSymbol: string;
    units: number[];
    precision: number;
}

class Unit implements IUnit {
    name: string;
    color: string;
    colorInverse: string;
    unitSymbol: string;
    units: number[];
    precision: number;

    constructor(config: IUnitConfig) {
        this.name = config.name;
        this.color = config.color;
        this.colorInverse = config.colorInverse;
        this.unitSymbol = config.unitSymbol;
        this.units = config.units;
        this.precision = config.precision;
    }

    roundValue(value: number) {
        return roundNumber(value, this.precision);
    }

    formatValue(value: number, precision?: number, space?: string) {
        value = roundNumber(value, precision !== undefined ? precision : this.precision);

        const unitSymbol = this.unitSymbol;

        function result(roundedValue: number, dim: string) {
            if (roundedValue === 0) {
                return "0";
            }
            if (space === undefined) {
                space = "";
            }
            return roundedValue + space + dim + unitSymbol;
        }

        if (!(this instanceof TimeUnit)) {
            if (Math.abs(value) >= 1000000000) {
                return result(roundNumber(value / 1000000000, this.precision - 9), "G");
            }

            if (Math.abs(value) >= 1000000) {
                return result(roundNumber(value / 1000000, this.precision - 6), "M");
            }

            if (Math.abs(value) >= 1000) {
                return result(roundNumber(value / 1000, this.precision - 3), "K");
            }
        }

        if (this.precision >= 12 && Math.abs(value) < 0.000000001) {
            return result(roundNumber(value * 1000000000000, this.precision - 12), "p");
        }

        if (this.precision >= 9 && Math.abs(value) < 0.000001) {
            return result(roundNumber(value * 1000000000, this.precision - 9), "n");
        }

        if (this.precision >= 6 && Math.abs(value) < 0.001) {
            return result(roundNumber(value * 1000000, this.precision - 6), "u");
        }

        if (this.precision >= 3 && Math.abs(value) < 1) {
            return result(roundNumber(value * 1000, this.precision - 3), "m");
        }

        return result(value, "");
    }

    parseValue(value: string): number | null {
        value = value.replace(/\s*/g, "");

        if (!value) {
            return null;
        }

        let prefixes: { [prefix: string]: number };
        if (this instanceof TimeUnit) {
            prefixes = {
                p: -1000000000000,
                n: -1000000000,
                u: -1000000,
                m: -1000
            };
        } else {
            prefixes = {
                p: -1000000000000,
                n: -1000000000,
                u: -1000000,
                m: -1000,
                K: 1000,
                M: 1000000,
                G: 1000000000
            };
        }
        let power = 0;

        for (let prefix in prefixes) {
            const unit = prefix + this.unitSymbol;
            if (value.endsWith(unit)) {
                value = value.substr(0, value.length - unit.length);
                power = prefixes[prefix] as number;
                break;
            }
        }

        if (power === 0 && value.endsWith(this.unitSymbol)) {
            value = value.substr(0, value.length - this.unitSymbol.length);
        }

        let numValue = filterFloat(value);
        if (isNaN(numValue)) {
            return null;
        }

        if (power > 0) {
            numValue *= power;
        } else if (power < 0) {
            numValue /= -power;
        }

        return numValue;
    }

    clone() {
        return new Unit(this);
    }
}

////////////////////////////////////////////////////////////////////////////////

class TimeUnit extends Unit {
    constructor(
        config: IUnitConfig,
        private options: {
            customFormat: boolean;
        }
    ) {
        super(config);
    }

    formatValue(value: number, precision?: number) {
        if (!this.options.customFormat) {
            return super.formatValue(value, precision);
        }

        value = roundNumber(value, precision !== undefined ? precision : this.precision);

        if (value === 0) {
            return "0";
        }

        if (this.precision >= 12 && Math.abs(value) < 0.000000001) {
            return roundNumber(value * 1000000000000, this.precision - 12) + "ps";
        } else if (this.precision >= 9 && Math.abs(value) < 0.000001) {
            return roundNumber(value * 1000000000, this.precision - 9) + "ns";
        } else if (this.precision >= 6 && Math.abs(value) < 0.001) {
            return roundNumber(value * 1000000, this.precision - 6) + "us";
        } else if (this.precision >= 3 && Math.abs(value) < 1) {
            return roundNumber(value * 1000, this.precision - 3) + "ms";
        }

        let sign;
        if (value < 0) {
            value = -value;
            sign = "-";
        } else {
            sign = "";
        }

        let result = "";

        let d = Math.floor(value / (24 * 60 * 60));
        if (d >= 1) {
            result = d + "d";
            value -= d * 24 * 60 * 60;
        }

        let h = Math.floor(value / (60 * 60));
        if (h >= 1) {
            if (result.length) {
                result += " ";
            }
            result += h + "h";
            value -= h * 60 * 60;
        }

        let m = Math.floor(value / 60);
        if (m >= 1) {
            if (result.length) {
                result += " ";
            }
            result += m + "m";
            value -= m * 60;
        }

        value = roundNumber(value, this.precision);
        if (value > 0) {
            if (result.length) {
                result += " ";
            }

            result += value + "s";
        } else if (!result) {
            return "0";
        }

        return sign + result;
    }

    parseValue(value: string) {
        let result = super.parseValue(value);
        if (result !== null) {
            return result;
        }

        if (!this.options.customFormat) {
            return null;
        }

        result = 0;

        const suffixes: [string, number][] = [
            ["d", 24 * 60 * 60],
            ["h", 60 * 60],
            ["m", 60],
            ["s", 1]
        ];
        let suffixIndex = 0;

        const parts = value.split(/\s+/);
        for (let partIndex = 0; partIndex < parts.length; partIndex++) {
            let part = parts[partIndex].trim().toLowerCase();

            for (; suffixIndex < suffixes.length; suffixIndex++) {
                if (part.endsWith(suffixes[suffixIndex][0])) {
                    const partValue = filterFloat(part.substr(0, part.length - 1));
                    if (isNaN(partValue)) {
                        return null;
                    }
                    result += partValue * suffixes[suffixIndex][1];
                    break;
                }
            }

            if (suffixIndex == suffixes.length) {
                return null;
            }
        }

        return result;
    }

    clone() {
        return new TimeUnit(this, this.options);
    }
}

////////////////////////////////////////////////////////////////////////////////

const TIME_UNIT_CONFIG = {
    name: "time",
    color: "white",
    colorInverse: "black",
    unitSymbol: "s",
    units: [
        0.000000000001,
        0.00000000001,
        0.0000000001,
        0.000000001,
        0.00000001,
        0.0000001,
        0.000001,
        0.00001,
        0.0001,
        0.001,
        0.01,
        0.1,
        1,
        10,
        60,
        10 * 60,
        60 * 60,
        24 * 60 * 60,
        7 * 24 * 60 * 60,
        30 * 24 * 60 * 60,
        365 * 24 * 60 * 60
    ],
    precision: 12
};

export const TIME_UNIT = new TimeUnit(TIME_UNIT_CONFIG, {
    customFormat: true
});

export const TIME_UNIT_NO_CUSTOM_FORMAT = new TimeUnit(TIME_UNIT_CONFIG, {
    customFormat: false
});

export const VOLTAGE_UNIT = new Unit({
    name: "voltage",
    color: "#bb8100",
    colorInverse: "#bb8100",
    unitSymbol: "V",
    units: [
        0.000000000001,
        0.00000000001,
        0.0000000001,
        0.000000001,
        0.00000001,
        0.0000001,
        0.000001,
        0.00001,
        0.0001,
        0.001,
        0.005,
        0.01,
        0.05,
        0.1,
        0.5,
        1,
        5,
        10,
        50,
        100,
        1000,
        10000,
        100000,
        1000000,
        10000000,
        100000000,
        1000000000,
        10000000000
    ],
    precision: 12
});

export const CURRENT_UNIT = new Unit({
    name: "current",
    color: "#C830C8",
    colorInverse: "#C830C8",
    unitSymbol: "A",
    units: [
        0.000000000001,
        0.00000000001,
        0.0000000001,
        0.000000001,
        0.00000001,
        0.0000001,
        0.000001,
        0.00001,
        0.0001,
        0.001,
        0.005,
        0.01,
        0.05,
        0.1,
        0.5,
        1,
        5,
        10,
        100,
        1000,
        10000,
        100000,
        1000000,
        10000000,
        100000000,
        1000000000,
        10000000000
    ],
    precision: 12
});

export const POWER_UNIT = new Unit({
    name: "power",
    color: "#163b42",
    colorInverse: "#163b42",
    unitSymbol: "W",
    units: [
        0.000000000001,
        0.00000000001,
        0.0000000001,
        0.000000001,
        0.00000001,
        0.0000001,
        0.000001,
        0.00001,
        0.0001,
        0.001,
        0.005,
        0.01,
        0.05,
        0.1,
        0.5,
        1,
        5,
        10,
        100,
        1000,
        10000,
        100000,
        1000000,
        10000000,
        100000000,
        1000000000,
        10000000000
    ],
    precision: 12
});

export const JOULE_UNIT = new Unit({
    name: "joule",
    color: "#423b16",
    colorInverse: "#423b16",
    unitSymbol: "J",
    units: [
        0.000000000001,
        0.00000000001,
        0.0000000001,
        0.000000001,
        0.00000001,
        0.0000001,
        0.000001,
        0.00001,
        0.0001,
        0.001,
        0.005,
        0.01,
        0.05,
        0.1,
        0.5,
        1,
        5,
        10,
        100,
        1000,
        10000,
        100000,
        1000000,
        10000000,
        100000000,
        1000000000,
        10000000000
    ],
    precision: 12
});

export const FREQUENCY_UNIT = new Unit({
    name: "frequency",
    color: "white",
    colorInverse: "black",
    unitSymbol: "Hz",
    units: [
        0.000000000001,
        0.00000000001,
        0.0000000001,
        0.000000001,
        0.00000001,
        0.0000001,
        0.000001,
        0.00001,
        0.0001,
        0.001,
        0.01,
        0.1,
        1,
        10,
        100,
        1000,
        10000,
        100000,
        1000000,
        10000000,
        100000000,
        1000000000,
        10000000000
    ],
    precision: 12
});

export const SAMPLING_RATE_UNIT = new Unit({
    name: "sampling rate",
    color: "white",
    colorInverse: "black",
    unitSymbol: "S/s",
    units: [
        0.000000000001,
        0.00000000001,
        0.0000000001,
        0.000000001,
        0.00000001,
        0.0000001,
        0.000001,
        0.00001,
        0.0001,
        0.001,
        0.01,
        0.1,
        1,
        10,
        100,
        1000,
        10000,
        100000,
        1000000,
        10000000,
        100000000,
        1000000000,
        10000000000,
        100000000000,
        1000000000000
    ],
    precision: 12
});

export const DECIBEL_UNIT = new Unit({
    name: "decibel",
    color: "white",
    colorInverse: "black",
    unitSymbol: "dB",
    units: [
        0.000000000001,
        0.00000000001,
        0.0000000001,
        0.000000001,
        0.00000001,
        0.0000001,
        0.000001,
        0.00001,
        0.0001,
        0.001,
        0.01,
        0.1,
        1,
        10,
        100,
        1000,
        10000,
        100000,
        1000000,
        10000000,
        100000000,
        1000000000,
        10000000000,
        100000000000,
        1000000000000
    ],
    precision: 12
});

export const UNKNOWN_UNIT = new Unit({
    name: "unknown",
    color: "#a0a0a0",
    colorInverse: "#a0a0a0",
    unitSymbol: "",
    units: [
        0.000000000001,
        0.00000000001,
        0.0000000001,
        0.000000001,
        0.00000001,
        0.0000001,
        0.000001,
        0.00001,
        0.0001,
        0.001,
        0.005,
        0.01,
        0.05,
        0.1,
        0.5,
        1,
        5,
        10,
        50,
        100,
        1000,
        10000,
        100000,
        1000000,
        10000000,
        100000000,
        1000000000,
        10000000000
    ],
    precision: 12
});

export const UNITS = {
    time: TIME_UNIT_NO_CUSTOM_FORMAT,

    volt: VOLTAGE_UNIT,
    voltage: VOLTAGE_UNIT,

    amp: CURRENT_UNIT,
    amperage: CURRENT_UNIT,
    ampere: CURRENT_UNIT,
    current: CURRENT_UNIT,

    watt: POWER_UNIT,
    wattage: POWER_UNIT,
    power: POWER_UNIT,

    frequency: FREQUENCY_UNIT,

    "sampling rate": SAMPLING_RATE_UNIT,

    decibel: DECIBEL_UNIT,

    joule: JOULE_UNIT,

    unknown: UNKNOWN_UNIT,
    unkn: UNKNOWN_UNIT
};

export const format = Object.entries(UNITS).reduce((a, [key, { formatValue }]) => {
    a[key] = formatValue;
    return a;
}, {} as { [key: string]: (value: number, precision?: number) => string });

export const PREFIXES = {
    f: 0.000000000000001,
    p: 0.000000000001,
    n: 0.000000001,
    u: 0.000001,
    m: 0.001,
    "": 1,
    K: 1000,
    M: 1000000,
    G: 1000000000
};
