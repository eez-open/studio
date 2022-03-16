import React from "react";

import { ProjectContext } from "project-editor/project/context";
import { DocumentStoreClass } from "project-editor/core/store";

import { observer } from "mobx-react";
import { AssetsMap } from "project-editor/build/assets";
import {
    RemoteRuntime,
    DebuggerConnectionBase
} from "project-editor/flow/remote-runtime";

export class WasmRuntime extends RemoteRuntime {
    debuggerConnection = new WasmDebuggerConnection(this);

    constructor(public DocumentStore: DocumentStoreClass) {
        super(DocumentStore);
    }

    worker: Worker;

    assetsDataMapJs: AssetsMap;

    ctx: CanvasRenderingContext2D | undefined;
    width: number = 480;
    height: number = 272;

    pointerEvents: {
        x: number;
        y: number;
        pressed: number;
    }[] = [];
    wheelDeltaY = 0;
    wheelClicked = 0;
    messageFromDebugger: string | undefined;
    screen: any;
    requestAnimationFrameId: number | undefined;

    ////////////////////////////////////////////////////////////////////////////////

    async doStartRuntime(isDebuggerActive: boolean) {
        const result = await this.DocumentStore.buildAssets();

        this.assetsMap = result.GUI_ASSETS_DATA_MAP_JS as AssetsMap;
        if (!this.assetsMap) {
            this.DocumentStore.setEditorMode();
            return;
        }

        const assetsData = result.GUI_ASSETS_DATA;

        this.worker = new Worker(
            "../project-editor/flow/runtime/flow_runtime.js"
        );

        this.worker.onmessage = e => {
            if (e.data.init) {
                this.worker.postMessage({
                    assets: assetsData
                });

                if (!isDebuggerActive) {
                    this.resumeAtStart = true;
                }
            } else {
                if (e.data.messageToDebugger) {
                    this.debuggerConnection.onMessageToDebugger(
                        arrayBufferToBinaryString(e.data.messageToDebugger)
                    );
                }

                this.screen = e.data.screen;
                this.requestAnimationFrameId = window.requestAnimationFrame(
                    this.tick
                );
            }
        };
    }

    async doStopRuntime(notifyUser: boolean) {
        if (this.requestAnimationFrameId) {
            window.cancelAnimationFrame(this.requestAnimationFrameId);
        }

        this.worker.terminate();
    }

    ////////////////////////////////////////////////////////////////////////////////

    tick = () => {
        this.requestAnimationFrameId = undefined;
        if (this.screen && this.ctx) {
            var imgData = new ImageData(this.screen, this.width, this.height);
            this.ctx.putImageData(imgData, 0, 0);
        }

        this.worker.postMessage({
            wheel: {
                deltaY: this.wheelDeltaY,
                clicked: this.wheelClicked
            },
            pointerEvents: this.pointerEvents,
            messageFromDebugger: this.messageFromDebugger
                ? binaryStringToArrayBuffer(this.messageFromDebugger)
                : undefined
        });

        this.wheelDeltaY = 0;
        this.wheelClicked = 0;
        this.pointerEvents = [];
        this.messageFromDebugger = undefined;
        this.screen = undefined;
    };

    renderPage() {
        return <WasmCanvas />;
    }
}

export const WasmCanvas = observer(
    class WasmCanvas extends React.Component {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        canvasRef = React.createRef<HTMLCanvasElement>();

        componentDidMount() {
            const canvasElement = this.canvasRef.current;
            if (!canvasElement) {
                return;
            }
            const canvas = canvasElement;

            const wasmRuntime = this.context.runtime as WasmRuntime;

            canvas.width = wasmRuntime.width;
            canvas.height = wasmRuntime.height;
            wasmRuntime.ctx = canvas.getContext("2d")!;

            function sendPointerEvent(event: PointerEvent) {
                var bbox = canvas.getBoundingClientRect();

                const x =
                    (event.clientX - bbox.left) * (canvas.width / bbox.width);

                const y =
                    (event.clientY - bbox.top) * (canvas.height / bbox.height);

                const pressed = event.buttons == 1 ? 1 : 0;

                wasmRuntime.pointerEvents.push({ x, y, pressed });

                event.preventDefault();
                event.stopPropagation();
            }

            canvas.addEventListener(
                "pointerdown",
                event => {
                    if (event.buttons == 4) {
                        wasmRuntime.wheelClicked = 1;
                    }
                    canvas.setPointerCapture(event.pointerId);
                    sendPointerEvent(event);
                },
                true
            );

            canvas.addEventListener(
                "pointermove",
                event => {
                    sendPointerEvent(event);
                },
                true
            );

            canvas.addEventListener(
                "pointerup",
                event => {
                    canvas.releasePointerCapture(event.pointerId);
                    sendPointerEvent(event);
                },
                true
            );

            canvas.addEventListener(
                "pointercancel",
                event => {
                    canvas.releasePointerCapture(event.pointerId);
                    sendPointerEvent(event);
                },
                true
            );

            document.addEventListener(
                "wheel",
                event => {
                    wasmRuntime.wheelDeltaY += -event.deltaY;
                },
                true
            );
        }

        componentWillUnmount() {
            const wasmRuntime = this.context.runtime as WasmRuntime;
            if (wasmRuntime) {
                wasmRuntime.ctx = undefined;
            }
        }

        render() {
            return <canvas ref={this.canvasRef} width="480" height="272" />;
        }
    }
);

class WasmDebuggerConnection extends DebuggerConnectionBase {
    constructor(private wasmRuntime: WasmRuntime) {
        super(wasmRuntime);
    }

    start() {}

    stop() {}

    sendMessageFromDebugger(data: string) {
        if (this.wasmRuntime.messageFromDebugger) {
            this.wasmRuntime.messageFromDebugger += data;
        } else {
            this.wasmRuntime.messageFromDebugger = data;
        }
    }
}

function arrayBufferToBinaryString(data: ArrayBuffer) {
    const buffer = Buffer.from(data);
    return buffer.toString("binary");
}

function binaryStringToArrayBuffer(data: string) {
    const buffer = Buffer.from(data, "binary");
    return buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength
    );
}
