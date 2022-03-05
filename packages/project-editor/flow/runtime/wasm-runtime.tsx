import React from "react";

import { ProjectContext } from "project-editor/project/context";
import { Component, Widget } from "project-editor/flow/component";
import { IFlowContext } from "project-editor/flow/flow-interfaces";
import {
    FlowState,
    RuntimeBase,
    StateMachineAction
} from "project-editor/flow/runtime";
import { DocumentStoreClass } from "project-editor/core/store";

import { IExpressionContext } from "project-editor/flow/expression/expression";
import { observer } from "mobx-react";

export class WasmRuntime extends RuntimeBase {
    constructor(public DocumentStore: DocumentStoreClass) {
        super(DocumentStore);
    }

    worker: Worker;

    ////////////////////////////////////////////////////////////////////////////////

    async doStartRuntime(isDebuggerActive: boolean) {
        this.worker = new Worker("./flow_runtime");

        this.worker.onmessage = function (e) {
            if (e.data.init) {
                const assets: Uint8Array = new Uint8Array(0);
                // TODO build assets but this time don't save to file, just give back Uint8Array for assets and give back the map like in RemoteRuntime

                var ptr = WasmFlowRuntime._malloc(assets.length);
                WasmFlowRuntime.HEAPU8.set(assets, ptr);
                WasmFlowRuntime._loadAssets(ptr, assets.length);
            } else if (e.data.screen) {
                // TODO
            }
        };
    }

    async doStopRuntime(notifyUser: boolean) {
        this.worker.terminate();
    }

    toggleDebugger(): void {
        if (this.isDebuggerActive) {
            this.transition(StateMachineAction.RUN);
        } else {
            this.transition(StateMachineAction.PAUSE);
        }
    }

    resume() {
        this.transition(StateMachineAction.RESUME);
    }

    pause() {
        this.transition(StateMachineAction.PAUSE);
    }

    runSingleStep() {
        this.transition(StateMachineAction.SINGLE_STEP);
    }

    onBreakpointAdded(component: Component) {}

    onBreakpointRemoved(component: Component) {}

    onBreakpointEnabled(component: Component) {}

    onBreakpointDisabled(component: Component) {}

    executeWidgetAction(
        flowContext: IFlowContext,
        widget: Widget,
        value?: any
    ) {}

    readSettings(key: string) {}
    writeSettings(key: string, value: any) {}

    async startFlow(flowState: FlowState) {}

    propagateValue(
        flowState: FlowState,
        sourceComponent: Component,
        output: string,
        value: any,
        outputName?: string
    ) {}

    throwError(flowState: FlowState, component: Component, message: string) {}

    assignValue(
        expressionContext: IExpressionContext,
        component: Component,
        assignableExpression: string,
        value: any
    ) {}

    destroyObjectLocalVariables(flowState: FlowState): void {}

    ////////////////////////////////////////////////////////////////////////////////

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
            const canvasElement1 = this.canvasRef.current;
            if (!canvasElement1) {
                return;
            }

            const canvas = canvasElement1;

            canvas.width = 480;
            canvas.height = 272;
            var ctx = canvas.getContext("2d")!;

            let wheelDeltaY = 0;
            let wheelClicked = 0;

            function update() {
                if ((window as any).WasmFlowRuntime) {
                    WasmFlowRuntime._onMouseWheelEvent(
                        wheelDeltaY,
                        wheelClicked
                    );
                    wheelDeltaY = 0;
                    wheelClicked = 0;

                    WasmFlowRuntime._mainLoop();

                    var buf_addr = WasmFlowRuntime._getSyncedBuffer();

                    if (buf_addr != 0) {
                        var uint8ClampedArray = new Uint8ClampedArray(
                            WasmFlowRuntime.HEAPU8.subarray(
                                buf_addr,
                                buf_addr + canvas.width * canvas.height * 4
                            )
                        );
                        var imgData = new ImageData(
                            uint8ClampedArray,
                            canvas.width,
                            canvas.height
                        );

                        ctx.putImageData(imgData, 0, 0);
                    }
                }

                window.requestAnimationFrame(update);
            }

            window.requestAnimationFrame(update);

            function sendPointerEvent(event: PointerEvent) {
                if ((window as any).WasmFlowRuntime) {
                    var bbox = canvas.getBoundingClientRect();
                    WasmFlowRuntime._onPointerEvent(
                        (event.clientX - bbox.left) *
                            (canvas.width / bbox.width),
                        (event.clientY - bbox.top) *
                            (canvas.height / bbox.height),
                        event.buttons == 1 ? 1 : 0
                    );
                }
                event.preventDefault();
                event.stopPropagation();
            }

            canvas.addEventListener(
                "pointerdown",
                event => {
                    if (event.buttons == 4) {
                        wheelClicked = 1;
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
                    wheelDeltaY += -event.deltaY;
                },
                true
            );
        }

        componentWillUnmount() {}

        render() {
            return <canvas ref={this.canvasRef} width="480" height="272" />;
        }
    }
);
