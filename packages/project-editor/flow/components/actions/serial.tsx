import React from "react";
import { action, observable, runInAction, makeObservable, toJS } from "mobx";
import { Stream } from "stream";

import {
    EnumItems,
    GenericDialogResult,
    showGenericDialog
} from "eez-studio-ui/generic-dialog";
import { validators } from "eez-studio-shared/validation";

import * as SerialPortsModule from "instrument/connection/interfaces/serial-ports";
import type {
    SerialConnectionConstructorParams,
    SerialConnectionCallbacks
} from "instrument/connection/interfaces/serial-ports";

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

            context.assignProperty(
                "connection",
                {
                    id: serialConnection.id,
                    status: serialConnection.status
                },
                undefined
            );

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
            const serialConnection =
                context.evalProperty<SerialConnection>("connection");
            if (!serialConnection || serialConnection.destroyed) {
                context.throwError(`invalid connection`);
                return;
            }

            context = context.startAsyncExecution();

            (async (serialConnectionId: number) => {
                let serialConnection =
                    serialConnections.get(serialConnectionId);
                if (serialConnection && !serialConnection.destroyed) {
                    try {
                        await serialConnection.connect();

                        if (serialConnection.destroyed) {
                            serialConnection.disconnect();
                            context.throwError(`invalid connection`);
                        } else {
                            context.setPropertyField(
                                "connection",
                                "id",
                                serialConnection.id
                            );
                            context.propagateValueThroughSeqout();
                        }
                    } catch (err) {
                        context.throwError(err.toString());
                    }
                } else {
                    context.throwError(
                        `serial connection ${serialConnectionId} not found`
                    );
                }

                context.endAsyncExecution();
            })(serialConnection.id);
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

            (async (serialConnectionId: number) => {
                const serialConnection =
                    serialConnections.get(serialConnectionId);

                if (serialConnection) {
                    serialConnection.disconnect();

                    context.propagateValueThroughSeqout();
                } else {
                    context.throwError("serial connection not found");
                }

                context.endAsyncExecution();
            })(serialConnection.id);
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
                type: "stream",
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

            (async serialConnectionId => {
                const serialConnection =
                    serialConnections.get(serialConnectionId);
                if (serialConnection) {
                    if (serialConnection.isConnected) {
                        serialConnection.onRead = data => {
                            if (data) {
                                readableStream.push(data);
                            } else {
                                readableStream.destroy();
                                context.endAsyncExecution();
                            }
                        };
                    } else {
                        context.throwError("not connected");
                        context.endAsyncExecution();
                    }
                } else {
                    context.throwError("serial connection not found");
                    context.endAsyncExecution();
                }
            })(serialConnection.id);
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

            (async (serialConnectionId: number, data: any) => {
                const serialConnection =
                    serialConnections.get(serialConnectionId);
                if (serialConnection) {
                    if (data) {
                        try {
                            serialConnection.write(data.toString());
                            context.propagateValueThroughSeqout();
                        } catch (err) {
                            context.throwError(err.toString());
                        }
                    } else {
                        context.propagateValueThroughSeqout();
                    }
                } else {
                    context.throwError("serial connection not found");
                }
                context.endAsyncExecution();
            })(serialConnection.id, data);
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

            (async () => {
                try {
                    const ports = await SerialConnection.listPorts();
                    context.propagateValue("ports", ports);
                    context.propagateValueThroughSeqout();
                } catch (err) {
                    context.throwError(err.toString());
                }
                context.endAsyncExecution();
            })();
        }
    }
]);

////////////////////////////////////////////////////////////////////////////////

export const serialConnections = new Map<number, SerialConnection>();
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
            serialConnections.delete(serialConnection.id);
            serialConnection.destroyed = true;
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
                return value.port;
            }
        },
        {
            name: "baudRate",
            valueType: "integer",
            getFieldValue: (value: SerialConnection): number => {
                return value.baudRate;
            }
        },
        {
            name: "dataBits",
            valueType: "integer",
            getFieldValue: (value: SerialConnection): number => {
                return value.dataBits;
            }
        },
        {
            name: "stopBits",
            valueType: "integer",
            getFieldValue: (value: SerialConnection): number => {
                return value.stopBits;
            }
        },
        {
            name: "parity",
            valueType: "string",
            getFieldValue: (value: SerialConnection): string => {
                return value.parity;
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
        let serialPorts = observable.box<EnumItems>([]);

        const onRefreshSerialPortPaths = async () => {
            const { getSerialPorts } = await import(
                "instrument/connection/interfaces/serial-ports"
            );
            const temp = (await getSerialPorts()).map(port => ({
                id: port.path,
                label:
                    port.path +
                    (port.manufacturer ? " - " + port.manufacturer : "") +
                    (port.productId ? " - " + port.productId : "")
            }));

            runInAction(() => {
                serialPorts.set(temp);
            });
        };

        await onRefreshSerialPortPaths();

        const result = await showGenericDialog({
            dialogDefinition: {
                title: variable.description || variable.fullName,
                size: "medium",
                fields: [
                    {
                        name: "port",
                        type: "enum",
                        enumItems: serialPorts,
                        inputGroupButton: (
                            <button
                                className="btn btn-secondary"
                                title="Refresh list of available serial ports"
                                onClick={event => {
                                    event.preventDefault();
                                    onRefreshSerialPortPaths();
                                }}
                            >
                                Refresh
                            </button>
                        ),
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

export class SerialConnection implements SerialConnectionCallbacks {
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

    destroyed: boolean = false;

    get port() {
        return this.constructorParams.port;
    }
    get baudRate() {
        return this.constructorParams.baudRate;
    }
    get dataBits() {
        return this.constructorParams.dataBits;
    }
    get stopBits() {
        return this.constructorParams.stopBits;
    }
    get parity() {
        return this.constructorParams.parity;
    }

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
        const { connect } = await import(
            "instrument/connection/interfaces/serial-ports"
        );
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
            const { disconnect } =
                require("instrument/connection/interfaces/serial-ports") as typeof SerialPortsModule;

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

        const { write } =
            require("instrument/connection/interfaces/serial-ports") as typeof SerialPortsModule;

        write(this.connectionId, data);
    }

    static async listPorts() {
        const { getSerialPorts } = await import(
            "instrument/connection/interfaces/serial-ports"
        );
        return await getSerialPorts();
    }
}
