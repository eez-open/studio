import React from "react";

import { ProjectContext } from "project-editor/project/context";
import { DocumentStoreClass } from "project-editor/store";

import { observer } from "mobx-react";
import {
    RemoteRuntime,
    DebuggerConnectionBase
} from "project-editor/flow/remote-runtime";

import type {
    ObjectGlobalVariableValues,
    RendererToWorkerMessage,
    ScpiCommand,
    WorkerToRenderMessage
} from "project-editor/flow/runtime/wasm-worker-interfaces";
import {
    getObjectVariableTypeFromType,
    IObjectVariableValue
} from "project-editor/features/variable/value-type";
import { InstrumentObject } from "instrument/instrument-object";
import { createJsArrayValue } from "project-editor/flow/runtime/wasm-value";

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

        let objectGlobalVariableValues: ObjectGlobalVariableValues;
        if (this.DocumentStore.project.isDashboardProject) {
            await this.DocumentStore.runtimeSettings.loadPersistentVariables();
            objectGlobalVariableValues =
                await this.constructObjectGlobalVariables();
        } else {
            objectGlobalVariableValues = [];
        }

        this.worker = new Worker(
            "../project-editor/flow/runtime/wasm-worker-pre.js"
        );

        this.worker.onmessage = (e: { data: WorkerToRenderMessage }) => {
            if (e.data.init) {
                const message: RendererToWorkerMessage = {};
                message.init = {
                    assetsData: assetsData,
                    assetsMap: this.assetsMap,
                    objectGlobalVariableValues
                };
                this.worker.postMessage(message);

                if (!isDebuggerActive) {
                    this.resumeAtStart = true;
                }
            } else {
                if (e.data.scpiCommand) {
                    this.executeScpiCommand(e.data.scpiCommand);
                    return;
                }

                if (e.data.messageToDebugger) {
                    this.debuggerConnection.onMessageToDebugger(
                        arrayBufferToBinaryString(e.data.messageToDebugger)
                    );
                    return;
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

        if (this.worker) {
            this.worker.terminate();
        }
    }

    ////////////////////////////////////////////////////////////////////////////////

    objectVariableValues: IObjectVariableValue[] = [];

    async constructObjectGlobalVariables() {
        for (const variable of this.DocumentStore.project.allGlobalVariables) {
            let value = this.DocumentStore.dataContext.get(variable.name);
            if (value == null) {
                const objectVariableType = getObjectVariableTypeFromType(
                    variable.type
                );
                if (objectVariableType) {
                    const constructorParams =
                        await objectVariableType.editConstructorParams(
                            variable,
                            undefined
                        );
                    if (constructorParams) {
                        const value = objectVariableType.createValue(
                            constructorParams,
                            true
                        );

                        this.DocumentStore.dataContext.set(
                            variable.name,
                            value
                        );
                    }
                }
            }
        }

        let objectGlobalVariableValues: ObjectGlobalVariableValues = [];

        for (const variable of this.DocumentStore.project.allGlobalVariables) {
            let value = this.DocumentStore.dataContext.get(variable.name);
            if (value != null) {
                const objectVariableType = getObjectVariableTypeFromType(
                    variable.type
                );
                if (objectVariableType) {
                    this.objectVariableValues.push(value);

                    const arrayValue = createJsArrayValue(
                        variable.type,
                        value,
                        this.assetsMap,
                        objectVariableType
                    );

                    if (arrayValue) {
                        const globalVariableInAssetsMap =
                            this.assetsMap.globalVariables.find(
                                globalVariableInAssetsMap =>
                                    globalVariableInAssetsMap.name ==
                                    variable.name
                            );

                        if (globalVariableInAssetsMap) {
                            objectGlobalVariableValues.push({
                                globalVariableIndex:
                                    globalVariableInAssetsMap.index,
                                arrayValue
                            });
                        } else {
                            console.error(
                                `Can't find global variable "${variable.name}" in assets map`
                            );
                        }
                    } else {
                        console.error(
                            "Can't create array value",
                            variable.type,
                            value,
                            this.assetsMap
                        );
                    }
                }
            }
        }

        return objectGlobalVariableValues;
    }

    ////////////////////////////////////////////////////////////////////////////////

    async executeScpiCommand(scpiCommand: ScpiCommand) {
        const command = arrayBufferToBinaryString(scpiCommand.command);

        for (let i = 0; i < this.objectVariableValues.length; i++) {
            const instrument = this.objectVariableValues[i];
            if (instrument instanceof InstrumentObject) {
                if (scpiCommand.instrumentId == instrument.id) {
                    const CONNECTION_TIMEOUT = 5000;
                    const startTime = Date.now();
                    while (
                        !instrument.isConnected &&
                        Date.now() - startTime < CONNECTION_TIMEOUT
                    ) {
                        if (!instrument.connection.isTransitionState) {
                            instrument.connection.connect();
                        }
                        await new Promise<boolean>(resolve =>
                            setTimeout(resolve, 10)
                        );
                    }

                    if (!instrument.isConnected) {
                        const data: RendererToWorkerMessage = {
                            scpiResult: {
                                errorMessage: "instrument not connected"
                            }
                        };
                        this.worker.postMessage(data);
                        return;
                    }

                    const connection = instrument.connection;

                    await connection.acquire(false);

                    try {
                        let result = await connection.query(command);
                        const data: RendererToWorkerMessage = {
                            scpiResult: {
                                result: binaryStringToArrayBuffer(result)
                            }
                        };
                        this.worker.postMessage(data);
                    } finally {
                        connection.release();
                    }

                    return;
                }
            }
        }
    }

    ////////////////////////////////////////////////////////////////////////////////

    tick = () => {
        this.requestAnimationFrameId = undefined;
        if (this.screen && this.ctx) {
            var imgData = new ImageData(this.screen, this.width, this.height);
            this.ctx.putImageData(imgData, 0, 0);
        }

        const message: RendererToWorkerMessage = {
            wheel: {
                deltaY: this.wheelDeltaY,
                clicked: this.wheelClicked
            },
            pointerEvents: this.pointerEvents
        };

        this.worker.postMessage(message);

        this.wheelDeltaY = 0;
        this.wheelClicked = 0;
        this.pointerEvents = [];
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
        const message: RendererToWorkerMessage = {
            messageFromDebugger: binaryStringToArrayBuffer(data)
        };
        this.wasmRuntime.worker.postMessage(message);
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
