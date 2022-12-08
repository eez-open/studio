
/**
 * Rounds equivalently to PHP_ROUND_HALF_UP in PHP.
 * @param n input number
 * @returns rounded result
 */
export function round_half_up(n: number): number {
    if(n < 0) {
        /* Ugly hack that makes sure -1.5 rounds to -2 */
        n -= 0.0000001;
    }
    return Math.round(n);
}

export function str_pad(str: string, n: number, padding: string, left?: boolean): string {
    if(left) {
        return str.padStart(n, padding);
    } else
        return str.padEnd(n, padding);
}

export function dechex(n: number): string {
    return n.toString(16);
}