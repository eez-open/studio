import tinycolor from "tinycolor2";

import { clamp } from "eez-studio-ui/chart/clamp";

import type {
    IWaveformRenderJobSpecification,
    IAverageContinuation,
    IMinMaxContinuation,
    IGraduallyContinuation,
    ILogarithmicContinuation
} from "eez-studio-ui/chart/chart";

const CONF_SINGLE_STEP_TIMEOUT = 1000 / 30;

////////////////////////////////////////////////////////////////////////////////

export function renderWaveformPath(
    canvas: HTMLCanvasElement,
    job: IWaveformRenderJobSpecification,
    continuation: any
) {
    const { waveform, xAxisController, yAxisController, strokeColor, label } =
        job;

    let xFromPx = xAxisController.valueToPx(xAxisController.from);
    let xToPx = xAxisController.valueToPx(xAxisController.to);

    let xLabel = continuation ? continuation.xLabel : undefined;
    let yLabel = continuation ? continuation.yLabel : undefined;

    function xAxisPxToIndex(px: number) {
        return xAxisController.pxToValue(px) * waveform.samplingRate;
    }

    function renderSparse() {
        let a = Math.max(Math.floor(xAxisPxToIndex(xFromPx)) - 1, 0);
        let b = Math.min(
            Math.ceil(xAxisPxToIndex(xToPx)) + 1,
            waveform.length - 1
        );

        ctx.fillStyle = strokeColor;
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 0.4;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        let r = Math.max(
            1,
            Math.min(4, 0.75 / Math.sqrt(xAxisPxToIndex(1) - xAxisPxToIndex(0)))
        );

        // let y0 = Math.round(canvas.height - yAxisController.valueToPx(0));
        let xPrev = 0;
        let yPrev = 0;

        for (let i = a; i <= b; i++) {
            let x = Math.round(
                xAxisController.valueToPx(
                    (i * xAxisController.range) / (waveform.length - 1)
                )
            );
            let y = Math.round(
                canvas.height - yAxisController.valueToPx(waveform.value(i))
            );

            ctx.beginPath();
            ctx.arc(x, y, r, 0, 2 * Math.PI);
            ctx.fill();

            if (!label) {
                // draw vertical line to y-axis 0
                // if (r > 1.2) {
                //     ctx.beginPath();
                //     ctx.moveTo(x, y);
                //     ctx.lineTo(x, y0);
                //     ctx.stroke();
                // }
            }

            if (i > a) {
                ctx.beginPath();
                ctx.moveTo(xPrev, yPrev);
                ctx.lineTo(x, y);
                ctx.stroke();
            }

            xPrev = x;
            yPrev = y;

            if (xLabel == undefined || x > xLabel) {
                xLabel = x;
                yLabel = y;
            }
        }
    }

    function renderAverage(
        continuation: IAverageContinuation | undefined
    ): IAverageContinuation | undefined {
        function valueAt(x: number) {
            let a = xAxisPxToIndex(x);
            let b = xAxisPxToIndex(x + 1);

            a = clamp(a, 0, waveform.length);
            b = clamp(b, 0, waveform.length);

            if (a >= b) {
                return NaN;
            }

            let aa = Math.ceil(a);
            let ad = aa - a;
            let y = waveform.value(Math.floor(a)) * ad;
            let c = ad;
            a = aa;

            let bb = Math.floor(b);
            let bd = b - bb;
            y += waveform.value(bb) * bd;
            c += bd;
            b = bb;

            for (let i = a; i < b; i++) {
                y += waveform.value(i);
                c++;
            }

            y /= c;

            y = yAxisController.valueToPx(y);

            return y;
        }

        xFromPx = Math.round(xFromPx);
        xToPx = Math.round(xToPx);

        const N = xToPx - xFromPx;

        let offsets: number[];
        let offset: number;
        if (continuation) {
            offsets = continuation.offsets;
            offset = continuation.offset;
        } else {
            ctx.fillStyle = strokeColor;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            offsets = genRandomOffsets(N);
            offset = 0;
        }

        let startTime = new Date().getTime();

        for (; offset < N; offset++) {
            if (new Date().getTime() - startTime > CONF_SINGLE_STEP_TIMEOUT) {
                return {
                    offsets,
                    offset,
                    commitAlways: false
                };
            }

            const x = xFromPx + offsets[offset];
            const y = valueAt(x);
            if (isFinite(y)) {
                ctx.beginPath();
                ctx.arc(x, canvas.height - y, 1, 0, 2 * Math.PI);
                ctx.fill();

                if (xLabel == undefined || x > xLabel) {
                    xLabel = x;
                    yLabel = canvas.height - y;
                }
            }
        }

        return undefined;
    }

    function renderMinMax(
        continuation: IMinMaxContinuation | undefined
    ): IMinMaxContinuation | undefined {
        function valueAt(x: number, result: number[]) {
            let a = Math.floor(xAxisPxToIndex(x));
            let b = Math.ceil(xAxisPxToIndex(x + 1));

            a = clamp(a, 0, waveform.length);
            b = clamp(b, 0, waveform.length);
            if (a >= b) {
                return false;
            }

            let min = Number.MAX_VALUE;
            let max = -Number.MAX_VALUE;
            for (let i = a; i < b; i++) {
                const y = waveform.value(i);
                if (y < min) {
                    min = y;
                }
                if (y > max) {
                    max = y;
                }
            }

            if (min > max) {
                return false;
            }

            result[0] = yAxisController.valueToPx(min);
            result[1] = yAxisController.valueToPx(max);
            return true;
        }

        xFromPx = Math.round(xFromPx);
        xToPx = Math.round(xToPx);

        const N = xToPx - xFromPx;

        let offsets: number[];
        let offset: number;
        if (continuation) {
            offsets = continuation.offsets;
            offset = continuation.offset;
        } else {
            ctx.strokeStyle = strokeColor;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            offsets = genRandomOffsets(N);
            offset = 0;
        }

        let result = [0, 0];

        let startTime = new Date().getTime();

        for (; offset < N; offset++) {
            if (new Date().getTime() - startTime > CONF_SINGLE_STEP_TIMEOUT) {
                return {
                    offsets,
                    offset,
                    commitAlways: false
                };
            }

            const x = xFromPx + offsets[offset] + 0.5;

            if (valueAt(x, result)) {
                if (result[1] - result[0] < 1) {
                    result[1] = result[0] + 1;
                }
                ctx.beginPath();
                ctx.moveTo(x, canvas.height - result[0]);
                ctx.lineTo(x, canvas.height - result[1]);
                ctx.stroke();

                if (xLabel == undefined || x > xLabel) {
                    xLabel = x;
                    yLabel =
                        (canvas.height -
                            result[0] +
                            canvas.height -
                            result[1]) /
                        2;
                }
            }
        }

        return undefined;
    }

    function renderGradually(
        continuation: IGraduallyContinuation
    ): IGraduallyContinuation | undefined {
        function init(): boolean {
            let a = Math.round(xAxisPxToIndex(xFromPx));
            let b = Math.round(xAxisPxToIndex(xToPx));

            a = clamp(a, 0, waveform.length);
            b = clamp(b, 0, waveform.length);

            if (a >= b) {
                return false;
            }

            let K = Math.floor((b - a) / canvas.width);
            if (K === 0) {
                K = 1;
            }

            const offsets = genRandomOffsets(K);
            const offset = 0;

            let minAlpha = 0.4;
            let maxAlpha = 1;
            let alpha = minAlpha + (maxAlpha - minAlpha) / K;

            ctx.fillStyle = addAlphaToColor(strokeColor, alpha);
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            continuation = { a, b, K, offsets, offset, commitAlways: true };
            return true;
        }

        function renderStep(a: number, b: number, K: number, offset: number) {
            for (let i = a + offset; i < b; i += K) {
                let x = Math.round(
                    xAxisController.valueToPx(
                        (i * xAxisController.range) / waveform.length
                    )
                );
                let y = yAxisController.valueToPx(waveform.value(i));
                if (x >= 0 && x < canvas.width && y >= 0 && y < canvas.height) {
                    ctx.fillRect(x - 1, canvas.height - y - 1, 2, 2);

                    if (xLabel == undefined || x > xLabel) {
                        xLabel = x;
                        yLabel = canvas.height - y;
                    }
                }
            }
        }

        if (!continuation && !init()) {
            return undefined;
        }

        renderStep(
            continuation.a,
            continuation.b,
            continuation.K,
            continuation.offsets[continuation.offset]
        );

        if (++continuation.offset < continuation.K) {
            return continuation;
        }

        return undefined;
    }

    function renderLogarithmic(
        continuation: ILogarithmicContinuation
    ): ILogarithmicContinuation | undefined {
        let xFromPx = Math.floor(
            xAxisController.linearValueToPx(xAxisController.from)
        );
        let xToPx = Math.ceil(
            xAxisController.linearValueToPx(xAxisController.to)
        );

        function init(): boolean {
            let a = Math.floor(xAxisPxToIndex(xFromPx)) - 1;
            let b = Math.ceil(xAxisPxToIndex(xToPx)) + 1;

            a = clamp(a, 0, waveform.length);
            b = clamp(b, 0, waveform.length);

            if (a >= b) {
                return false;
            }

            let K = 50000;

            continuation = {
                i: a,
                b,
                K,
                points: [],
                isDone: false
            };
            return true;
        }

        function renderStep(continuation: ILogarithmicContinuation) {
            const { points, b, K } = continuation;

            let i = continuation.i;
            const iEnd = Math.min(i + K, b);
            for (; i < iEnd; ++i) {
                let x = Math.round(
                    xAxisController.valueToPx(i / waveform.samplingRate)
                );
                let y = Math.round(
                    canvas.height - yAxisController.valueToPx(waveform.value(i))
                );

                if (points.length === 0 || points[points.length - 1].x !== x) {
                    points.push({
                        x,
                        y
                    });
                } else {
                    if (y < points[points.length - 1].y) {
                        points[points.length - 1].y = y;
                    }
                }
            }
            continuation.i = i;
            if (i === b) {
                continuation.isDone = true;
            }

            ctx.fillStyle = strokeColor;
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = 1;
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            if (points.length > 0) {
                ctx.beginPath();
                ctx.moveTo(points[0].x, points[0].y);
                for (i = 1; i < points.length; ++i) {
                    ctx.lineTo(points[i].x, points[i].y);
                }
                ctx.stroke();
            }

            let R = 1.5;
            for (i = 0; i < points.length; ++i) {
                if (
                    (i === 0 || points[i].x - points[i - 1].x > 2 * R) &&
                    (i === points.length - 1 ||
                        points[i + 1].x - points[i].x > 2 * R)
                ) {
                    ctx.beginPath();
                    ctx.arc(points[i].x, points[i].y, R, 0, 2 * Math.PI);
                    ctx.fill();
                }
            }
        }

        if (!continuation && !init()) {
            return undefined;
        }

        renderStep(continuation);

        if (!continuation.isDone) {
            return continuation;
        }

        return undefined;
    }

    var ctx = canvas.getContext("2d")!;

    if (job.xAxisController.logarithmic) {
        continuation = renderLogarithmic(continuation);
    } else if (xAxisPxToIndex(1) - xAxisPxToIndex(0) < 1) {
        continuation = renderSparse();
    } else if (job.renderAlgorithm === "minmax") {
        continuation = renderMinMax(continuation);
    } else if (job.renderAlgorithm === "avg") {
        continuation = renderAverage(continuation);
    } else {
        continuation = renderGradually(continuation);
    }

    if (continuation) {
        continuation.xLabel = xLabel;
        continuation.yLabel = yLabel;
        return continuation;
    }

    // draw label
    if (label && xLabel != undefined && yLabel != undefined) {
        const FONT_SIZE = 14;
        const HORZ_PADDING = 4;
        const VERT_PADDING = 4;

        ctx.font = `${FONT_SIZE}px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans",sans-serif,"Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol","Noto Color Emoji"`;

        const width =
            Math.ceil(ctx.measureText(label).width) + 2 * HORZ_PADDING;
        const height = FONT_SIZE + 2 * VERT_PADDING;

        xLabel = Math.round(xLabel - width);
        yLabel = Math.round(yLabel - height);

        if (xLabel < 0) {
            xLabel = 0;
        } else if (xLabel + width > canvas.width) {
            xLabel = canvas.width - width;
        }

        if (yLabel < 0) {
            yLabel = 0;
        } else if (yLabel + height > canvas.height) {
            yLabel = canvas.height - height;
        }

        xLabel += 0.5;
        yLabel += 0.5;

        ctx.fillStyle = strokeColor;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText(label, xLabel + HORZ_PADDING, yLabel + VERT_PADDING);
    }

    return undefined;
}

function genRandomOffsets(K: number) {
    let offsets = new Array(K);
    for (let i = 0; i < K; i++) {
        offsets[i] = i;
    }
    for (let i = 0; i < K; i++) {
        let a = Math.floor(Math.random() * K);
        let b = Math.floor(Math.random() * K);
        let temp = offsets[a];
        offsets[a] = offsets[b];
        offsets[b] = temp;
    }
    return offsets;
}

function addAlphaToColor(color: string, alpha: number) {
    return tinycolor(color).setAlpha(alpha).toRgbString();
}
