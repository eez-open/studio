import { IWaveformRenderJobSpecification } from "eez-studio-ui/chart/render";

const NUM_WORKERS = 10;
const workers: Worker[] = [];
for (let i = 0; i < NUM_WORKERS; i++) {
    workers[i] = new Worker("../eez-studio-shared/ui/chart/render-worker.js");
}
let nextWorkerIndex = 0;
let nextCanvasId = 0;

const canvasToWorkerMap = new Map<HTMLCanvasElement, { canvasId: number; workerIndex: number }>();

export function drawWithWorker(
    canvas: HTMLCanvasElement,
    job: IWaveformRenderJobSpecification | undefined
) {
    let worker;
    let canvasToWorkerElement = canvasToWorkerMap.get(canvas);
    if (canvasToWorkerElement === undefined) {
        canvasToWorkerElement = {
            canvasId: nextCanvasId,
            workerIndex: nextWorkerIndex
        };
        canvasToWorkerMap.set(canvas, canvasToWorkerElement);

        worker = workers[canvasToWorkerElement.workerIndex];

        nextCanvasId++;
        nextWorkerIndex = (nextWorkerIndex + 1) % NUM_WORKERS;

        const offScreenCanvas = canvas.transferControlToOffscreen();
        worker.postMessage({ canvasId: canvasToWorkerElement.canvasId, canvas: offScreenCanvas }, [
            offScreenCanvas as any
        ]);
    } else {
        worker = workers[canvasToWorkerElement.workerIndex];
    }

    let jobForWorker: IWaveformRenderJobSpecification | null;

    if (job) {
        jobForWorker = {
            renderAlgorithm: job.renderAlgorithm,
            waveform: {
                isVisible: true,
                format: job.waveform.format,
                values: job.waveform.values,
                length: job.waveform.length,
                offset: job.waveform.offset,
                scale: job.waveform.scale,
                samplingRate: job.waveform.samplingRate,
                value: undefined as any,
                waveformData: undefined as any
            },
            xAxisController: {
                from: job.xAxisController.from,
                to: job.xAxisController.to,
                range: job.xAxisController.range,
                scale: job.xAxisController.scale,
                pxToValue: undefined as any,
                valueToPx: undefined as any
            },
            yAxisController: {
                from: job.yAxisController.from,
                to: job.yAxisController.to,
                range: job.yAxisController.range,
                scale: job.yAxisController.scale,
                pxToValue: undefined as any,
                valueToPx: undefined as any
            },
            xFromValue: job.xFromValue,
            xToValue: job.xToValue,
            yFromValue: job.yFromValue,
            yToValue: job.yToValue,
            strokeColor: job.strokeColor
        };
    } else {
        jobForWorker = null;
    }

    worker.postMessage({
        canvasId: canvasToWorkerElement.canvasId,
        job: jobForWorker
    });
}

export function releaseCanvas(canvas: HTMLCanvasElement) {
    let canvasToWorkerElement = canvasToWorkerMap.get(canvas);
    if (canvasToWorkerElement) {
        workers[canvasToWorkerElement.workerIndex].postMessage({
            releaseCanvasId: canvasToWorkerElement.canvasId
        });
    } else {
        console.error("canvas not found");
    }
}
