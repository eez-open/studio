export function filterInteger(value: string) {
    if (/^(\-|\+)?[0-9]+$/.test(value)) {
        return Number(value);
    }
    return NaN;
}

export function filterFloat(value: string) {
    if (/^(\-|\+)?([0-9]+(\.[0-9]+)?([eE][-+]?[0-9]+)?|Infinity)$/.test(value)) {
        return Number(value);
    }
    return NaN;
}

export function filterNumber(value: string) {
    let num = filterFloat(value);
    if (isNaN(num)) {
        num = filterInteger(value);
    }
    return num;
}
