import React from "react";
import { makeObservable, observable } from "mobx";
import type { ModbusRTUClient, ModbusTCPClient } from "jsmodbus";
import type * as JsmodbusModule from "jsmodbus";

import type {
    IDashboardComponentContext,
    IWasmFlowRuntime,
    ValueType
} from "eez-studio-types";

import type * as SerialPortsModule from "instrument/connection/interfaces/serial-ports";

import {
    PropertyType,
    makeDerivedClassInfo,
    registerClass
} from "project-editor/core/object";

import { MODBUS_ICON } from "project-editor/ui-components/icons";
import { specificGroup } from "project-editor/ui-components/PropertyGrid/groups";

import { Assets, DataBuffer } from "project-editor/build/assets";

import {
    ActionComponent,
    ComponentOutput,
    makeExpressionProperty
} from "project-editor/flow/component";

import { IFlowContext } from "project-editor/flow/flow-interfaces";

import {
    serialConnections,
    SerialConnection
} from "project-editor/flow/components/actions/serial";
import { onWasmFlowRuntimeTerminate } from "project-editor/flow/runtime/wasm-worker";

import { isArray } from "eez-studio-shared/util";
import {
    tcpSockets,
    type TCPSocket
} from "project-editor/flow/components/actions/tcp";

////////////////////////////////////////////////////////////////////////////////

const modbusClients = new Map<
    number,
    Map<string, ModbusRTUClient | ModbusTCPClient>
>();

onWasmFlowRuntimeTerminate((wasmFlowRuntime: IWasmFlowRuntime) => {
    modbusClients.delete(wasmFlowRuntime.wasmModuleId);
});

////////////////////////////////////////////////////////////////////////////////

const COMMANDS = [
    { id: "01", label: "01 (0x01) Read Coils" },
    { id: "02", label: "02 (0x02) Read Discrete Inputs" },
    { id: "03", label: "03 (0x03) Read Holding Registers" },
    { id: "04", label: "04 (0x04) Read Input Registers" },
    { id: "05", label: "05 (0x05) Write Single Coil" },
    { id: "06", label: "06 (0x06) Write Single Register" },
    { id: "15", label: "15 (0x0F) Write Multiple Coils" },
    { id: "16", label: "16 (0x10) Write Multiple Registers" }
];

export class ModbusActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        componentPaletteGroupName: "Instrument",
        label: (component: ModbusActionComponent) => {
            if (component.command) {
                return `Modbus - ${COMMANDS.find(
                    command => command.id == component.command
                )!
                    .label.split(" ")
                    .slice(2)
                    .join(" ")}`;
            }

            return "Modbus";
        },
        properties: [
            makeExpressionProperty(
                {
                    name: "connection",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup
                },
                "any"
            ),
            makeExpressionProperty(
                {
                    name: "serverAddress",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup
                },
                "integer"
            ),
            {
                name: "command",
                type: PropertyType.Enum,
                enumItems: COMMANDS,
                propertyGridGroup: specificGroup
            },
            makeExpressionProperty(
                {
                    name: "registerAddress",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup,
                    disabled: (component: ModbusActionComponent) =>
                        component.command != "05" && component.command !== "06"
                },
                "integer"
            ),
            makeExpressionProperty(
                {
                    name: "startingRegisterAddress",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup,
                    disabled: (component: ModbusActionComponent) =>
                        component.command == "05" || component.command == "06"
                },
                "integer"
            ),
            makeExpressionProperty(
                {
                    name: "quantityOfRegisters",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup,
                    disabled: (component: ModbusActionComponent) =>
                        component.command == "05" ||
                        component.command == "06" ||
                        component.command == "15" ||
                        component.command == "16"
                },
                "integer"
            ),
            makeExpressionProperty(
                {
                    name: "coilValue",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup,
                    disabled: (component: ModbusActionComponent) =>
                        component.command != "05"
                },
                "boolean"
            ),
            makeExpressionProperty(
                {
                    name: "registerValue",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup,
                    disabled: (component: ModbusActionComponent) =>
                        component.command != "06"
                },
                "integer"
            ),
            makeExpressionProperty(
                {
                    name: "coilValues",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup,
                    disabled: (component: ModbusActionComponent) =>
                        component.command != "15"
                },
                "array:boolean"
            ),
            makeExpressionProperty(
                {
                    name: "registerValues",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup,
                    disabled: (component: ModbusActionComponent) =>
                        component.command != "16"
                },
                "array:integer"
            ),
            makeExpressionProperty(
                {
                    name: "timeout",
                    displayName: "Timeout (ms)",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup
                },
                "integer"
            )
        ],
        icon: MODBUS_ICON,
        componentHeaderColor: "#D0FDA2",
        defaultValue: {},

        execute: (context: IDashboardComponentContext) => {
            const connection = context.evalProperty("connection");
            if (!connection) {
                context.throwError(`modbus invalid Connection`);
                return;
            }

            const serverAddress = context.evalProperty("serverAddress");
            if (!serverAddress) {
                context.throwError(`invalid Server address`);
                return;
            }

            const command = context.getUint8Param(0);

            const timeout = context.evalProperty("timeout");
            if (!timeout) {
                context.throwError(`invalid Timeout`);
                return;
            }

            function getModbusClient() {
                let connectionObject: SerialConnection | TCPSocket | undefined;

                connectionObject = serialConnections.get(connection.id);
                if (!connectionObject) {
                    connectionObject = tcpSockets.get(connection.id);
                }

                if (!connectionObject) {
                    context.throwError(
                        `modbus invalid Connection ${connection.id}`
                    );
                    return undefined;
                }

                connectionObject.read(); // do not accumulate read data

                let connectionId =
                    connectionObject instanceof SerialConnection
                        ? "serial-" +
                          connectionObject.connectionId +
                          "-" +
                          timeout
                        : "tcp-" + connectionObject.id;

                let client;
                let runtimeModbusClients = modbusClients.get(
                    context.WasmFlowRuntime.wasmModuleId
                );
                if (runtimeModbusClients) {
                    client = runtimeModbusClients.get(connectionId);
                }
                if (!client) {
                    try {
                        if (connectionObject instanceof SerialConnection) {
                            const { getSerialPort } =
                                require("instrument/connection/interfaces/serial-ports") as typeof SerialPortsModule;
                            const serialPort = getSerialPort(
                                connectionObject.connectionId
                            );

                            const { ModbusRTUClient } =
                                require("jsmodbus") as typeof JsmodbusModule;

                            client = new ModbusRTUClient(
                                serialPort,
                                serverAddress,
                                timeout
                            );
                        } else {
                            if (!connectionObject.socket) {
                                return undefined;
                            }

                            const { ModbusTCPClient } =
                                require("jsmodbus") as typeof JsmodbusModule;

                            client = new ModbusTCPClient(
                                connectionObject.socket,
                                serverAddress
                            );

                            connectionObject.socket.emit("connect", false);
                        }

                        if (!runtimeModbusClients) {
                            runtimeModbusClients = new Map();
                            modbusClients.set(
                                context.WasmFlowRuntime.wasmModuleId,
                                runtimeModbusClients
                            );
                        }

                        runtimeModbusClients.set(connectionId, client);
                    } catch (err) {
                        console.warn(err);
                        context.throwError(err.toString());
                        return undefined;
                    }
                }

                return client;
            }

            let modbusClient = getModbusClient();
            if (!modbusClient) {
                context.throwError(`failed to create Modbus client`);
                return;
            }

            if (command == 1) {
                // 01 (0x01) Read Coils
                const startingRegisterAddress = context.evalProperty(
                    "startingRegisterAddress"
                );
                if (typeof startingRegisterAddress != "number") {
                    context.throwError(`invalid Starting register address`);
                    return;
                }

                const quantityOfRegisters = context.evalProperty(
                    "quantityOfRegisters"
                );
                if (typeof quantityOfRegisters != "number") {
                    context.throwError(`invalid Quantity of registers`);
                    return;
                }

                context.startAsyncExecution();

                modbusClient
                    .readCoils(startingRegisterAddress, quantityOfRegisters)
                    .then(
                        resp => {
                            context.propagateValue(
                                "values",
                                resp.response.body.values
                            );
                            context.propagateValueThroughSeqout();
                            context.endAsyncExecution();

                            // optimization: run main loop as soon as possible
                            context.WasmFlowRuntime._mainLoop();
                        },
                        error => {
                            console.warn(error);
                            context.throwError(error.message);
                            context.endAsyncExecution();
                        }
                    );
            } else if (command == 2) {
                // 02 (0x02) Read Discrete Inputs
                const startingRegisterAddress = context.evalProperty(
                    "startingRegisterAddress"
                );
                if (typeof startingRegisterAddress != "number") {
                    context.throwError(`invalid Starting register address`);
                    return;
                }

                const quantityOfRegisters = context.evalProperty(
                    "quantityOfRegisters"
                );
                if (typeof quantityOfRegisters != "number") {
                    context.throwError(`invalid Quantity of registers`);
                    return;
                }

                context.startAsyncExecution();

                modbusClient
                    .readDiscreteInputs(
                        startingRegisterAddress,
                        quantityOfRegisters
                    )
                    .then(
                        resp => {
                            context.propagateValue(
                                "values",
                                resp.response.body.discrete
                            );
                            context.propagateValueThroughSeqout();
                            context.endAsyncExecution();

                            // optimization: run main loop as soon as possible
                            context.WasmFlowRuntime._mainLoop();
                        },
                        error => {
                            console.warn(error);
                            context.throwError(error.message);
                            context.endAsyncExecution();
                        }
                    );
            } else if (command == 3) {
                // 03 (0x03) Read Holding Registers
                const startingRegisterAddress = context.evalProperty(
                    "startingRegisterAddress"
                );
                if (typeof startingRegisterAddress != "number") {
                    context.throwError(`invalid Starting register address`);
                    return;
                }

                const quantityOfRegisters = context.evalProperty(
                    "quantityOfRegisters"
                );
                if (typeof quantityOfRegisters != "number") {
                    context.throwError(`invalid Quantity of registers`);
                    return;
                }

                context.startAsyncExecution();

                modbusClient
                    .readHoldingRegisters(
                        startingRegisterAddress,
                        quantityOfRegisters
                    )
                    .then(
                        resp => {
                            context.propagateValue(
                                "values",
                                resp.response.body.values
                            );
                            context.propagateValueThroughSeqout();
                            context.endAsyncExecution();

                            // optimization: run main loop as soon as possible
                            context.WasmFlowRuntime._mainLoop();
                        },
                        error => {
                            console.warn(error);
                            context.throwError(error.message);
                            context.endAsyncExecution();
                        }
                    );
            } else if (command == 4) {
                // 04 (0x04) Read Input Registers
                const startingRegisterAddress = context.evalProperty(
                    "startingRegisterAddress"
                );
                if (typeof startingRegisterAddress != "number") {
                    context.throwError(`invalid Starting register address`);
                    return;
                }

                const quantityOfRegisters = context.evalProperty(
                    "quantityOfRegisters"
                );
                if (typeof quantityOfRegisters != "number") {
                    context.throwError(`invalid Quantity of registers`);
                    return;
                }

                context.startAsyncExecution();

                modbusClient
                    .readInputRegisters(
                        startingRegisterAddress,
                        quantityOfRegisters
                    )
                    .then(
                        resp => {
                            context.propagateValue(
                                "values",
                                resp.response.body.values
                            );
                            context.propagateValueThroughSeqout();
                            context.endAsyncExecution();

                            // optimization: run main loop as soon as possible
                            context.WasmFlowRuntime._mainLoop();
                        },
                        error => {
                            console.warn(error);
                            context.throwError(error.message);
                            context.endAsyncExecution();
                        }
                    );
            } else if (command == 5) {
                // 05 (0x05) Write Single Coil
                const registerAddress = context.evalProperty("registerAddress");
                if (typeof registerAddress != "number") {
                    context.throwError(`invalid Register address`);
                    return;
                }

                const coilValue = context.evalProperty("coilValue");
                if (typeof coilValue != "boolean") {
                    context.throwError(`invalid Coil value`);
                    return;
                }

                context.startAsyncExecution();

                modbusClient.writeSingleCoil(registerAddress, coilValue).then(
                    resp => {
                        context.propagateValueThroughSeqout();
                        context.endAsyncExecution();
                    },
                    error => {
                        console.warn(error);
                        context.throwError(error.message);
                        context.endAsyncExecution();
                    }
                );
            } else if (command == 6) {
                // 06 (0x06) Write Single Register
                const registerAddress = context.evalProperty("registerAddress");
                if (typeof registerAddress != "number") {
                    context.throwError(`invalid Register address`);
                    return;
                }

                const registerValue = context.evalProperty("registerValue");
                if (typeof registerValue != "number") {
                    context.throwError(`invalid Register value`);
                    return;
                }

                context.startAsyncExecution();

                modbusClient
                    .writeSingleRegister(registerAddress, registerValue)
                    .then(
                        resp => {
                            context.propagateValueThroughSeqout();
                            context.endAsyncExecution();
                        },
                        error => {
                            console.warn(error);
                            context.throwError(error.message);
                            context.endAsyncExecution();
                        }
                    );
            } else if (command == 15) {
                // 15 (0x0F) Write Multiple Coils
                const startingRegisterAddress = context.evalProperty(
                    "startingRegisterAddress"
                );
                if (typeof startingRegisterAddress != "number") {
                    context.throwError(`invalid Starting register address`);
                    return;
                }

                const coilValues = context.evalProperty("coilValues");
                if (!isArray(coilValues)) {
                    context.throwError(`invalid Coil values`);
                    return;
                }

                context.startAsyncExecution();

                modbusClient
                    .writeMultipleCoils(startingRegisterAddress, coilValues)
                    .then(
                        resp => {
                            context.propagateValueThroughSeqout();
                            context.endAsyncExecution();
                        },
                        error => {
                            console.warn(error);
                            context.throwError(error.message);
                            context.endAsyncExecution();
                        }
                    );
            } else if (command == 16) {
                // 16 (0x10) Write Multiple Registers
                const startingRegisterAddress = context.evalProperty(
                    "startingRegisterAddress"
                );
                if (typeof startingRegisterAddress != "number") {
                    context.throwError(`invalid Starting register address`);
                    return;
                }

                const registerValues = context.evalProperty("registerValues");
                if (!isArray(registerValues)) {
                    context.throwError(`invalid Register values`);
                    return;
                }

                context.startAsyncExecution();

                modbusClient
                    .writeMultipleRegisters(
                        startingRegisterAddress,
                        registerValues
                    )
                    .then(
                        resp => {
                            context.propagateValueThroughSeqout();
                            context.endAsyncExecution();
                        },
                        error => {
                            console.warn(error);
                            context.throwError(error.message);
                            context.endAsyncExecution();
                        }
                    );
            }
        }
    });

    connection: string;
    serverAddress: string;
    command: string;
    registerAddress: string;
    startingRegisterAddress: string;
    quantityOfRegisters: string;
    coilValue: string;
    registerValue: string;
    coilValues: string;
    registerValues: string;
    timeout: string;

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            connection: observable,
            serverAddress: observable,
            command: observable,
            registerAddress: observable,
            startingRegisterAddress: observable,
            quantityOfRegisters: observable,
            coilValue: observable,
            registerValue: observable,
            coilValues: observable,
            registerValues: observable,
            timeout: observable
        });
    }

    getInputs() {
        return [
            {
                name: "@seqin",
                type: "any" as ValueType,
                isSequenceInput: true,
                isOptionalInput: true
            },
            ...super.getInputs()
        ];
    }

    getOutputs(): ComponentOutput[] {
        return [
            {
                name: "@seqout",
                type: "null" as ValueType,
                isSequenceOutput: true,
                isOptionalOutput: true
            },

            ...(this.command === "01" || this.command == "02"
                ? [
                      {
                          name: "values",
                          type: "array:boolean" as ValueType,
                          isSequenceOutput: false,
                          isOptionalOutput: false
                      }
                  ]
                : this.command === "03" || this.command == "04"
                ? [
                      {
                          name: "values",
                          type: "array:integer" as ValueType,
                          isSequenceOutput: false,
                          isOptionalOutput: false
                      }
                  ]
                : []),

            ...super.getOutputs()
        ];
    }

    getBody(flowContext: IFlowContext): React.ReactNode {
        return null;
    }

    buildFlowComponentSpecific(assets: Assets, dataBuffer: DataBuffer) {
        dataBuffer.writeUint8(Number.parseInt(this.command));
    }
}

registerClass("ModbusActionComponent", ModbusActionComponent);
