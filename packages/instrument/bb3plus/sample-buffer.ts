// Samples of a scope trace: the newest ones of a sampled module field
// (FRAME_SAMPLES of the BB3+ push port) and their times.
//
// Time of a sample: time(n) = t0 + n * period, n is the number of the sample
// from the start of the generation (gaps included). t0 is estimated from the
// time the chunks arrive: a sample can't arrive before it was taken, so each
// chunk gives an upper bound of t0 (arrival - n of its last sample * period),
// t0 is the lowest one. So the network jitter doesn't move the samples, and
// the traces of a module (their chunks come in the same frames) line up. t0
// may move up by CLOCK_CREEP per second, the clock of the module can be
// slower than the clock of the PC.
//
// The minimum and the maximum of each block of BLOCK_SIZES samples are kept
// as the samples come, so the envelope of a long window (many samples per
// pixel column) is made from the blocks, not from all the samples.

// the most samples a buffer keeps (32 MB of floats)
export const MAX_BUFFER_SAMPLES = 8 * 1024 * 1024;

// t0 may move up this much per second (200 ppm)
export const CLOCK_CREEP = 2e-4;

// samples per block of the block levels, a pixel column takes at most 7
// blocks of a level at each end
const BLOCK_SIZES = [8, 64, 512, 4096, 32768];

function createLevels(capacity: number) {
    return BLOCK_SIZES.map(size => new BlockLevel(size, capacity));
}

// The minimum and the maximum of the samples of each block (the numbers
// block * size to block * size + size - 1), in a ring like the samples. A
// block of only NaN has min > max.
class BlockLevel {
    min: Float32Array;
    max: Float32Array;
    // the block in each slot, -1 if none
    blocks: Float64Array;

    constructor(
        public size: number,
        capacity: number
    ) {
        const count = Math.ceil(capacity / size) + 2;
        this.min = new Float32Array(count);
        this.max = new Float32Array(count);
        this.blocks = new Float64Array(count).fill(-1);
    }

    // the minimum and the maximum of the sample or the smaller block that
    // ends at number into its block, the slot of the block
    add(number: number, min: number, max: number) {
        const block = Math.floor(number / this.size);
        const slot = block % this.blocks.length;
        if (this.blocks[slot] != block) {
            this.blocks[slot] = block;
            this.min[slot] = Infinity;
            this.max[slot] = -Infinity;
        }
        // NaN changes neither
        if (min < this.min[slot]) {
            this.min[slot] = min;
        }
        if (max > this.max[slot]) {
            this.max[slot] = max;
        }
        return slot;
    }

    // the slot of the block of the samples from number (a multiple of size),
    // -1 if it isn't kept
    getSlot(number: number) {
        const block = number / this.size;
        const slot = block % this.blocks.length;
        return this.blocks[slot] == block ? slot : -1;
    }
}

export class SampleBuffer {
    private span = 1;
    private data = new Float32Array(0);
    // from the smallest blocks
    private levels = createLevels(0);
    private start = 0;
    private _size = 0;
    private generation = -1;
    private nextSeq = 0;
    private nextNumber = 0;
    private _period = 0;
    private t0 = 0;
    private lastArrival = 0;
    gapSamples = 0;

    // the result of getMinMax
    private resultMin = 0;
    private resultMax = 0;

    // The min and the max of the complete columns of getWindowPoints (all
    // their samples in the window and kept): they don't change, the samples
    // of a number never do. A ring by the column number, for the column width
    // columnStep; cleared with the samples or when the width changes.
    private columnStep = 0;
    private columnNumbers = new Float64Array(0);
    private columnMins = new Float32Array(0);
    private columnMaxs = new Float32Array(0);

    // keeps the newest samples of this many seconds
    setSpan(seconds: number) {
        this.span = seconds;
        this.clear();
    }

    clear() {
        this.data = new Float32Array(0);
        this.levels = createLevels(0);
        this.start = 0;
        this._size = 0;
        this.generation = -1;
        this.nextSeq = 0;
        this.nextNumber = 0;
        this._period = 0;
        this.t0 = 0;
        this.lastArrival = 0;
        this.gapSamples = 0;
        this.columnStep = 0;
    }

    // the column width of getWindowPoints: a width within the rounding errors
    // of the one before is the same width (the same columns, the cache stays)
    private setColumnStep(step: number, pixels: number) {
        // without the rounding errors of the time window: a column boundary
        // is ceil(column * step), a step of 5.000000000001 instead of 5 would
        // move all of them by a sample
        step = +step.toPrecision(9);
        if (Math.abs(step - this.columnStep) <= this.columnStep * 1e-9) {
            return this.columnStep;
        }
        this.columnStep = step;
        // the columns of a window and some more
        const size = pixels * 2 + 16;
        if (this.columnNumbers.length != size) {
            this.columnNumbers = new Float64Array(size);
            this.columnMins = new Float32Array(size);
            this.columnMaxs = new Float32Array(size);
        }
        this.columnNumbers.fill(-1);
        return step;
    }

    get size() {
        return this._size;
    }

    // seconds per sample, 0 before the first chunk
    get period() {
        return this._period;
    }

    // the generation of the stream (a new one starts the samples again), -1
    // before the first chunk
    get streamGeneration() {
        return this.generation;
    }

    private push(value: number) {
        const capacity = this.data.length;
        if (this._size < capacity) {
            this.data[(this.start + this._size) % capacity] = value;
            this._size++;
        } else {
            // the oldest goes
            this.data[this.start] = value;
            this.start = (this.start + 1) % capacity;
        }
        // the smallest blocks sample by sample, a block that is complete
        // into the block of the next level
        const number = this.nextNumber;
        const levels = this.levels;
        let slot = levels[0].add(number, value, value);
        for (let i = 1; i < levels.length; i++) {
            const smaller = levels[i - 1];
            if ((number + 1) % smaller.size != 0) {
                break;
            }
            slot = levels[i].add(number, smaller.min[slot], smaller.max[slot]);
        }
        this.nextNumber++;
    }

    // A chunk that arrived at arrivalTime (seconds). A new generation starts
    // again (the period can differ), the samples missing before seq (a gap)
    // are NaN.
    add(
        generation: number,
        seq: number,
        period: number,
        values: Float32Array,
        arrivalTime: number
    ) {
        if (!(period > 0)) {
            return;
        }

        const newGeneration = generation != this.generation;
        if (newGeneration) {
            // a new start of the stream: the capacity for the span at its
            // period
            const gapSamples = this.gapSamples;
            this.clear();
            this.gapSamples = gapSamples;
            this.generation = generation;
            this._period = period;
            const capacity = Math.min(
                Math.ceil(this.span / period) + 1,
                MAX_BUFFER_SAMPLES
            );
            this.data = new Float32Array(capacity);
            this.levels = createLevels(capacity);
            this.nextSeq = seq;
            this.nextNumber = seq;
        }

        // u32 sequence numbers
        const gap = (seq - this.nextSeq) | 0;
        if (gap > 0) {
            this.gapSamples += gap;
            if (gap > this.data.length) {
                // the whole buffer would be NaN
                this.start = 0;
                this._size = 0;
                this.nextNumber += gap;
            } else {
                for (let i = 0; i < gap; i++) {
                    this.push(NaN);
                }
            }
        }

        for (let i = 0; i < values.length; i++) {
            this.push(values[i]);
        }
        this.nextSeq = (seq + values.length) >>> 0;

        // the newest sample was taken before it arrived
        const bound = arrivalTime - (this.nextNumber - 1) * this._period;
        if (newGeneration) {
            this.t0 = bound;
        } else {
            this.t0 += (arrivalTime - this.lastArrival) * CLOCK_CREEP;
            if (bound < this.t0) {
                this.t0 = bound;
            }
        }
        this.lastArrival = arrivalTime;
    }

    private getByNumber(number: number) {
        const oldest = this.nextNumber - this._size;
        return this.data[(this.start + (number - oldest)) % this.data.length];
    }

    getTime(number: number) {
        return this.t0 + number * this._period;
    }

    // time of the newest sample, 0 if none
    getNewestTime() {
        return this._size ? this.getTime(this.nextNumber - 1) : 0;
    }

    // the number of the first and the last sample kept with a time from
    // tFrom to tTo, undefined if none
    private getWindow(tFrom: number, tTo: number) {
        if (this._size == 0 || tTo < tFrom) {
            return undefined;
        }
        const oldest = this.nextNumber - this._size;
        const first = Math.max(
            oldest,
            Math.ceil((tFrom - this.t0) / this._period)
        );
        const last = Math.min(
            this.nextNumber - 1,
            Math.floor((tTo - this.t0) / this._period)
        );
        return last < first ? undefined : { first, last };
    }

    // The minimum and the maximum of the samples kept from number begin to
    // end - 1 in resultMin and resultMax (min > max if they are all NaN):
    // the whole blocks inside from the block levels, the rest sample by
    // sample.
    private getMinMax(begin: number, end: number) {
        const levels = this.levels;
        let min = Infinity;
        let max = -Infinity;
        let number = begin;
        next: while (number < end) {
            // the largest block that starts here and is inside
            for (let i = levels.length - 1; i >= 0; i--) {
                const level = levels[i];
                const size = level.size;
                if (number % size == 0 && number + size <= end) {
                    const slot = level.getSlot(number);
                    if (slot != -1) {
                        if (level.min[slot] < min) {
                            min = level.min[slot];
                        }
                        if (level.max[slot] > max) {
                            max = level.max[slot];
                        }
                        number += size;
                        continue next;
                    }
                }
            }
            const value = this.getByNumber(number);
            if (value < min) {
                min = value;
            }
            if (value > max) {
                max = value;
            }
            number++;
        }
        this.resultMin = min;
        this.resultMax = max;
    }

    // The points to draw the samples from tFrom to tTo in a plot pixels
    // wide: all of them if they fit (and the one before and after the
    // window), otherwise the minimum and the maximum of
    // each pixel column (an all NaN column is a NaN point, a gap), envelope
    // is then true. The columns start at fixed sample numbers (multiples of
    // the samples per column of the span), so the envelope doesn't change
    // as the window moves.
    getWindowPoints(tFrom: number, tTo: number, pixels: number) {
        const times: number[] = [];
        const values: number[] = [];
        const window = this.getWindow(tFrom, tTo);
        if (!window) {
            return { times, values, envelope: false };
        }
        const { first, last } = window;
        const count = last - first + 1;
        pixels = Math.max(1, Math.floor(pixels));

        if (count <= pixels * 2) {
            // with the samples just outside the window (if kept): the lines
            // to them reach the edges of the plot, which clips them
            const from = Math.max(this.nextNumber - this._size, first - 1);
            const to = Math.min(this.nextNumber - 1, last + 1);
            for (let number = from; number <= to; number++) {
                times.push(this.getTime(number));
                values.push(this.getByNumber(number));
            }
            return { times, values, envelope: false };
        }

        const step = this.setColumnStep(
            Math.max(1, (tTo - tFrom) / this._period / pixels),
            pixels
        );
        const numbers = this.columnNumbers;
        const mins = this.columnMins;
        const maxs = this.columnMaxs;
        for (let column = Math.floor(first / step); ; column++) {
            const columnBegin = Math.ceil(column * step);
            const columnEnd = Math.ceil((column + 1) * step);
            const begin = Math.max(first, columnBegin);
            if (begin > last) {
                break;
            }
            const end = Math.min(last + 1, columnEnd);
            if (end <= begin) {
                continue;
            }
            if (begin == columnBegin && end == columnEnd) {
                // complete: from the cache
                const slot = column % numbers.length;
                if (numbers[slot] === column) {
                    this.resultMin = mins[slot];
                    this.resultMax = maxs[slot];
                } else {
                    this.getMinMax(begin, end);
                    numbers[slot] = column;
                    mins[slot] = this.resultMin;
                    maxs[slot] = this.resultMax;
                }
            } else {
                this.getMinMax(begin, end);
            }
            // the time of the column boundary, not of its first sample (a
            // whole sample number): the columns are equally wide, a pixel
            // each, also with a fractional number of samples per column
            const time = this.getTime(column * step);
            if (this.resultMin > this.resultMax) {
                // only NaN: a gap
                times.push(time);
                values.push(NaN);
            } else {
                times.push(time, time);
                values.push(this.resultMin, this.resultMax);
            }
        }
        return { times, values, envelope: true };
    }

    // The number of the sample shown at the time, not interpolated: the
    // nearest one, or with steps the one before (a bit field holds its value
    // until the next sample); NaN outside the samples.
    private getNumberAt(time: number, steps: boolean) {
        if (this._size == 0 || !(this._period > 0)) {
            return NaN;
        }
        const position = (time - this.t0) / this._period;
        const oldest = this.nextNumber - this._size;
        const newest = this.nextNumber - 1;
        if (steps) {
            // a time at a sample is that sample, also with a rounding error
            const number = Math.floor(position + 1e-6);
            return number >= oldest && number <= newest ? number : NaN;
        }
        if (position < oldest - 0.5 || position > newest + 0.5) {
            return NaN;
        }
        return Math.min(Math.max(Math.round(position), oldest), newest);
    }

    // the sample shown at the time (see getNumberAt), undefined outside the
    // samples
    getSampleAt(time: number, steps: boolean) {
        const number = this.getNumberAt(time, steps);
        if (isNaN(number)) {
            return undefined;
        }
        return { time: this.getTime(number), value: this.getByNumber(number) };
    }

    // the number of the first sample at or after the time
    getFirstNumberAt(time: number) {
        return Math.ceil((time - this.t0) / this._period);
    }

    // The first edge of the samples crossing the level from the number
    // fromNumber on (each sample with the one before it): rising (from below
    // to at or above the level) or falling. A bit field crosses with its bit
    // (0 or 1) if bit >= 0. A NaN sample (a gap) is not an edge. The time of
    // the crossing (linear between the two samples), undefined if none (yet),
    // and the number to go on from (after the crossing, else after the newest
    // sample).
    findCrossing(
        fromNumber: number,
        rising: boolean,
        level: number,
        bit: number
    ): { time: number | undefined; next: number } {
        const next = this.nextNumber;
        if (this._size < 2) {
            return { time: undefined, next };
        }
        const valueOf = (number: number) => {
            const value = this.getByNumber(number);
            return bit < 0 || isNaN(value) ? value : (value >> bit) & 1;
        };
        // each sample needs the one before it
        let number = Math.max(fromNumber, next - this._size + 1);
        for (; number < next; number++) {
            const previous = valueOf(number - 1);
            const current = valueOf(number);
            if (
                rising
                    ? previous < level && current >= level
                    : previous > level && current <= level
            ) {
                const fraction = (level - previous) / (current - previous);
                return {
                    time: this.getTime(number - 1 + fraction),
                    next: number + 1
                };
            }
        }
        return { time: undefined, next };
    }

    // The samples kept from tFrom to tTo (and the one before and after) in a
    // new buffer, with the same numbers and times: the capture of a trigger.
    copyWindow(tFrom: number, tTo: number) {
        const copy = new SampleBuffer();
        copy.span = this.span;
        copy.generation = this.generation;
        copy._period = this._period;
        copy.t0 = this.t0;
        copy.lastArrival = this.lastArrival;
        const window = this.getWindow(tFrom, tTo);
        if (!window) {
            copy.nextNumber = copy.nextSeq = this.nextNumber;
            return copy;
        }
        const from = Math.max(this.nextNumber - this._size, window.first - 1);
        const to = Math.min(this.nextNumber - 1, window.last + 1);
        copy.data = new Float32Array(to - from + 1);
        copy.levels = createLevels(copy.data.length);
        copy.nextNumber = from;
        for (let number = from; number <= to; number++) {
            copy.push(this.getByNumber(number));
        }
        copy.nextSeq = copy.nextNumber;
        return copy;
    }

    // the minimum and the maximum of the samples kept from tFrom to tTo,
    // undefined if there are none (or only NaN)
    getRange(tFrom: number, tTo: number) {
        const window = this.getWindow(tFrom, tTo);
        if (!window) {
            return undefined;
        }
        this.getMinMax(window.first, window.last + 1);
        return this.resultMin <= this.resultMax
            ? { min: this.resultMin, max: this.resultMax }
            : undefined;
    }

    // the samples kept with a time from tFrom to tTo: the number of the
    // first and the values, undefined if none
    getSamples(tFrom: number, tTo: number) {
        const window = this.getWindow(tFrom, tTo);
        if (!window) {
            return undefined;
        }
        const values = new Float32Array(window.last - window.first + 1);
        for (let i = 0; i < values.length; i++) {
            values[i] = this.getByNumber(window.first + i);
        }
        return { first: window.first, values };
    }

    // the values of the samples shown at the times start + i * step, i from
    // 0 to count - 1 (see getNumberAt), NaN outside the samples
    getValuesAt(start: number, step: number, count: number, steps: boolean) {
        const values = new Float32Array(count);
        for (let i = 0; i < count; i++) {
            const number = this.getNumberAt(start + i * step, steps);
            values[i] = isNaN(number) ? NaN : this.getByNumber(number);
        }
        return values;
    }
}
