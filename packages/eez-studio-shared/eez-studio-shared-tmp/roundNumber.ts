export function roundNumber(value: number, digits: number) {
    digits = digits - (Math.floor(Math.log(Math.abs(value)) / Math.log(10)) + 1);
    if (digits < 0) {
        digits = 0;
    } else if (digits > 32) {
        digits = 32;
    }
    return parseFloat(value.toFixed(digits));
}
