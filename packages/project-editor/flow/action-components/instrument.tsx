import React from "react";
import { observable, computed, action } from "mobx";
import { observer } from "mobx-react";

import { _find, _range } from "eez-studio-shared/algorithm";

import {
    registerClass,
    PropertyType,
    makeDerivedClassInfo,
    specificGroup
} from "project-editor/core/object";

import { styled } from "eez-studio-ui/styled-components";
import { Dialog, showDialog } from "eez-studio-ui/dialog";
import { IListNode, ListItem } from "eez-studio-ui/list";
import { PropertyList, SelectFromListProperty } from "eez-studio-ui/properties";

import { InstrumentObject, instruments } from "instrument/instrument-object";

import {
    ActionComponent,
    makeToggablePropertyToInput
} from "project-editor/flow/component";
import { getConnection } from "instrument/window/connection";
import { getFlow } from "project-editor/project/project";
import { RunningFlow } from "project-editor/flow//runtime";
import type {
    IFlowContext,
    IRunningFlow
} from "project-editor/flow//flow-interfaces";
import { workbenchObjects } from "home/store";

////////////////////////////////////////////////////////////////////////////////

const ScpiDiv = styled.div`
    padding-top: 0 !important;
    & > div:first-child {
        white-space: nowrap;
        border-bottom: 1px solid ${props => props.theme.borderColor};
    }
`;

export class ScpiActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        properties: [
            makeToggablePropertyToInput({
                name: "instrument",
                type: PropertyType.String,
                propertyGridGroup: specificGroup
            }),
            {
                name: "scpi",
                type: PropertyType.MultilineText,
                propertyGridGroup: specificGroup
            }
        ],
        label: (component: ScpiActionComponent) => {
            const label = ActionComponent.classInfo.label!(component);
            if (!component.isInputProperty("instrument")) {
                return `${label} ${component.instrument}`;
            }
            return label;
        },
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 7 7">
                <path d="M1.5 0C.67 0 0 .67 0 1.5S.67 3 1.5 3H2v1h-.5C.67 4 0 4.67 0 5.5S.67 7 1.5 7 3 6.33 3 5.5V5h1v.5C4 6.33 4.67 7 5.5 7S7 6.33 7 5.5 6.33 4 5.5 4H5V3h.5C6.33 3 7 2.33 7 1.5S6.33 0 5.5 0 4 .67 4 1.5V2H3v-.5C3 .67 2.33 0 1.5 0zm0 1c.28 0 .5.22.5.5V2h-.5c-.28 0-.5-.22-.5-.5s.22-.5.5-.5zm4 0c.28 0 .5.22.5.5s-.22.5-.5.5H5v-.5c0-.28.22-.5.5-.5zM3 3h1v1H3V3zM1.5 5H2v.5c0 .28-.22.5-.5.5S1 5.78 1 5.5s.22-.5.5-.5zM5 5h.5c.28 0 .5.22.5.5s-.22.5-.5.5-.5-.22-.5-.5V5z" />
            </svg>
        ),
        componentHeaderColor: "#FDD0A2",
        updateObjectValueHook: (object: ScpiActionComponent, values: any) => {
            if (values.scpi) {
                const {
                    inputs: inputsBefore,
                    outputs: outputsBefore
                } = ScpiActionComponent.parse(object.scpi);

                const {
                    inputs: inputsAfter,
                    outputs: outputsAfter
                } = ScpiActionComponent.parse(values.scpi);

                const flow = getFlow(object);

                inputsBefore.forEach((inputBefore, i) => {
                    if (inputsAfter.indexOf(inputBefore) === -1) {
                        if (inputsBefore.length === inputsAfter.length) {
                            flow.rerouteConnectionLinesInput(
                                object,
                                inputBefore,
                                inputsAfter[i]
                            );
                        } else {
                            flow.deleteConnectionLinesToInput(
                                object,
                                inputBefore
                            );
                        }
                    }
                });

                outputsBefore.forEach((outputBefore, i) => {
                    if (outputsAfter.indexOf(outputBefore) === -1) {
                        if (outputsBefore.length === outputsAfter.length) {
                            flow.rerouteConnectionLinesOutput(
                                object,
                                outputBefore,
                                outputsAfter[i]
                            );
                        } else {
                            flow.deleteConnectionLinesFromOutput(
                                object,
                                outputBefore
                            );
                        }
                    }
                });
            }
        },
        componentPaletteGroupName: "Instrument"
    });

    @observable instrument: string;
    @observable scpi: string;

    static readonly PARAMS_REGEXP = /\{([^\}]+)\}/;
    static readonly QUERY_WITH_ASSIGNMENT_REGEXP = /(?<outputName>[^\s]+)\s*=\s*(?<query>.+\?)(?<params>.*)/;
    static readonly QUERY_REGEXP = /(?<query>.+\?)(?<params>.*)/;

    static parse(scpi: string) {
        const inputs = new Set<string>();
        const outputs = new Set<string>();

        const lines = scpi?.split("\n") ?? [];
        lines.forEach(commandOrQueriesLine => {
            const commandOrQueries = commandOrQueriesLine.split(";");
            commandOrQueries.forEach(commandOrQuery => {
                commandOrQuery = commandOrQuery.trim();

                ScpiActionComponent.PARAMS_REGEXP.lastIndex = 0;
                let str = commandOrQuery;
                while (true) {
                    let matches = str.match(ScpiActionComponent.PARAMS_REGEXP);
                    if (!matches) {
                        break;
                    }
                    const input = matches[1].trim();
                    inputs.add(input);
                    str = str.substring(matches.index! + matches[1].length);
                }

                const matches = ScpiActionComponent.QUERY_WITH_ASSIGNMENT_REGEXP.exec(
                    commandOrQuery
                );
                if (matches) {
                    const output = matches.groups!.outputName.trim();
                    outputs.add(output);
                }
            });
        });

        return {
            inputs: Array.from(inputs.keys()),
            outputs: Array.from(outputs.keys())
        };
    }

    @computed get inputs() {
        return [
            ...super.inputs,
            ...ScpiActionComponent.parse(this.scpi).inputs.map(input => ({
                name: input,
                displayName: input,
                type: PropertyType.Any
            }))
        ];
    }

    @computed get outputs() {
        return [
            ...super.outputs,
            ...ScpiActionComponent.parse(this.scpi).outputs.map(output => ({
                name: output,
                displayName: output,
                type: PropertyType.Any
            }))
        ];
    }

    getInstrumentObject(
        flowContext?: IFlowContext,
        runningFlow?: IRunningFlow
    ): InstrumentObject | undefined {
        runningFlow = runningFlow || flowContext?.runningFlow;

        if (this.isInputProperty("instrument")) {
            if (runningFlow) {
                const inputPropertyValue = runningFlow.getInputPropertyValue(
                    this,
                    "instrument"
                );
                return inputPropertyValue?.value;
            }
        } else {
            const dataContext =
                runningFlow?.dataContext || flowContext?.dataContext;
            if (dataContext) {
                return dataContext.get(this.instrument);
            }
        }

        return undefined;
    }

    async execute(runningFlow: RunningFlow) {
        const instrument = this.getInstrumentObject(undefined, runningFlow);
        if (!instrument) {
            throw "instrument not found";
        }

        const editor = instrument.getEditor();

        if (!editor || !editor.instrument) {
            editor.onCreate();
            await new Promise<void>(resolve => {
                const intervalId = setInterval(() => {
                    if (editor.instrument) {
                        clearInterval(intervalId);
                        resolve();
                    }
                }, 50);
            });
        }

        const connection = getConnection(editor);
        if (!connection || !connection.isConnected) {
            throw "instrument not connected";
        }

        await connection.acquire(false);

        try {
            const lines = this.scpi?.split("\n") ?? [];
            for (let i = 0; i < lines.length; i++) {
                const commandOrQueriesLine = lines[i];
                const commandOrQueries = commandOrQueriesLine.split(";");
                let offset = 0;
                for (let j = 0; j < commandOrQueries.length; j++) {
                    const commandOrQuery = commandOrQueries[j].trim();

                    let command = commandOrQuery;
                    ScpiActionComponent.PARAMS_REGEXP.lastIndex = 0;
                    while (true) {
                        let matches = command.substring(offset).match(
                            ScpiActionComponent.PARAMS_REGEXP
                        );
                        if (!matches) {
                            break;
                        }

                        const input = matches[1].trim();
                        const inputPropertyValue = runningFlow.getInputPropertyValue(
                            this,
                            input
                        );
                        if (
                            inputPropertyValue &&
                            inputPropertyValue.value != undefined
                        ) {
                            const value = inputPropertyValue.value;

                            const i = offset + matches.index!;

                            command =
                                command.substring(0, i) +
                                value +
                                command.substring(i + matches[1].length + 2);

                            offset = i + value.length;
                        } else {
                            throw `missing scpi parameter ${input}`;
                        }
                    }

                    const matches = ScpiActionComponent.QUERY_WITH_ASSIGNMENT_REGEXP.exec(
                        command
                    );

                    if (matches) {
                        const output = matches.groups!.outputName.trim();
                        const query = matches.groups!.query.trim();
                        const params = matches.groups!.params.trim();
                        console.log(
                            `SCPI QUERY [${instrument.name}]:`,
                            `${query} ${params}`
                        );
                        let result = await connection.query(
                            `${query} ${params}`
                        );
                        console.log(
                            `SCPI QUERY RESULT [${instrument.name}]:`,
                            result
                        );
                        if (typeof result === "object" && result.error) {
                            throw result.error;
                        }

                        if (
                            result &&
                            result.length >= 2 &&
                            result[0] === '"' &&
                            result.slice(-1) === '"'
                        ) {
                            result = result.slice(1, -1);
                        }

                        runningFlow.propagateValue(this, output, result);
                    } else {
                        if (command.length > 0) {
                            const matches = ScpiActionComponent.QUERY_REGEXP.exec(
                                command
                            );
                            if (matches) {
                                console.log(
                                    `SCPI QUERY [${instrument.name}]:`,
                                    command
                                );
                                const result = await connection.query(command);
                                console.log(
                                    `SCPI QUERY RESULT [${instrument.name}]:`,
                                    result
                                );
                                if (
                                    typeof result === "object" &&
                                    result.error
                                ) {
                                    throw result.error;
                                }
                            } else {
                                console.log(
                                    `SCPI COMMAND [${instrument.name}]:`,
                                    command
                                );
                                connection.command(command);
                            }
                        }
                    }
                }
            }
        } finally {
            connection.release();
        }
        return undefined;
    }

    getBody(flowContext: IFlowContext): React.ReactNode {
        return (
            <ScpiDiv className="body">
                <pre>{this.scpi}</pre>
            </ScpiDiv>
        );
    }
}

registerClass(ScpiActionComponent);

////////////////////////////////////////////////////////////////////////////////

@observer
class SelectInstrumentDialog extends React.Component<
    {
        callback: (instrument: InstrumentObject | undefined) => void;
    },
    {}
> {
    @observable selectedInstrument: any;

    renderNode(node: IListNode<InstrumentObject>) {
        let instrument = node.data;
        return (
            <ListItem
                leftIcon={instrument.image}
                leftIconSize={48}
                label={instrument.name}
            />
        );
    }

    @computed
    get instrumentNodes() {
        const instrumentObjects = [];

        for (let [_, workbenchObject] of workbenchObjects) {
            const instrument = instruments.get(workbenchObject.oid);
            if (instrument) {
                instrumentObjects.push(instrument);
            }
        }

        instrumentObjects.sort((a, b) =>
            a.name.toLocaleLowerCase().localeCompare(b.name.toLocaleLowerCase())
        );

        return instrumentObjects.map(instrument => ({
            id: instrument.id,
            data: instrument,
            selected:
                this.selectedInstrument &&
                instrument.id === this.selectedInstrument.id
        }));
    }

    @action.bound
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
                        name="Select instrument:"
                        nodes={this.instrumentNodes}
                        renderNode={this.renderNode}
                        onChange={this.selectInstrumentExtension}
                    />
                </PropertyList>
            </Dialog>
        );
    }
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

    @computed get outputs() {
        return [
            ...super.outputs,
            {
                name: "instrument",
                type: PropertyType.Any
            }
        ];
    }

    async execute(runningFlow: RunningFlow) {
        await new Promise<void>(resolve => {
            showDialog(
                <SelectInstrumentDialog
                    callback={instrument => {
                        if (instrument) {
                            runningFlow.propagateValue(
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

registerClass(SelectInstrumentActionComponent);

////////////////////////////////////////////////////////////////////////////////

export class GetInstrumentActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        properties: [],
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 448">
                <path d="M224 144c-44.004 0-80.001 36-80.001 80 0 44.004 35.997 80 80.001 80 44.005 0 79.999-35.996 79.999-80 0-44-35.994-80-79.999-80zm190.938 58.667c-9.605-88.531-81.074-160-169.605-169.599V0h-42.666v33.067c-88.531 9.599-160 81.068-169.604 169.599H0v42.667h33.062c9.604 88.531 81.072 160 169.604 169.604V448h42.666v-33.062c88.531-9.604 160-81.073 169.605-169.604H448v-42.667h-33.062zM224 373.333c-82.137 0-149.334-67.198-149.334-149.333 0-82.136 67.197-149.333 149.334-149.333 82.135 0 149.332 67.198 149.332 149.333S306.135 373.333 224 373.333z" />
            </svg>
        ),
        componentHeaderColor: "#FDD0A2",
        componentPaletteGroupName: "Instrument"
    });

    @computed get inputs() {
        return [
            ...super.inputs,
            {
                name: "id",
                type: PropertyType.String
            }
        ];
    }

    @computed get outputs() {
        return [
            ...super.outputs,
            {
                name: "instrument",
                type: PropertyType.Any
            }
        ];
    }

    async execute(runningFlow: RunningFlow) {
        let instrument;

        const inputPropertyValue = runningFlow.getInputPropertyValue(
            this,
            "id"
        );

        if (inputPropertyValue) {
            const id = inputPropertyValue.value;
            instrument = instruments.get(id);
        }

        runningFlow.propagateValue(this, "instrument", instrument);

        return undefined;
    }
}

registerClass(GetInstrumentActionComponent);

////////////////////////////////////////////////////////////////////////////////

export class ConnectInstrumentActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        properties: [
            makeToggablePropertyToInput({
                name: "instrument",
                type: PropertyType.String,
                propertyGridGroup: specificGroup
            })
        ],
        label: (component: ScpiActionComponent) => {
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

    @observable instrument: string;

    getInstrumentObject(
        flowContext?: IFlowContext,
        runningFlow?: IRunningFlow
    ): InstrumentObject | undefined {
        runningFlow = runningFlow || flowContext?.runningFlow;

        if (this.isInputProperty("instrument")) {
            if (runningFlow) {
                const inputPropertyValue = runningFlow.getInputPropertyValue(
                    this,
                    "instrument"
                );
                return inputPropertyValue?.value;
            }
        } else {
            const dataContext =
                runningFlow?.dataContext || flowContext?.dataContext;
            if (dataContext) {
                return dataContext.get(this.instrument);
            }
        }

        return undefined;
    }

    async execute(runningFlow: RunningFlow) {
        const instrument = this.getInstrumentObject(undefined, runningFlow);
        if (!instrument) {
            throw "instrument not found";
        }

        instrument.connection.connect();

        return undefined;
    }
}

registerClass(ConnectInstrumentActionComponent);
