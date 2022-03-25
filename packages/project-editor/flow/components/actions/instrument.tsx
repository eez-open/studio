import React from "react";
import {
    observable,
    computed,
    action,
    runInAction,
    ObservableMap,
    makeObservable
} from "mobx";
import { observer } from "mobx-react";

import { _find, _range } from "eez-studio-shared/algorithm";

import {
    registerClass,
    PropertyType,
    makeDerivedClassInfo,
    MessageType
} from "project-editor/core/object";

import { Dialog, showDialog } from "eez-studio-ui/dialog";
import { IListNode, ListItem } from "eez-studio-ui/list";
import { PropertyList, SelectFromListProperty } from "eez-studio-ui/properties";
import * as notification from "eez-studio-ui/notification";

import { InstrumentObject, instruments } from "instrument/instrument-object";

import {
    ActionComponent,
    ComponentOutput,
    makeExpressionProperty
} from "project-editor/flow/component";
import { FlowState } from "project-editor/flow//runtime";
import type { IFlowContext } from "project-editor/flow//flow-interfaces";
import { Assets, DataBuffer } from "project-editor/build/assets";
import {
    getChildOfObject,
    getDocumentStore,
    isAppletOrFirmwareWithFlowSupportProject,
    Message
} from "project-editor/core/store";
import {
    buildExpression,
    buildAssignableExpression,
    checkExpression,
    checkAssignableExpression
} from "project-editor/flow/expression";
import {
    IObjectVariableValue,
    IObjectVariableValueConstructorParams,
    registerObjectVariableType,
    ValueType
} from "project-editor/features/variable/value-type";
import type { IVariable } from "project-editor/flow/flow-interfaces";

import { humanize } from "eez-studio-shared/string";

import {
    parseScpi,
    parseScpiString,
    SCPI_PART_COMMAND,
    SCPI_PART_EXPR,
    SCPI_PART_QUERY,
    SCPI_PART_QUERY_WITH_ASSIGNMENT,
    SCPI_PART_STRING
} from "eez-studio-shared/scpi-parser";
import { ProjectEditor } from "project-editor/project-editor-interface";
import { FileHistoryItem } from "instrument/window/history/items/file";
import { specificGroup } from "project-editor/components/PropertyGrid/groups";
import { COMPONENT_TYPE_SCPIACTION } from "project-editor/flow/components/component_types";

////////////////////////////////////////////////////////////////////////////////

export class SCPIActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        flowComponentId: COMPONENT_TYPE_SCPIACTION,
        properties: [
            makeExpressionProperty(
                {
                    name: "instrument",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup,
                    hideInPropertyGrid: isAppletOrFirmwareWithFlowSupportProject
                },
                "object:Instrument"
            ),
            {
                name: "scpi",
                type: PropertyType.MultilineText,
                propertyGridGroup: specificGroup,
                monospaceFont: true,
                disableSpellcheck: true
            }
        ],
        beforeLoadHook: (component: SCPIActionComponent, jsObject: any) => {
            if (jsObject.scpi) {
                if (!jsObject.customInputs && !jsObject.customOutputs) {
                    jsObject.customInputs = [];
                    jsObject.customOutputs = [];

                    const parts = parseScpi(jsObject.scpi);
                    for (const part of parts) {
                        const tag = part.tag;
                        const str = part.value!;

                        if (tag == SCPI_PART_EXPR) {
                            const inputName = str.substring(1, str.length - 1);

                            if (
                                !jsObject.customInputs.find(
                                    (customInput: {
                                        name: string;
                                        type: PropertyType;
                                    }) => customInput.name == inputName
                                )
                            ) {
                                jsObject.customInputs.push({
                                    name: inputName,
                                    type: "string"
                                });
                            }
                        } else if (tag == SCPI_PART_QUERY_WITH_ASSIGNMENT) {
                            const outputName =
                                str[0] == "{"
                                    ? str.substring(1, str.length - 1)
                                    : str;

                            jsObject.customOutputs.push({
                                name: outputName,
                                type: "any"
                            });
                        }
                    }
                }
            }

            const project = ProjectEditor.getProject(component);
            if (
                project.isAppletProject ||
                project.isFirmwareWithFlowSupportProject
            ) {
                jsObject.instrument = undefined;
            }
        },
        check: (component: SCPIActionComponent) => {
            let messages: Message[] = [];

            const parts = parseScpi(component.scpi);
            for (const part of parts) {
                const tag = part.tag;
                const str = part.value!;

                if (tag == SCPI_PART_EXPR) {
                    try {
                        const expr = str.substring(1, str.length - 1);
                        checkExpression(component, expr);
                    } catch (err) {
                        messages.push(
                            new Message(
                                MessageType.ERROR,
                                `Invalid expression: ${err}`,
                                getChildOfObject(component, "scpi")
                            )
                        );
                    }
                } else if (tag == SCPI_PART_QUERY_WITH_ASSIGNMENT) {
                    try {
                        const assignableExpression =
                            str[0] == "{"
                                ? str.substring(1, str.length - 1)
                                : str;
                        checkAssignableExpression(
                            component,
                            assignableExpression
                        );
                    } catch (err) {
                        messages.push(
                            new Message(
                                MessageType.ERROR,
                                `Invalid assignable expression: ${err}`,
                                getChildOfObject(component, "scpi")
                            )
                        );
                    }
                }
            }

            return messages;
        },
        label: (component: SCPIActionComponent) => {
            const project = getDocumentStore(component).project;

            if (
                !project.isAppletProject &&
                !project.isFirmwareWithFlowSupportProject &&
                component.instrument
            ) {
                return `SCPI ${component.instrument}`;
            }

            return "SCPI";
        },
        componentPaletteLabel: "SCPI",
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 7 7">
                <path d="M1.5 0C.67 0 0 .67 0 1.5S.67 3 1.5 3H2v1h-.5C.67 4 0 4.67 0 5.5S.67 7 1.5 7 3 6.33 3 5.5V5h1v.5C4 6.33 4.67 7 5.5 7S7 6.33 7 5.5 6.33 4 5.5 4H5V3h.5C6.33 3 7 2.33 7 1.5S6.33 0 5.5 0 4 .67 4 1.5V2H3v-.5C3 .67 2.33 0 1.5 0zm0 1c.28 0 .5.22.5.5V2h-.5c-.28 0-.5-.22-.5-.5s.22-.5.5-.5zm4 0c.28 0 .5.22.5.5s-.22.5-.5.5H5v-.5c0-.28.22-.5.5-.5zM3 3h1v1H3V3zM1.5 5H2v.5c0 .28-.22.5-.5.5S1 5.78 1 5.5s.22-.5.5-.5zM5 5h.5c.28 0 .5.22.5.5s-.22.5-.5.5-.5-.22-.5-.5V5z" />
            </svg>
        ),
        componentHeaderColor: "#FDD0A2",
        componentPaletteGroupName: "Instrument"
    });

    instrument: string;
    scpi: string;

    constructor() {
        super();

        makeObservable(this, {
            instrument: observable,
            scpi: observable
        });
    }

    getInputs() {
        return [
            ...super.getInputs(),
            {
                name: "@seqin",
                type: "null" as ValueType,
                isSequenceInput: true,
                isOptionalInput: true
            }
        ];
    }

    getOutputs() {
        return [
            ...super.getOutputs(),
            {
                name: "@seqout",
                type: "null" as ValueType,
                isSequenceOutput: true,
                isOptionalOutput: true
            }
        ];
    }

    async execute(flowState: FlowState) {
        const instrument: InstrumentObject | undefined =
            flowState.evalExpression(this, this.instrument);

        if (!instrument) {
            throw "instrument not found";
        }

        const CONNECTION_TIMEOUT = 5000;
        const startTime = Date.now();
        while (
            !instrument.isConnected &&
            Date.now() - startTime < CONNECTION_TIMEOUT
        ) {
            if (!instrument.connection.isTransitionState) {
                instrument.connection.connect();
            }
            await new Promise<boolean>(resolve => setTimeout(resolve, 10));
        }

        if (!instrument.isConnected) {
            throw "instrument not connected";
        }

        const connection = instrument.connection;

        await connection.acquire(false);

        try {
            let command = "";

            const parts = parseScpi(this.scpi);
            for (const part of parts) {
                const tag = part.tag;
                const str = part.value!;

                if (tag == SCPI_PART_STRING) {
                    command += str;
                } else if (tag == SCPI_PART_EXPR) {
                    const expr = str.substring(1, str.length - 1);

                    const value = flowState.evalExpression(this, expr);

                    command += value.toString();
                } else if (
                    tag == SCPI_PART_QUERY_WITH_ASSIGNMENT ||
                    tag == SCPI_PART_QUERY
                ) {
                    flowState.logScpi(
                        `SCPI QUERY [${instrument.name}]: ${command}`,
                        this
                    );
                    let result = await connection.query(command);
                    command = "";

                    if (result instanceof FileHistoryItem) {
                        flowState.logScpi(
                            `SCPI QUERY RESULT [${instrument.name}]: file, size: ${result.fileLength})`,
                            this
                        );
                        result = result.data;
                    } else {
                        let resultStr;
                        try {
                            resultStr =
                                result != undefined
                                    ? JSON.stringify(result)
                                    : "";
                        } catch (err) {
                            resultStr = "unknown";
                        }

                        flowState.logScpi(
                            `SCPI QUERY RESULT [${instrument.name}]: ${resultStr}`,
                            this
                        );
                    }

                    if (typeof result === "object" && result.error) {
                        throw result.error;
                    }

                    if (tag == SCPI_PART_QUERY_WITH_ASSIGNMENT) {
                        if (typeof result == "string") {
                            const resultStr = parseScpiString(result);
                            if (resultStr) {
                                result = resultStr;
                            }
                        }

                        const assignableExpression =
                            str[0] == "{"
                                ? str.substring(1, str.length - 1)
                                : str;

                        flowState.runtime.assignValue(
                            flowState,
                            this,
                            assignableExpression,
                            result
                        );
                    }
                } else if (tag == SCPI_PART_COMMAND) {
                    flowState.logScpi(
                        `SCPI COMMAND [${instrument.name}]: ${command}`,
                        this
                    );
                    connection.command(command);
                    command = "";
                }
            }
        } finally {
            connection.release();
        }

        return undefined;
    }

    getBody(flowContext: IFlowContext): React.ReactNode {
        return (
            <div className="body EezStudio_ScpiBody">
                <pre>{this.scpi}</pre>
            </div>
        );
    }

    buildFlowComponentSpecific(assets: Assets, dataBuffer: DataBuffer) {
        const parts = parseScpi(this.scpi);
        for (const part of parts) {
            dataBuffer.writeUint8(part.tag);

            const str = part.value!;

            if (part.tag == SCPI_PART_STRING) {
                dataBuffer.writeUint16NonAligned(str.length);
                for (const ch of str) {
                    dataBuffer.writeUint8(ch.codePointAt(0)!);
                }
            } else if (part.tag == SCPI_PART_EXPR) {
                const expression = str.substring(1, str.length - 1);
                buildExpression(assets, dataBuffer, this, expression);
            } else if (part.tag == SCPI_PART_QUERY_WITH_ASSIGNMENT) {
                const lValueExpression =
                    str[0] == "{" ? str.substring(1, str.length - 1) : str;
                buildAssignableExpression(
                    assets,
                    dataBuffer,
                    this,
                    lValueExpression
                );
            }
        }
    }
}

registerClass("SCPIActionComponent", SCPIActionComponent);

////////////////////////////////////////////////////////////////////////////////

export const SelectInstrumentDialog = observer(
    class SelectInstrumentDialog extends React.Component<
        {
            name?: string;
            instruments: ObservableMap<string, InstrumentObject>;
            instrument?: InstrumentObject;
            callback: (instrument: InstrumentObject | undefined) => void;
        },
        {}
    > {
        _selectedInstrument: InstrumentObject | undefined;

        constructor(props: {
            name?: string;
            instruments: ObservableMap<string, InstrumentObject>;
            instrument?: InstrumentObject;
            callback: (instrument: InstrumentObject | undefined) => void;
        }) {
            super(props);

            makeObservable(this, {
                _selectedInstrument: observable,
                instrumentNodes: computed,
                selectInstrumentExtension: action.bound
            });
        }

        get selectedInstrument() {
            return this._selectedInstrument || this.props.instrument;
        }

        set selectedInstrument(value: InstrumentObject | undefined) {
            runInAction(() => (this._selectedInstrument = value));
        }

        renderNode(node: IListNode<InstrumentObject>) {
            let instrument = node.data;
            return (
                <ListItem
                    leftIcon={instrument.image}
                    leftIconSize={48}
                    label={
                        <div className="EezStudio_InstrumentConnectionState">
                            <span
                                style={{
                                    backgroundColor:
                                        instrument.connectionState.color
                                }}
                            />
                            <span>{instrument.name}</span>
                        </div>
                    }
                />
            );
        }

        get instrumentNodes() {
            const instrumentObjects = [];

            for (let [_, instrument] of this.props.instruments) {
                instrumentObjects.push(instrument);
            }

            instrumentObjects.sort((a, b) =>
                a.name
                    .toLocaleLowerCase()
                    .localeCompare(b.name.toLocaleLowerCase())
            );

            return instrumentObjects.map(instrument => ({
                id: instrument.id,
                data: instrument,
                selected: this.selectedInstrument
                    ? instrument.id === this.selectedInstrument.id
                    : false
            }));
        }

        selectInstrumentExtension(node: IListNode<InstrumentObject>) {
            this.selectedInstrument = node.data;
        }

        isOkEnabled = () => {
            return this.selectedInstrument != undefined;
        };

        onOk = () => {
            if (this.selectedInstrument) {
                this.props.callback(this.selectedInstrument);
                return true;
            }
            return false;
        };

        onCancel = () => {
            this.props.callback(undefined);
        };

        render() {
            return (
                <Dialog
                    okEnabled={this.isOkEnabled}
                    onOk={this.onOk}
                    onCancel={this.onCancel}
                >
                    <PropertyList>
                        <SelectFromListProperty
                            name={this.props.name || "Select instrument:"}
                            nodes={this.instrumentNodes}
                            renderNode={this.renderNode}
                            onChange={this.selectInstrumentExtension}
                        />
                    </PropertyList>
                </Dialog>
            );
        }
    }
);

export async function showSelectInstrumentDialog(
    name?: string,
    instrumentId?: string | null
) {
    return new Promise<InstrumentObject | undefined>(resolve =>
        showDialog(
            <SelectInstrumentDialog
                name={name}
                instruments={instruments}
                instrument={
                    instrumentId ? instruments.get(instrumentId) : undefined
                }
                callback={instrument => {
                    resolve(instrument);
                }}
            />
        )
    );
}

export class SelectInstrumentActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        properties: [],
        icon: (
            <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 38.26620101928711 38.26569747924805"
            >
                <path
                    fillOpacity=".404"
                    d="M38.266 0v7h-7V0h7zm-9 0v7h-7V0h7zm-9 0v7h-7V0h7zm18 9v7h-7V9h7zm-9 0v7h-7V9h7zm-9 0v7h-7V9h7zm18 9v7h-7v-7h7zm-9 0v7h-7v-7h7zm-9 0v7h-7v-7h7z"
                />
                <path d="M4.916 37.202a2.724 2.724 0 1 1-3.852-3.853l7.874-7.874A11.446 11.446 0 0 1 7.266 19.5c0-6.351 5.15-11.5 11.5-11.5s11.5 5.149 11.5 11.5S25.117 31 18.766 31c-2.188 0-4.234-.611-5.975-1.672l-7.874 7.874zM18.766 12a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15z" />
            </svg>
        ),
        componentHeaderColor: "#FDD0A2",
        componentPaletteGroupName: "Instrument"
    });

    getInputs() {
        return [
            ...super.getInputs(),
            {
                name: "@seqin",
                type: "null" as ValueType,
                isSequenceInput: true,
                isOptionalInput: false
            }
        ];
    }

    getOutputs(): ComponentOutput[] {
        return [
            ...super.getOutputs(),
            {
                name: "@seqout",
                type: "null" as ValueType,
                isSequenceOutput: true,
                isOptionalOutput: true
            },
            {
                name: "instrument",
                type: "object:Instrument",
                isSequenceOutput: false,
                isOptionalOutput: false
            }
        ];
    }

    async execute(flowState: FlowState) {
        await new Promise<void>(resolve => {
            showDialog(
                <SelectInstrumentDialog
                    instruments={instruments}
                    callback={instrument => {
                        if (instrument) {
                            flowState.runtime.propagateValue(
                                flowState,
                                this,
                                "instrument",
                                instrument
                            );
                        }
                        resolve();
                    }}
                />
            );
        });
        return undefined;
    }
}

registerClass(
    "SelectInstrumentActionComponent",
    SelectInstrumentActionComponent
);

////////////////////////////////////////////////////////////////////////////////

export class GetInstrumentActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        properties: [
            makeExpressionProperty(
                {
                    name: "id",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup
                },
                "string"
            )
        ],
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 448">
                <path d="M224 144c-44.004 0-80.001 36-80.001 80 0 44.004 35.997 80 80.001 80 44.005 0 79.999-35.996 79.999-80 0-44-35.994-80-79.999-80zm190.938 58.667c-9.605-88.531-81.074-160-169.605-169.599V0h-42.666v33.067c-88.531 9.599-160 81.068-169.604 169.599H0v42.667h33.062c9.604 88.531 81.072 160 169.604 169.604V448h42.666v-33.062c88.531-9.604 160-81.073 169.605-169.604H448v-42.667h-33.062zM224 373.333c-82.137 0-149.334-67.198-149.334-149.333 0-82.136 67.197-149.333 149.334-149.333 82.135 0 149.332 67.198 149.332 149.333S306.135 373.333 224 373.333z" />
            </svg>
        ),
        componentHeaderColor: "#FDD0A2",
        componentPaletteGroupName: "Instrument"
    });

    getInputs() {
        return [
            ...super.getInputs(),
            {
                name: "@seqin",
                type: "null" as ValueType,
                isSequenceInput: true,
                isOptionalInput: false
            }
        ];
    }

    getOutputs(): ComponentOutput[] {
        return [
            ...super.getOutputs(),
            {
                name: "@seqout",
                type: "null" as ValueType,
                isSequenceOutput: true,
                isOptionalOutput: true
            },
            {
                name: "instrument",
                type: "object:Instrument",
                isSequenceOutput: false,
                isOptionalOutput: false
            }
        ];
    }

    async execute(flowState: FlowState) {
        const id = flowState.evalExpression(this, "id");
        const instrument = instruments.get(id);
        flowState.runtime.propagateValue(
            flowState,
            this,
            "instrument",
            instrument
        );
        return undefined;
    }
}

registerClass("GetInstrumentActionComponent", GetInstrumentActionComponent);

////////////////////////////////////////////////////////////////////////////////

export class ConnectInstrumentActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        properties: [
            makeExpressionProperty(
                {
                    name: "instrument",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup
                },
                "object:Instrument"
            )
        ],
        label: (component: SCPIActionComponent) => {
            const label = ActionComponent.classInfo.label!(component);
            if (!component.isInputProperty("instrument")) {
                return `${label} ${component.instrument}`;
            }
            return label;
        },
        icon: (
            <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 37.06357192993164 37.06456756591797"
            >
                <path d="M6.296 8.535L.619 2.858A1.584 1.584 0 0 1 2.858.618l5.677 5.678c4.34-3.255 10.527-2.908 14.475 1.04L7.336 23.01C3.388 19.062 3.04 12.876 6.296 8.535zm23.432 5.52c3.948 3.947 4.295 10.133 1.04 14.474l5.677 5.677a1.584 1.584 0 1 1-2.24 2.24l-5.676-5.678c-4.341 3.255-10.527 2.908-14.475-1.04l3.358-3.359-2.8-2.799a2.376 2.376 0 1 1 3.36-3.359l2.799 2.8 2.24-2.24-2.8-2.799a2.375 2.375 0 1 1 3.36-3.358l2.798 2.798 3.359-3.358z" />
            </svg>
        ),
        componentHeaderColor: "#FDD0A2",
        componentPaletteGroupName: "Instrument"
    });

    instrument: string;

    constructor() {
        super();

        makeObservable(this, {
            instrument: observable
        });
    }

    getInputs() {
        return [
            ...super.getInputs(),
            {
                name: "@seqin",
                type: "null" as ValueType,
                isSequenceInput: true,
                isOptionalInput: false
            }
        ];
    }

    getOutputs() {
        return [
            ...super.getOutputs(),
            {
                name: "@seqout",
                type: "null" as ValueType,
                isSequenceOutput: true,
                isOptionalOutput: true
            }
        ];
    }

    async execute(flowState: FlowState) {
        const instrument: InstrumentObject | undefined =
            flowState.evalExpression(this, this.instrument);

        if (!instrument) {
            throw "instrument not found";
        }

        instrument.connection.connect();

        return undefined;
    }
}

registerClass(
    "ConnectInstrumentActionComponent",
    ConnectInstrumentActionComponent
);

////////////////////////////////////////////////////////////////////////////////

async function connectToInstrument(instrument: InstrumentObject) {
    const connection = instrument.connection;
    connection.connect();
    for (let i = 0; i < 100; i++) {
        try {
            await connection.acquire(false);
            connection.release();
            return;
        } catch (err) {
            await new Promise<void>(resolve => setTimeout(resolve, 100));
        }
    }
    notification.error("Failed to connect to the instrument!");
}

type InstrumentConstructorParams = "string" | { id: "string" };

function getInstrumentIdFromConstructorParams(
    constructorParams: InstrumentConstructorParams | undefined
) {
    return constructorParams == null
        ? null
        : typeof constructorParams === "string"
        ? constructorParams
        : (constructorParams.id as string);
}

registerObjectVariableType("Instrument", {
    editConstructorParams: async (
        variable: IVariable,
        constructorParams?: InstrumentConstructorParams
    ): Promise<IObjectVariableValueConstructorParams | undefined> => {
        const instrument = await showSelectInstrumentDialog(
            variable.description || humanize(variable.name),
            getInstrumentIdFromConstructorParams(constructorParams)
        );

        return instrument
            ? {
                  id: instrument.id
              }
            : undefined;
    },

    createValue: (
        constructorParams: InstrumentConstructorParams,
        isRuntime: boolean
    ) => {
        const instrumentId =
            getInstrumentIdFromConstructorParams(constructorParams);
        if (instrumentId) {
            const instrument = instruments.get(instrumentId);
            if (instrument) {
                if (isRuntime) {
                    connectToInstrument(instrument);
                }
                return instrument;
            }
        }
        return {
            constructorParams,
            status: {
                label: "Unknown instrument",
                error: `Instrument with ID [${constructorParams}] is not found`
            }
        };
    },
    destroyValue: (value: IObjectVariableValue) => {},

    valueFieldDescriptions: [
        {
            name: "id",
            valueType: "string",
            getFieldValue: (value: InstrumentObject) => {
                return value.id;
            }
        }
    ]
});
