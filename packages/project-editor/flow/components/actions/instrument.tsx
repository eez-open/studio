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

import { Dialog, showDialog } from "eez-studio-ui/dialog";
import { IListNode, ListItem } from "eez-studio-ui/list";
import { PropertyList, SelectFromListProperty } from "eez-studio-ui/properties";
import * as notification from "eez-studio-ui/notification";
import { humanize } from "eez-studio-shared/string";

import {
    parseScpi,
    SCPI_PART_EXPR,
    SCPI_PART_QUERY_WITH_ASSIGNMENT,
    SCPI_PART_STRING
} from "eez-studio-shared/scpi-parser";

import { InstrumentObject, instruments } from "instrument/instrument-object";

import type { IDashboardComponentContext } from "eez-studio-types";

import {
    registerClass,
    PropertyType,
    makeDerivedClassInfo,
    MessageType,
    ProjectType
} from "project-editor/core/object";

import {
    ActionComponent,
    ComponentOutput,
    makeExpressionProperty
} from "project-editor/flow/component";
import type { IFlowContext } from "project-editor/flow//flow-interfaces";
import { Assets, DataBuffer } from "project-editor/build/assets";
import {
    getChildOfObject,
    getProjectStore,
    Message,
    ProjectStore
} from "project-editor/store";
import { isNotDashboardProject } from "project-editor/project/project-type-traits";
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

import { specificGroup } from "project-editor/ui-components/PropertyGrid/groups";
import { COMPONENT_TYPE_SCPIACTION } from "project-editor/flow/components/component_types";
import { getComponentName } from "project-editor/flow/editor/ComponentsPalette";
import type { WorkerToRenderMessage } from "eez-studio-types";
import { ProjectContext } from "project-editor/project/context";
import { ProjectEditor } from "project-editor/project-editor-interface";
import { TextAction, IconAction } from "eez-studio-ui/action";
import { ConnectionParameters } from "instrument/connection/interface";

////////////////////////////////////////////////////////////////////////////////

export class SCPIActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        flowComponentId: COMPONENT_TYPE_SCPIACTION,
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType !== ProjectType.LVGL,
        properties: [
            makeExpressionProperty(
                {
                    name: "instrument",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup,
                    hideInPropertyGrid: isNotDashboardProject
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

                    try {
                        const parts = parseScpi(jsObject.scpi);
                        for (const part of parts) {
                            const tag = part.tag;
                            const str = part.value!;

                            if (tag == SCPI_PART_EXPR) {
                                const inputName = str.substring(
                                    1,
                                    str.length - 1
                                );

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
                    } catch (err) {}
                }
            }
        },
        check: (component: SCPIActionComponent) => {
            let messages: Message[] = [];

            try {
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
            } catch (err) {
                messages.push(
                    new Message(
                        MessageType.ERROR,
                        `Invalid SCPI: ${err}`,
                        getChildOfObject(component, "scpi")
                    )
                );
            }

            return messages;
        },
        label: (component: SCPIActionComponent) => {
            const project = getProjectStore(component).project;

            if (project.projectTypeTraits.isDashboard && component.instrument) {
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
                type: "any" as ValueType,
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
    class SelectInstrumentDialog extends React.Component<{
        name?: string;
        instruments: ObservableMap<string, InstrumentObject>;
        instrument?: InstrumentObject;
        callback: (instrument: InstrumentObject | undefined) => void;
    }> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        _selectedInstrument: InstrumentObject | undefined;
        open: boolean = true;

        constructor(props: any) {
            super(props);

            makeObservable(this, {
                _selectedInstrument: observable,
                instrumentNodes: computed,
                selectInstrumentExtension: action.bound,
                open: observable
            });
        }

        get isStandaloneDashboard() {
            return true || this.context?.standalone;
        }

        get selectedInstrument() {
            return this._selectedInstrument || this.props.instrument;
        }

        set selectedInstrument(value: InstrumentObject | undefined) {
            runInAction(() => (this._selectedInstrument = value));
        }

        renderNode = (node: IListNode<InstrumentObject>) => {
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
                    rightIcon={
                        this.isStandaloneDashboard &&
                        instrument == this.selectedInstrument ? (
                            <span>
                                {instrument != this.props.instrument &&
                                    instrument.isConnected && (
                                        <TextAction
                                            text="Disconnect"
                                            title="Disconnect connection to the instrument"
                                            onClick={async () => {
                                                if (instrument.isConnected) {
                                                    instrument.connection.disconnect();
                                                }
                                            }}
                                            style={{ color: "white" }}
                                        ></TextAction>
                                    )}
                                <IconAction
                                    icon="material:edit"
                                    title="Edit Instrument Label"
                                    onClick={async () => {
                                        const { EditInstrumentLabelDialog } =
                                            await import(
                                                "instrument/window/app"
                                            );

                                        showDialog(
                                            <EditInstrumentLabelDialog
                                                instrument={instrument}
                                                size="large"
                                            />
                                        );
                                    }}
                                    style={{ color: "white" }}
                                ></IconAction>
                            </span>
                        ) : null
                    }
                />
            );
        };

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
            return (
                this.selectedInstrument != undefined &&
                this.selectedInstrument != this.props.instrument
            );
        };

        async connectToInstrument(
            instrument: InstrumentObject,
            callback: (instrument: InstrumentObject | undefined) => void
        ) {
            const { showConnectionDialog } = await import(
                "instrument/window/connection-dialog"
            );

            showConnectionDialog(
                instrument.getConnectionParameters([
                    instrument.lastConnection,
                    instrument.defaultConnectionParameters
                ]),
                async (connectionParameters: ConnectionParameters) => {
                    if (!connectionParameters && !instrument.lastConnection) {
                        connectionParameters =
                            instrument.defaultConnectionParameters;
                    }

                    instrument.connection.connect(connectionParameters);

                    for (let i = 0; i < 30; i++) {
                        try {
                            await instrument.connection.acquire(false);
                            instrument.connection.release();

                            callback(instrument);

                            runInAction(() => (this.open = false));

                            return;
                        } catch (err) {
                            console.log("trace 6");
                            await new Promise<void>(resolve =>
                                setTimeout(resolve, 100)
                            );
                        }
                    }

                    notification.error("Failed to connect");
                },
                instrument.availableConnections,
                instrument.serialBaudRates
            );
        }

        onOk = () => {
            const instrument = this.selectedInstrument;
            if (!instrument) {
                return false;
            }

            if (instrument.isConnected) {
                this.props.callback(instrument);
                return true;
            }

            this.connectToInstrument(instrument, this.props.callback);
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
                    open={this.open}
                    okButtonText="Select"
                    cancelButtonText="Close"
                    onCancel={this.onCancel}
                    additionalButtons={
                        this.isStandaloneDashboard
                            ? [
                                  {
                                      id: "add-instrument",
                                      type: "primary",
                                      position: "left",
                                      onClick: async () => {
                                          const { showAddInstrumentDialog } =
                                              await import(
                                                  "instrument/add-instrument-dialog"
                                              );

                                          showAddInstrumentDialog(
                                              instrumentId => {
                                                  setTimeout(() => {
                                                      runInAction(
                                                          () =>
                                                              (this._selectedInstrument =
                                                                  instruments.get(
                                                                      instrumentId
                                                                  ))
                                                      );
                                                  }, 100);
                                              }
                                          );
                                      },
                                      disabled: false,
                                      style: {},
                                      title: "Add Instrument",
                                      text: "Add Instrument"
                                  },
                                  {
                                      id: "delete-instrument",
                                      type: "danger",
                                      position: "left",
                                      onClick: async () => {
                                          if (!this.selectedInstrument) {
                                              return;
                                          }
                                          this.selectedInstrument.deletePermanently();
                                          runInAction(
                                              () =>
                                                  (this._selectedInstrument =
                                                      undefined)
                                          );
                                      },
                                      disabled: !this.selectedInstrument,
                                      style: { marginRight: "auto" },
                                      title: "Delete Instrument",
                                      text: "Delete Instrument"
                                  }
                              ]
                            : []
                    }
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
    projectStore: ProjectStore | undefined,
    name?: string,
    instrumentId?: string | null
) {
    return new Promise<InstrumentObject | undefined>(resolve => {
        const dialog = (
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
        );
        if (projectStore) {
            showDialog(
                <ProjectContext.Provider value={projectStore}>
                    {dialog}
                </ProjectContext.Provider>
            );
        } else {
            showDialog(dialog);
        }
    });
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
                type: "any" as ValueType,
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
                type: "any" as ValueType,
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
            let name = getComponentName(component.type);
            if (!component.isInputProperty("instrument")) {
                return `${name} ${component.instrument}`;
            }
            return name;
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
        componentPaletteGroupName: "Instrument",
        execute: (context: IDashboardComponentContext) => {
            interface InstrumentVariableTypeConstructorParams {
                id: string;
            }

            const instrument =
                context.evalProperty<InstrumentVariableTypeConstructorParams>(
                    "instrument"
                );

            if (instrument == undefined || typeof instrument.id != "string") {
                context.throwError(`Invalid instrument property`);
                return;
            }

            const data: WorkerToRenderMessage = {
                connectToInstrumentId: instrument.id
            };

            context.WasmFlowRuntime.postWorkerToRendererMessage(data);

            context.propagateValueThroughSeqout();
        }
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
                type: "any" as ValueType,
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
}

registerClass(
    "ConnectInstrumentActionComponent",
    ConnectInstrumentActionComponent
);

////////////////////////////////////////////////////////////////////////////////

async function connectToInstrument(instrument: InstrumentObject) {
    if (!instrument.lastConnection) {
        return;
    }

    const connection = instrument.connection;
    connection.connect();
    for (let i = 0; i < 10; i++) {
        try {
            await connection.acquire(false);
            connection.release();
            return;
        } catch (err) {
            await new Promise<void>(resolve => setTimeout(resolve, 100));
        }
    }
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
        let instrument = await showSelectInstrumentDialog(
            ProjectEditor.getProject(variable as any)?._store,
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
            getFieldValue: (value: InstrumentObject): string => {
                return value.id;
            }
        },
        {
            name: "isConnected",
            valueType: "boolean",
            getFieldValue: (value: InstrumentObject): boolean => {
                return value.isConnected;
            }
        }
    ]
});
