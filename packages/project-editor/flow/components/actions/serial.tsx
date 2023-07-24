import { action, observable, runInAction, makeObservable, toJS } from "mobx";
import { Stream } from "stream";

import {
    GenericDialogResult,
    showGenericDialog
} from "eez-studio-ui/generic-dialog";
import { validators } from "eez-studio-shared/validation";

import {
    connect,
    disconnect,
    getSerialPorts,
    SerialConnectionCallbacks,
    SerialConnectionConstructorParams,
    write
} from "instrument/connection/interfaces/serial-ports-renderer";

import type { IDashboardComponentContext } from "eez-studio-types";

import { registerActionComponents } from "project-editor/flow/component";
import {
    IObjectVariableValue,
    registerObjectVariableType,
    registerSystemStructure,
    ValueType
} from "project-editor/features/variable/value-type";
import type { IVariable } from "project-editor/flow/flow-interfaces";
import {
    SERIAL_STATUS_ICON,
    SERIAL_CONNECT_ICON,
    SERIAL_DISCONNECT_ICON,
    SERIAL_READ_ICON,
    SERIAL_WRITE_ICON
} from "project-editor/ui-components/icons";

////////////////////////////////////////////////////////////////////////////////

const componentHeaderColor = "#cca3ba";

const SERIAL_PORT_STRUCT_NAME = "$SerialPort";

registerSystemStructure({
    name: SERIAL_PORT_STRUCT_NAME,
    fields: [
        {
            name: "manufacturer",
            type: "string"
        },
        {
            name: "serialNumber",
            type: "string"
        },
        {
            name: "path",
            type: "string"
        }
    ]
});

registerActionComponents("Serial Port", [
    {
        name: "SerialInit",
        icon: SERIAL_STATUS_ICON as any,
        componentHeaderColor,
        bodyPropertyName: "connection",
        inputs: [],
        outputs: [],
        properties: [
            {
                name: "connection",
                type: "assignable-expression",
                valueType: "object:SerialConnection"
            },

            {
                name: "port",
                type: "expression",
                valueType: "object:string"
            },

            {
                name: "baudRate",
                type: "expression",
                valueType: "object:number"
            },

            {
                name: "dataBits",
                type: "expression",
                valueType: "object:number",
                formText: `5, 6, 7, 8`
            },

            {
                name: "stopBits",
                type: "expression",
                valueType: "object:number",
                formText: `1, 2`
            },

            {
                name: "parity",
                type: "expression",
                valueType: "object:string",
                formText: `"none", "even", "mark", "odd", "space"`
            }
        ],
        defaults: {
            port: `"COM1"`,
            baudRate: "9600",
            dataBits: "8",
            stopBits: "1",
            parity: `"even"`
        },
        execute: (context: IDashboardComponentContext) => {
            const port = context.evalProperty<string>("port");
            if (!port || typeof port != "string") {
                context.throwError(`invalid Port property`);
                return;
            }

            const baudRate = context.evalProperty<number>("baudRate");
            if (
                baudRate == undefined ||
                typeof baudRate != "number" ||
                isNaN(baudRate) ||
                baudRate <= 0
            ) {
                context.throwError(`invalid Baud rate property`);
                return;
            }

            const dataBits = context.evalProperty<number>("dataBits");
            if (
                dataBits == undefined ||
                typeof dataBits != "number" ||
                isNaN(dataBits) ||
                (dataBits != 8 &&
                    dataBits != 5 &&
                    dataBits != 6 &&
                    dataBits != 5)
            ) {
                context.throwError(`invalid Data bits property`);
                return;
            }

            const stopBits = context.evalProperty<number>("stopBits");
            if (
                stopBits == undefined ||
                typeof stopBits != "number" ||
                isNaN(stopBits) ||
                (stopBits != 1 && stopBits != 2)
            ) {
                context.throwError(`invalid Stop bits property`);
                return;
            }

            const parity = context.evalProperty<string>("parity");
            if (
                !parity ||
                typeof parity != "string" ||
                (parity != "none" &&
                    parity != "even" &&
                    parity != "mark" &&
                    parity != "odd" &&
                    parity != "space")
            ) {
                context.throwError(`invalid Partiy property`);
                return;
            }

            const constructorParams: SerialConnectionConstructorParams = {
                port,
                baudRate,
                dataBits,
                stopBits,
                parity
            };

            const id = nextSerialConnectionId++;
            let serialConnection = new SerialConnection(id, constructorParams);
            serialConnections.set(id, serialConnection);

            context.assignProperty("connection", {
                id: serialConnection.id,
                status: serialConnection.status
            });

            context.propagateValueThroughSeqout();
        }
    },
    {
        name: "SerialConnect",
        icon: SERIAL_CONNECT_ICON as any,
        componentHeaderColor,
        bodyPropertyName: "connection",
        inputs: [],
        outputs: [],
        properties: [
            {
                name: "connection",
                type: "expression",
                valueType: "object:SerialConnection"
            }
        ],
        execute: (context: IDashboardComponentContext) => {
            const serialConnection = context.evalProperty("connection");
            if (!serialConnection) {
                context.throwError(`invalid connection`);
                return;
            }

            context = context.startAsyncExecution();

            context.sendMessageToComponent(serialConnection, result => {
                if (result.serialConnectionId != undefined) {
                    if (result.serialConnectionId != serialConnection.id) {
                        try {
                            context.setPropertyField(
                                "connection",
                                "id",
                                result.serialConnectionId
                            );
                            context.propagateValueThroughSeqout();
                        } catch (err) {
                            context.throwError(err.toString());
                        }
                    }
                } else {
                    context.throwError(result.error);
                }
                context.endAsyncExecution();
            });
        },
        onWasmWorkerMessage: async (flowState, message, messageId) => {
            let serialConnection = serialConnections.get(message.id);
            if (serialConnection) {
                try {
                    await serialConnection.connect();
                    flowState.sendResultToWorker(messageId, {
                        serialConnectionId: serialConnection.id
                    });
                } catch (err) {
                    flowState.sendResultToWorker(messageId, {
                        error: err.toString()
                    });
                }
            } else {
                flowState.sendResultToWorker(
                    messageId,
                    `serial connection ${message.id} not found`
                );
            }
        }
    },
    {
        name: "SerialDisconnect",
        icon: SERIAL_DISCONNECT_ICON as any,
        componentHeaderColor,
        bodyPropertyName: "connection",
        inputs: [],
        outputs: [],
        properties: [
            {
                name: "connection",
                type: "expression",
                valueType: "object:SerialConnection"
            }
        ],
        execute: (context: IDashboardComponentContext) => {
            const serialConnection = context.evalProperty("connection");
            if (!serialConnection) {
                context.throwError(`invalid connection`);
                return;
            }

            context = context.startAsyncExecution();

            context.sendMessageToComponent(serialConnection, result => {
                if (result) {
                    context.throwError(result);
                } else {
                    context.propagateValueThroughSeqout();
                }
                context.endAsyncExecution();
            });
        },
        onWasmWorkerMessage: async (flowState, message, messageId) => {
            const serialConnection = serialConnections.get(message.id);
            if (serialConnection) {
                serialConnection.disconnect();
                flowState.sendResultToWorker(messageId, null);
            } else {
                flowState.sendResultToWorker(
                    messageId,
                    "serial connection not found"
                );
            }
        }
    },
    {
        name: "SerialRead",
        icon: SERIAL_READ_ICON as any,
        componentHeaderColor,
        inputs: [],
        outputs: [
            {
                name: "data",
                type: "string",
                isSequenceOutput: false,
                isOptionalOutput: false
            }
        ],
        properties: [
            {
                name: "connection",
                type: "expression",
                valueType: "object:SerialConnection"
            }
        ],
        execute: (context: IDashboardComponentContext) => {
            const serialConnection = context.evalProperty("connection");
            if (!serialConnection) {
                context.throwError(`invalid connection`);
                return;
            }

            context = context.startAsyncExecution();

            const readableStream = new Stream.Readable();
            readableStream._read = () => {};

            context.propagateValue("data", readableStream);

            context.sendMessageToComponent(serialConnection, result => {
                if (result && result.error) {
                    context.throwError(result.error);
                    context.endAsyncExecution();
                } else {
                    if (result.data) {
                        readableStream.push(result.data);
                    } else {
                        readableStream.destroy();
                        context.endAsyncExecution();
                    }
                }
            });
        },
        onWasmWorkerMessage: async (flowState, message, messageId) => {
            const serialConnection = serialConnections.get(message.id);
            if (serialConnection) {
                if (serialConnection.isConnected) {
                    serialConnection.onRead = data => {
                        flowState.sendResultToWorker(
                            messageId,
                            {
                                data
                            },
                            data == undefined
                        );
                    };
                } else {
                    flowState.sendResultToWorker(messageId, {
                        error: "not connected"
                    });
                }
            } else {
                flowState.sendResultToWorker(messageId, {
                    error: "serial connection not found"
                });
            }
        }
    },
    {
        name: "SerialWrite",
        icon: SERIAL_WRITE_ICON as any,
        componentHeaderColor,
        bodyPropertyName: "data",
        inputs: [],
        outputs: [],
        properties: [
            {
                name: "connection",
                type: "expression",
                valueType: "object:SerialConnection"
            },
            {
                name: "data",
                type: "expression",
                valueType: "string"
            }
        ],
        execute: (context: IDashboardComponentContext) => {
            const serialConnection = context.evalProperty("connection");
            if (!serialConnection) {
                context.throwError(`invalid connection`);
                return;
            }

            const data = context.evalProperty("data");

            context = context.startAsyncExecution();

            context.sendMessageToComponent(
                {
                    serialConnection,
                    data
                },
                result => {
                    if (result) {
                        context.throwError(result);
                    } else {
                        context.propagateValueThroughSeqout();
                    }
                    context.endAsyncExecution();
                }
            );
        },
        onWasmWorkerMessage: async (flowState, message, messageId) => {
            const serialConnection = serialConnections.get(
                message.serialConnection.id
            );
            if (serialConnection) {
                const data = message.data;
                if (data) {
                    serialConnection.write(data.toString());
                }
                flowState.sendResultToWorker(messageId, null);
            } else {
                flowState.sendResultToWorker(
                    messageId,
                    "serial connection not found"
                );
                return;
            }
        }
    },
    {
        name: "SerialListPorts",
        icon: SERIAL_STATUS_ICON as any,
        componentHeaderColor,
        inputs: [],
        outputs: [
            {
                name: "ports",
                type: `array:struct:${SERIAL_PORT_STRUCT_NAME}` as ValueType,
                isSequenceOutput: false,
                isOptionalOutput: false
            }
        ],
        properties: [],
        execute: (context: IDashboardComponentContext) => {
            context = context.startAsyncExecution();

            context.sendMessageToComponent(undefined, result => {
                if (result.ports) {
                    context.propagateValue("ports", result.ports);
                    context.propagateValueThroughSeqout();
                } else {
                    context.throwError(result.error);
                }
                context.endAsyncExecution();
            });
        },
        onWasmWorkerMessage: async (flowState, message, messageId) => {
            try {
                const ports = await SerialConnection.listPorts();
                flowState.sendResultToWorker(messageId, {
                    ports
                });
            } catch (err) {
                flowState.sendResultToWorker(messageId, {
                    error: err.toString()
                });
            }
        }
    }
]);

////////////////////////////////////////////////////////////////////////////////

const serialConnections = new Map<number, SerialConnection>();
let nextSerialConnectionId = 0;

registerObjectVariableType("SerialConnection", {
    editConstructorParams: async (
        variable: IVariable,
        constructorParams?: SerialConnectionConstructorParams
    ): Promise<SerialConnectionConstructorParams | undefined> => {
        return await showConnectDialog(variable, constructorParams);
        // return {
        //     port: "COM1",
        //     baudRate: 115200,
        //     dataBits: 8,
        //     parity: "even",
        //     stopBits: 1
        // };
    },

    createValue: (constructorParams: SerialConnectionConstructorParams) => {
        const id = nextSerialConnectionId++;
        const serialConnection = new SerialConnection(id, constructorParams);
        serialConnections.set(id, serialConnection);
        return serialConnection;
    },
    destroyValue: (objectVariable: IObjectVariableValue & { id: number }) => {
        const serialConnection = serialConnections.get(objectVariable.id);
        if (serialConnection) {
            serialConnection.disconnect();
            serialConnections.set(serialConnection.id, serialConnection);
        }
    },
    getValue: (variableValue: any): IObjectVariableValue | null => {
        return serialConnections.get(variableValue.id) ?? null;
    },
    valueFieldDescriptions: [
        {
            name: "port",
            valueType: "string",
            getFieldValue: (value: SerialConnection): string => {
                return value.constructorParams.port;
            }
        },
        {
            name: "baudRate",
            valueType: "integer",
            getFieldValue: (value: SerialConnection): number => {
                return value.constructorParams.baudRate;
            }
        },
        {
            name: "dataBits",
            valueType: "integer",
            getFieldValue: (value: SerialConnection): number => {
                return value.constructorParams.dataBits;
            }
        },
        {
            name: "stopBits",
            valueType: "integer",
            getFieldValue: (value: SerialConnection): number => {
                return value.constructorParams.stopBits;
            }
        },
        {
            name: "parity",
            valueType: "string",
            getFieldValue: (value: SerialConnection): string => {
                return value.constructorParams.parity;
            }
        },
        {
            name: "isConnected",
            valueType: "boolean",
            getFieldValue: (value: SerialConnection): boolean => {
                return value.isConnected;
            }
        },
        {
            name: "id",
            valueType: "integer",
            getFieldValue: (value: SerialConnection): number => {
                return value.id;
            }
        }
    ]
});

////////////////////////////////////////////////////////////////////////////////

async function showConnectDialog(
    variable: IVariable,
    values: SerialConnectionConstructorParams | undefined
) {
    try {
        const serialPorts = (await getSerialPorts()).map(port => ({
            id: port.path,
            label:
                port.path +
                (port.manufacturer ? " - " + port.manufacturer : "") +
                (port.productId ? " - " + port.productId : "")
        }));

        const result = await showGenericDialog({
            dialogDefinition: {
                title: variable.description || variable.fullName,
                size: "medium",
                fields: [
                    {
                        name: "port",
                        type: "enum",
                        enumItems: serialPorts,
                        validators: [validators.required]
                    },
                    {
                        name: "baudRate",
                        type: "number",
                        validators: [validators.integer]
                    },
                    {
                        name: "dataBits",
                        type: "enum",
                        enumItems: [8, 7, 6, 5],
                        validators: [validators.integer]
                    },
                    {
                        name: "stopBits",
                        type: "enum",
                        enumItems: [1, 2],
                        validators: [validators.integer]
                    },
                    {
                        name: "parity",
                        type: "enum",
                        enumItems: ["none", "even", "mark", "odd", "space"],
                        validators: [validators.required]
                    }
                ],
                error: undefined
            },
            values: values || {
                baudRate: 9600,
                dataBits: 8,
                stopBits: 1,
                parity: "none"
            },
            okButtonText: "Connect",
            onOk: async (result: GenericDialogResult) => {
                return new Promise<boolean>(async resolve => {
                    const serialConnection = new SerialConnection(
                        0,
                        result.values
                    );
                    result.onProgress("info", "Connecting...");
                    try {
                        await serialConnection.connect();
                        serialConnection.disconnect();
                        resolve(true);
                    } catch (err) {
                        result.onProgress("error", err);
                        resolve(false);
                    }
                });
            }
        });

        return result.values;
    } catch (err) {
        return undefined;
    }
}

////////////////////////////////////////////////////////////////////////////////

class SerialConnection implements SerialConnectionCallbacks {
    constructor(
        public id: number,
        public constructorParams: SerialConnectionConstructorParams
    ) {
        makeObservable(this, {
            receivedData: observable,
            isConnected: observable,
            onData: action,
            read: action,
            onConnected: action,
            onDisconnected: action
        });
    }

    connectionId: string;
    error: string | undefined = undefined;
    receivedData: string | undefined;

    isConnected: boolean = false;

    onRead: ((data: any) => void) | undefined;

    connectResolve: (() => void) | undefined;
    connectReject: ((err: any) => void) | undefined;

    get status() {
        return {
            label: `Port: ${this.constructorParams.port}, Baud rate: ${this.constructorParams.baudRate}, Data bits: ${this.constructorParams.dataBits}, Stop bits: ${this.constructorParams.stopBits}, Parity: ${this.constructorParams.parity}`,
            image: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 68.792 34.396"><g transform="translate(-21.422 -163.072)" fill="none"><circle stroke="black" cx="43.765" cy="180.27" r="7.955"/><circle stroke="black" cx="67.686" cy="180.27" r="7.955"/></g><path stroke="black" transform="translate(-21.422 -163.072)" d="M31.674 171.406v17.728M55.726 171.406v17.728M79.96 171.406v17.728"/></svg>`,
            color: this.error ? "red" : this.isConnected ? "green" : "gray",
            error: this.error
        };
    }

    async connect() {
        return new Promise<void>((resolve, reject) => {
            this.connectionId = connect(toJS(this.constructorParams), this);
            this.connectResolve = resolve;
            this.connectReject = reject;
        });
    }

    onConnected() {
        this.isConnected = true;

        if (this.connectResolve) {
            this.connectResolve();
            this.connectResolve = undefined;
            this.connectReject = undefined;
        }
    }

    onData(data: string) {
        if (!this.receivedData) {
            this.receivedData = data;
        } else {
            this.receivedData += data;
        }

        if (this.onRead) {
            this.onRead(this.read());
        }
    }

    onError(err: any) {
        this.error = err.toString();
        this.disconnect();

        if (this.connectReject) {
            this.connectReject(this.error);
            this.connectResolve = undefined;
            this.connectReject = undefined;
        }
    }

    onDisconnected() {
        if (this.onRead) {
            this.onRead(undefined);
            this.onRead = undefined;
        }

        this.isConnected = false;

        if (this.connectReject) {
            this.connectReject("disconnected");
            this.connectResolve = undefined;
            this.connectReject = undefined;
        }
    }

    disconnect() {
        if (this.isConnected) {
            disconnect(this.connectionId);
        }
    }

    read() {
        const data = this.receivedData;
        runInAction(() => (this.receivedData = undefined));
        return data;
    }

    write(data: string) {
        if (!this.isConnected) {
            throw "not connected";
        }
        write(this.connectionId, data);
    }

    static async listPorts() {
        return await getSerialPorts();
    }
}
