import React from "react";
import { observer } from "mobx-react";

import * as notification from "eez-studio-ui/notification";

import { getNodeModuleFolders } from "eez-studio-shared/extensions/yarn";

import { InstrumentObject } from "instrument/instrument-object";
import { FileHistoryItem } from "instrument/window/history/items/file";

import { ProjectContext } from "project-editor/project/context";

import {
    ProjectStore,
    getClassInfo,
    getObjectFromStringPath,
    getObjectPathAsString,
    LayoutModels,
    Section
} from "project-editor/store";

import {
    RemoteRuntime,
    DebuggerConnectionBase
} from "project-editor/flow//runtime/remote-runtime";

import type {
    IAssignProperty,
    IEvalProperty,
    IGlobalVariable,
    RendererToWorkerMessage
} from "project-editor/flow/runtime/wasm-worker-interfaces";

import type {
    ScpiCommand,
    WorkerToRenderMessage,
    IPropertyValue,
    ValueWithType,
    AssetsMap
} from "eez-studio-types";

import {
    getObjectVariableTypeFromType,
    IObjectVariableValue,
    isArrayType,
    isStructType
} from "project-editor/features/variable/value-type";

import {
    ArrayValue,
    clarStremIDs,
    createJsArrayValue
} from "project-editor/flow/runtime/wasm-value";

import {
    isFlowProperty,
    Widget as Component,
    Widget
} from "project-editor/flow/component";

import { ProjectEditor } from "project-editor/project-editor-interface";
import type { IFlowContext } from "project-editor/flow/flow-interfaces";
import { makeObservable, observable, runInAction } from "mobx";
import { FLOW_ITERATOR_INDEXES_VARIABLE } from "project-editor/features/variable/defs";
import type {
    IObjectVariableType,
    IObjectVariableValueConstructorParams,
    IVariable,
    ValueType
} from "eez-studio-types";
import { IExpressionContext } from "project-editor/flow/expression";
import type { Page } from "project-editor/features/page/page";
import { createWasmWorker } from "project-editor/flow/runtime/wasm-worker";
import { LVGLPageViewerRuntime } from "project-editor/lvgl/page-runtime";

interface IGlobalVariableBase {
    variable: IVariable;
    globalVariableIndex: number;
}

interface IBasicGlobalVariable extends IGlobalVariableBase {
    kind: "basic";
    value: null | undefined | number | boolean | string;
}

interface IStructGlobalVariable extends IGlobalVariableBase {
    kind: "struct";
    value: ArrayValue;
}

interface IObjectGlobalVariable extends IGlobalVariableBase {
    kind: "object";
    value: ArrayValue;

    objectVariableValue: IObjectVariableValue;
    objectVariableType: IObjectVariableType;
}

type IRuntimeGlobalVariable =
    | IBasicGlobalVariable
    | IStructGlobalVariable
    | IObjectGlobalVariable;

let nextWasmModuleId = 1;

export class WasmRuntime extends RemoteRuntime {
    wasmModuleId: number;

    debuggerConnection = new WasmDebuggerConnection(this);

    worker: ReturnType<typeof createWasmWorker>;

    assetsData: any;
    assetsDataMapJs: AssetsMap;

    globalVariables: IRuntimeGlobalVariable[] = [];

    ctx: CanvasRenderingContext2D | undefined;
    displayWidth: number;
    displayHeight: number;

    pointerEvents: {
        x: number;
        y: number;
        pressed: number;
    }[] = [];
    wheelDeltaY = 0;
    wheelClicked = 0;
    screen: any;
    lastScreen: any;
    requestAnimationFrameId: number | undefined;

    componentProperties = new ComponentProperties(this);

    lgvlPageRuntime: LVGLPageViewerRuntime | undefined;

    ////////////////////////////////////////////////////////////////////////////////

    constructor(public projectStore: ProjectStore) {
        super(projectStore);

        makeObservable(this, {
            displayWidth: observable,
            displayHeight: observable
        });
    }

    ////////////////////////////////////////////////////////////////////////////////

    async doStartRuntime(isDebuggerActive: boolean) {
        const result = await this.projectStore.buildAssets();

        const outputSection = this.projectStore.outputSectionsStore.getSection(
            Section.OUTPUT
        );
        if (outputSection.numErrors > 0 || outputSection.numWarnings > 0) {
            this.projectStore.layoutModels.selectTab(
                this.projectStore.layoutModels.root,
                LayoutModels.OUTPUT_TAB_ID
            );
            if (outputSection.numErrors > 0) {
                this.stopRuntimeWithError("Build error");
                this.projectStore.setEditorMode();
                return;
            }
        }

        this.assetsMap = result.GUI_ASSETS_DATA_MAP_JS as AssetsMap;
        if (!this.assetsMap) {
            this.stopRuntimeWithError("Build error");
            this.projectStore.setEditorMode();
            return;
        }

        runInAction(() => {
            this.displayWidth = this.assetsMap.displayWidth;
            this.displayHeight = this.assetsMap.displayHeight;
        });

        this.assetsData = result.GUI_ASSETS_DATA;

        if (this.projectStore.projectTypeTraits.isDashboard) {
            await this.loadGlobalVariables();
        }

        if (!isDebuggerActive) {
            this.resumeAtStart = true;
        }

        // create WASM worker
        this.wasmModuleId = nextWasmModuleId++;
        this.worker = createWasmWorker(
            this.wasmModuleId,
            this.onWorkerMessage,
            this.projectStore.projectTypeTraits.isLVGL,
            this.displayWidth,
            this.displayHeight
        );

        if (this.projectStore.projectTypeTraits.isLVGL) {
            this.lgvlPageRuntime = new LVGLPageViewerRuntime(this);
        }
    }

    async doStopRuntime(notifyUser: boolean) {
        if (this.requestAnimationFrameId) {
            window.cancelAnimationFrame(this.requestAnimationFrameId);
        }

        this.destroyGlobalVariables();

        clarStremIDs();

        if (this.lgvlPageRuntime) {
            this.lgvlPageRuntime.unmount();
        }

        if (this.worker) {
            this.worker.terminate();
            this.ctx = undefined;
        }

        if (this.error) {
            if (notifyUser) {
                notification.error(
                    `Flow stopped with error: ${this.error.toString()}`
                );
            }
        }
    }

    stop() {
        const message: RendererToWorkerMessage = {};
        message.stopScript = true;

        this.worker.postMessage(message);

        setTimeout(() => {
            if (!this.isStopped) {
                this.projectStore.setEditorMode();
            }
        }, 500);
    }

    ////////////////////////////////////////////////////////////////////////////////

    onWorkerMessage = (workerToRenderMessage: WorkerToRenderMessage) => {
        if (workerToRenderMessage.getLvglImageByName) {
            return (
                this.lgvlPageRuntime?.getBitmap(
                    workerToRenderMessage.getLvglImageByName.name
                ) ?? 0
            );
        }
        this.onWorkerMessageAsync(workerToRenderMessage);
        return undefined;
    };

    onWorkerMessageAsync = async (
        workerToRenderMessage: WorkerToRenderMessage
    ) => {
        if (workerToRenderMessage.init) {
            const message: RendererToWorkerMessage = {};

            let globalVariableValues: IGlobalVariable[];
            if (this.projectStore.projectTypeTraits.isDashboard) {
                globalVariableValues = this.globalVariables.map(
                    globalVariable => {
                        if (globalVariable.kind == "basic") {
                            return {
                                kind: "basic",
                                globalVariableIndex:
                                    globalVariable.globalVariableIndex,
                                value: globalVariable.value
                            };
                        }
                        return {
                            kind: "array",
                            globalVariableIndex:
                                globalVariable.globalVariableIndex,
                            value: globalVariable.value
                        };
                    }
                );
            } else {
                globalVariableValues = [];
            }

            message.init = {
                nodeModuleFolders: await getNodeModuleFolders(),
                assetsData: this.assetsData,
                assetsMap: this.assetsMap,
                globalVariableValues,
                displayWidth: this.displayWidth,
                displayHeight: this.displayHeight
            };

            await this.worker.postMessage(message);

            if (this.lgvlPageRuntime) {
                this.lgvlPageRuntime.mount();
                await this.lgvlPageRuntime.loadAllBitmaps();
            }

            this.debuggerConnection.onConnected();
        } else {
            if (workerToRenderMessage.scpiCommand) {
                this.executeScpiCommand(workerToRenderMessage.scpiCommand);
                return;
            }

            if (workerToRenderMessage.connectToInstrumentId) {
                this.connectToInstrument(
                    workerToRenderMessage.connectToInstrumentId
                );
                return;
            }

            if (workerToRenderMessage.freeArrayValue) {
                const valueType =
                    workerToRenderMessage.freeArrayValue.valueType;

                const objectVariableType =
                    getObjectVariableTypeFromType(valueType);
                if (objectVariableType) {
                    const value = objectVariableType.createValue(
                        workerToRenderMessage.freeArrayValue
                            .value as IObjectVariableValueConstructorParams,
                        true
                    );
                    objectVariableType.destroyValue(value);
                }

                return;
            }

            if (workerToRenderMessage.propertyValues) {
                this.componentProperties.valuesFromWorker(
                    workerToRenderMessage.propertyValues
                );
            }

            if (workerToRenderMessage.componentMessages) {
                for (const componentMessage of workerToRenderMessage.componentMessages) {
                    const flowStateAndIndex = this.flowStateMap.get(
                        componentMessage.flowStateIndex
                    );
                    if (flowStateAndIndex) {
                        const { flowState, flowIndex } = flowStateAndIndex;

                        const component = getObjectFromStringPath(
                            this.projectStore.project,
                            this.assetsMap.flows[flowIndex].components[
                                componentMessage.componentIndex
                            ].path
                        ) as Component;
                        if (component) {
                            component.onWasmWorkerMessage(
                                flowState,
                                componentMessage.message,
                                componentMessage.id
                            );
                        } else {
                            console.error("UNEXPECTED!");
                        }
                    } else {
                        console.error("UNEXPECTED!");
                    }
                }
            }

            if (workerToRenderMessage.messageToDebugger) {
                this.debuggerConnection.onMessageToDebugger(
                    arrayBufferToBinaryString(
                        workerToRenderMessage.messageToDebugger
                    )
                );
            }

            this.screen = workerToRenderMessage.screen;

            runInAction(() => {
                if (
                    workerToRenderMessage.isRTL != undefined &&
                    this.isRTL !== workerToRenderMessage.isRTL
                ) {
                    this.isRTL = workerToRenderMessage.isRTL ? true : false;
                }
            });

            this.requestAnimationFrameId = window.requestAnimationFrame(
                this.tick
            );
        }
    };

    tick = () => {
        if (this.componentProperties.selectedPage != this.selectedPage) {
            this.componentProperties.selectedPage = this.selectedPage;
            this.componentProperties.reset();
        }

        this.requestAnimationFrameId = undefined;

        if (this.screen) {
            this.lastScreen = this.screen;
            this.updateCanvasContext();
        }

        const message: RendererToWorkerMessage = {
            wheel: this.isPaused
                ? undefined
                : {
                      deltaY: this.wheelDeltaY,
                      clicked: this.wheelClicked
                  },
            pointerEvents: this.isPaused ? undefined : this.pointerEvents,
            updateGlobalVariableValues:
                this.getUpdatedObjectGlobalVariableValues(),
            assignProperties:
                this.componentProperties.assignPropertiesOnNextTick,
            evalProperties: this.componentProperties.evalProperties
        };

        this.worker.postMessage(message);

        this.wheelDeltaY = 0;
        this.wheelClicked = 0;
        this.pointerEvents = [];
        //this.screen = undefined;
        this.componentProperties.assignPropertiesOnNextTick = [];
    };

    setCanvasContext(ctx: CanvasRenderingContext2D) {
        this.ctx = ctx;
        this.updateCanvasContext();
    }

    updateCanvasContext() {
        if (!this.lastScreen || !this.ctx) {
            return;
        }

        var imgData = new ImageData(
            this.lastScreen,
            this.displayWidth,
            this.displayHeight
        );

        let left;
        let top;
        let width;
        let height;
        if (this.isDebuggerActive) {
            this.ctx.clearRect(0, 0, this.displayWidth, this.displayHeight);
            left = this.selectedPage.left;
            top = this.selectedPage.top;
            width = this.selectedPage.width;
            height = this.selectedPage.height;
        } else {
            left = 0;
            top = 0;
            width = this.displayWidth;
            height = this.displayHeight;
        }

        this.ctx.putImageData(imgData, 0, 0, left, top, width, height);
    }

    ////////////////////////////////////////////////////////////////////////////////

    async loadGlobalVariables() {
        await this.projectStore.runtimeSettings.loadPersistentVariables();

        for (const variable of this.projectStore.project.allGlobalVariables) {
            const globalVariableInAssetsMap =
                this.assetsMap.globalVariables.find(
                    globalVariableInAssetsMap =>
                        globalVariableInAssetsMap.name == variable.name
                );

            const globalVariableIndex = globalVariableInAssetsMap!.index;

            let value = this.projectStore.dataContext.get(variable.name);

            const objectVariableType = getObjectVariableTypeFromType(
                variable.type
            );
            if (objectVariableType) {
                if (value == null) {
                    if (objectVariableType.editConstructorParams) {
                        const constructorParams =
                            await objectVariableType.editConstructorParams(
                                variable,
                                undefined
                            );

                        if (constructorParams) {
                            value = objectVariableType.createValue(
                                constructorParams,
                                true
                            );

                            this.projectStore.dataContext.set(
                                variable.name,
                                value
                            );
                        }
                    }
                }

                if (value != null) {
                    const arrayValue = createJsArrayValue(
                        this.assetsMap.typeIndexes[variable.type],
                        value,
                        this.assetsMap,
                        getObjectVariableTypeFromType
                    );

                    this.globalVariables.push({
                        kind: "object",
                        globalVariableIndex,
                        variable,
                        value: arrayValue,

                        objectVariableValue: value,
                        objectVariableType
                    });
                }
            } else if (variable.persistent) {
                if (isStructType(variable.type) || isArrayType(variable.type)) {
                    const arrayValue = createJsArrayValue(
                        this.assetsMap.typeIndexes[variable.type],
                        value,
                        this.assetsMap,
                        getObjectVariableTypeFromType
                    );

                    this.globalVariables.push({
                        kind: "struct",
                        globalVariableIndex,
                        variable,
                        value: arrayValue
                    });
                } else {
                    this.globalVariables.push({
                        kind: "basic",
                        globalVariableIndex,
                        variable,
                        value
                    });
                }
            }
        }
    }

    getUpdatedObjectGlobalVariableValues(): IGlobalVariable[] {
        const updatedGlobalVariableValues: IGlobalVariable[] = [];

        function isDifferent(
            oldArrayValue: ArrayValue,
            newArrayValue: ArrayValue
        ) {
            for (let i = 0; i < oldArrayValue.values.length; i++) {
                const oldValue = oldArrayValue.values[i];
                const newValue = newArrayValue.values[i];
                if (oldValue != null && typeof oldValue == "object") {
                    if (isDifferent(oldValue, newValue as ArrayValue)) {
                        return true;
                    }
                } else {
                    if (oldValue != newValue) {
                        return true;
                    }
                }
            }
            return false;
        }

        for (const objectVariable of this.globalVariables) {
            if (objectVariable.kind == "object") {
                const oldArrayValue = objectVariable.value;

                const newArrayValue = createJsArrayValue(
                    this.assetsMap.typeIndexes[objectVariable.variable.type],
                    objectVariable.objectVariableValue,
                    this.assetsMap,
                    getObjectVariableTypeFromType
                );

                if (isDifferent(oldArrayValue, newArrayValue)) {
                    updatedGlobalVariableValues.push({
                        kind: "array",
                        globalVariableIndex: objectVariable.globalVariableIndex,
                        value: newArrayValue
                    });
                    objectVariable.value = newArrayValue;
                }
            }
        }

        return updatedGlobalVariableValues;
    }

    async destroyGlobalVariables() {
        for (let i = 0; i < this.globalVariables.length; i++) {
            const globalVariable = this.globalVariables[i];
            if (globalVariable.kind == "object") {
                this.projectStore.dataContext.set(
                    globalVariable.variable.name,
                    globalVariable.objectVariableValue
                );
            }
        }

        await this.projectStore.runtimeSettings.savePersistentVariables();

        for (let i = 0; i < this.globalVariables.length; i++) {
            const globalVariable = this.globalVariables[i];
            if (globalVariable.kind == "object") {
                globalVariable.objectVariableType.destroyValue(
                    globalVariable.objectVariableValue
                );
            }
        }
    }

    ////////////////////////////////////////////////////////////////////////////////

    async executeScpiCommand(scpiCommand: ScpiCommand) {
        const command = arrayBufferToBinaryString(scpiCommand.command);

        for (let i = 0; i < this.globalVariables.length; i++) {
            const globalVariable = this.globalVariables[i];
            if (globalVariable.kind == "object") {
                const instrument = globalVariable.objectVariableValue;
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

                        try {
                            await connection.acquire(false);
                        } catch (err) {
                            let data: RendererToWorkerMessage;
                            data = {
                                scpiResult: {
                                    errorMessage: err.toString()
                                }
                            };
                            this.worker.postMessage(data);
                            return;
                        }

                        let result: any = "";
                        try {
                            if (scpiCommand.isQuery) {
                                //console.log("SCPI query", command);
                                result = await connection.query(command);
                                //console.log("SCPI result", result);
                            } else {
                                //console.log("SCPI command", command);
                                connection.query(command);
                                result = "";
                            }
                        } finally {
                            connection.release();
                        }

                        if (result instanceof FileHistoryItem) {
                            result = result.data;
                        }

                        let data: RendererToWorkerMessage;
                        if (result instanceof Uint8Array) {
                            data = {
                                scpiResult: {
                                    result
                                }
                            };
                        } else if (typeof result == "number") {
                            data = {
                                scpiResult: {
                                    result: binaryStringToArrayBuffer(
                                        result.toString()
                                    )
                                }
                            };
                        } else if (typeof result == "string") {
                            data = {
                                scpiResult: {
                                    result: binaryStringToArrayBuffer(result)
                                }
                            };
                        } else {
                            data = {
                                scpiResult: {
                                    errorMessage: result.error
                                        ? result.error
                                        : "unknown SCPI result"
                                }
                            };
                        }

                        this.worker.postMessage(data);

                        return;
                    }
                }
            }
        }
    }

    connectToInstrument(instrumentId: string) {
        for (let i = 0; i < this.globalVariables.length; i++) {
            const globalVariable = this.globalVariables[i];
            if (globalVariable.kind == "object") {
                const instrument = globalVariable.objectVariableValue;
                if (
                    instrument instanceof InstrumentObject &&
                    instrument.id == instrumentId
                ) {
                    instrument.connection.connect();
                }
            }
        }
    }

    ////////////////////////////////////////////////////////////////////////////////

    evalProperty(
        flowContext: IFlowContext,
        component: Component,
        propertyName: string
    ) {
        return this.componentProperties.evalProperty(
            flowContext,
            component,
            propertyName
        );
    }

    assignProperty(
        expressionContext: IExpressionContext,
        component: Component,
        propertyName: string,
        value: any
    ) {
        this.componentProperties.assignProperty(
            expressionContext,
            component,
            propertyName,
            value
        );
    }

    executeWidgetAction(
        flowContext: IFlowContext,
        widget: Widget,
        actionName: string,
        value: any,
        valueType: ValueType
    ) {
        const flowState = flowContext.flowState!;

        const flowStateIndex = this.flowStateToFlowIndexMap.get(flowState);
        if (flowStateIndex == undefined) {
            console.error("Unexpected!");
            return;
        }

        const flow = ProjectEditor.getFlow(widget);
        const flowPath = getObjectPathAsString(flow);
        const flowIndex = this.assetsMap.flowIndexes[flowPath];
        if (flowIndex == undefined) {
            console.error("Unexpected!");
            return;
        }

        const componentPath = getObjectPathAsString(widget);
        const componentIndex =
            this.assetsMap.flows[flowIndex].componentIndexes[componentPath];
        if (componentIndex == undefined) {
            console.error("Unexpected!");
            return;
        }

        const outputIndex =
            this.assetsMap.flows[flowIndex].components[componentIndex]
                .outputIndexes[actionName];
        if (outputIndex == undefined) {
            console.error("Unexpected!");
            return;
        }

        const valueTypeIndex = this.assetsMap.typeIndexes[valueType];
        if (valueTypeIndex == undefined) {
            console.error("Unexpected!");
            return;
        }

        const arrayValue = createJsArrayValue(
            valueTypeIndex,
            value,
            this.assetsMap,
            getObjectVariableTypeFromType
        );

        if (arrayValue == undefined) {
            console.error("Unexpected!");
            return;
        }

        const message: RendererToWorkerMessage = {};
        message.executeWidgetAction = {
            flowStateIndex,
            componentIndex,
            outputIndex,
            arrayValue
        };
        this.worker.postMessage(message);
    }

    sendResultToWorker(messageId: number, result: any, finalResult: boolean) {
        const message: RendererToWorkerMessage = {};
        message.resultToWorker = {
            messageId,
            result,
            finalResult: finalResult == undefined ? true : finalResult
        };
        this.worker.postMessage(message);
    }

    ////////////////////////////////////////////////////////////////////////////////

    renderPage() {
        return <WasmCanvas />;
    }
}

////////////////////////////////////////////////////////////////////////////////

export const WasmCanvas = observer(
    class WasmCanvas extends React.Component {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        canvasRef = React.createRef<HTMLCanvasElement>();

        sendPointerEvent(event: PointerEvent) {
            const canvas = this.canvasRef.current;
            if (!canvas) {
                return;
            }
            const wasmRuntime = this.context.runtime as WasmRuntime;
            if (!wasmRuntime) {
                return;
            }

            var bbox = canvas.getBoundingClientRect();

            const x = (event.clientX - bbox.left) * (canvas.width / bbox.width);

            const y =
                (event.clientY - bbox.top) * (canvas.height / bbox.height);

            const pressed = event.buttons == 1 ? 1 : 0;

            wasmRuntime.pointerEvents.push({ x, y, pressed });

            event.preventDefault();
            event.stopPropagation();
        }

        onPointerDown = (event: PointerEvent) => {
            const canvas = this.canvasRef.current;
            if (!canvas) {
                return;
            }
            const wasmRuntime = this.context.runtime as WasmRuntime;
            if (!wasmRuntime) {
                return;
            }

            if (event.buttons == 4) {
                wasmRuntime.wheelClicked = 1;
            }
            canvas.setPointerCapture(event.pointerId);
            this.sendPointerEvent(event);
        };

        onPointerMove = (event: PointerEvent) => {
            this.sendPointerEvent(event);
        };

        onPointerUp = (event: PointerEvent) => {
            const canvas = this.canvasRef.current;
            if (!canvas) {
                return;
            }
            canvas.releasePointerCapture(event.pointerId);
            this.sendPointerEvent(event);
        };

        onPointerCancel = (event: PointerEvent) => {
            const canvas = this.canvasRef.current;
            if (!canvas) {
                return;
            }
            canvas.releasePointerCapture(event.pointerId);
            this.sendPointerEvent(event);
        };

        onWheel = (event: WheelEvent) => {
            const wasmRuntime = this.context.runtime as WasmRuntime;
            if (!wasmRuntime) {
                return;
            }
            wasmRuntime.wheelDeltaY += -event.deltaY;
        };

        componentDidMount() {
            const canvasElement = this.canvasRef.current;
            if (!canvasElement) {
                return;
            }
            const canvas = canvasElement;

            const wasmRuntime = this.context.runtime as WasmRuntime;

            canvas.width = wasmRuntime.displayWidth;
            canvas.height = wasmRuntime.displayHeight;

            wasmRuntime.setCanvasContext(canvas.getContext("2d")!);

            canvas.addEventListener("pointerdown", this.onPointerDown, true);
            canvas.addEventListener("pointermove", this.onPointerMove, true);
            canvas.addEventListener("pointerup", this.onPointerUp, true);
            canvas.addEventListener(
                "pointercancel",
                this.onPointerCancel,
                true
            );
            document.addEventListener("wheel", this.onWheel, true);
        }

        componentWillUnmount() {
            const canvasElement = this.canvasRef.current;
            if (canvasElement) {
                const canvas = canvasElement;

                canvas.removeEventListener(
                    "pointerdown",
                    this.onPointerDown,
                    true
                );
                canvas.removeEventListener(
                    "pointermove",
                    this.onPointerMove,
                    true
                );
                canvas.removeEventListener("pointerup", this.onPointerUp, true);
                canvas.removeEventListener(
                    "pointercancel",
                    this.onPointerCancel,
                    true
                );
                document.removeEventListener("wheel", this.onWheel, true);
            }
        }

        render() {
            const wasmRuntime = this.context.runtime as WasmRuntime;
            return (
                <canvas
                    ref={this.canvasRef}
                    width={wasmRuntime.displayWidth}
                    height={wasmRuntime.displayHeight}
                />
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

class WasmDebuggerConnection extends DebuggerConnectionBase {
    constructor(private wasmRuntime: WasmRuntime) {
        super(wasmRuntime);
    }

    start() {}

    stop() {}

    sendMessageFromDebugger(data: string) {
        if (this.wasmRuntime.worker) {
            const message: RendererToWorkerMessage = {
                messageFromDebugger: binaryStringToArrayBuffer(data)
            };
            this.wasmRuntime.worker.postMessage(message);
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

class ComponentProperties {
    selectedPage: Page;

    // eval
    evalFlowStates = new Map<
        number,
        {
            evalComponents: Map<
                Component,
                {
                    componentIndex: number;
                    evalProperties: {
                        [propertyName: string]: {
                            propertyIndex: number;
                            propertyValueIndexes: {
                                [indexesPath: string]: number;
                            };
                        };
                    };
                }
            >;
        }
    >();
    evalProperties: IEvalProperty[] | undefined;
    propertyValues: ValueWithType[] = [];
    nextPropertyValueIndex: number = 0;

    // assign
    assignFlowStates = new Map<
        number,
        {
            assignComponents: Map<
                Component,
                {
                    componentIndex: number;
                    assignProperties: {
                        [propertyName: string]: {
                            propertyIndex: number;
                            propertyValueIndexes: {
                                [indexesPath: string]: number;
                            };
                        };
                    };
                }
            >;
        }
    >();
    assignPropertiesOnNextTick: IAssignProperty[] = [];

    constructor(public wasmRuntime: WasmRuntime) {
        makeObservable(this, {
            propertyValues: observable
        });
    }

    reset() {
        this.evalFlowStates = new Map();
        this.evalProperties = undefined;
        runInAction(() => {
            this.propertyValues = [];
        });
        this.nextPropertyValueIndex = 0;
    }

    evalProperty(
        flowContext: IFlowContext,
        component: Component,
        propertyName: string
    ) {
        const flowState = flowContext.flowState!;

        const flowStateIndex =
            this.wasmRuntime.flowStateToFlowIndexMap.get(flowState);
        if (flowStateIndex == undefined) {
            console.error("Unexpected!");
            return undefined;
        }

        let evalFlowState = this.evalFlowStates.get(flowStateIndex);
        if (!evalFlowState) {
            // add new evalFlowState
            evalFlowState = {
                evalComponents: new Map()
            };
            this.evalFlowStates.set(flowStateIndex, evalFlowState);
        }

        let evalComponent = evalFlowState.evalComponents.get(component);
        if (!evalComponent) {
            // add new evalComponent
            const flow = ProjectEditor.getFlow(component);
            const flowPath = getObjectPathAsString(flow);
            const flowIndex = this.wasmRuntime.assetsMap.flowIndexes[flowPath];
            if (flowIndex == undefined) {
                console.error("Unexpected!");
                return undefined;
            }

            const componentPath = getObjectPathAsString(component);
            const componentIndex =
                this.wasmRuntime.assetsMap.flows[flowIndex].componentIndexes[
                    componentPath
                ];
            if (componentIndex == undefined) {
                console.error("Unexpected!");
                return undefined;
            }

            evalComponent = {
                componentIndex,
                evalProperties: {}
            };

            evalFlowState.evalComponents.set(component, evalComponent);
        }

        let indexes = flowContext.dataContext.get(
            FLOW_ITERATOR_INDEXES_VARIABLE
        );
        if (indexes == undefined) {
            indexes = [0];
        }
        let indexesPath = indexes.join("/");

        let evalProperty = evalComponent.evalProperties[propertyName];
        if (evalProperty == undefined) {
            // add new evalProperty
            const propertyIndex = this.getPropertyIndex(
                component,
                propertyName
            );
            if (propertyIndex == -1) {
                console.error("Unexpected!");
                return undefined;
            }

            evalProperty = {
                propertyIndex,
                propertyValueIndexes: {
                    [indexesPath]: this.nextPropertyValueIndex
                }
            };

            evalComponent.evalProperties[propertyName] = evalProperty;

            if (this.evalProperties == undefined) {
                this.evalProperties = [];
            }

            this.evalProperties[this.nextPropertyValueIndex] = {
                flowStateIndex,
                componentIndex: evalComponent.componentIndex,
                propertyIndex: evalProperty.propertyIndex,
                propertyValueIndex: this.nextPropertyValueIndex,
                indexes
            };
            this.nextPropertyValueIndex++;
        } else {
            if (evalProperty.propertyValueIndexes[indexesPath] == undefined) {
                evalProperty.propertyValueIndexes[indexesPath] =
                    this.nextPropertyValueIndex;

                if (this.evalProperties == undefined) {
                    this.evalProperties = [];
                }

                this.evalProperties[this.nextPropertyValueIndex] = {
                    flowStateIndex,
                    componentIndex: evalComponent.componentIndex,
                    propertyIndex: evalProperty.propertyIndex,
                    propertyValueIndex: this.nextPropertyValueIndex,
                    indexes
                };

                this.nextPropertyValueIndex++;
            }
        }

        let propertyValueIndex = evalProperty.propertyValueIndexes[indexesPath];

        if (propertyValueIndex < this.propertyValues.length) {
            // get evaluated value
            return this.propertyValues[propertyValueIndex].value;
        }

        // not evaluated yet
        return undefined;
    }

    valuesFromWorker(widgetPropertyValues: IPropertyValue[]) {
        if (widgetPropertyValues.length > 0) {
            runInAction(() => {
                for (const propertyValue of widgetPropertyValues) {
                    for (
                        let i = this.propertyValues.length;
                        i < propertyValue.propertyValueIndex;
                        i++
                    ) {
                        this.propertyValues[i] = {
                            value: undefined,
                            valueType: "undefined"
                        };
                    }

                    this.propertyValues[propertyValue.propertyValueIndex] =
                        propertyValue.valueWithType;
                }
            });
        }
    }

    assignProperty(
        expressionContext: IExpressionContext,
        component: Component,
        propertyName: string,
        value: any
    ) {
        const flowState = expressionContext.flowState!;

        const flowStateIndex =
            this.wasmRuntime.flowStateToFlowIndexMap.get(flowState);
        if (flowStateIndex == undefined) {
            console.error("Unexpected!");
            return;
        }

        let assignFlowState = this.assignFlowStates.get(flowStateIndex);
        if (!assignFlowState) {
            // add new assignFlowState
            assignFlowState = {
                assignComponents: new Map()
            };
            this.assignFlowStates.set(flowStateIndex, assignFlowState);
        }

        let assignComponent = assignFlowState.assignComponents.get(component);
        if (!assignComponent) {
            // add new assignComponent
            const flow = ProjectEditor.getFlow(component);
            const flowPath = getObjectPathAsString(flow);
            const flowIndex = this.wasmRuntime.assetsMap.flowIndexes[flowPath];
            if (flowIndex == undefined) {
                console.error("Unexpected!");
                return;
            }

            const componentPath = getObjectPathAsString(component);
            const componentIndex =
                this.wasmRuntime.assetsMap.flows[flowIndex].componentIndexes[
                    componentPath
                ];
            if (componentIndex == undefined) {
                console.error("Unexpected!");
                return;
            }

            assignComponent = {
                componentIndex,
                assignProperties: {}
            };

            assignFlowState.assignComponents.set(component, assignComponent);
        }

        // add new evalProperty
        const propertyIndex = this.getPropertyIndex(component, propertyName);
        if (propertyIndex == -1) {
            console.error("Unexpected!");
            return;
        }

        const indexes = expressionContext.dataContext.get(
            FLOW_ITERATOR_INDEXES_VARIABLE
        );

        this.assignPropertiesOnNextTick.push({
            flowStateIndex,
            componentIndex: assignComponent.componentIndex,
            propertyIndex,
            indexes,
            value
        });
    }

    private getPropertyIndex(component: Component, propertyName: string) {
        const classInfo = getClassInfo(component);

        const properties = classInfo.properties.filter(propertyInfo =>
            isFlowProperty(component, propertyInfo, [
                "input",
                "template-literal",
                "assignable"
            ])
        );

        return properties.findIndex(property => property.name == propertyName);
    }
}

////////////////////////////////////////////////////////////////////////////////

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
