import type { Socket } from "net";

import { showSelectInstrumentDialog } from "./action-components/instrument";
import * as notification from "eez-studio-ui/notification";
import { Connection, getConnection } from "instrument/window/connection";
import { FlowState, RuntimeStoreClass } from "project-editor/flow/runtime";
import { InstrumentObject } from "instrument/instrument-object";
import { ConnectionParameters } from "instrument/connection/interface";
import { AssetsMap } from "project-editor/features/page/build/assets";
import { getObjectFromStringPath } from "project-editor/core/object";
import { runInAction } from "mobx";
import { Flow } from "project-editor/flow/flow";
import { Component } from "project-editor/flow/component";
import { LogItemType } from "./debugger/logs";

const DEBUGGER_TCP_PORT = 3333;

enum MessagesToDebugger {
    MESSAGE_TO_DEBUGGER_FLOW_STATE_CREATED,
    MESSAGE_TO_DEBUGGER_FLOW_STATE_DESTROYED,
    MESSAGE_TO_DEBUGGER_LOG
}

const LOG_ITEM_TYPE_FATAL = 0;
const LOG_ITEM_TYPE_ERROR = 1;
const LOG_ITEM_TYPE_WARNING = 2;
const LOG_ITEM_TYPE_SCPI = 3;
const LOG_ITEM_TYPE_INFO = 4;
const LOG_ITEM_TYPE_DEBUG = 5;

export class RemoteRuntime {
    connection: Connection | undefined;
    debuggerConnection: DebuggerConnection | undefined;
    instrument: InstrumentObject | undefined;
    map: AssetsMap;

    constructor(public runtimeStore: RuntimeStoreClass) {}

    async startApplet(isDebuggerActive: boolean) {
        const parts = await this.runtimeStore.DocumentStore.build();
        if (!parts) {
            return false;
        }

        this.map = parts["GUI_ASSETS_DATA_MAP_JS"] as AssetsMap;
        if (!this.map) {
            return false;
        }

        const instrument = await showSelectInstrumentDialog();

        if (!instrument) {
            return false;
        }

        this.instrument = instrument;

        const toastId = notification.info("Uploading app...", {
            autoClose: false
        });

        instrument.connection.connect();

        const editor = instrument.getEditor();
        editor.onCreate();

        await new Promise<void>(resolve => setTimeout(resolve, 1000));

        const connection = getConnection(editor);
        if (!connection || !instrument.isConnected) {
            notification.update(toastId, {
                type: notification.ERROR,
                render: `Instrument not connected`,
                autoClose: 1000
            });
            return;
        }

        this.connection = connection;

        try {
            await connection.acquire(false);
        } catch (err) {
            notification.update(toastId, {
                type: notification.ERROR,
                render: `Error: ${err.toString()}`,
                autoClose: 1000
            });
            return false;
        }

        try {
            if (isDebuggerActive) {
                this.startDebugger();
            }

            const path = EEZStudio.remote.require("path");

            const destinationFolderPath =
                this.runtimeStore.DocumentStore.getAbsoluteFilePath(
                    this.runtimeStore.DocumentStore.project.settings.build
                        .destinationFolder || "."
                );

            const destinationFileName = `${path.basename(
                this.runtimeStore.DocumentStore.filePath,
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

            notification.update(toastId, {
                type: notification.SUCCESS,
                render: `App started`,
                autoClose: 1000
            });

            return true;
        } catch (err) {
            notification.update(toastId, {
                type: notification.ERROR,
                render: `Error: ${err.toString()}`,
                autoClose: 1000
            });
            return false;
        } finally {
            connection.release();
        }
    }

    async stopApplet() {
        this.stopDebugger();

        const connection = this.connection;
        this.connection = undefined;

        if (!connection) {
            return;
        }

        if (!connection.isConnected) {
            return;
        }

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
                notification.success("App stopped");
            }
        } catch (err) {
            notification.error(`Error: ${err.toString()}`);
        } finally {
            connection.release();
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
}

class DebuggerConnection {
    socket: Socket | undefined;
    dataAccumulated: string = "";

    constructor(private remoteRuntime: RemoteRuntime) {}

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
                    if (this.socket) {
                        this.socket.write("Hello, world!", "binary");
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

    onMessageToDebugger(data: string) {
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

            const runtimeStore = this.remoteRuntime.runtimeStore;

            switch (messageType) {
                case MessagesToDebugger.MESSAGE_TO_DEBUGGER_FLOW_STATE_CREATED:
                    {
                        const flowStateIndex = parseInt(messageParameters[1]);
                        const flowIndex = parseInt(messageParameters[2]);
                        const parentFlowStateIndex = parseInt(
                            messageParameters[3]
                        );

                        console.log(
                            MessagesToDebugger.MESSAGE_TO_DEBUGGER_FLOW_STATE_CREATED,
                            "flowStateIndex",
                            flowStateIndex,
                            "flowIndex",
                            flowIndex,
                            "parentFlowStateIndex",
                            parentFlowStateIndex
                        );

                        const flowMap = this.remoteRuntime.map.flows[flowIndex];
                        if (!flowMap) {
                            // TODO unexpected
                            return;
                        }

                        const flow = getObjectFromStringPath(
                            runtimeStore.DocumentStore.project,
                            flowMap.path
                        ) as Flow;
                        if (!flow) {
                            // TODO unexpected
                            return;
                        }

                        if (
                            runtimeStore.flowStates.find(
                                flowState =>
                                    flowState.flowStateIndex == flowStateIndex
                            )
                        ) {
                            // TODO unexpected
                            return;
                        }

                        let parentFlowState;
                        if (parentFlowStateIndex) {
                            parentFlowState = runtimeStore.flowStates.find(
                                flowState =>
                                    flowState.flowStateIndex ==
                                    parentFlowStateIndex
                            );

                            if (!parentFlowState) {
                                // TODO unexpected
                                return;
                            }
                        }

                        let flowState = new FlowState(
                            runtimeStore,
                            flow,
                            parentFlowState
                        );

                        flowState.flowStateIndex = flowStateIndex;
                        flowState.flowIndex = flowIndex;

                        runInAction(() =>
                            this.remoteRuntime.runtimeStore.flowStates.push(
                                flowState
                            )
                        );
                    }
                    break;

                case MessagesToDebugger.MESSAGE_TO_DEBUGGER_FLOW_STATE_DESTROYED:
                    {
                        const flowStateIndex = parseInt(messageParameters[1]);

                        console.log(
                            MessagesToDebugger.MESSAGE_TO_DEBUGGER_FLOW_STATE_DESTROYED,
                            "flowStateIndex",
                            flowStateIndex
                        );

                        const flowState = runtimeStore.flowStates.find(
                            flowState =>
                                flowState.flowStateIndex == flowStateIndex
                        );

                        if (!flowState) {
                            // TODO unexpected
                            return;
                        }

                        runtimeStore.removeFlowState(flowState);
                    }
                    break;

                case MessagesToDebugger.MESSAGE_TO_DEBUGGER_LOG:
                    {
                        const logItemType = parseInt(messageParameters[1]);
                        const flowStateIndex = parseInt(messageParameters[2]);
                        const componentIndex = parseInt(messageParameters[3]);
                        const message = messageParameters[4];

                        const flowState = runtimeStore.flowStates.find(
                            flowState =>
                                flowState.flowStateIndex == flowStateIndex
                        );

                        if (!flowState) {
                            // TODO unexpected
                            return;
                        }

                        const flowMap =
                            this.remoteRuntime.map.flows[flowState.flowIndex];
                        if (!flowMap) {
                            // TODO unexpected
                            return;
                        }

                        let component;

                        if (componentIndex != -1) {
                            const componentMap =
                                flowMap.components[componentIndex];
                            if (!componentMap) {
                                // TODO unexpected
                                return;
                            }
                            component = getObjectFromStringPath(
                                runtimeStore.DocumentStore.project,
                                componentMap.path
                            ) as Component;
                            if (!component) {
                                // TODO unexpected
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
