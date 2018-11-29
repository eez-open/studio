export function filterFloat(value: string) {
    if (/^(\-|\+)?([0-9]+(\.[0-9]+)?([eE][-+]?[0-9]+)?|Infinity)$/.test(value)) {
        return Number(value);
    }
    return NaN;
}
