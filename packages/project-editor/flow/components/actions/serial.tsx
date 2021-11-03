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

const icon: any = (
    <svg viewBox="0 0 88.784 88.784">
        <path
            fill="#010002"
            d="M58.74,0H30.027v26.033H58.74C58.74,26.033,58.74,0,58.74,0z M40.173,17.497h-6.281v-6.281h6.281
			V17.497z M54.875,17.497h-6.277v-6.281h6.277V17.497z"
        />
        <path
            fill="#010002"
            d="M65.436,28.931c-0.204,0.612-1.027,1.045-2.434,1.045H25.846c-1.525,0-2.412-0.497-2.498-1.199
			c-0.104,0.39-0.168,0.841-0.168,1.396v28.684c0,4.556,3.819,8.285,8.482,8.285h25.442c4.663,0,8.478-3.729,8.478-8.285V30.173
			C65.59,29.679,65.518,29.293,65.436,28.931z M50.315,41.762c-0.329-0.004-0.659,0-0.984,0c-0.014,0.029-0.014,0.054-0.014,0.075
			c0,0.734,0,1.467,0,2.201c0.014,0.701-0.258,1.303-0.719,1.818c-0.286,0.304-0.608,0.58-0.909,0.862
			c-0.805,0.773-1.614,1.528-2.426,2.301c-0.222,0.208-0.326,0.483-0.369,0.777c-0.007,0.079-0.014,0.157-0.014,0.236
			c0,1.75,0,3.504,0,5.261c0,0.068,0.014,0.086,0.089,0.107c0.991,0.233,1.725,1.063,1.865,2.083
			c0.175,1.303-0.727,2.545-2.022,2.759c-1.338,0.222-2.577-0.633-2.856-1.954c-0.258-1.292,0.565-2.584,1.843-2.881
			c0.079-0.021,0.093-0.054,0.093-0.129c-0.007-0.523-0.007-1.045-0.007-1.568c0-0.354-0.111-0.662-0.329-0.941
			c-0.021-0.021-0.021-0.036-0.061-0.061c-1.07-1.013-2.158-2.029-3.217-3.06c-0.523-0.515-0.82-1.16-0.82-1.922
			c0-0.759,0-1.507,0-2.276c0-0.057-0.014-0.082-0.075-0.107c-0.623-0.243-0.988-0.88-0.916-1.521
			c0.082-0.698,0.608-1.22,1.288-1.313c0.902-0.115,1.714,0.623,1.664,1.539c-0.036,0.619-0.354,1.052-0.931,1.303
			c-0.054,0.018-0.068,0.047-0.068,0.093c0,0.795,0,1.593,0.007,2.387c0.007,0.401,0.161,0.748,0.447,1.031
			c0.984,0.934,1.965,1.861,2.949,2.784c0.021,0.014,0.036,0.036,0.057,0.068c0-5.05,0-10.089,0-15.131c-0.39,0-0.798,0-1.217,0
			c0.58-0.995,1.134-1.976,1.714-2.967c0.58,0.988,1.142,1.968,1.714,2.956c-0.426,0-0.82,0-1.217,0c0,3.808-0.014,7.616,0,11.427
			c0.014-0.014,0.029-0.029,0.043-0.039c1.013-0.963,2.026-1.904,3.024-2.867c0.211-0.208,0.315-0.465,0.372-0.748
			c0.014-0.075,0.014-0.15,0.014-0.222c0-0.766,0-1.525,0-2.298c0-0.014,0-0.032,0-0.064c-0.329,0-0.651,0-0.977,0
			c0-0.991,0-1.979,0-2.956c0.977,0.004,1.958,0,2.956,0C50.315,39.786,50.315,40.77,50.315,41.762z"
        />
        <path
            fill="#010002"
            d="M47.108,74.182h5.075c1.432,0,2.609-1.17,2.609-2.605v-1.843c0-0.136-0.064-0.251-0.075-0.379
			h-20.65c-0.025,0.129-0.075,0.247-0.075,0.379v1.843c0,1.428,1.163,2.605,2.602,2.605h5.264c0.161,1.406,0.784,4.32,3.189,7.233
			c4.03,4.885,10.944,7.369,20.557,7.369v-5.2C50.372,83.58,47.602,76.659,47.108,74.182z"
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
                        name: "parity",
                        type: "enum",
                        enumItems: ["none", "even", "mark", "odd", "space"],
                        validators: [validators.required]
                    },
                    {
                        name: "stopBits",
                        type: "enum",
                        enumItems: [1, 2],
                        validators: [validators.integer]
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
    parity: "none" | "even" | "mark" | "odd" | "space";
    stopBits: 1 | 2;
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
            label: `Connected to ${this.constructorParams.port}`,
            image: icon,
            color: this.error ? "red" : "green",
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
