export function roundNumber(value: number, digits: number) {
    digits = digits - (Math.floor(Math.log(Math.abs(value)) / Math.log(10)) + 1);
    if (digits < 0) {
        digits = 0;
    } else if (digits > 32) {
        digits = 32;
    }
    return parseFloat(value.toFixed(digits));
}

// For example, if numDecimalDigits is 2 it will round:
// 123.45678V as 123.46V
// 1234.5678V as 123, i.e. 1.23KV
// 0.12345678V as 0.12346, i.e. 123.46 mV
export function roundNumberWithMaxNumberOfDecimalDigits(value: number, numDecimalDigits: number) {
    if (Math.abs(value) < Number.EPSILON) {
        return value;
    }

    const f =
        Math.pow(10, numDecimalDigits) /
        Math.pow(1000, Math.floor(Math.log(Math.abs(value)) / Math.log(1000)));

    return Math.round(value * f) / f;
}
