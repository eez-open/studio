import type { Socket } from "net";

import { showSelectInstrumentDialog } from "./action-components/instrument";
import * as notification from "eez-studio-ui/notification";
import { Connection, getConnection } from "instrument/window/connection";
import { InstrumentObject } from "instrument/instrument-object";
import { ConnectionParameters } from "instrument/connection/interface";
import { AssetsMap } from "project-editor/features/page/build/assets";
import { getObjectFromStringPath } from "project-editor/core/object";
import { action, observable, runInAction } from "mobx";
import { ConnectionLine, Flow } from "project-editor/flow/flow";
import { Component, Widget } from "project-editor/flow/component";
import { IFlowContext, LogItemType } from "project-editor/flow/flow-interfaces";
import {
    getArrayElementTypeFromType,
    getStructureFromType,
    isArrayType,
    isStructType
} from "project-editor/features/variable/value-type";
import { getFlow, getProject } from "project-editor/project/project";
import {
    StateMachineAction,
    ComponentState,
    FlowState,
    RuntimeBase
} from "project-editor/flow/runtime";
import { DocumentStoreClass } from "project-editor/core/store";

const DEBUGGER_TCP_PORT = 3333;

enum MessagesToDebugger {
    MESSAGE_TO_DEBUGGER_STATE_CHANGED, // STATE

    MESSAGE_TO_DEBUGGER_ADD_TO_QUEUE, // FLOW_STATE_INDEX, SOURCE_COMPONENT_INDEX, SOURCE_OUTPUT_INDEX, TARGET_COMPONENT_INDEX, TARGET_INPUT_INDEX
    MESSAGE_TO_DEBUGGER_REMOVE_FROM_QUEUE, // no params

    MESSAGE_TO_DEBUGGER_GLOBAL_VARIABLE_INIT, // GLOBAL_VARIABLE_INDEX, VALUE_ADDR, VALUE
    MESSAGE_TO_DEBUGGER_LOCAL_VARIABLE_INIT, // FLOW_STATE_INDEX, LOCAL_VARIABLE_INDEX, VALUE_ADDR, VALUE
    MESSAGE_TO_DEBUGGER_COMPONENT_INPUT_INIT, // FLOW_STATE_INDEX, COMPONENT_INPUT_INDEX, VALUE_ADDR, VALUE

    MESSAGE_TO_DEBUGGER_VALUE_CHANGED, // VALUE_ADDR, VALUE

    MESSAGE_TO_DEBUGGER_FLOW_STATE_CREATED, // FLOW_STATE_INDEX, FLOW_INDEX, PARENT_FLOW_STATE_INDEX (-1 - NO PARENT), PARENT_COMPONENT_INDEX (-1 - NO PARENT COMPONENT)
    MESSAGE_TO_DEBUGGER_FLOW_STATE_DESTROYED, // FLOW_STATE_INDEX

    MESSAGE_TO_DEBUGGER_FLOW_STATE_ERROR, // FLOW_STATE_INDEX, COMPONENT_INDEX, ERROR_MESSAGE

    MESSAGE_TO_DEBUGGER_LOG // LOG_ITEM_TYPE, FLOW_STATE_INDEX, COMPONENT_INDEX, MESSAGE
}

enum MessagesFromDebugger {
    MESSAGE_FROM_DEBUGGER_RESUME, // no params
    MESSAGE_FROM_DEBUGGER_PAUSE, // no params
    MESSAGE_FROM_DEBUGGER_SINGLE_STEP, // no params

    MESSAGE_FROM_DEBUGGER_ADD_BREAKPOINT, // FLOW_INDEX, COMPONENT_INDEX
    MESSAGE_FROM_DEBUGGER_REMOVE_BREAKPOINT, // FLOW_INDEX, COMPONENT_INDEX
    MESSAGE_FROM_DEBUGGER_ENABLE_BREAKPOINT, // FLOW_INDEX, COMPONENT_INDEX
    MESSAGE_FROM_DEBUGGER_DISABLE_BREAKPOINT // FLOW_INDEX, COMPONENT_INDEX
}

const DEBUGGER_STATE_RESUMED = 0;
const DEBUGGER_STATE_PAUSED = 1;
const DEBUGGER_STATE_SINGLE_STEP = 2;

const LOG_ITEM_TYPE_FATAL = 0;
const LOG_ITEM_TYPE_ERROR = 1;
const LOG_ITEM_TYPE_WARNING = 2;
const LOG_ITEM_TYPE_SCPI = 3;
const LOG_ITEM_TYPE_INFO = 4;
const LOG_ITEM_TYPE_DEBUG = 5;

export class RemoteRuntime extends RuntimeBase {
    connection: Connection | undefined;
    debuggerConnection: DebuggerConnection | undefined;
    instrument: InstrumentObject | undefined;
    assetsMap: AssetsMap;
    debuggerValues = new Map<number, DebuggerValue>();
    flowStateMap = new Map<
        number,
        { flowIndex: number; flowState: FlowState }
    >();
    transitionToRunningMode: boolean = false;

    constructor(public DocumentStore: DocumentStoreClass) {
        super(DocumentStore);
    }

    async doStartRuntime(isDebuggerActive: boolean) {
        const partsPromise = this.DocumentStore.build();

        const instrument = await showSelectInstrumentDialog();

        if (!instrument) {
            this.DocumentStore.setEditorMode();
            return;
        }

        this.instrument = instrument;

        const parts = await partsPromise;
        if (!parts) {
            notification.error("Build error...", {
                autoClose: false
            });
            this.DocumentStore.setEditorMode();
            return;
        }

        this.assetsMap = parts["GUI_ASSETS_DATA_MAP_JS"] as AssetsMap;
        if (!this.assetsMap) {
            this.DocumentStore.setEditorMode();
            return;
        }

        const toastId = notification.info("Uploading app...", {
            autoClose: false
        });

        instrument.connection.connect();

        const editor = instrument.getEditor();
        editor.onCreate();

        //await new Promise<void>(resolve => setTimeout(resolve, 1000));

        const connection = getConnection(editor);

        if (connection) {
            for (let i = 0; i < 10; i++) {
                if (instrument.isConnected) {
                    break;
                }
                await new Promise<void>(resolve => setTimeout(resolve, 100));
            }
        }

        if (!connection || !instrument.isConnected) {
            notification.update(toastId, {
                type: notification.ERROR,
                render: `Instrument not connected`,
                autoClose: 1000
            });
            this.DocumentStore.setEditorMode();
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
            this.DocumentStore.setEditorMode();
            return;
        }

        try {
            this.startDebugger();

            const path = EEZStudio.remote.require("path");

            const destinationFolderPath =
                this.DocumentStore.getAbsoluteFilePath(
                    this.DocumentStore.project.settings.build
                        .destinationFolder || "."
                );

            const destinationFileName = `${path.basename(
                this.DocumentStore.filePath,
                ".eez-project"
            )}.app`;

            const sourceFilePath = `${destinationFolderPath}/${destinationFileName}`;

            await new Promise<void>((resolve, reject) => {
                const uploadInstructions = Object.assign(
                    {},
                    connection.instrument.defaultFileUploadInstructions,
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

            return;
        } catch (err) {
            notification.update(toastId, {
                type: notification.ERROR,
                render: `Error: ${err.toString()}`,
                autoClose: 1000
            });

            this.DocumentStore.setEditorMode();

            return;
        } finally {
            connection.release();
        }
    }

    async doStopRuntime(notifyUser: boolean) {
        this.stopDebugger();

        this.debuggerValues.clear();

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
            this.debuggerConnection = new DebuggerConnection(this);
            this.debuggerConnection.start(this.instrument.lastConnection);
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
            this.transitionToRunningMode = true;
            this.resume();
        } else {
            this.pause();
        }
    }

    resume() {
        if (this.debuggerConnection) {
            this.debuggerConnection.sendMessageFromDebugger(
                `${MessagesFromDebugger.MESSAGE_FROM_DEBUGGER_RESUME}\n`
            );
        }
    }

    pause() {
        if (this.debuggerConnection) {
            this.debuggerConnection.sendMessageFromDebugger(
                `${MessagesFromDebugger.MESSAGE_FROM_DEBUGGER_PAUSE}\n`
            );
        } else {
            runInAction(() => {
                this.isDebuggerActive = true;
            });
        }
    }

    runSingleStep() {
        if (this.debuggerConnection) {
            this.debuggerConnection.sendMessageFromDebugger(
                `${MessagesFromDebugger.MESSAGE_FROM_DEBUGGER_SINGLE_STEP}\n`
            );
        }
    }

    findComponentInSourceMap(component: Component) {
        let flowIndex = -1;
        let componentIndex = -1;

        const flow = getFlow(component);
        const project = getProject(flow);

        const flowInAssetsMap = this.assetsMap.flows.find(
            flowInAssetsMap =>
                getObjectFromStringPath(project, flowInAssetsMap.path) == flow
        );

        if (flowInAssetsMap) {
            flowIndex = flowInAssetsMap.flowIndex;

            const componentInAssetsMap = flowInAssetsMap.components.find(
                componentInAssetsMap =>
                    getObjectFromStringPath(
                        project,
                        componentInAssetsMap.path
                    ) == component
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

    executeWidgetAction(flowContext: IFlowContext, widget: Widget) {}

    readSettings(key: string) {}
    writeSettings(key: string, value: any) {}
}

class DebuggerConnection {
    socket: Socket | undefined;
    dataAccumulated: string = "";

    timeoutTimerId: any;

    constructor(private runtime: RemoteRuntime) {}

    async start(connectionParameters: ConnectionParameters) {
        const net = await import("net");

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
        const os = await import("os");

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

            this.timeoutTimerId = setTimeout(() => {
                this.timeoutTimerId = undefined;
                this.runtime.stopRuntimeWithError(
                    "Debugger connection timeout"
                );
            }, 3000);
        } else if (this.runtime.isDebuggerActive) {
            this.runtime.stopRuntimeWithError("Debugger connection timeout");
        }
    }

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
                    console.error("UNEXPECTED!");
                }
            } else {
                parsedStr += str[i];
            }
        }
        return parsedStr;
    }

    parseArrayOrStructDebuggerValue(str: string, type: string) {
        const arrayElementAddresses = str.split(",");

        let value: any;

        let sortedStructFields;
        let arrayElementType: string | null = null;

        if (isStructType(type)) {
            const structure = getStructureFromType(
                this.runtime.DocumentStore.project,
                type
            );
            if (!structure) {
                console.error("UNEXPECTED!");
                return undefined;
            }

            sortedStructFields = structure.fields
                .slice()
                .sort((a, b) =>
                    a.name < b.name ? -1 : a.name > b.name ? 1 : 0
                );

            value = observable({});
        } else if (isArrayType(type)) {
            arrayElementType = getArrayElementTypeFromType(type);
            if (!arrayElementType) {
                console.error("UNEXPECTED!");
                return undefined;
            }

            value = observable([]);
        } else {
            console.error("UNEXPECTED!");
            return undefined;
        }

        for (let i = 0; i < arrayElementAddresses.length; i++) {
            let propertyName: string | number;
            let propertyType: string;

            if (sortedStructFields) {
                const field = sortedStructFields[i];
                if (!field) {
                    console.error("UNEXPECTED!");
                    return undefined;
                }
                propertyName = field.name;
                propertyType = field.type;
            } else {
                propertyName = i;
                propertyType = arrayElementType!;
            }

            value[propertyName] = undefined;

            const objectMemberValue = new ObjectMemberValue(
                value,
                propertyName,
                propertyType
            );

            this.runtime.debuggerValues.set(
                parseInt(arrayElementAddresses[i]),
                objectMemberValue
            );
        }

        return value;
    }

    parseDebuggerValue(str: string, type: string) {
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
            return this.parseStringDebuggerValue(str.substr(1, str.length - 2));
        }

        if (str[0] == "{") {
            return this.parseArrayOrStructDebuggerValue(
                str.substr(1, str.length - 2),
                type
            );
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

    onMessageToDebugger(data: string) {
        if (this.timeoutTimerId) {
            clearTimeout(this.timeoutTimerId);
            this.timeoutTimerId = undefined;
        }

        this.dataAccumulated += data;

        while (true) {
            const newLineIndex = this.dataAccumulated.indexOf("\n");
            if (newLineIndex == -1) {
                break;
            }

            const message = this.dataAccumulated.substr(0, newLineIndex);

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
                                runtime.transition(StateMachineAction.RUN);
                            } else {
                                runtime.transition(StateMachineAction.RESUME);
                            }
                        } else if (state == DEBUGGER_STATE_PAUSED) {
                            runtime.transition(StateMachineAction.PAUSE);
                        } else if (state == DEBUGGER_STATE_SINGLE_STEP) {
                            runtime.transition(StateMachineAction.SINGLE_STEP);
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

                        const targetComponent = getObjectFromStringPath(
                            runtime.DocumentStore.project,
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

                            const sourceComponent = getObjectFromStringPath(
                                runtime.DocumentStore.project,
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

                            connectionLine.setActive();
                        }

                        runInAction(() =>
                            runtime.pushTask({
                                flowState,
                                component: targetComponent,
                                connectionLine
                            })
                        );

                        if (runtime.isPaused) {
                            runtime.showNextQueueTask();
                        }
                    }
                    break;

                case MessagesToDebugger.MESSAGE_TO_DEBUGGER_REMOVE_FROM_QUEUE:
                    {
                        runInAction(() => runtime.queue.shift());
                    }
                    break;

                case MessagesToDebugger.MESSAGE_TO_DEBUGGER_GLOBAL_VARIABLE_INIT:
                    {
                        // console.log(
                        //     "MESSAGE_TO_DEBUGGER_GLOBAL_VARIABLE_INIT",
                        //     messageParameters.slice(1)
                        // );

                        const globalVariableIndex = parseInt(
                            messageParameters[1]
                        );
                        const valueAddress = parseInt(messageParameters[2]);
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
                            runtime.DocumentStore.project.variables.globalVariables.find(
                                globalVariable =>
                                    globalVariable.name ==
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

                        globalVariableValue.set(
                            this.parseDebuggerValue(value, globalVariable.type)
                        );

                        runtime.debuggerValues.set(
                            valueAddress,
                            globalVariableValue
                        );
                    }
                    break;

                case MessagesToDebugger.MESSAGE_TO_DEBUGGER_LOCAL_VARIABLE_INIT:
                    {
                        // console.log(
                        //     "MESSAGE_TO_DEBUGGER_LOCAL_VARIABLE_INIT",
                        //     messageParameters.slice(1)
                        // );

                        const flowStateIndex = parseInt(messageParameters[1]);
                        const localVariableIndex = parseInt(
                            messageParameters[2]
                        );
                        const valueAddress = parseInt(messageParameters[3]);
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
                            flowState.flow.localVariables.find(
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

                        localVariableValue.set(
                            this.parseDebuggerValue(value, localVariable.type)
                        );

                        runtime.debuggerValues.set(
                            valueAddress,
                            localVariableValue
                        );
                    }
                    break;

                case MessagesToDebugger.MESSAGE_TO_DEBUGGER_COMPONENT_INPUT_INIT:
                    {
                        // console.log(
                        //     "MESSAGE_TO_DEBUGGER_COMPONENT_INPUT_INIT",
                        //     messageParameters.slice(1)
                        // );

                        const flowStateIndex = parseInt(messageParameters[1]);
                        const componentInputIndex = parseInt(
                            messageParameters[2]
                        );
                        const valueAddress = parseInt(messageParameters[3]);
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

                        const component = getObjectFromStringPath(
                            runtime.DocumentStore.project,
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
                            "any"
                        );

                        componentInputValue.set(
                            this.parseDebuggerValue(value, "any")
                        );

                        runtime.debuggerValues.set(
                            valueAddress,
                            componentInputValue
                        );
                    }
                    break;

                case MessagesToDebugger.MESSAGE_TO_DEBUGGER_VALUE_CHANGED:
                    {
                        // console.log(
                        //     "MESSAGE_TO_DEBUGGER_VALUE_CHANGED",
                        //     messageParameters.slice(1)
                        // );

                        const valueAddress = parseInt(messageParameters[1]);
                        const value = messageParameters[2];

                        const debuggerValue =
                            runtime.debuggerValues.get(valueAddress);
                        if (!debuggerValue) {
                            console.error("UNEXPECTED!");
                            return;
                        }

                        debuggerValue.set(
                            this.parseDebuggerValue(value, debuggerValue.type)
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
                        //     MessagesToDebugger.MESSAGE_TO_DEBUGGER_FLOW_STATE_CREATED,
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

                        const flow = getObjectFromStringPath(
                            runtime.DocumentStore.project,
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

                                parentComponent = getObjectFromStringPath(
                                    runtime.DocumentStore.project,
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
                            parentComponent
                        );

                        runtime.flowStateMap.set(flowStateIndex, {
                            flowIndex,
                            flowState
                        });

                        runInAction(() =>
                            (parentFlowState || runtime).flowStates.push(
                                flowState
                            )
                        );
                    }
                    break;

                case MessagesToDebugger.MESSAGE_TO_DEBUGGER_FLOW_STATE_DESTROYED:
                    {
                        const flowStateIndex = parseInt(messageParameters[1]);

                        // console.log(
                        //     MessagesToDebugger.MESSAGE_TO_DEBUGGER_FLOW_STATE_DESTROYED,
                        //     "flowStateIndex",
                        //     flowStateIndex
                        // );

                        const { flowState } = this.getFlowState(flowStateIndex);
                        if (!flowState) {
                            console.error("UNEXPECTED!");
                            return;
                        }

                        runInAction(() => (flowState.isFinished = true));
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
                        component = getObjectFromStringPath(
                            runtime.DocumentStore.project,
                            componentInAssetsMap.path
                        ) as Component;
                        if (!component) {
                            console.error("UNEXPECTED!");
                            return;
                        }

                        flowState.log("error", errorMessage, component);

                        runInAction(() => {
                            flowState.runtime.error = flowState.error =
                                errorMessage;
                        });
                        flowState.runtime.stopRuntime(true);
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
                            component = getObjectFromStringPath(
                                runtime.DocumentStore.project,
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
            }
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
        this.runtime.DocumentStore.dataContext.set(this.variableName, value);
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
    ) {}

    @action
    set(value: any) {
        this.object[this.propertyName] = value;
    }
}
