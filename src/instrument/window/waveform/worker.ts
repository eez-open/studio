const { initValuesAccesor } = require("./buffer");
const { renderWaveformPath } = require("./render");

let canvasMap = new Map<
    number,
    {
        canvas: HTMLCanvasElement;
        ctx: CanvasRenderingContext2D;
        continuation: any;
        continuationTimeoutId: any;
    }
    >();

onmessage = function (e) {
    if (e.data.canvas) {
        const canvasId: number = e.data.canvasId;
        const canvas: HTMLCanvasElement = e.data.canvas;
        if (!canvasMap.has(canvasId)) {
            canvasMap.set(canvasId, {
                canvas,
                ctx: canvas.getContext("2d")!,
                continuation: undefined,
                continuationTimeoutId: undefined
            });
        } else {
            console.error("canvas already in map");
        }
        return;
    } else if (e.data.releaseCanvasId) {
        const canvasMapElement = canvasMap.get(e.data.releaseCanvasId);
        if (canvasMapElement) {
            if (canvasMapElement.continuation) {
                clearTimeout(canvasMapElement.continuationTimeoutId);
            }
            canvasMap.delete(e.data.releaseCanvasId);
        } else {
            console.error("canvas not found");
        }
    } else if (e.data.job) {
        const canvasId: number = e.data.canvasId;
        const foundCanvasMapElement = canvasMap.get(canvasId);
        if (foundCanvasMapElement) {
            const canvasMapElement = foundCanvasMapElement;

            if (canvasMapElement.continuation) {
                canvasMapElement.ctx.commit();
                clearTimeout(canvasMapElement.continuationTimeoutId);
                canvasMapElement.continuation = undefined;
                canvasMapElement.continuationTimeoutId = undefined;
            }

            const job = e.data.job;
            if (job) {
                initValuesAccesor(job.waveform);

                const xAxisController = job.xAxisController;
                const yAxisController = job.yAxisController;
                xAxisController.pxToValue = yAxisController.pxToValue = function (px: number) {
                    return this.from + px / this.scale;
                };
                xAxisController.valueToPx = yAxisController.valueToPx = function (value: number) {
                    return (value - this.from) * this.scale;
                };

                function doRender() {
                    canvasMapElement.continuation = renderWaveformPath(
                        canvasMapElement.canvas,
                        job,
                        canvasMapElement.continuation
                    );

                    if (canvasMapElement.continuation) {
                        canvasMapElement.continuationTimeoutId = setTimeout(doRender);
                    } else {
                        canvasMapElement.ctx.commit();
                    }
                }

                doRender();
            }
        }
    }
};
