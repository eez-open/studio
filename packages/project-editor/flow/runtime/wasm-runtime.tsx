import React from "react";
import { observer } from "mobx-react";

import * as notification from "eez-studio-ui/notification";

import { ProjectContext } from "project-editor/project/context";
import {
    DocumentStoreClass,
    getClassInfo,
    getObjectFromStringPath,
    getObjectPathAsString
} from "project-editor/store";

import {
    RemoteRuntime,
    DebuggerConnectionBase
} from "project-editor/flow/remote-runtime";

import type {
    IAssignProperty,
    IEvalProperty,
    IGlobalVariable,
    IPropertyValue,
    RendererToWorkerMessage,
    ScpiCommand,
    ValueWithType,
    WorkerToRenderMessage
} from "project-editor/flow/runtime/wasm-worker-interfaces";
import {
    getObjectVariableTypeFromType,
    IObjectVariableValue,
    isArrayType,
    isStructType
} from "project-editor/features/variable/value-type";
import { InstrumentObject } from "instrument/instrument-object";
import {
    ArrayValue,
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
    IVariable,
    ValueType
} from "eez-studio-types";
import { getNodeModuleFolders } from "eez-studio-shared/extensions/yarn";
import { IExpressionContext } from "project-editor/flow/expression";
import { FileHistoryItem } from "instrument/window/history/items/file";
import type { Page } from "project-editor/features/page/page";

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

export class WasmRuntime extends RemoteRuntime {
    debuggerConnection = new WasmDebuggerConnection(this);

    worker: Worker;

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
    requestAnimationFrameId: number | undefined;

    componentProperties = new ComponentProperties(this);

    ////////////////////////////////////////////////////////////////////////////////

    constructor(public DocumentStore: DocumentStoreClass) {
        super(DocumentStore);
    }

    ////////////////////////////////////////////////////////////////////////////////

    async doStartRuntime(isDebuggerActive: boolean) {
        const result = await this.DocumentStore.buildAssets();

        const maxPageWidth = Math.max(
            ...this.DocumentStore.project.pages.map(page => page.width)
        );
        if (this.DocumentStore.project.isFirmwareWithFlowSupportProject) {
            this.displayWidth = Math.max(
                maxPageWidth,
                this.DocumentStore.project.settings.general.displayWidth
            );
        } else {
            this.displayWidth = maxPageWidth;
        }

        const maxPageHeight = Math.max(
            ...this.DocumentStore.project.pages.map(page => page.height)
        );
        if (this.DocumentStore.project.isFirmwareWithFlowSupportProject) {
            this.displayHeight = Math.max(
                maxPageHeight,
                this.DocumentStore.project.settings.general.displayHeight
            );
        } else {
            this.displayHeight = maxPageHeight;
        }

        this.displayHeight = Math.min(
            Math.max(
                this.DocumentStore.project.isFirmwareWithFlowSupportProject
                    ? this.DocumentStore.project.settings.general.displayHeight
                    : maxPageHeight,
                1
            ),
            1280
        );

        this.assetsMap = result.GUI_ASSETS_DATA_MAP_JS as AssetsMap;
        if (!this.assetsMap) {
            this.DocumentStore.setEditorMode();
            return;
        }

        this.assetsData = result.GUI_ASSETS_DATA;

        if (this.DocumentStore.project.isDashboardProject) {
            await this.loadGlobalVariables();
        }

        if (!isDebuggerActive) {
            this.resumeAtStart = true;
        }

        // create WASM worker
        this.worker = new Worker(
            "../project-editor/flow/runtime/wasm-worker-pre.js"
        );
        this.worker.onmessage = this.onWorkerMessage;
    }

    async doStopRuntime(notifyUser: boolean) {
        if (this.requestAnimationFrameId) {
            window.cancelAnimationFrame(this.requestAnimationFrameId);
        }

        if (this.worker) {
            this.worker.terminate();
        }

        this.destroyGlobalVariables();

        if (this.error) {
            if (notifyUser) {
                notification.error(
                    `Flow stopped with error: ${this.error.toString()}`
                );
            }
        }
    }

    ////////////////////////////////////////////////////////////////////////////////

    onWorkerMessage = async (e: { data: WorkerToRenderMessage }) => {
        if (e.data.init) {
            const message: RendererToWorkerMessage = {};

            let globalVariableValues: IGlobalVariable[];
            if (this.DocumentStore.project.isDashboardProject) {
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

            this.worker.postMessage(message);
        } else {
            if (e.data.scpiCommand) {
                this.executeScpiCommand(e.data.scpiCommand);
                return;
            }

            if (e.data.connectToInstrumentId) {
                this.connectToInstrument(e.data.connectToInstrumentId);
                return;
            }

            if (e.data.messageToDebugger) {
                this.debuggerConnection.onMessageToDebugger(
                    arrayBufferToBinaryString(e.data.messageToDebugger)
                );
                return;
            }

            if (e.data.propertyValues) {
                this.componentProperties.valuesFromWorker(
                    e.data.propertyValues
                );
            }

            if (e.data.componentMessages) {
                for (const componentMessage of e.data.componentMessages) {
                    const flowStateAndIndex = this.flowStateMap.get(
                        componentMessage.flowStateIndex
                    );
                    if (flowStateAndIndex) {
                        const { flowState, flowIndex } = flowStateAndIndex;

                        const component = getObjectFromStringPath(
                            this.DocumentStore.project,
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

            this.screen = e.data.screen;

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

        if (this.screen && this.ctx) {
            var imgData = new ImageData(
                this.screen,
                this.displayWidth,
                this.displayHeight
            );
            this.ctx.putImageData(imgData, 0, 0);
        }

        const message: RendererToWorkerMessage = {
            wheel: {
                deltaY: this.wheelDeltaY,
                clicked: this.wheelClicked
            },
            pointerEvents: this.pointerEvents,
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
        this.screen = undefined;
    };

    ////////////////////////////////////////////////////////////////////////////////

    async loadGlobalVariables() {
        await this.DocumentStore.runtimeSettings.loadPersistentVariables();

        for (const variable of this.DocumentStore.project.allGlobalVariables) {
            const globalVariableInAssetsMap =
                this.assetsMap.globalVariables.find(
                    globalVariableInAssetsMap =>
                        globalVariableInAssetsMap.name == variable.name
                );

            const globalVariableIndex = globalVariableInAssetsMap!.index;

            let value = this.DocumentStore.dataContext.get(variable.name);

            const objectVariableType = getObjectVariableTypeFromType(
                variable.type
            );
            if (objectVariableType) {
                if (value == null) {
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

                        this.DocumentStore.dataContext.set(
                            variable.name,
                            value
                        );
                    }
                }

                if (value != null) {
                    const arrayValue = createJsArrayValue(
                        this.assetsMap.typeIndexes[variable.type],
                        value,
                        this.assetsMap,
                        objectVariableType
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
                        undefined
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
                    objectVariable.objectVariableType
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
                this.DocumentStore.dataContext.set(
                    globalVariable.variable.name,
                    globalVariable.objectVariableValue
                );
            }
        }

        await this.DocumentStore.runtimeSettings.savePersistentVariables();

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
            undefined
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

        componentDidMount() {
            const canvasElement = this.canvasRef.current;
            if (!canvasElement) {
                return;
            }
            const canvas = canvasElement;

            const wasmRuntime = this.context.runtime as WasmRuntime;

            canvas.width = wasmRuntime.displayWidth;
            canvas.height = wasmRuntime.displayHeight;
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
        const message: RendererToWorkerMessage = {
            messageFromDebugger: binaryStringToArrayBuffer(data)
        };
        this.wasmRuntime.worker.postMessage(message);
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
                widgetPropertyValues.forEach(propertyValue => {
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
                });
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
            isFlowProperty(propertyInfo, [
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
