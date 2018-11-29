export function roundNumber(value: number, digits: number) {
    if (digits < 0) {
        digits = 0;
    }
    return parseFloat(value.toFixed(digits));
}
