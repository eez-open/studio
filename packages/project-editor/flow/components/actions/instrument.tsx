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

import type * as AddInstrumentDialogModule from "instrument/add-instrument-dialog";

import type { IDashboardComponentContext } from "eez-studio-types";

import {
    registerClass,
    PropertyType,
    makeDerivedClassInfo,
    MessageType,
    ProjectType,
    IMessage
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
    isStructType,
    registerObjectVariableType,
    ValueType
} from "project-editor/features/variable/value-type";
import type { IVariable } from "project-editor/flow/flow-interfaces";

import { specificGroup } from "project-editor/ui-components/PropertyGrid/groups";
import { COMPONENT_TYPE_SCPI_ACTION } from "project-editor/flow/components/component-types";
import { ProjectContext } from "project-editor/project/context";
import { ProjectEditor } from "project-editor/project-editor-interface";
import { TextAction, IconAction } from "eez-studio-ui/action";
import { ConnectionParameters } from "instrument/connection/interface";
import { activityLogStore, log } from "instrument/window/history/activity-log";
import { WaveformFormat } from "eez-studio-ui/chart/WaveformFormat";

////////////////////////////////////////////////////////////////////////////////

export class SCPIActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        flowComponentId: COMPONENT_TYPE_SCPI_ACTION,
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
                disableSpellcheck: true,
                flowProperty: "scpi-template-literal"
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
        check: (component: SCPIActionComponent, messages: IMessage[]) => {
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
            <svg viewBox="12 12 232 232" fill="currentColor">
                <path d="M180 146h-22v-36h22a34 34 0 1 0-34-34v22h-36V76a34 34 0 1 0-34 34h22v36H76a34 34 0 1 0 34 34v-22h36v22a34 34 0 1 0 34-34Zm-22-70a22 22 0 1 1 22 22h-22ZM54 76a22 22 0 0 1 44 0v22H76a22.025 22.025 0 0 1-22-22Zm44 104a22 22 0 1 1-22-22h22Zm12-70h36v36h-36Zm70 92a22.025 22.025 0 0 1-22-22v-22h22a22 22 0 0 1 0 44Z" />
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
            {
                name: "@seqin",
                type: "any" as ValueType,
                isSequenceInput: true,
                isOptionalInput: true
            },
            ...super.getInputs()
        ];
    }

    getOutputs() {
        return [
            {
                name: "@seqout",
                type: "null" as ValueType,
                isSequenceOutput: true,
                isOptionalOutput: true
            },
            ...super.getOutputs()
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
        selectAndConnect: boolean;
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
            return this.context?.standalone;
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

            if (instrument.isConnected || !this.props.selectAndConnect) {
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
                                              require("instrument/add-instrument-dialog") as typeof AddInstrumentDialogModule;

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
    instrumentId?: string | null,
    selectAndConnect?: boolean
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
                selectAndConnect={
                    selectAndConnect == undefined ? true : selectAndConnect
                }
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
                fill="currentColor"
            >
                <path
                    fillOpacity=".404"
                    d="M38.266 0v7h-7V0h7zm-9 0v7h-7V0h7zm-9 0v7h-7V0h7zm18 9v7h-7V9h7zm-9 0v7h-7V9h7zm-9 0v7h-7V9h7zm18 9v7h-7v-7h7zm-9 0v7h-7v-7h7zm-9 0v7h-7v-7h7z"
                />
                <path d="M4.916 37.202a2.724 2.724 0 1 1-3.852-3.853l7.874-7.874A11.446 11.446 0 0 1 7.266 19.5c0-6.351 5.15-11.5 11.5-11.5s11.5 5.149 11.5 11.5S25.117 31 18.766 31c-2.188 0-4.234-.611-5.975-1.672l-7.874 7.874zM18.766 12a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15z" />
            </svg>
        ),
        componentHeaderColor: "#FDD0A2",
        componentPaletteGroupName: "Instrument",
        execute: async (context: IDashboardComponentContext) => {
            try {
                context.startAsyncExecution();
                const instrument = await showSelectInstrumentDialog(
                    undefined,
                    undefined,
                    undefined,
                    false
                );
                context.endAsyncExecution();

                if (instrument) {
                    context.propagateValue("instrument", instrument);
                }
                context.propagateValueThroughSeqout();
            } catch (err) {
                context.endAsyncExecution();
                context.throwError(err.toString());
            }
        }
    });

    getInputs() {
        return [
            {
                name: "@seqin",
                type: "any" as ValueType,
                isSequenceInput: true,
                isOptionalInput: false
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
            {
                name: "instrument",
                type: "object:Instrument",
                isSequenceOutput: false,
                isOptionalOutput: false
            },
            ...super.getOutputs()
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
                    name: "instrumentId",
                    displayName: "Instrument ID",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup
                },
                "string"
            )
        ],
        icon: (
            <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 448 448"
                fill="currentColor"
            >
                <path d="M224 144c-44.004 0-80.001 36-80.001 80 0 44.004 35.997 80 80.001 80 44.005 0 79.999-35.996 79.999-80 0-44-35.994-80-79.999-80zm190.938 58.667c-9.605-88.531-81.074-160-169.605-169.599V0h-42.666v33.067c-88.531 9.599-160 81.068-169.604 169.599H0v42.667h33.062c9.604 88.531 81.072 160 169.604 169.604V448h42.666v-33.062c88.531-9.604 160-81.073 169.605-169.604H448v-42.667h-33.062zM224 373.333c-82.137 0-149.334-67.198-149.334-149.333 0-82.136 67.197-149.333 149.334-149.333 82.135 0 149.332 67.198 149.332 149.333S306.135 373.333 224 373.333z" />
            </svg>
        ),
        componentHeaderColor: "#FDD0A2",
        componentPaletteGroupName: "Instrument",
        execute: (context: IDashboardComponentContext) => {
            const instrumentId = context.evalProperty<string>("instrumentId");

            if (instrumentId == undefined || typeof instrumentId != "string") {
                context.throwError(`Invalid Instrument ID property`);
                return;
            }

            const instrument = instruments.get(instrumentId);

            if (!instrument) {
                context.throwError("Instrument not found");
                return;
            }

            context.propagateValue("instrument", instrument);
            context.propagateValueThroughSeqout();
        }
    });

    instrumentId: string;

    constructor() {
        super();

        makeObservable(this, {
            instrumentId: observable
        });
    }

    getInputs() {
        return [
            {
                name: "@seqin",
                type: "any" as ValueType,
                isSequenceInput: true,
                isOptionalInput: false
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
            {
                name: "instrument",
                type: "object:Instrument",
                isSequenceOutput: false,
                isOptionalOutput: false
            },
            ...super.getOutputs()
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
        icon: (
            <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                height="24"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
            >
                <path stroke="none" d="M0 0h24v24H0z" />
                <path d="m7 12 5 5-1.5 1.5a3.536 3.536 0 1 1-5-5L7 12zM17 12l-5-5 1.5-1.5a3.536 3.536 0 1 1 5 5L17 12zM3 21l2.5-2.5M18.5 5.5 21 3M10 11l-2 2M13 14l-2 2" />
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

            const instrumentObject = instruments.get(instrument.id);

            if (!instrumentObject) {
                context.throwError(`Instrument not found`);
                return;
            }

            instrumentObject.connection.connect();

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
            {
                name: "@seqin",
                type: "any" as ValueType,
                isSequenceInput: true,
                isOptionalInput: false
            },
            ...super.getInputs()
        ];
    }

    getOutputs() {
        return [
            {
                name: "@seqout",
                type: "null" as ValueType,
                isSequenceOutput: true,
                isOptionalOutput: true
            },
            ...super.getOutputs()
        ];
    }

    getBody(flowContext: IFlowContext): React.ReactNode {
        if (!this.instrument) {
            return null;
        }

        if (this.customInputs.find(input => input.name == this.instrument)) {
            return null;
        }

        return (
            <div className="body EezStudio_ScpiBody">
                <pre>{this.instrument}</pre>
            </div>
        );
    }
}

registerClass(
    "ConnectInstrumentActionComponent",
    ConnectInstrumentActionComponent
);

////////////////////////////////////////////////////////////////////////////////

export class DisconnectInstrumentActionComponent extends ActionComponent {
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
        icon: (
            <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                height="24"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
            >
                <path stroke="none" d="M0 0h24v24H0z" />
                <path d="m20 16-4 4M7 12l5 5-1.5 1.5a3.536 3.536 0 1 1-5-5L7 12zM17 12l-5-5 1.5-1.5a3.536 3.536 0 1 1 5 5L17 12zM3 21l2.5-2.5M18.5 5.5 21 3M10 11l-2 2M13 14l-2 2M16 16l4 4" />
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

            const instrumentObject = instruments.get(instrument.id);

            if (!instrumentObject) {
                context.throwError(`Instrument not found`);
                return;
            }

            instrumentObject.connection.disconnect();

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
            {
                name: "@seqin",
                type: "any" as ValueType,
                isSequenceInput: true,
                isOptionalInput: false
            },
            ...super.getInputs()
        ];
    }

    getOutputs() {
        return [
            {
                name: "@seqout",
                type: "null" as ValueType,
                isSequenceOutput: true,
                isOptionalOutput: true
            },
            ...super.getOutputs()
        ];
    }

    getBody(flowContext: IFlowContext): React.ReactNode {
        if (!this.instrument) {
            return null;
        }

        if (this.customInputs.find(input => input.name == this.instrument)) {
            return null;
        }

        return (
            <div className="body EezStudio_ScpiBody">
                <pre>{this.instrument}</pre>
            </div>
        );
    }
}

registerClass(
    "DisconnectInstrumentActionComponent",
    DisconnectInstrumentActionComponent
);

////////////////////////////////////////////////////////////////////////////////

export class GetInstrumentPropertiesActionComponent extends ActionComponent {
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
        defaultValue: {
            customOutputs: [
                {
                    name: "properties",
                    type: "any"
                }
            ]
        },
        icon: (
            <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 231.621 231.616"
                fill="currentColor"
            >
                <path
                    fill="none"
                    d="M137.566 14.85 9.656 142.76l79.196 79.2L216.766 94.045c-8.852-14.042-6.946-32.655 5.023-44.62L182.192 9.827c-11.973 11.969-30.586 13.879-44.626 5.023zM51.598 129.108l79.68-79.683 5.656 5.656-79.68 79.683-5.656-5.656zm28.28 28.285-5.655-5.656 54.226-54.23 5.657 5.656-54.227 54.23zm22.63 22.625-5.656-5.656 68.367-68.37 5.656 5.655-68.367 68.371zm92.855-127.765a15.89 15.89 0 0 1-4.687 11.312 15.948 15.948 0 0 1-11.313 4.68 15.952 15.952 0 0 1-11.316-4.68c-6.234-6.242-6.234-16.39 0-22.625 6.242-6.238 16.387-6.246 22.629 0a15.877 15.877 0 0 1 4.687 11.313z"
                />
                <path
                    fill="none"
                    d="M173.703 46.596c-3.117 3.118-3.117 8.192 0 11.313 3.125 3.117 8.2 3.117 11.317 0 1.511-1.512 2.343-3.52 2.343-5.656s-.832-4.145-2.343-5.657c-3.118-3.117-8.2-3.12-11.317 0z"
                />
                <path d="M230.45 46.772 184.843 1.167c-.813-.813-1.926-1.204-3.07-1.164a4.008 4.008 0 0 0-2.91 1.527 29.51 29.51 0 0 1-2.329 2.64c-9.972 9.97-25.86 10.961-36.968 2.325a3.994 3.994 0 0 0-5.286.328L1.172 139.933a3.998 3.998 0 0 0 0 5.656l84.852 84.855a3.997 3.997 0 0 0 5.656 0L224.793 97.331a4.002 4.002 0 0 0 .328-5.286c-8.64-11.105-7.644-26.996 2.324-36.964a28.046 28.046 0 0 1 2.626-2.32 3.996 3.996 0 0 0 .378-5.989zm-13.684 47.274L88.852 221.96l-79.196-79.2 127.91-127.91c14.04 8.856 32.653 6.946 44.626-5.023l39.597 39.598c-11.968 11.965-13.875 30.578-5.023 44.62z" />
                <path d="M168.047 40.94c-6.235 6.235-6.235 16.383 0 22.625a15.952 15.952 0 0 0 11.316 4.68c4.094 0 8.192-1.559 11.313-4.68a15.89 15.89 0 0 0 4.687-11.312c0-4.278-1.664-8.293-4.687-11.313-6.242-6.246-16.387-6.238-22.63 0zm19.316 11.313a7.946 7.946 0 0 1-2.343 5.656c-3.118 3.117-8.192 3.117-11.317 0-3.117-3.121-3.117-8.196 0-11.313 3.118-3.12 8.2-3.117 11.317 0a7.946 7.946 0 0 1 2.343 5.657zM51.596 129.11l79.68-79.68 5.657 5.656-79.681 79.68zM74.22 151.741l54.228-54.228 5.656 5.656-54.228 54.228zM96.849 174.363l68.369-68.37 5.656 5.657-68.369 68.369z" />
            </svg>
        ),
        componentHeaderColor: "#FDD0A2",
        componentPaletteGroupName: "Instrument",
        check: (
            component: GetInstrumentPropertiesActionComponent,
            messages: IMessage[]
        ) => {
            const output = component.customOutputs.find(
                output => output.name == "properties"
            );
            if (output) {
                if (!isStructType(output.type)) {
                    messages.push(
                        new Message(
                            MessageType.ERROR,
                            `Output "properties" must be of struct type`,
                            component
                        )
                    );
                }
            } else {
                messages.push(
                    new Message(
                        MessageType.ERROR,
                        `Output "properties" not found`,
                        component
                    )
                );
            }
        },
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

            const instrumentObject = instruments.get(instrument.id);
            if (!instrumentObject) {
                context.throwError(`Instrument ${instrument.id} not found`);
                return;
            }

            context.propagateValue("properties", instrumentObject.properties);

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
            {
                name: "@seqin",
                type: "any" as ValueType,
                isSequenceInput: true,
                isOptionalInput: false
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
            ...super.getOutputs()
        ];
    }
}

registerClass(
    "GetInstrumentPropertiesActionComponent",
    GetInstrumentPropertiesActionComponent
);

////////////////////////////////////////////////////////////////////////////////

export class AddToInstrumentHistoryActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        properties: [
            makeExpressionProperty(
                {
                    name: "instrument",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup
                },
                "object:Instrument"
            ),
            {
                name: "itemType",
                type: PropertyType.Enum,
                enumItems: [
                    {
                        id: "chart"
                    }
                ],
                propertyGridGroup: specificGroup
            },
            makeExpressionProperty(
                {
                    name: "chartDescription",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup,
                    hideInPropertyGrid: (
                        component: AddToInstrumentHistoryActionComponent
                    ) => {
                        return component.itemType != "chart";
                    }
                },
                "string"
            ),
            makeExpressionProperty(
                {
                    name: "chartData",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup,
                    hideInPropertyGrid: (
                        component: AddToInstrumentHistoryActionComponent
                    ) => {
                        return component.itemType != "chart";
                    }
                },
                "blob"
            ),
            makeExpressionProperty(
                {
                    name: "chartSamplingRate",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup,
                    hideInPropertyGrid: (
                        component: AddToInstrumentHistoryActionComponent
                    ) => {
                        return component.itemType != "chart";
                    }
                },
                "float"
            ),
            makeExpressionProperty(
                {
                    name: "chartOffset",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup,
                    hideInPropertyGrid: (
                        component: AddToInstrumentHistoryActionComponent
                    ) => {
                        return component.itemType != "chart";
                    }
                },
                "double"
            ),
            makeExpressionProperty(
                {
                    name: "chartScale",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup,
                    hideInPropertyGrid: (
                        component: AddToInstrumentHistoryActionComponent
                    ) => {
                        return component.itemType != "chart";
                    }
                },
                "double"
            ),
            makeExpressionProperty(
                {
                    name: "chartFormat",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup,
                    hideInPropertyGrid: (
                        component: AddToInstrumentHistoryActionComponent
                    ) => {
                        return component.itemType != "chart";
                    },
                    formText: `"float", "double", "rigol-byte", "rigol-word", "csv"`
                },
                "string"
            ),
            makeExpressionProperty(
                {
                    name: "chartUnit",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup,
                    hideInPropertyGrid: (
                        component: AddToInstrumentHistoryActionComponent
                    ) => {
                        return component.itemType != "chart";
                    },
                    formText: `"voltage", "current", "watt", "power", "time", "frequency", "joule"`
                },
                "integer"
            ),
            makeExpressionProperty(
                {
                    name: "chartColor",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup,
                    hideInPropertyGrid: (
                        component: AddToInstrumentHistoryActionComponent
                    ) => {
                        return component.itemType != "chart";
                    }
                },
                "string"
            ),
            makeExpressionProperty(
                {
                    name: "chartColorInverse",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup,
                    hideInPropertyGrid: (
                        component: AddToInstrumentHistoryActionComponent
                    ) => {
                        return component.itemType != "chart";
                    }
                },
                "string"
            ),
            makeExpressionProperty(
                {
                    name: "chartLabel",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup,
                    hideInPropertyGrid: (
                        component: AddToInstrumentHistoryActionComponent
                    ) => {
                        return component.itemType != "chart";
                    }
                },
                "string"
            ),
            makeExpressionProperty(
                {
                    name: "chartMajorSubdivisionHorizontal",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup,
                    hideInPropertyGrid: (
                        component: AddToInstrumentHistoryActionComponent
                    ) => {
                        return component.itemType != "chart";
                    }
                },
                "integer"
            ),
            makeExpressionProperty(
                {
                    name: "chartMajorSubdivisionVertical",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup,
                    hideInPropertyGrid: (
                        component: AddToInstrumentHistoryActionComponent
                    ) => {
                        return component.itemType != "chart";
                    }
                },
                "integer"
            ),
            makeExpressionProperty(
                {
                    name: "chartMinorSubdivisionHorizontal",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup,
                    hideInPropertyGrid: (
                        component: AddToInstrumentHistoryActionComponent
                    ) => {
                        return component.itemType != "chart";
                    }
                },
                "integer"
            ),
            makeExpressionProperty(
                {
                    name: "chartMinorSubdivisionVertical",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup,
                    hideInPropertyGrid: (
                        component: AddToInstrumentHistoryActionComponent
                    ) => {
                        return component.itemType != "chart";
                    }
                },
                "integer"
            ),
            makeExpressionProperty(
                {
                    name: "chartHorizontalScale",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup,
                    hideInPropertyGrid: (
                        component: AddToInstrumentHistoryActionComponent
                    ) => {
                        return component.itemType != "chart";
                    }
                },
                "double"
            ),
            makeExpressionProperty(
                {
                    name: "chartVerticalScale",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup,
                    hideInPropertyGrid: (
                        component: AddToInstrumentHistoryActionComponent
                    ) => {
                        return component.itemType != "chart";
                    }
                },
                "double"
            )
        ],
        defaultValue: {},
        icon: (
            <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 128 128"
                fill="currentColor"
            >
                <path d="M99 60H68V29h-8v39h39zM20 60h8v8h-8z" />
                <path d="M64 127c34.8 0 63-28.2 63-63S98.8 1 64 1 1 29.2 1 64s28.2 63 63 63zM64 9c30.3 0 55 24.7 55 55s-24.7 55-55 55S9 94.3 9 64 33.7 9 64 9z" />
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

            const chartDescription =
                context.evalProperty<string>("chartDescription");
            if (chartDescription == undefined) {
                context.throwError(`Invalid Chart description property`);
                return;
            }

            const chartData = context.evalProperty<Uint8Array>("chartData");
            if (chartData == undefined) {
                context.throwError(`Invalid Chart data property`);
                return;
            }

            const chartSamplingRate =
                context.evalProperty<number>("chartSamplingRate");
            if (chartSamplingRate == undefined) {
                context.throwError(`Invalid Chart sampling rate property`);
                return;
            }

            const chartOffset = context.evalProperty<number>("chartOffset");
            if (chartOffset == undefined) {
                context.throwError(`Invalid Chart offet property`);
                return;
            }

            const chartScale = context.evalProperty<number>("chartScale");
            if (chartScale == undefined) {
                context.throwError(`Invalid Chart scale property`);
                return;
            }

            const chartFormatStr = context.evalProperty<string>("chartFormat");
            if (chartFormatStr == undefined) {
                context.throwError(`Invalid Chart format property`);
                return;
            }
            let chartFormat =
                chartFormatStr == "float"
                    ? WaveformFormat.FLOATS_32BIT
                    : chartFormatStr == "double"
                    ? WaveformFormat.FLOATS_64BIT
                    : chartFormatStr == "rigol-byte"
                    ? WaveformFormat.RIGOL_BYTE
                    : chartFormatStr == "rigol-word"
                    ? WaveformFormat.RIGOL_WORD
                    : chartFormatStr == "csv"
                    ? WaveformFormat.CSV_STRING
                    : WaveformFormat.JS_NUMBERS;

            const chartUnit = context.evalProperty<string>("chartUnit");
            if (chartUnit == undefined) {
                context.throwError(`Invalid Chart unit property`);
                return;
            }

            const chartColor = context.evalProperty<string>("chartColor");
            if (chartColor == undefined) {
                context.throwError(`Invalid Chart color property`);
                return;
            }

            const chartColorInverse =
                context.evalProperty<string>("chartColorInverse");
            if (chartColorInverse == undefined) {
                context.throwError(`Invalid Chart color inverse property`);
                return;
            }

            const chartLabel = context.evalProperty<string>("chartLabel");
            if (chartLabel == undefined) {
                context.throwError(`Invalid Chart label property`);
                return;
            }

            const chartMajorSubdivisionHorizontal =
                context.evalProperty<number>("chartMajorSubdivisionHorizontal");
            if (chartMajorSubdivisionHorizontal == undefined) {
                context.throwError(
                    `Invalid Chart major subdivision horizontal property`
                );
                return;
            }

            const chartMajorSubdivisionVertical = context.evalProperty<number>(
                "chartMajorSubdivisionVertical"
            );
            if (chartMajorSubdivisionVertical == undefined) {
                context.throwError(
                    `Invalid Chart major subdivision vertical property`
                );
                return;
            }

            const chartMinorSubdivisionHorizontal =
                context.evalProperty<number>("chartMinorSubdivisionHorizontal");
            if (chartMinorSubdivisionHorizontal == undefined) {
                context.throwError(
                    `Invalid Chart minor subdivision horizontal property`
                );
                return;
            }

            const chartMinorSubdivisionVertical = context.evalProperty<number>(
                "chartMinorSubdivisionVertical"
            );
            if (chartMinorSubdivisionVertical == undefined) {
                context.throwError(
                    `Invalid Chart minor subdivision vertical property`
                );
                return;
            }

            const chartHorizontalScale = context.evalProperty<number>(
                "chartHorizontalScale"
            );
            if (chartHorizontalScale == undefined) {
                context.throwError(`Invalid Chart horizontal scale property`);
                return;
            }

            const chartVerticalScale =
                context.evalProperty<number>("chartVerticalScale");
            if (chartVerticalScale == undefined) {
                context.throwError(`Invalid Chart vertical scale property`);
                return;
            }

            const message: any = {
                state: "success",
                fileType: { mime: "application/eez-raw" },
                description: chartDescription,
                waveformDefinition: {
                    samplingRate: chartSamplingRate,
                    format: chartFormat,
                    unitName: chartUnit.toLowerCase(),
                    color: chartColor,
                    colorInverse: chartColorInverse,
                    label: chartLabel,
                    offset: chartOffset,
                    scale: chartScale
                },
                viewOptions: {
                    axesLines: {
                        type: "fixed",
                        majorSubdivision: {
                            horizontal: chartMajorSubdivisionHorizontal,
                            vertical: chartMajorSubdivisionVertical
                        },
                        minorSubdivision: {
                            horizontal: chartMinorSubdivisionHorizontal,
                            vertical: chartMinorSubdivisionVertical
                        }
                    }
                },
                horizontalScale: chartHorizontalScale,
                verticalScale: chartVerticalScale
            };

            message.dataLength = chartData.length;

            const historyId = log(
                activityLogStore,
                {
                    oid: instrument.id,
                    type: "instrument/file-download",
                    message: JSON.stringify(message),
                    data: chartData
                },
                {
                    undoable: false
                }
            );

            context.propagateValue("id", historyId);

            context.propagateValueThroughSeqout();
        }
    });

    instrument: string;
    itemType: string;

    chartDescription: string;
    chartData: string;
    chartSamplingRate: string;
    chartOffset: string;
    chartScale: string;
    chartFormat: string;
    chartUnit: string;
    chartColor: string;
    chartColorInverse: string;
    chartLabel: string;
    chartMajorSubdivisionHorizontal: string;
    chartMajorSubdivisionVertical: string;
    chartMinorSubdivisionHorizontal: string;
    chartMinorSubdivisionVertical: string;
    chartHorizontalScale: string;
    chartVerticalScale: string;

    constructor() {
        super();

        makeObservable(this, {
            instrument: observable,

            itemType: observable,

            chartDescription: observable,
            chartData: observable,
            chartSamplingRate: observable,
            chartOffset: observable,
            chartScale: observable,
            chartFormat: observable,
            chartUnit: observable,
            chartColor: observable,
            chartColorInverse: observable,
            chartLabel: observable,
            chartMajorSubdivisionHorizontal: observable,
            chartMajorSubdivisionVertical: observable,
            chartMinorSubdivisionHorizontal: observable,
            chartMinorSubdivisionVertical: observable,
            chartHorizontalScale: observable,
            chartVerticalScale: observable
        });
    }

    getInputs() {
        return [
            {
                name: "@seqin",
                type: "any" as ValueType,
                isSequenceInput: true,
                isOptionalInput: false
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
            {
                name: "id",
                type: "string",
                isSequenceOutput: false,
                isOptionalOutput: true
            },
            ...super.getOutputs()
        ];
    }
}

registerClass(
    "AddToInstrumentHistoryActionComponent",
    AddToInstrumentHistoryActionComponent
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
            ProjectEditor.getProjectStore(variable as any),
            variable.description || humanize(variable.fullName),
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

    getValue: (variableValue: any): IObjectVariableValue | null => {
        return instruments.get(variableValue.id) ?? null;
    },

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
