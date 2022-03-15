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
import { AssetsMap } from "project-editor/build/assets";

export class WasmRuntime extends RuntimeBase {
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

    ////////////////////////////////////////////////////////////////////////////////

    async doStartRuntime(isDebuggerActive: boolean) {
        const result = await this.DocumentStore.buildAssets();
        const assetsData = result.GUI_ASSETS_DATA;
        this.assetsDataMapJs = result.GUI_ASSETS_DATA_MAP_JS;

        this.worker = new Worker(
            "../project-editor/flow/runtime/flow_runtime.js"
        );

        this.worker.onmessage = e => {
            //console.log("renderer", e.data);

            if (e.data.init) {
                this.worker.postMessage({
                    assets: assetsData
                });
            } else {
                if (e.data.screen) {
                    if (this.ctx) {
                        var imgData = new ImageData(
                            e.data.screen,
                            this.width,
                            this.height
                        );
                        this.ctx.putImageData(imgData, 0, 0);
                    }
                }

                this.worker.postMessage({
                    wheel: {
                        deltaY: this.wheelDeltaY,
                        clicked: this.wheelClicked
                    },
                    pointerEvents: this.pointerEvents
                });

                this.wheelDeltaY = 0;
                this.wheelClicked = 0;
                this.pointerEvents = [];
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
