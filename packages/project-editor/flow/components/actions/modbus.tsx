import React from "react";
import { makeObservable, observable } from "mobx";
import type { ModbusRTUClient } from "jsmodbus";
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

import { serialConnections } from "project-editor/flow/components/actions/serial";
import { onWasmFlowRuntimeTerminate } from "project-editor/flow/runtime/wasm-worker";

////////////////////////////////////////////////////////////////////////////////

const modbusClients = new Map<number, Map<string, ModbusRTUClient>>();

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
                    hideInPropertyGrid: (component: ModbusActionComponent) =>
                        component.command != "05" && component.command !== "06"
                },
                "integer"
            ),
            makeExpressionProperty(
                {
                    name: "startingRegisterAddress",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup,
                    hideInPropertyGrid: (component: ModbusActionComponent) =>
                        component.command == "05" || component.command == "06"
                },
                "integer"
            ),
            makeExpressionProperty(
                {
                    name: "quantityOfRegisters",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup,
                    hideInPropertyGrid: (component: ModbusActionComponent) =>
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
                    hideInPropertyGrid: (component: ModbusActionComponent) =>
                        component.command != "05"
                },
                "boolean"
            ),
            makeExpressionProperty(
                {
                    name: "registerValue",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup,
                    hideInPropertyGrid: (component: ModbusActionComponent) =>
                        component.command != "06"
                },
                "integer"
            ),
            makeExpressionProperty(
                {
                    name: "coilValues",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup,
                    hideInPropertyGrid: (component: ModbusActionComponent) =>
                        component.command != "15"
                },
                "array:boolean"
            ),
            makeExpressionProperty(
                {
                    name: "registerValues",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup,
                    hideInPropertyGrid: (component: ModbusActionComponent) =>
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
                context.throwError(`invalid Connection`);
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

            if (command == 1) {
                // 01 (0x01) Read Coils
                context.throwError("Not implemented");
            } else if (command == 2) {
                // 02 (0x02) Read Discrete Inputs
                context.throwError("Not implemented");
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

                const serialConnection = serialConnections.get(connection.id);

                if (!serialConnection) {
                    context.throwError(`invalid Connection`);
                    return;
                }

                const { getSerialPort } =
                    require("instrument/connection/interfaces/serial-ports") as typeof SerialPortsModule;

                const serialPort = getSerialPort(serialConnection.connectionId);

                let client;
                let runtimeModbusClients = modbusClients.get(
                    context.WasmFlowRuntime.wasmModuleId
                );
                if (runtimeModbusClients) {
                    client = runtimeModbusClients.get(
                        serialConnection.connectionId
                    );
                }
                if (!client) {
                    try {
                        const { ModbusRTUClient } =
                            require("jsmodbus") as typeof JsmodbusModule;

                        client = new ModbusRTUClient(
                            serialPort,
                            serverAddress,
                            timeout
                        );
                        if (!runtimeModbusClients) {
                            runtimeModbusClients = new Map();
                            modbusClients.set(
                                context.WasmFlowRuntime.wasmModuleId,
                                runtimeModbusClients
                            );
                        }
                        runtimeModbusClients.set(
                            serialConnection.connectionId,
                            client
                        );
                    } catch (err) {
                        context.throwError(err.toString());
                        return;
                    }
                }

                context.startAsyncExecution();

                client
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
                        },
                        error => {
                            context.throwError(error.message);
                            context.endAsyncExecution();
                        }
                    );
            } else if (command == 4) {
                // 04 (0x04) Read Input Registers
                context.throwError("Not implemented");
            } else if (command == 5) {
                // 05 (0x05) Write Single Coil
                context.throwError("Not implemented");
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

                const serialConnection = serialConnections.get(connection.id);

                if (!serialConnection) {
                    context.throwError(`invalid Connection`);
                    return;
                }

                const { getSerialPort } =
                    require("instrument/connection/interfaces/serial-ports") as typeof SerialPortsModule;

                const serialPort = getSerialPort(serialConnection.connectionId);

                let client;
                try {
                    const { ModbusRTUClient } =
                        require("jsmodbus") as typeof JsmodbusModule;
                    client = new ModbusRTUClient(
                        serialPort,
                        serverAddress,
                        timeout
                    );
                } catch (err) {
                    context.throwError(err.toString());
                    return;
                }

                context.startAsyncExecution();

                client.writeSingleRegister(registerAddress, registerValue).then(
                    resp => {
                        context.propagateValueThroughSeqout();
                        context.endAsyncExecution();
                    },
                    error => {
                        context.throwError(error.message);
                        context.endAsyncExecution();
                    }
                );
            } else if (command == 15) {
                // 15 (0x0F) Write Multiple Coils
                context.throwError("Not implemented");
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
                if (!Array.isArray(registerValues)) {
                    context.throwError(`invalid Register values`);
                    return;
                }

                const serialConnection = serialConnections.get(connection.id);

                if (!serialConnection) {
                    context.throwError(`invalid Connection`);
                    return;
                }

                const { getSerialPort } =
                    require("instrument/connection/interfaces/serial-ports") as typeof SerialPortsModule;

                const serialPort = getSerialPort(serialConnection.connectionId);

                let client;
                try {
                    const { ModbusRTUClient } =
                        require("jsmodbus") as typeof JsmodbusModule;
                    client = new ModbusRTUClient(
                        serialPort,
                        serverAddress,
                        timeout
                    );
                } catch (err) {
                    context.throwError(err.toString());
                    return;
                }

                context.startAsyncExecution();

                client
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

    constructor() {
        super();

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
