/*
 * Free FFT and convolution (TypeScript)
 *
 * Copyright (c) 2018 Project Nayuki. (MIT License)
 * https://www.nayuki.io/page/free-small-fft-in-multiple-languages
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the "Software"), to deal in
 * the Software without restriction, including without limitation the rights to
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
 * the Software, and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 * - The above copyright notice and this permission notice shall be included in
 *   all copies or substantial portions of the Software.
 * - The Software is provided "as is", without warranty of any kind, express or
 *   implied, including but not limited to the warranties of merchantability,
 *   fitness for a particular purpose and noninfringement. In no event shall the
 *   authors or copyright holders be liable for any claim, damages or other
 *   liability, whether in an action of contract, tort or otherwise, arising from,
 *   out of or in connection with the Software or the use or other dealings in the
 *   Software.
 */

"use strict";

/*
 * Computes the discrete Fourier transform (DFT) of the given complex vector, storing the result back into the vector.
 * The vector can have any length. This is a wrapper function.
 */
export function transform(real: Float64Array, imag: Float64Array): void {
    const n: number = real.length;
    if (n != imag.length) {
        throw "Mismatched lengths";
    }
    if (n == 0) {
        return;
    } else if ((n & (n - 1)) == 0) {
        // Is power of 2
        transformRadix2(real, imag);
    }
    // More complicated algorithm for arbitrary sizes
    else {
        transformBluestein(real, imag);
    }
}

/*
 * Computes the inverse discrete Fourier transform (IDFT) of the given complex vector, storing the result back into the vector.
 * The vector can have any length. This is a wrapper function. This transform does not perform scaling, so the inverse is not a true inverse.
 */
export function inverseTransform(real: Float64Array, imag: Float64Array): void {
    transform(imag, real);
}

/*
 * Computes the discrete Fourier transform (DFT) of the given complex vector, storing the result back into the vector.
 * The vector's length must be a power of 2. Uses the Cooley-Tukey decimation-in-time radix-2 algorithm.
 */
export function transformRadix2(real: Float64Array, imag: Float64Array): void {
    // Length variables
    const n: number = real.length;
    if (n != imag.length) {
        throw "Mismatched lengths";
    }
    if (n == 1) {
        // Trivial transform
        return;
    }
    let levels: number = -1;
    for (let i = 0; i < 32; i++) {
        if (1 << i == n) {
            levels = i; // Equal to log2(n)
        }
    }
    if (levels == -1) {
        throw "Length is not a power of 2";
    }

    // Trigonometric tables
    let cosTable = new Float64Array(n / 2);
    let sinTable = new Float64Array(n / 2);
    for (let i = 0; i < n / 2; i++) {
        cosTable[i] = Math.cos((2 * Math.PI * i) / n);
        sinTable[i] = Math.sin((2 * Math.PI * i) / n);
    }

    // Bit-reversed addressing permutation
    for (let i = 0; i < n; i++) {
        const j: number = reverseBits(i, levels);
        if (j > i) {
            let temp: number = real[i];
            real[i] = real[j];
            real[j] = temp;
            temp = imag[i];
            imag[i] = imag[j];
            imag[j] = temp;
        }
    }

    // Cooley-Tukey decimation-in-time radix-2 FFT
    for (let size = 2; size <= n; size *= 2) {
        const halfsize: number = size / 2;
        const tablestep: number = n / size;
        for (let i = 0; i < n; i += size) {
            for (let j = i, k = 0; j < i + halfsize; j++, k += tablestep) {
                const l: number = j + halfsize;
                const tpre: number = real[l] * cosTable[k] + imag[l] * sinTable[k];
                const tpim: number = -real[l] * sinTable[k] + imag[l] * cosTable[k];
                real[l] = real[j] - tpre;
                imag[l] = imag[j] - tpim;
                real[j] += tpre;
                imag[j] += tpim;
            }
        }
    }

    // Returns the integer whose value is the reverse of the lowest 'bits' bits of the integer 'x'.
    function reverseBits(x: number, bits: number): number {
        let y: number = 0;
        for (let i = 0; i < bits; i++) {
            y = (y << 1) | (x & 1);
            x >>>= 1;
        }
        return y;
    }
}

/*
 * Computes the discrete Fourier transform (DFT) of the given complex vector, storing the result back into the vector.
 * The vector can have any length. This requires the convolution function, which in turn requires the radix-2 FFT function.
 * Uses Bluestein's chirp z-transform algorithm.
 */
export function transformBluestein(real: Float64Array, imag: Float64Array): void {
    // Find a power-of-2 convolution length m such that m >= n * 2 + 1
    const n: number = real.length;
    if (n != imag.length) {
        throw "Mismatched lengths";
    }
    let m: number = 1;
    while (m < n * 2 + 1) {
        m *= 2;
    }

    // Trignometric tables
    let cosTable = new Float64Array(n);
    let sinTable = new Float64Array(n);
    for (let i = 0; i < n; i++) {
        const j: number = (i * i) % (n * 2); // This is more accurate than j = i * i
        cosTable[i] = Math.cos((Math.PI * j) / n);
        sinTable[i] = Math.sin((Math.PI * j) / n);
    }

    // Temporary vectors and preprocessing
    let areal = newArrayOfZeros(m);
    let aimag = newArrayOfZeros(m);
    let breal = newArrayOfZeros(m);
    let bimag = newArrayOfZeros(m);
    breal[0] = cosTable[0];
    bimag[0] = sinTable[0];
    for (let i = 0; i < n; i++) {
        areal[i] = real[i] * cosTable[i] + imag[i] * sinTable[i];
        aimag[i] = -real[i] * sinTable[i] + imag[i] * cosTable[i];
        breal[i] = breal[m - i] = cosTable[i];
        bimag[i] = bimag[m - i] = sinTable[i];
    }

    // Convolution
    let creal = new Float64Array(m);
    let cimag = new Float64Array(m);
    convolveComplex(areal, aimag, breal, bimag, creal, cimag);

    // Postprocessing
    for (let i = 0; i < n; i++) {
        real[i] = creal[i] * cosTable[i] + cimag[i] * sinTable[i];
        imag[i] = -creal[i] * sinTable[i] + cimag[i] * cosTable[i];
    }
}

/*
 * Computes the circular convolution of the given real vectors. Each vector's length must be the same.
 */
export function convolveReal(x: Float64Array, y: Float64Array, out: Float64Array): void {
    const n: number = x.length;
    if (n != y.length || n != out.length) {
        throw "Mismatched lengths";
    }
    convolveComplex(x, newArrayOfZeros(n), y, newArrayOfZeros(n), out, newArrayOfZeros(n));
}

/*
 * Computes the circular convolution of the given complex vectors. Each vector's length must be the same.
 */
export function convolveComplex(
    xreal: Float64Array,
    ximag: Float64Array,
    yreal: Float64Array,
    yimag: Float64Array,
    outreal: Float64Array,
    outimag: Float64Array
): void {
    const n: number = xreal.length;
    if (
        n != ximag.length ||
        n != yreal.length ||
        n != yimag.length ||
        n != outreal.length ||
        n != outimag.length
    ) {
        throw "Mismatched lengths";
    }

    xreal = xreal.slice();
    ximag = ximag.slice();
    yreal = yreal.slice();
    yimag = yimag.slice();
    transform(xreal, ximag);
    transform(yreal, yimag);

    for (let i = 0; i < n; i++) {
        const temp: number = xreal[i] * yreal[i] - ximag[i] * yimag[i];
        ximag[i] = ximag[i] * yreal[i] + xreal[i] * yimag[i];
        xreal[i] = temp;
    }
    inverseTransform(xreal, ximag);

    for (let i = 0; i < n; i++) {
        // Scaling (because this FFT implementation omits it)
        outreal[i] = xreal[i] / n;
        outimag[i] = ximag[i] / n;
    }
}

export function newArrayOfZeros(n: number) {
    return new Float64Array(n).fill(0);
}
