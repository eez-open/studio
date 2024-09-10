import path from "path";
import type { Socket } from "net";
import { action, observable, runInAction, makeObservable } from "mobx";
import net from "net";
import _ from "lodash";

import * as notification from "eez-studio-ui/notification";

import type { InstrumentObject } from "instrument/instrument-object";
import type { ConnectionParameters } from "instrument/connection/interface";
import type { WebSimulatorMessageDispatcher } from "instrument/connection/connection-renderer";
import type { ConnectionBase } from "instrument/connection/connection-base";

import type { AssetsMap, ValueType, ValueWithType } from "eez-studio-types";

import { showSelectInstrumentDialog } from "project-editor/flow/components/actions/instrument";
import { Flow } from "project-editor/flow/flow";
import { ConnectionLine } from "project-editor/flow/connection-line";
import { Component, Widget } from "project-editor/flow/component";
import {
    IFlowContext,
    IFlowState,
    LogItemType
} from "project-editor/flow/flow-interfaces";
import {
    StateMachineAction,
    ComponentState,
    FlowState,
    RuntimeBase,
    SingleStepMode
} from "project-editor/flow/runtime/runtime";
import { ProjectStore } from "project-editor/store";

import { getObjectFromStringPath } from "project-editor/store";
import {
    evalExpression,
    IExpressionContext
} from "project-editor/flow/expression";
import { ProjectEditor } from "project-editor/project-editor-interface";
import { ExecuteComponentLogItem } from "project-editor/flow/debugger/logs";
import { InputActionComponent } from "project-editor/flow/components/actions";
import { getProperty, IEezObject } from "project-editor/core/object";
import { getDashboardState } from "project-editor/flow/runtime/component-execution-states";
import { getJSObjectFromID } from "project-editor/flow/runtime/wasm-value";

const DEBUGGER_TCP_PORT = 3333;

export enum MessagesToDebugger {
    MESSAGE_TO_DEBUGGER_STATE_CHANGED, // STATE

    MESSAGE_TO_DEBUGGER_ADD_TO_QUEUE, // FLOW_STATE_INDEX, SOURCE_COMPONENT_INDEX, SOURCE_OUTPUT_INDEX, TARGET_COMPONENT_INDEX, TARGET_INPUT_INDEX, FREE_MEMORT, TOTAL_MEMORY
    MESSAGE_TO_DEBUGGER_REMOVE_FROM_QUEUE, // no params

    MESSAGE_TO_DEBUGGER_GLOBAL_VARIABLE_INIT, // GLOBAL_VARIABLE_INDEX, VALUE_ADDR, VALUE
    MESSAGE_TO_DEBUGGER_LOCAL_VARIABLE_INIT, // FLOW_STATE_INDEX, LOCAL_VARIABLE_INDEX, VALUE_ADDR, VALUE
    MESSAGE_TO_DEBUGGER_COMPONENT_INPUT_INIT, // FLOW_STATE_INDEX, COMPONENT_INPUT_INDEX, VALUE_ADDR, VALUE

    MESSAGE_TO_DEBUGGER_VALUE_CHANGED, // VALUE_ADDR, VALUE

    MESSAGE_TO_DEBUGGER_FLOW_STATE_CREATED, // FLOW_STATE_INDEX, FLOW_INDEX, PARENT_FLOW_STATE_INDEX (-1 - NO PARENT), PARENT_COMPONENT_INDEX (-1 - NO PARENT COMPONENT)
    MESSAGE_TO_DEBUGGER_FLOW_STATE_TIMELINE_CHANGED, // FLOW_STATE_INDEX, TIMELINE_POSITION
    MESSAGE_TO_DEBUGGER_FLOW_STATE_DESTROYED, // FLOW_STATE_INDEX

    MESSAGE_TO_DEBUGGER_FLOW_STATE_ERROR, // FLOW_STATE_INDEX, COMPONENT_INDEX, ERROR_MESSAGE

    MESSAGE_TO_DEBUGGER_LOG, // LOG_ITEM_TYPE, FLOW_STATE_INDEX, COMPONENT_INDEX, MESSAGE

    MESSAGE_TO_DEBUGGER_PAGE_CHANGED, // PAGE_ID

    MESSAGE_TO_DEBUGGER_COMPONENT_EXECUTION_STATE_CHANGED, // FLOW_STATE_INDEX, COMPONENT_INDEX, STATE
    MESSAGE_TO_DEBUGGER_COMPONENT_ASYNC_STATE_CHANGED // FLOW_STATE_INDEX, COMPONENT_INDEX, STATE
}

enum MessagesFromDebugger {
    MESSAGE_FROM_DEBUGGER_RESUME, // no params
    MESSAGE_FROM_DEBUGGER_PAUSE, // no params
    MESSAGE_FROM_DEBUGGER_SINGLE_STEP, // no params

    MESSAGE_FROM_DEBUGGER_ADD_BREAKPOINT, // FLOW_INDEX, COMPONENT_INDEX
    MESSAGE_FROM_DEBUGGER_REMOVE_BREAKPOINT, // FLOW_INDEX, COMPONENT_INDEX
    MESSAGE_FROM_DEBUGGER_ENABLE_BREAKPOINT, // FLOW_INDEX, COMPONENT_INDEX
    MESSAGE_FROM_DEBUGGER_DISABLE_BREAKPOINT, // FLOW_INDEX, COMPONENT_INDEX

    MESSAGE_FROM_DEBUGGER_MODE // MODE (0:RUN | 1:DEBUG)
}

const DEBUGGER_STATE_RESUMED = 0;
const DEBUGGER_STATE_PAUSED = 1;
const DEBUGGER_STATE_SINGLE_STEP = 2;
const DEBUGGER_STATE_STOPPED = 3;

const LOG_ITEM_TYPE_FATAL = 0;
const LOG_ITEM_TYPE_ERROR = 1;
const LOG_ITEM_TYPE_WARNING = 2;
const LOG_ITEM_TYPE_SCPI = 3;
const LOG_ITEM_TYPE_INFO = 4;
const LOG_ITEM_TYPE_DEBUG = 5;

const FIRST_INTERNAL_PAGE_ID = 32000;

export class RemoteRuntime extends RuntimeBase {
    connection: ConnectionBase | undefined;
    debuggerConnection: DebuggerConnectionBase | undefined;
    instrument: InstrumentObject | undefined;
    assetsMap: AssetsMap;
    debuggerValues = new Map<number, DebuggerValue[]>();
    flowStateMap = new Map<
        number,
        { flowIndex: number; flowState: FlowState }
    >();
    flowStateToFlowIndexMap = new Map<IFlowState, number>();
    transitionToRunningMode: boolean = false;
    resumeAtStart: boolean = false;

    constructor(public projectStore: ProjectStore) {
        super(projectStore);
    }

    getWasmModuleId(): number | undefined {
        return undefined;
    }

    async doStartRuntime(isDebuggerActive: boolean) {
        const partsPromise = this.projectStore.build();

        const instrument = await showSelectInstrumentDialog(this.projectStore);

        if (!instrument) {
            this.projectStore.setEditorMode();
            return;
        }

        this.instrument = instrument;

        const parts = await partsPromise;
        if (!parts) {
            notification.error("Build error...", {
                autoClose: false
            });
            this.projectStore.setEditorMode();
            return;
        }

        this.assetsMap = parts["GUI_ASSETS_DATA_MAP_JS"] as AssetsMap;
        if (!this.assetsMap) {
            this.projectStore.setEditorMode();
            return;
        }

        const toastId = notification.info("Uploading app...", {
            autoClose: false
        });

        const connection = instrument.connection;
        connection.connect();

        for (let i = 0; i < 10; i++) {
            if (instrument.isConnected) {
                break;
            }
            await new Promise<void>(resolve => setTimeout(resolve, 100));
        }

        if (!instrument.isConnected) {
            notification.update(toastId, {
                type: notification.ERROR,
                render: `Instrument not connected`,
                autoClose: 1000
            });
            this.projectStore.setEditorMode();
            return;
        }

        this.connection = connection;

        let acquired = false;
        let acquireError;
        for (let i = 0; i < 10; i++) {
            try {
                await connection.acquire(false);
                acquired = true;
                break;
            } catch (err) {
                acquireError = err;
                await new Promise<void>(resolve => setTimeout(resolve, 100));
            }
        }

        if (!acquired) {
            notification.update(toastId, {
                type: notification.ERROR,
                render: `Error: ${acquireError.toString()}`,
                autoClose: 1000
            });
            this.projectStore.setEditorMode();
            return;
        }

        try {
            this.startDebugger();

            const destinationFolderPath = this.projectStore.getAbsoluteFilePath(
                this.projectStore.project.settings.build.destinationFolder ||
                    "."
            );

            const destinationFileName = `${path.basename(
                this.projectStore.filePath || "",
                ".eez-project"
            )}.app`;

            const sourceFilePath = `${destinationFolderPath}/${destinationFileName}`;

            await new Promise<void>((resolve, reject) => {
                const uploadInstructions = Object.assign(
                    {},
                    instrument.defaultFileUploadInstructions,
                    {
                        sourceFilePath,
                        destinationFileName,
                        destinationFolderPath: "/Scripts"
                    }
                );

                connection.upload(uploadInstructions, resolve, reject);
            });

            connection.command(`SYST:DEL 100`);

            const runningScript = await connection.query(`SCR:RUN?`);
            if (runningScript != "" && runningScript != `""`) {
                connection.command(`SCR:STOP`);
                connection.command(`SYST:DEL 100`);
            }

            connection.command(`SCR:RUN "/Scripts/${destinationFileName}"`);

            if (isDebuggerActive) {
                this.transition(StateMachineAction.PAUSE);
            } else {
                this.transition(StateMachineAction.RUN);
            }

            if (!this.isStopped) {
                notification.update(toastId, {
                    type: notification.SUCCESS,
                    render: `Flow started`,
                    autoClose: 1000
                });
            }

            this.onDebuggerActiveChanged();

            return;
        } catch (err) {
            notification.update(toastId, {
                type: notification.ERROR,
                render: `Error: ${err.toString()}`,
                autoClose: 1000
            });

            this.projectStore.setEditorMode();

            return;
        } finally {
            connection.release();
        }
    }

    cleanup() {
        this.debuggerValues.clear();
        this.flowStateMap.clear();
    }

    async doStopRuntime(notifyUser: boolean) {
        this.stopDebugger();

        this.cleanup();

        const connection = this.connection;
        this.connection = undefined;

        if (!connection) {
            return;
        }

        if (!connection.isConnected) {
            return;
        }

        if (this.error) {
            if (notifyUser) {
                notification.error(
                    `Flow stopped with error: ${this.error.toString()}`
                );
            }
        } else {
            try {
                await connection.acquire(false);
            } catch (err) {
                notification.error(`Error: ${err.toString()}`);
                return;
            }

            try {
                const runningScript = await connection.query(`SCR:RUN?`);
                if (runningScript != "" && runningScript != `""`) {
                    connection.command(`SCR:STOP`);
                    if (notifyUser) {
                        notification.success("Flow stopped", {
                            autoClose: 1000
                        });
                    }
                }
            } catch (err) {
                if (notifyUser) {
                    notification.error(
                        `Flow stopped with error: ${err.toString()}`
                    );
                }
            } finally {
                connection.release();
            }
        }
    }

    startDebugger() {
        if (
            !this.debuggerConnection &&
            this.instrument &&
            this.instrument.lastConnection
        ) {
            if (this.instrument.lastConnection.type == "web-simulator") {
                this.debuggerConnection = new WebSimulatorDebuggerConnection(
                    this
                );
                this.debuggerConnection.start(this.instrument.lastConnection);
            } else {
                this.debuggerConnection = new SocketDebuggerConnection(this);
                this.debuggerConnection.start(this.instrument.lastConnection);
            }
        }
    }

    stopDebugger() {
        if (this.debuggerConnection) {
            this.debuggerConnection.stop();
            this.debuggerConnection = undefined;
        }
    }

    toggleDebugger() {
        if (this.isDebuggerActive) {
            if (this.isPaused) {
                this.transitionToRunningMode = true;
                this.resume();
            } else {
                this.transition(StateMachineAction.RUN);
            }

            runInAction(() => {
                this.isDebuggerActive = false;
                this.projectStore.uiStateStore.pageRuntimeFrontFace = true;
            });
        } else {
            this.pause();
        }

        this.onDebuggerActiveChanged();
    }

    resume() {
        if (this.debuggerConnection) {
            this.singleStepQueueTask = undefined;
            this.singleStepLastSkippedTask = undefined;
            this.debuggerConnection.sendMessageFromDebugger(
                `${MessagesFromDebugger.MESSAGE_FROM_DEBUGGER_RESUME}\n`
            );

            if (this.isDebuggerActive) {
                this.projectStore.editorsStore.openEditor(this.selectedPage);
            }
        }
    }

    pause() {
        if (!this.isPaused) {
            if (this.debuggerConnection) {
                this.debuggerConnection.sendMessageFromDebugger(
                    `${MessagesFromDebugger.MESSAGE_FROM_DEBUGGER_PAUSE}\n`
                );
            }
        }

        runInAction(() => {
            this.isDebuggerActive = true;
            this.projectStore.uiStateStore.pageRuntimeFrontFace = false;
        });
    }

    onDebuggerActiveChanged() {
        if (this.debuggerConnection) {
            this.debuggerConnection.sendMessageFromDebugger(
                `${MessagesFromDebugger.MESSAGE_FROM_DEBUGGER_MODE}\t${
                    this.isDebuggerActive ? 1 : 0
                }\n`
            );
        }
    }

    runSingleStep(singleStepMode?: SingleStepMode) {
        if (this.debuggerConnection) {
            if (singleStepMode != undefined) {
                this.singleStepMode = singleStepMode;
                this.singleStepQueueTask = this.queue[0];
                this.singleStepLastSkippedTask = undefined;
            }
            this.debuggerConnection.sendMessageFromDebugger(
                `${MessagesFromDebugger.MESSAGE_FROM_DEBUGGER_SINGLE_STEP}\n`
            );
        }
    }

    stringPathToObject = new Map<string, IEezObject | undefined>();

    getObjectFromStringPath(path: string) {
        let object = this.stringPathToObject.get(path);
        if (!object) {
            object = getObjectFromStringPath(this.projectStore.project, path);
            this.stringPathToObject.set(path, object);
        }
        return object;
    }

    findComponentInSourceMap(component: Component) {
        let flowIndex = -1;
        let componentIndex = -1;

        const flow = ProjectEditor.getFlow(component);

        const flowInAssetsMap = this.assetsMap.flows.find(flowInAssetsMap => {
            const obj = this.getObjectFromStringPath(flowInAssetsMap.path);
            return obj == flow;
        });

        if (flowInAssetsMap) {
            flowIndex = flowInAssetsMap.flowIndex;

            const componentInAssetsMap = flowInAssetsMap.components.find(
                componentInAssetsMap => {
                    const obj = this.getObjectFromStringPath(
                        componentInAssetsMap.path
                    );
                    return obj == component;
                }
            );

            if (componentInAssetsMap) {
                componentIndex = componentInAssetsMap.componentIndex;
            }
        }

        return { flowIndex, componentIndex };
    }

    onBreakpointAdded(component: Component) {
        if (this.debuggerConnection) {
            const { flowIndex, componentIndex } =
                this.findComponentInSourceMap(component);

            if (flowIndex == -1 || componentIndex == -1) {
                console.error("UNEXPECTED!");
                return;
            }

            this.debuggerConnection.sendMessageFromDebugger(
                `${MessagesFromDebugger.MESSAGE_FROM_DEBUGGER_ADD_BREAKPOINT}\t${flowIndex}\t${componentIndex}\n`
            );
        }
    }

    onBreakpointRemoved(component: Component) {
        if (this.debuggerConnection) {
            const { flowIndex, componentIndex } =
                this.findComponentInSourceMap(component);

            if (flowIndex == -1 || componentIndex == -1) {
                console.error("UNEXPECTED!");
                return;
            }

            this.debuggerConnection.sendMessageFromDebugger(
                `${MessagesFromDebugger.MESSAGE_FROM_DEBUGGER_REMOVE_BREAKPOINT}\t${flowIndex}\t${componentIndex}\n`
            );
        }
    }

    onBreakpointEnabled(component: Component) {
        if (this.debuggerConnection) {
            const { flowIndex, componentIndex } =
                this.findComponentInSourceMap(component);

            if (flowIndex == -1 || componentIndex == -1) {
                console.error("UNEXPECTED!");
                return;
            }

            this.debuggerConnection.sendMessageFromDebugger(
                `${MessagesFromDebugger.MESSAGE_FROM_DEBUGGER_ENABLE_BREAKPOINT}\t${flowIndex}\t${componentIndex}\n`
            );
        }
    }

    onBreakpointDisabled(component: Component) {
        if (this.debuggerConnection) {
            const { flowIndex, componentIndex } =
                this.findComponentInSourceMap(component);

            if (flowIndex == -1 || componentIndex == -1) {
                console.error("UNEXPECTED!");
                return;
            }

            this.debuggerConnection.sendMessageFromDebugger(
                `${MessagesFromDebugger.MESSAGE_FROM_DEBUGGER_DISABLE_BREAKPOINT}\t${flowIndex}\t${componentIndex}\n`
            );
        }
    }

    executeWidgetAction(
        flowContext: IFlowContext,
        widget: Widget,
        actionName: string,
        value: any,
        valueType: ValueType
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

    evalProperty(
        flowContext: IFlowContext,
        widget: Widget,
        propertyName: string
    ) {
        let expr = getProperty(widget, propertyName);
        return evalExpression(flowContext, widget, expr);
    }

    evalPropertyWithType(
        flowContext: IFlowContext,
        widget: Widget,
        propertyName: string
    ): ValueWithType | undefined {
        let expr = getProperty(widget, propertyName);
        return {
            value: evalExpression(flowContext, widget, expr),
            valueType: "any" as const
        };
    }
}

////////////////////////////////////////////////////////////////////////////////

export abstract class DebuggerConnectionBase {
    dataAccumulated: string = "";

    timeoutTimerId: any;

    constructor(public runtime: RemoteRuntime) {}

    abstract start(connectionParameters: ConnectionParameters): void;
    abstract stop(): void;
    abstract sendMessageFromDebugger(data: string): void;

    parseStringDebuggerValue(str: string) {
        let parsedStr = "";
        for (let i = 0; i < str.length; i++) {
            if (str[i] == "\\") {
                i++;
                if (str[i] == "t") {
                    parsedStr += "\t";
                } else if (str[i] == "n") {
                    parsedStr += "\n";
                } else if (str[i] == '"') {
                    parsedStr += '"';
                } else {
                    i--;
                    parsedStr += str[i];
                }
            } else {
                parsedStr += str[i];
            }
        }
        return parsedStr;
    }

    parseArrayOrStructDebuggerValue(str: string) {
        const addresses = str
            .substring(1, str.length - 1)
            .split(",")
            .map(addressStr => parseInt(addressStr, 16));

        const arraySize = addresses[1];

        const arrayType = addresses[2];
        const type = this.runtime.assetsMap.types[arrayType];
        if (!type) {
            console.error("UNEXPECTED!");
            return undefined;
        }

        const arrayElementAddresses = addresses.slice(3);

        let value = observable(
            type.kind == "array" ||
                (type.kind == "basic" && type.valueType == "array:any")
                ? new Array(arraySize)
                : {}
        );

        for (let i = 0; i < arrayElementAddresses.length; i++) {
            let propertyName: string | number;
            let propertyType: string;

            if (type.kind == "array") {
                propertyName = i;
                propertyType = type.elementType.valueType;
            } else if (type.kind == "object") {
                const field = type.fields[i];
                if (!field) {
                    console.error("UNEXPECTED!");
                    return undefined;
                }
                propertyName = field.name;
                propertyType = field.valueType;
            } else {
                propertyName = i;
                propertyType = type.valueType;
            }

            const objectMemberValue = new ObjectMemberValue(
                value,
                propertyName,
                propertyType
            );

            const arr = this.runtime.debuggerValues.get(
                arrayElementAddresses[i]
            );
            this.runtime.debuggerValues.set(
                arrayElementAddresses[i],
                arr ? [...arr, objectMemberValue] : [objectMemberValue]
            );
        }

        return value;
    }

    parseDebuggerValue(str: string) {
        if (str == "undefined") {
            return undefined;
        }

        if (str == "null") {
            return null;
        }

        if (str == "true") {
            return true;
        }

        if (str == "false") {
            return false;
        }

        if (str[0] == '"') {
            try {
                return JSON.parse(str);
            } catch (err) {
                console.log("UNEXPECTED!", err, str);
                return str;
            }
        }

        if (str[0] == "{") {
            return this.parseArrayOrStructDebuggerValue(str);
        }

        if (str[0] == "@") {
            return `blob (size=${Number.parseInt(str.substring(1))})`;
        }

        if (str[0] == ">") {
            return `stream (id=${Number.parseInt(str.substring(1))})`;
        }

        if (str[0] == "#") {
            const objID = Number.parseInt(str.substring(1));
            const wasmModuleId = this.runtime.getWasmModuleId();
            if (wasmModuleId) {
                return getJSObjectFromID(objID, wasmModuleId);
            }
            return `json (id=${Number.parseInt(str.substring(1))})`;
        }

        if (str[0] == "*") {
            return str[1] == "p"
                ? `widget (${str.substring(2)})`
                : `widget (id=${Number.parseInt(str.substring(2))})`;
        }

        function parseFloat(str: string) {
            const buf = Buffer.alloc(8);

            for (let i = 0; i < str.length; i += 2) {
                buf[i / 2] = parseInt(str.substring(i, i + 2), 16);
            }

            if (str.length == 16) {
                return buf.readDoubleLE(0);
            }

            return buf.readFloatLE(0);
        }

        if (str[0] == "!") {
            if (str[1] == "!") {
                return `event (${str.substring(2)})`;
            } else {
                const time = parseFloat(str.substring(1));
                return new Date(time);
            }
        }

        if (str[0] == "H") {
            return parseFloat(str.substring(1));
        }

        return Number.parseFloat(str);
    }

    getFlowState(flowStateIndex: number) {
        return (
            this.runtime.flowStateMap.get(flowStateIndex) ?? {
                flowIndex: -1,
                flowState: undefined
            }
        );
    }

    onConnected() {
        this.runtime.onDebuggerActiveChanged();
    }

    counter = 0;

    onMessageToDebugger(data: string) {
        this.dataAccumulated += data;

        while (true) {
            const newLineIndex = this.dataAccumulated.indexOf("\n");
            if (newLineIndex == -1) {
                break;
            }

            const message = this.dataAccumulated.substring(0, newLineIndex);
            this.dataAccumulated = this.dataAccumulated.substr(
                newLineIndex + 1
            );

            const messageParameters = message.split("\t");

            const messageType = parseInt(
                messageParameters[0]
            ) as MessagesToDebugger;

            const runtime = this.runtime;

            switch (messageType) {
                case MessagesToDebugger.MESSAGE_TO_DEBUGGER_STATE_CHANGED:
                    {
                        const state = parseInt(messageParameters[1]);

                        if (state == DEBUGGER_STATE_RESUMED) {
                            if (runtime.transitionToRunningMode) {
                                runtime.transitionToRunningMode = false;
                                runtime.transition(StateMachineAction.RUN);
                            } else {
                                runtime.transition(StateMachineAction.RESUME);
                            }
                        } else if (state == DEBUGGER_STATE_PAUSED) {
                            if (runtime.resumeAtStart) {
                                runtime.resumeAtStart = false;
                                runtime.resume();
                            } else {
                                runtime.transition(StateMachineAction.PAUSE);
                            }
                        } else if (state == DEBUGGER_STATE_SINGLE_STEP) {
                            runtime.transition(StateMachineAction.SINGLE_STEP);
                        } else if (state == DEBUGGER_STATE_STOPPED) {
                            if (!runtime.error) {
                                runtime.projectStore.setEditorMode(true);
                            }
                        }
                    }
                    break;

                case MessagesToDebugger.MESSAGE_TO_DEBUGGER_ADD_TO_QUEUE:
                    {
                        const flowStateIndex = parseInt(messageParameters[1]);
                        const sourceComponentIndex = parseInt(
                            messageParameters[2]
                        );
                        const sourceOutputIndex = parseInt(
                            messageParameters[3]
                        );
                        const targetComponentIndex = parseInt(
                            messageParameters[4]
                        );
                        const targetInputIndex = parseInt(messageParameters[5]);

                        runInAction(() => {
                            this.runtime.freeMemory = parseInt(
                                messageParameters[6]
                            );
                            this.runtime.totalMemory = parseInt(
                                messageParameters[7]
                            );
                        });

                        const { flowIndex, flowState } =
                            this.getFlowState(flowStateIndex);
                        if (!flowState) {
                            console.error("UNEXPECTED!");
                            return;
                        }

                        const flowInAssetsMap =
                            runtime.assetsMap.flows[flowIndex];
                        if (!flowInAssetsMap) {
                            console.error("UNEXPECTED!");
                            return;
                        }

                        const targetComponentInAssetsMap =
                            flowInAssetsMap.components[targetComponentIndex];
                        if (!targetComponentInAssetsMap) {
                            console.error("UNEXPECTED!");
                            return;
                        }

                        const targetComponent =
                            this.runtime.getObjectFromStringPath(
                                targetComponentInAssetsMap.path
                            ) as Component;
                        if (!targetComponent) {
                            console.error("UNEXPECTED!");
                            return;
                        }

                        let connectionLine: ConnectionLine | undefined;

                        if (sourceComponentIndex != -1) {
                            const sourceComponentInAssetsMap =
                                flowInAssetsMap.components[
                                    sourceComponentIndex
                                ];
                            if (!sourceComponentInAssetsMap) {
                                console.error("UNEXPECTED!");
                                return;
                            }

                            const sourceComponent =
                                this.runtime.getObjectFromStringPath(
                                    sourceComponentInAssetsMap.path
                                ) as Component;
                            if (!sourceComponent) {
                                console.error("UNEXPECTED!");
                                return;
                            }

                            const sourceOutputInAssetsMap =
                                sourceComponentInAssetsMap.outputs[
                                    sourceOutputIndex
                                ];
                            if (!sourceOutputInAssetsMap) {
                                console.error("UNEXPECTED!");
                                return;
                            }

                            const targetInputInAssetsMap =
                                flowInAssetsMap.componentInputs.find(
                                    componentInput =>
                                        componentInput.inputIndex ==
                                        targetInputIndex
                                );
                            if (!targetInputInAssetsMap) {
                                console.error("UNEXPECTED!");
                                return;
                            }

                            connectionLine =
                                flowState.flow.connectionLines.find(
                                    connectionLine =>
                                        connectionLine.sourceComponent ==
                                            sourceComponent &&
                                        connectionLine.output ==
                                            sourceOutputInAssetsMap.outputName &&
                                        connectionLine.targetComponent ==
                                            targetComponent &&
                                        connectionLine.input ==
                                            targetInputInAssetsMap.inputName
                                );

                            if (!connectionLine) {
                                console.error("UNEXPECTED!");
                                return;
                            }

                            this.runtime.setActiveConnectionLine(
                                connectionLine
                            );
                        }

                        runInAction(() =>
                            runtime.pushTask({
                                flowState,
                                component: targetComponent,
                                connectionLine
                            })
                        );
                    }
                    break;

                case MessagesToDebugger.MESSAGE_TO_DEBUGGER_REMOVE_FROM_QUEUE:
                    {
                        if (runtime.queue.length > 0) {
                            runtime.logs.addLogItem(
                                new ExecuteComponentLogItem(runtime.queue[0])
                            );

                            runtime.popTask();
                        } else {
                            console.error("UNEXPECTED!");
                            return;
                        }
                    }
                    break;

                case MessagesToDebugger.MESSAGE_TO_DEBUGGER_GLOBAL_VARIABLE_INIT:
                    {
                        // console.log(
                        //     "MESSAGE_TO_DEBUGGER_GLOBAL_VARIABLE_INIT",
                        //     messageParameters
                        // );

                        const globalVariableIndex = parseInt(
                            messageParameters[1]
                        );
                        const valueAddress = parseInt(messageParameters[2], 16);
                        const value = messageParameters[3];

                        const globalVariableInAssetsMap =
                            runtime.assetsMap.globalVariables.find(
                                globalVariable =>
                                    globalVariable.index == globalVariableIndex
                            );
                        if (!globalVariableInAssetsMap) {
                            console.error("UNEXPECTED!");
                            return;
                        }

                        const globalVariable =
                            runtime.projectStore.project.allGlobalVariables.find(
                                globalVariable =>
                                    globalVariable.fullName ==
                                    globalVariableInAssetsMap.name
                            );
                        if (!globalVariable) {
                            console.error("UNEXPECTED!");
                            return;
                        }

                        const globalVariableValue = new GlobalVariableValue(
                            runtime,
                            globalVariableInAssetsMap.name,
                            globalVariable.type
                        );

                        globalVariableValue.set(this.parseDebuggerValue(value));

                        const arr =
                            this.runtime.debuggerValues.get(valueAddress);

                        runtime.debuggerValues.set(
                            valueAddress,
                            arr
                                ? [...arr, globalVariableValue]
                                : [globalVariableValue]
                        );
                    }
                    break;

                case MessagesToDebugger.MESSAGE_TO_DEBUGGER_LOCAL_VARIABLE_INIT:
                    {
                        // console.log(
                        //     "MESSAGE_TO_DEBUGGER_LOCAL_VARIABLE_INIT",
                        //     messageParameters
                        // );

                        const flowStateIndex = parseInt(messageParameters[1]);
                        const localVariableIndex = parseInt(
                            messageParameters[2]
                        );
                        const valueAddress = parseInt(messageParameters[3], 16);
                        const value = messageParameters[4];

                        const { flowIndex, flowState } =
                            this.getFlowState(flowStateIndex);
                        if (!flowState) {
                            console.error("UNEXPECTED!");
                            return;
                        }

                        const flowInAssetsMap =
                            runtime.assetsMap.flows[flowIndex];
                        if (!flowInAssetsMap) {
                            console.error("UNEXPECTED!");
                            return;
                        }

                        const localVariableInAssetsMap =
                            flowInAssetsMap.localVariables.find(
                                localVariable =>
                                    localVariable.index == localVariableIndex
                            );
                        if (!localVariableInAssetsMap) {
                            console.error("UNEXPECTED!");
                            return;
                        }

                        const localVariable =
                            flowState.flow.userPropertiesAndLocalVariables.find(
                                localVariable =>
                                    localVariable.name ==
                                    localVariableInAssetsMap.name
                            );
                        if (!localVariable) {
                            console.error("UNEXPECTED!");
                            return;
                        }

                        const localVariableValue = new LocalVariableValue(
                            flowState,
                            localVariableInAssetsMap.name,
                            localVariable.type
                        );

                        localVariableValue.set(this.parseDebuggerValue(value));

                        const arr =
                            this.runtime.debuggerValues.get(valueAddress);

                        runtime.debuggerValues.set(
                            valueAddress,
                            arr
                                ? [...arr, localVariableValue]
                                : [localVariableValue]
                        );
                    }
                    break;

                case MessagesToDebugger.MESSAGE_TO_DEBUGGER_COMPONENT_INPUT_INIT:
                    {
                        // console.log(
                        //     "MESSAGE_TO_DEBUGGER_COMPONENT_INPUT_INIT",
                        //     messageParameters
                        // );

                        const flowStateIndex = parseInt(messageParameters[1]);
                        const componentInputIndex = parseInt(
                            messageParameters[2]
                        );
                        const valueAddress = parseInt(messageParameters[3], 16);
                        const value = messageParameters[4];

                        const { flowIndex, flowState } =
                            this.getFlowState(flowStateIndex);

                        if (!flowState) {
                            console.error("UNEXPECTED!");
                            return;
                        }

                        const flowInAssetsMap =
                            runtime.assetsMap.flows[flowIndex];
                        if (!flowInAssetsMap) {
                            console.error("UNEXPECTED!");
                            return;
                        }

                        const componentInputMap =
                            flowInAssetsMap.componentInputs.find(
                                componentInput =>
                                    componentInput.inputIndex ==
                                    componentInputIndex
                            );
                        if (!componentInputMap) {
                            console.error("UNEXPECTED!");
                            return;
                        }

                        const componentInAssetsMap =
                            flowInAssetsMap.components[
                                componentInputMap.componentIndex
                            ];
                        if (!componentInAssetsMap) {
                            console.error("UNEXPECTED!");
                            return;
                        }

                        const component = this.runtime.getObjectFromStringPath(
                            componentInAssetsMap.path
                        ) as Component;
                        if (!component) {
                            console.error("UNEXPECTED!");
                            return;
                        }

                        const componentState =
                            flowState.getComponentState(component);

                        const componentInputValue = new ComponentInputValue(
                            componentState,
                            componentInputMap.inputName,
                            componentInputMap.inputType
                        );

                        componentInputValue.set(this.parseDebuggerValue(value));

                        const arr =
                            this.runtime.debuggerValues.get(valueAddress);

                        runtime.debuggerValues.set(
                            valueAddress,
                            arr
                                ? [...arr, componentInputValue]
                                : [componentInputValue]
                        );
                    }
                    break;

                case MessagesToDebugger.MESSAGE_TO_DEBUGGER_VALUE_CHANGED:
                    {
                        const valueAddress = parseInt(messageParameters[1], 16);
                        const value = messageParameters[2];

                        const debuggerValueArr =
                            runtime.debuggerValues.get(valueAddress);
                        if (!debuggerValueArr) {
                            console.log(
                                "MESSAGE_TO_DEBUGGER_VALUE_CHANGED",
                                messageParameters
                            );
                            console.error("UNEXPECTED!");
                            return;
                        }

                        const parsedValue = this.parseDebuggerValue(value);

                        debuggerValueArr.forEach(debuggerValue =>
                            debuggerValue.set(parsedValue)
                        );
                    }
                    break;

                case MessagesToDebugger.MESSAGE_TO_DEBUGGER_FLOW_STATE_CREATED:
                    {
                        const flowStateIndex = parseInt(messageParameters[1]);
                        const flowIndex = parseInt(messageParameters[2]);
                        const parentFlowStateIndex = parseInt(
                            messageParameters[3]
                        );
                        const parentComponentIndex = parseInt(
                            messageParameters[4]
                        );

                        // console.log(
                        //     "MESSAGE_TO_DEBUGGER_FLOW_STATE_CREATED",
                        //     "flowStateIndex",
                        //     flowStateIndex,
                        //     "flowIndex",
                        //     flowIndex,
                        //     "parentFlowStateIndex",
                        //     parentFlowStateIndex
                        // );

                        const flowInAssetsMap =
                            runtime.assetsMap.flows[flowIndex];
                        if (!flowInAssetsMap) {
                            console.error("UNEXPECTED!");
                            return;
                        }

                        const flow = this.runtime.getObjectFromStringPath(
                            flowInAssetsMap.path
                        ) as Flow;
                        if (!flow) {
                            console.error("UNEXPECTED!");
                            return;
                        }

                        if (this.getFlowState(flowStateIndex).flowState) {
                            console.error("UNEXPECTED!");
                            return;
                        }

                        let parentFlowState: FlowState | undefined;
                        let parentComponent: Component | undefined;
                        if (parentFlowStateIndex != -1) {
                            const { flowIndex, flowState } =
                                this.getFlowState(parentFlowStateIndex);

                            if (!flowState) {
                                console.error("UNEXPECTED!");
                                return;
                            }

                            parentFlowState = flowState;

                            if (parentComponentIndex != -1) {
                                const parentFlowInAssetsMap =
                                    runtime.assetsMap.flows[flowIndex];
                                if (!parentFlowInAssetsMap) {
                                    console.error("UNEXPECTED!");
                                    return;
                                }

                                const componentInAssetsMap =
                                    parentFlowInAssetsMap.components[
                                        parentComponentIndex
                                    ];
                                if (!componentInAssetsMap) {
                                    console.error("UNEXPECTED!");
                                    return;
                                }

                                parentComponent =
                                    this.runtime.getObjectFromStringPath(
                                        componentInAssetsMap.path
                                    ) as Component;
                                if (!parentComponent) {
                                    console.error("UNEXPECTED!");
                                    return;
                                }
                            }
                        }

                        let flowState = new FlowState(
                            runtime,
                            flow,
                            parentFlowState,
                            parentComponent,
                            flowStateIndex
                        );

                        runtime.flowStateMap.set(flowStateIndex, {
                            flowIndex,
                            flowState
                        });

                        runtime.flowStateToFlowIndexMap.set(
                            flowState,
                            flowStateIndex
                        );

                        runInAction(() =>
                            (parentFlowState || runtime).flowStates.push(
                                flowState
                            )
                        );
                    }
                    break;

                case MessagesToDebugger.MESSAGE_TO_DEBUGGER_FLOW_STATE_TIMELINE_CHANGED:
                    {
                        const flowStateIndex = parseInt(messageParameters[1]);
                        const timelinePosition = parseFloat(
                            messageParameters[2]
                        );

                        // console.log(
                        //     "MESSAGE_TO_DEBUGGER_FLOW_STATE_TIMELINE_CHANGED",
                        //     "flowStateIndex",
                        //     flowStateIndex,
                        //     timelinePosition
                        // );

                        const { flowState } = this.getFlowState(flowStateIndex);
                        if (!flowState) {
                            console.error("UNEXPECTED!");
                            return;
                        }

                        runInAction(
                            () =>
                                (flowState.timelinePosition = timelinePosition)
                        );
                    }
                    break;

                case MessagesToDebugger.MESSAGE_TO_DEBUGGER_FLOW_STATE_DESTROYED:
                    {
                        const flowStateIndex = parseInt(messageParameters[1]);

                        // console.log(
                        //     "MESSAGE_TO_DEBUGGER_FLOW_STATE_DESTROYED",
                        //     "flowStateIndex",
                        //     flowStateIndex
                        // );

                        const { flowState } = this.getFlowState(flowStateIndex);
                        if (!flowState) {
                            console.error("UNEXPECTED!");
                            return;
                        }

                        runtime.flowStateMap.delete(flowStateIndex);
                        runtime.flowStateToFlowIndexMap.delete(flowState);

                        runInAction(() => (flowState.isFinished = true));

                        this.runtime.cleanupFlowStates();
                    }
                    break;

                case MessagesToDebugger.MESSAGE_TO_DEBUGGER_FLOW_STATE_ERROR:
                    {
                        const flowStateIndex = parseInt(messageParameters[1]);
                        const componentIndex = parseInt(messageParameters[2]);
                        const errorMessage = this.parseStringDebuggerValue(
                            messageParameters[3].substr(
                                1,
                                messageParameters[3].length - 2
                            )
                        );

                        runInAction(() => {
                            runtime.error = errorMessage;
                        });

                        runtime.stopRuntime(true);

                        const { flowIndex, flowState } =
                            this.getFlowState(flowStateIndex);
                        if (!flowState) {
                            console.error("UNEXPECTED!");
                            return;
                        }

                        runInAction(() => {
                            flowState.error = errorMessage;
                        });

                        const flowInAssetsMap =
                            runtime.assetsMap.flows[flowIndex];
                        if (!flowInAssetsMap) {
                            console.error("UNEXPECTED!");
                            return;
                        }

                        let component;

                        const componentInAssetsMap =
                            flowInAssetsMap.components[componentIndex];
                        if (!componentInAssetsMap) {
                            console.error("UNEXPECTED!");
                            return;
                        }
                        component = this.runtime.getObjectFromStringPath(
                            componentInAssetsMap.path
                        ) as Component;
                        if (!component) {
                            console.error("UNEXPECTED!");
                            return;
                        }

                        flowState.log("error", errorMessage, component);
                    }
                    break;

                case MessagesToDebugger.MESSAGE_TO_DEBUGGER_LOG:
                    {
                        const logItemType = parseInt(messageParameters[1]);
                        const flowStateIndex = parseInt(messageParameters[2]);
                        const componentIndex = parseInt(messageParameters[3]);
                        const message = messageParameters[4];

                        const { flowIndex, flowState } =
                            this.getFlowState(flowStateIndex);
                        if (!flowState) {
                            console.error("UNEXPECTED!");
                            return;
                        }

                        const flowInAssetsMap =
                            runtime.assetsMap.flows[flowIndex];
                        if (!flowInAssetsMap) {
                            console.error("UNEXPECTED!");
                            return;
                        }

                        let component;

                        if (componentIndex != -1) {
                            const componentInAssetsMap =
                                flowInAssetsMap.components[componentIndex];
                            if (!componentInAssetsMap) {
                                console.error("UNEXPECTED!");
                                return;
                            }
                            component = this.runtime.getObjectFromStringPath(
                                componentInAssetsMap.path
                            ) as Component;
                            if (!component) {
                                console.error("UNEXPECTED!");
                                return;
                            }
                        }

                        const mapLogItemTypeEnumToString: {
                            [key: number]: LogItemType;
                        } = {
                            [LOG_ITEM_TYPE_FATAL]: "fatal",
                            [LOG_ITEM_TYPE_ERROR]: "error",
                            [LOG_ITEM_TYPE_WARNING]: "warning",
                            [LOG_ITEM_TYPE_SCPI]: "scpi",
                            [LOG_ITEM_TYPE_INFO]: "info",
                            [LOG_ITEM_TYPE_DEBUG]: "debug"
                        };

                        flowState.log(
                            mapLogItemTypeEnumToString[logItemType],
                            message,
                            component
                        );
                    }
                    break;

                case MessagesToDebugger.MESSAGE_TO_DEBUGGER_PAGE_CHANGED:
                    {
                        let pageId = parseInt(messageParameters[1]);

                        if (pageId < 0) {
                            pageId = -pageId;
                        }

                        pageId -= 1;

                        if (
                            pageId < 0 ||
                            pageId >= this.runtime.assetsMap.flows.length
                        ) {
                            if (pageId < FIRST_INTERNAL_PAGE_ID) {
                                console.error("UNEXPECTED!");
                            }
                            return;
                        }

                        const page = this.runtime.getObjectFromStringPath(
                            this.runtime.assetsMap.flows[pageId].path
                        );

                        if (!(page instanceof ProjectEditor.PageClass)) {
                            console.error("UNEXPECTED!");
                            return;
                        }

                        this.runtime.selectedPage = page;
                    }
                    break;

                case MessagesToDebugger.MESSAGE_TO_DEBUGGER_COMPONENT_EXECUTION_STATE_CHANGED:
                    {
                        const flowStateIndex = parseInt(messageParameters[1]);
                        const componentIndex = parseInt(messageParameters[2]);
                        const executionState = parseInt(
                            messageParameters[3],
                            16
                        );

                        const { flowIndex, flowState } =
                            this.getFlowState(flowStateIndex);
                        if (!flowState) {
                            console.error("UNEXPECTED!");
                            return;
                        }

                        const flowInAssetsMap =
                            runtime.assetsMap.flows[flowIndex];
                        if (!flowInAssetsMap) {
                            console.error("UNEXPECTED!");
                            return;
                        }

                        let component;

                        const componentInAssetsMap =
                            flowInAssetsMap.components[componentIndex];
                        if (!componentInAssetsMap) {
                            console.error("UNEXPECTED!");
                            return;
                        }
                        component = this.runtime.getObjectFromStringPath(
                            componentInAssetsMap.path
                        ) as Component;
                        if (!component) {
                            console.error("UNEXPECTED!");
                            return;
                        }

                        if (!(component instanceof InputActionComponent)) {
                            const wasmModuleId = this.runtime.getWasmModuleId();

                            if (executionState) {
                                let dashboardExecutionState;
                                if (wasmModuleId != undefined) {
                                    dashboardExecutionState = getDashboardState(
                                        wasmModuleId,
                                        executionState
                                    );
                                }
                                flowState.setComponentExecutionState(
                                    component,
                                    dashboardExecutionState || executionState
                                );
                            } else {
                                flowState.setComponentExecutionState(
                                    component,
                                    undefined
                                );
                            }
                        }
                    }
                    break;

                case MessagesToDebugger.MESSAGE_TO_DEBUGGER_COMPONENT_ASYNC_STATE_CHANGED:
                    {
                        const flowStateIndex = parseInt(messageParameters[1]);
                        const componentIndex = parseInt(messageParameters[2]);
                        const asyncState = parseInt(messageParameters[3]);

                        const { flowIndex, flowState } =
                            this.getFlowState(flowStateIndex);
                        if (!flowState) {
                            console.error("UNEXPECTED!");
                            return;
                        }

                        const flowInAssetsMap =
                            runtime.assetsMap.flows[flowIndex];
                        if (!flowInAssetsMap) {
                            console.error("UNEXPECTED!");
                            return;
                        }

                        let component;

                        const componentInAssetsMap =
                            flowInAssetsMap.components[componentIndex];
                        if (!componentInAssetsMap) {
                            console.error("UNEXPECTED!");
                            return;
                        }
                        component = this.runtime.getObjectFromStringPath(
                            componentInAssetsMap.path
                        ) as Component;
                        if (!component) {
                            console.error("UNEXPECTED!");
                            return;
                        }

                        flowState.setComponentAsyncState(
                            component,
                            asyncState ? true : false
                        );
                    }
                    break;
            }
        }
    }
}

class SocketDebuggerConnection extends DebuggerConnectionBase {
    socket: Socket | undefined;

    constructor(runtime: RemoteRuntime) {
        super(runtime);
    }

    async start(connectionParameters: ConnectionParameters) {
        this.socket = new net.Socket();

        this.socket.setEncoding("binary");

        this.socket.on("data", (data: string) => {
            this.onMessageToDebugger(data);
        });

        this.socket.on("error", (err: any) => {
            if (err.code === "ECONNRESET") {
                console.error(
                    "A connection was forcibly closed by an instrument."
                );
            } else if (err.code === "ECONNREFUSED") {
                console.error(
                    "No connection could be made because the target instrument actively refused it."
                );
            } else {
                console.error(err.toString());
            }
            this.destroy();
        });

        this.socket.on("close", (e: any) => {
            this.stop();
        });

        this.socket.on("end", (e: any) => {
            this.stop();
        });

        this.socket.on("timeout", (e: any) => {
            this.stop();
        });

        this.socket.on("destroyed", (e: any) => {
            this.stop();
        });

        try {
            this.socket.connect(
                DEBUGGER_TCP_PORT,
                connectionParameters.ethernetParameters.address,
                () => {
                    this.onConnected();
                    if (!this.runtime.isDebuggerActive) {
                        this.runtime.resume();
                    }
                }
            );
        } catch (err) {
            console.error(err);
            this.destroy();
        }
    }

    async stop() {
        const os = require("os");

        if (os.platform() == "win32") {
            this.destroy();
        } else {
            if (this.socket) {
                if (this.socket.connecting) {
                    this.destroy();
                } else {
                    this.socket.end();
                    this.destroy();
                }
            }
        }
    }

    destroy() {
        if (this.socket) {
            this.socket.destroy();
            this.socket.unref();
            this.socket.removeAllListeners();
            this.socket = undefined;
        }
    }

    sendMessageFromDebugger(data: string) {
        if (this.socket) {
            this.socket.write(data, "binary");
        } else if (this.runtime.isDebuggerActive) {
            this.runtime.stopRuntimeWithError(
                "Connection with debugger is closed"
            );
        }
    }
}

class WebSimulatorDebuggerConnection extends DebuggerConnectionBase {
    simulatorID: string;
    connected: boolean;
    webSimulatorMessageDispatcher: WebSimulatorMessageDispatcher;

    constructor(runtime: RemoteRuntime) {
        super(runtime);
    }

    async start(connectionParameters: ConnectionParameters) {
        const { webSimulatorMessageDispatcher } = await import(
            "instrument/connection/connection-renderer"
        );
        this.webSimulatorMessageDispatcher = webSimulatorMessageDispatcher;

        this.simulatorID = connectionParameters.webSimulatorParameters.id;

        this.webSimulatorMessageDispatcher.connectDebugger(
            this.simulatorID,
            this
        );
        this.connected = true;
        if (!this.runtime.isDebuggerActive) {
            this.runtime.resume();
        }
        this.onConnected();
    }

    async stop() {
        this.webSimulatorMessageDispatcher.disconnectDebugger(this.simulatorID);
        this.connected = false;
    }

    sendMessageFromDebugger(data: string) {
        if (this.connected) {
            this.webSimulatorMessageDispatcher.sendMessageFromDebugger(
                this.simulatorID,
                data
            );
        } else if (this.runtime.isDebuggerActive) {
            this.runtime.stopRuntimeWithError(
                "Connection with debugger is closed"
            );
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

interface DebuggerValue {
    type: string;

    set(value: any): void;
}

class GlobalVariableValue implements DebuggerValue {
    constructor(
        private runtime: RemoteRuntime,
        private variableName: string,
        public type: string
    ) {}

    set(value: any) {
        this.runtime.projectStore.dataContext.set(this.variableName, value);
    }
}

class LocalVariableValue implements DebuggerValue {
    constructor(
        private flowState: FlowState,
        private variableName: string,
        public type: string
    ) {}

    set(value: any) {
        this.flowState.dataContext.set(this.variableName, value);
    }
}

class ComponentInputValue implements DebuggerValue {
    constructor(
        private componentState: ComponentState,
        private inputName: string,
        public type: string
    ) {}

    set(value: any) {
        this.componentState.setInputData(this.inputName, value);
    }
}

class ObjectMemberValue implements DebuggerValue {
    constructor(
        private object: any,
        private propertyName: string | number,
        public type: string
    ) {
        makeObservable(this, {
            set: action
        });
    }

    set(value: any) {
        this.object[this.propertyName] = value;
    }
}
