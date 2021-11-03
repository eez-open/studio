import React from "react";

import { registerActionComponents } from "project-editor/flow/component";
import { registerObjectVariableType } from "project-editor/features/variable/value-type";
import type { IVariable } from "project-editor/flow/flow-interfaces";
import {
    GenericDialogResult,
    showGenericDialog
} from "eez-studio-ui/generic-dialog";
import { validators } from "eez-studio-shared/validation";
import { action, observable, reaction, runInAction } from "mobx";

////////////////////////////////////////////////////////////////////////////////

const styleCircle: React.CSSProperties = {
    opacity: "1",
    fill: "#800000",
    fillOpacity: 0,
    stroke: "#000000",
    strokeWidth: "1.5",
    strokeLinecap: "round",
    strokeLinejoin: "miter",
    strokeMiterlimit: 4,
    strokeDasharray: "none",
    strokeDashoffset: "0",
    strokeOpacity: 1,
    paintOrder: "fill markers stroke"
};

const stylePath: React.CSSProperties = {
    fill: "none",
    fillRule: "evenodd",
    stroke: "#000000",
    strokeWidth: "1.5",
    strokeLinecap: "butt",
    strokeLinejoin: "miter",
    strokeMiterlimit: 4,
    strokeDasharray: "none",
    strokeOpacity: 1
};

const icon: any = (
    <svg viewBox="0 0 68.792 34.396">
        <g transform="translate(-21.422 -163.072)" fill="none">
            <circle
                style={{
                    opacity: 1,
                    fill: "maroon",
                    fillOpacity: 0,
                    stroke: "#000",
                    strokeWidth: "1.5",
                    strokeLinecap: "round",
                    strokeLinejoin: "miter",
                    strokeMiterlimit: 4,
                    strokeDasharray: "none",
                    strokeDashoffset: 0,
                    strokeOpacity: 1,
                    paintOrder: "fill markers stroke"
                }}
                cx="43.765"
                cy="180.27"
                r="7.955"
            />
            <circle
                style={{
                    opacity: 1,
                    fill: "maroon",
                    fillOpacity: 0,
                    stroke: "#000",
                    strokeWidth: "1.5",
                    strokeLinecap: "round",
                    strokeLinejoin: "miter",
                    strokeMiterlimit: 4,
                    strokeDasharray: "none",
                    strokeDashoffset: 0,
                    strokeOpacity: 1,
                    paintOrder: "fill markers stroke"
                }}
                cx="67.686"
                cy="180.27"
                r="7.955"
            />
        </g>
        <path
            d="M31.674 171.406v17.728M55.726 171.406v17.728M79.96 171.406v17.728"
            style={{
                fill: "none",
                fillRule: "evenodd",
                stroke: "#000",
                strokeWidth: "1.5",
                strokeLinecap: "butt",
                strokeLinejoin: "miter",
                strokeMiterlimit: 4,
                strokeDasharray: "none",
                strokeOpacity: 1
            }}
            transform="translate(-21.422 -163.072)"
        />
    </svg>
);
const componentHeaderColor = "#cca3ba";

registerActionComponents("Serial Port", [
    {
        name: "SerialConnect",
        icon,
        componentHeaderColor,
        inputs: [],
        outputs: [],
        properties: [
            {
                name: "connection",
                type: "expression",
                valueType: "object:SerialConnection"
            }
        ],
        execute: async (flowState, ...[connection]) => {
            const serialConnection = flowState.evalExpression(connection);
            if (!serialConnection) {
                throw `connection "${connection}" not found`;
            }

            if (!(serialConnection instanceof SerialConnection)) {
                throw `"${connection}" is not SerialConnection`;
            }

            await serialConnection.connect();

            return undefined;
        }
    },
    {
        name: "SerialDisconnect",
        icon,
        componentHeaderColor,
        inputs: [],
        outputs: [],
        properties: [
            {
                name: "connection",
                type: "expression",
                valueType: "object:SerialConnection"
            }
        ],
        execute: async (flowState, ...[connection]) => {
            const serialConnection = flowState.evalExpression(connection);
            if (!serialConnection) {
                throw `connection "${connection}" not found`;
            }

            if (!(serialConnection instanceof SerialConnection)) {
                throw `"${connection}" is not SerialConnection`;
            }

            serialConnection.disconnect();

            return undefined;
        }
    },
    {
        name: "SerialRead",
        icon,
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
        execute: async (flowState, ...[connection]) => {
            if (flowState.dispose) {
                return flowState.dispose;
            }

            let serialConnection: SerialConnection;
            try {
                serialConnection = flowState.evalExpression(connection);
            } catch (err) {
                return undefined;
            }

            if (!(serialConnection instanceof SerialConnection)) {
                return undefined;
            }

            return reaction(
                () => {
                    return serialConnection.read();
                },
                data => {
                    if (data) {
                        flowState.propagateValue("data", data);
                    }
                }
            );
        }
    },
    {
        name: "SerialWrite",
        icon,
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
        execute: async (flowState, ...[connection, data]) => {
            const serialConnection = flowState.evalExpression(connection);
            if (!serialConnection) {
                throw `connection "${connection}" not found`;
            }

            if (!(serialConnection instanceof SerialConnection)) {
                throw `"${connection}" is not SerialConnection`;
            }

            const dataValue = flowState.evalExpression(data);

            if (dataValue) {
                serialConnection.write(dataValue.toString());
            }

            return undefined;
        }
    }
]);

////////////////////////////////////////////////////////////////////////////////

registerObjectVariableType("SerialConnection", {
    constructorFunction: (
        constructorParams: SerialConnectionConstructorParams
    ) => {
        return new SerialConnection(constructorParams);
    },

    editConstructorParams: async (
        variable: IVariable,
        constructorParams: SerialConnectionConstructorParams | null
    ): Promise<SerialConnectionConstructorParams | undefined> => {
        return await showConnectDialog(variable, constructorParams);
        // return {
        //     port: "COM24",
        //     baudRate: 115200,
        //     dataBits: 8,
        //     parity: "even",
        //     stopBits: 1
        // };
    },

    destroy: (serialConnection: SerialConnection) => {
        serialConnection.disconnect();
    }
});

////////////////////////////////////////////////////////////////////////////////

async function showConnectDialog(
    variable: IVariable,
    values: SerialConnectionConstructorParams | null
) {
    try {
        const SerialPort = await import("serialport");
        const ports = await SerialPort.default.list();
        const serialPorts = ports.map(port => ({
            id: port.path,
            label: port.path
        }));

        const result = await showGenericDialog({
            dialogDefinition: {
                title: variable.description || variable.name,
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

interface SerialConnectionConstructorParams {
    port: string;
    baudRate: number;
    dataBits: 8 | 7 | 6 | 5;
    stopBits: 1 | 2;
    parity: "none" | "even" | "mark" | "odd" | "space";
}

const CONF_CHUNK_SIZE = 64;

class SerialConnection {
    constructor(public constructorParams: SerialConnectionConstructorParams) {}

    port: any;
    error: string | undefined = undefined;
    dataToWrite: string | undefined;
    @observable receivedData: string | undefined;

    @observable isConnected: boolean = false;

    get status() {
        return {
            label: `Port: ${this.constructorParams.port}, Baud rate: ${this.constructorParams.baudRate}, Data bits: ${this.constructorParams.dataBits}, Stop bits: ${this.constructorParams.stopBits}, Parity: ${this.constructorParams.parity}`,
            image: icon,
            color: this.error ? "red" : this.isConnected ? "green" : "gray",
            error: this.error
        };
    }

    async connect() {
        return new Promise<void>(async (resolve, reject) => {
            try {
                const SerialPort = await import("serialport");
                const port = new SerialPort.default(
                    this.constructorParams.port,
                    {
                        baudRate: this.constructorParams.baudRate,
                        dataBits: this.constructorParams.dataBits,
                        parity: this.constructorParams.parity,
                        stopBits: this.constructorParams.stopBits
                    },
                    (err: any) => {
                        if (err) {
                            console.log("serial constructor error", err);
                            reject(err);
                        } else {
                            console.log("serial constructor success");

                            port.on("error", (err: any) => {
                                console.error(err);
                                this.port = undefined;
                                runInAction(() => (this.isConnected = false));
                            });

                            port.on(
                                "data",
                                action((data: any) => {
                                    if (!this.receivedData) {
                                        this.receivedData =
                                            data.toString("binary");
                                    } else {
                                        this.receivedData +=
                                            data.toString("binary");
                                    }
                                })
                            );

                            this.port = port;
                            runInAction(() => (this.isConnected = true));

                            resolve();
                        }
                    }
                );
            } catch (err) {
                reject(err);
            }
        });
    }

    disconnect() {
        if (this.port) {
            this.port.close();
            this.port = undefined;
            runInAction(() => (this.isConnected = false));
        }
    }

    read() {
        const data = this.receivedData;
        runInAction(() => (this.receivedData = undefined));
        return data;
    }

    sendNextChunkCallback = () => {
        if (this.port && this.dataToWrite) {
            let nextChunk;
            if (this.dataToWrite.length <= CONF_CHUNK_SIZE) {
                nextChunk = this.dataToWrite;
                this.dataToWrite = undefined;
            } else {
                nextChunk = this.dataToWrite.slice(0, CONF_CHUNK_SIZE);
                this.dataToWrite = this.dataToWrite.slice(CONF_CHUNK_SIZE);
            }

            this.port.write(nextChunk, "binary");

            if (this.dataToWrite) {
                this.port.drain(this.sendNextChunkCallback);
            }
        }
    };

    write(data: string) {
        if (!this.port) {
            throw "not connected";
        }

        if (this.dataToWrite) {
            this.dataToWrite += data;
        } else {
            this.dataToWrite = data;
            this.port.drain(this.sendNextChunkCallback);
        }
    }
}
