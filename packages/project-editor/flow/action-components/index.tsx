import React from "react";
import { observable, action, computed } from "mobx";
import { observer } from "mobx-react";

import { _find, _range } from "eez-studio-shared/algorithm";

import {
    registerClass,
    PropertyType,
    makeDerivedClassInfo,
    getClassInfo,
    PropertyInfo,
    specificGroup
} from "project-editor/core/object";
import { getDocumentStore } from "project-editor/core/store";

import type { IFlowContext } from "project-editor/flow/flow-interfaces";

import { styled } from "eez-studio-ui/styled-components";
import { guid } from "eez-studio-shared/guid";

import {
    ActionComponent,
    makeToggablePropertyToInput
} from "project-editor/flow/component";

import { instruments } from "instrument/instrument-object";
import { getConnection } from "instrument/window/connection";
import { getFlow } from "project-editor/project/project";
import { RunningFlow } from "../runtime";

////////////////////////////////////////////////////////////////////////////////

export class InputActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        properties: [
            {
                name: "name",
                type: PropertyType.String,
                propertyGridGroup: specificGroup
            }
        ],
        icon: (
            <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 875 1065.3333740234375"
            >
                <path d="M43 8.667l814 498q18 11 18 26t-18 26l-814 498q-18 11-30.5 4t-12.5-28v-1000q0-21 12.5-28t30.5 4z" />
            </svg>
        )
    });

    @observable name: string;

    async execute(runningFlow: RunningFlow) {
        return "@seqout";
    }
}

registerClass(InputActionComponent);

////////////////////////////////////////////////////////////////////////////////

export class OutputActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        properties: [
            {
                name: "name",
                type: PropertyType.String,
                propertyGridGroup: specificGroup
            }
        ],
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 900">
                <path d="M900 50v800q0 21-14.5 35.5T850 900H50q-21 0-35.5-14.5T0 850V50q0-21 14.5-35.5T50 0h800q21 0 35.5 14.5T900 50z" />
            </svg>
        )
    });

    @observable name: string;
}

registerClass(OutputActionComponent);

////////////////////////////////////////////////////////////////////////////////

const GetVariableBody = styled.div`
    text-align: center;
    background-color: #fffcf7 !important;
`;

export class GetVariableActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        properties: [
            {
                name: "variable",
                type: PropertyType.String,
                propertyGridGroup: specificGroup
            }
        ],
        icon: (
            <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 33.94000244140625 36.08000183105469"
            >
                <path d="M18.4 28h-5.306l-3.42-9.119c-.127-.337-.26-.962-.4-1.875h-.057l-.457 1.956L5.327 28H0l6.325-14L.558 0H5.99l2.831 8.394c.22.666.418 1.454.592 2.362h.057l.614-2.437L13.204 0h4.917L12.28 13.881 18.4 28zm15.54-10.667l-5.11 13.775c-1.22 3.315-3.055 4.972-5.506 4.972-.934 0-1.702-.169-2.304-.507v-3.04a2.917 2.917 0 0 0 1.65.507c.98 0 1.662-.476 2.047-1.429l.65-1.58-5.107-12.698h4.327l2.33 7.75c.146.484.26 1.052.341 1.707h.048l.404-1.678 2.355-7.779h3.875z" />
            </svg>
        )
    });

    @observable variable: string;

    @computed get body(): React.ReactNode {
        return (
            <GetVariableBody
                className="body"
                data-connection-output-id="variable"
            >
                <pre>{this.variable}</pre>
            </GetVariableBody>
        );
    }
}

registerClass(GetVariableActionComponent);

////////////////////////////////////////////////////////////////////////////////

const SetVariableBody = styled.div`
    display: flex;
`;

export class SetVariableActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        properties: [
            {
                name: "variable",
                type: PropertyType.String,
                propertyGridGroup: specificGroup
            },
            makeToggablePropertyToInput({
                name: "value",
                type: PropertyType.JSON,
                propertyGridGroup: specificGroup
            })
        ],
        icon: (
            <svg
                xmlns="http://www.w3.org/2000/svg"
                version="1.2"
                viewBox="0 0 16 11"
            >
                <path d="M14 0H2a2 2 0 0 0 0 4h12a2 2 0 0 0 0-4zm0 7H2a2 2 0 0 0 0 4h12a2 2 0 0 0 0-4z" />
            </svg>
        )
    });

    @observable variable: string;
    @observable value: string;

    @computed get body(): React.ReactNode {
        return (
            <SetVariableBody className="body">
                <div>
                    <pre>{this.variable}</pre>
                </div>
                <div style={{ padding: "0 10px" }}>🠔</div>
                <div style={{ textAlign: "left" }}>
                    <pre>{this.value}</pre>
                </div>
            </SetVariableBody>
        );
    }

    @action
    async execute(runningFlow: RunningFlow) {
        const DocumentStore = getDocumentStore(this);
        let value;
        if (this.isInputProperty("value")) {
            const inputPropertyValue = this.getInputPropertyValue("value");
            if (
                inputPropertyValue == undefined ||
                inputPropertyValue.value == undefined
            ) {
                throw `missing value input`;
            }
            value = inputPropertyValue.value;
        } else {
            value = this.value;
        }
        DocumentStore.dataContext.setValue(this.variable, value);
        return "@seqout";
    }
}

registerClass(SetVariableActionComponent);

////////////////////////////////////////////////////////////////////////////////

const DeclareVariableBody = styled.div`
    display: flex;
`;

export class DeclareVariableActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        properties: [
            {
                name: "variable",
                type: PropertyType.String,
                propertyGridGroup: specificGroup
            },
            makeToggablePropertyToInput({
                name: "value",
                type: PropertyType.JSON,
                propertyGridGroup: specificGroup
            })
        ],
        icon: (
            <svg
                xmlns="http://www.w3.org/2000/svg"
                version="1.2"
                viewBox="0 0 16 11"
            >
                <path d="M14 0H2a2 2 0 0 0 0 4h12a2 2 0 0 0 0-4zm0 7H2a2 2 0 0 0 0 4h12a2 2 0 0 0 0-4z" />
            </svg>
        )
    });

    @observable variable: string;
    @observable value: string;

    @computed get body(): React.ReactNode {
        return (
            <DeclareVariableBody className="body">
                <div>
                    <pre>{this.variable}</pre>
                </div>
                {!this.isInputProperty("value") && (
                    <>
                        <div style={{ padding: "0 10px" }}>🠔</div>
                        <div style={{ textAlign: "left" }}>
                            <pre>{this.value}</pre>
                        </div>
                    </>
                )}
            </DeclareVariableBody>
        );
    }

    @action
    async execute(runningFlow: RunningFlow) {
        const DocumentStore = getDocumentStore(this);
        let value;
        if (this.isInputProperty("value")) {
            const inputPropertyValue = this.getInputPropertyValue("value");
            if (
                inputPropertyValue == undefined ||
                inputPropertyValue.value == undefined
            ) {
                throw `missing value input`;
            }
            value = inputPropertyValue.value;
        } else {
            value = this.value;
        }
        DocumentStore.dataContext.setValue(this.variable, value);
        return "@seqout";
    }
}

registerClass(DeclareVariableActionComponent);

////////////////////////////////////////////////////////////////////////////////

export class CompareActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        icon: (
            <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 594.8059692382812 1200.2340087890625"
            >
                <path d="M285.206.234C188.053 0 11.212 93.504 5.606 176.634c-5.606 83.13 11.325 88.253 19.2 92.8h91.2c20.839-47.054 46.22-74.561 112.8-74s139.612 83.846 108.8 157.6c-30.813 73.754-59.285 99.443-97.2 179.2-37.914 79.757-50.579 200.231-.8 300.4l112.4 2c-27.82-142.988 119.44-270.381 178-358.4 58.559-88.019 64.125-121.567 64.8-194.4-.516-69.114-25.544-138.181-80-194.4S382.358.468 285.206.234zm5.599 927.601c-75.174 0-136 60.825-136 135.999 0 75.175 60.826 136.4 136 136.4 75.175 0 136-61.226 136-136.4s-60.825-135.999-136-135.999z" />
            </svg>
        )
    });
}

registerClass(CompareActionComponent);

////////////////////////////////////////////////////////////////////////////////

export class ConstantActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        properties: [
            {
                name: "value",
                type: PropertyType.JSON,
                propertyGridGroup: specificGroup
            }
        ],
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 44">
                <path d="M4 8H0v32c0 2.21 1.79 4 4 4h32v-4H4V8zm22 20h4V8h-8v4h4v16zM40 0H12C9.79 0 8 1.79 8 4v28c0 2.21 1.79 4 4 4h28c2.21 0 4-1.79 4-4V4c0-2.21-1.79-4-4-4zm0 32H12V4h28v28z" />
            </svg>
        )
    });

    @observable value: string;

    @computed get outputs(): PropertyInfo[] {
        return [
            {
                name: "value",
                displayName: this.value,
                type: PropertyType.Any
            }
        ];
    }

    onStart(runningFlow: RunningFlow) {
        runningFlow.propagateValue(this, "value", JSON.parse(this.value));
    }
}

registerClass(ConstantActionComponent);

////////////////////////////////////////////////////////////////////////////////

const ScpiBody = styled.div``;

export class ScpiActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        properties: [
            {
                name: "instrument",
                type: PropertyType.String,
                propertyGridGroup: specificGroup
            },
            {
                name: "scpi",
                type: PropertyType.MultilineText,
                propertyGridGroup: specificGroup
            }
        ],
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 7 7">
                <path d="M1.5 0C.67 0 0 .67 0 1.5S.67 3 1.5 3H2v1h-.5C.67 4 0 4.67 0 5.5S.67 7 1.5 7 3 6.33 3 5.5V5h1v.5C4 6.33 4.67 7 5.5 7S7 6.33 7 5.5 6.33 4 5.5 4H5V3h.5C6.33 3 7 2.33 7 1.5S6.33 0 5.5 0 4 .67 4 1.5V2H3v-.5C3 .67 2.33 0 1.5 0zm0 1c.28 0 .5.22.5.5V2h-.5c-.28 0-.5-.22-.5-.5s.22-.5.5-.5zm4 0c.28 0 .5.22.5.5s-.22.5-.5.5H5v-.5c0-.28.22-.5.5-.5zM3 3h1v1H3V3zM1.5 5H2v.5c0 .28-.22.5-.5.5S1 5.78 1 5.5s.22-.5.5-.5zM5 5h.5c.28 0 .5.22.5.5s-.22.5-.5.5-.5-.22-.5-.5V5z" />
            </svg>
        ),
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
        }
    });

    @observable instrument: string;
    @observable scpi: string;

    static readonly COMMAND_REGEXP = /\{([^\}]+)\}/;
    static readonly QUERY_REGEXP = /(?<outputName>[^\s]+)\s*=\s*(?<query>.+\?)/;

    static parse(scpi: string) {
        const lines = scpi?.split("\n") ?? [];
        const inputs: string[] = [];
        const outputs: string[] = [];
        lines.forEach(commandOrQueriesLine => {
            const commandOrQueries = commandOrQueriesLine.split(";");
            commandOrQueries.forEach(commandOrQuery => {
                commandOrQuery = commandOrQuery.trim();
                const matches = ScpiActionComponent.QUERY_REGEXP.exec(
                    commandOrQuery
                );
                if (matches) {
                    const output = matches.groups!.outputName.trim();
                    outputs.push(output);
                } else {
                    ScpiActionComponent.COMMAND_REGEXP.lastIndex = 0;
                    let str = commandOrQuery;
                    while (true) {
                        let matches = str.match(
                            ScpiActionComponent.COMMAND_REGEXP
                        );
                        if (!matches) {
                            break;
                        }
                        const input = matches[1].trim();
                        inputs.push(input);
                        str = str.substring(matches.index! + matches[1].length);
                    }
                }
            });
        });
        return { inputs, outputs };
    }

    @computed get inputs() {
        return [
            ...super.inputProperties,
            ...ScpiActionComponent.parse(this.scpi).inputs.map(input => ({
                name: input,
                displayName: input,
                type: PropertyType.Any
            }))
        ];
    }

    @computed get outputs() {
        return [
            ...super.outputProperties,
            ...ScpiActionComponent.parse(this.scpi).outputs.map(output => ({
                name: output,
                displayName: output,
                type: PropertyType.Any
            }))
        ];
    }

    async execute(runningFlow: RunningFlow) {
        const instrument = instruments.get(this.instrument);
        if (!instrument) {
            throw "instrument not found";
        }

        const editor = instrument.getEditor();

        if (!editor || !editor.instrument) {
            throw "instrument not connected";
        }

        const connection = getConnection(editor);
        if (!connection || !connection.isConnected) {
            throw "instrument not connected";
        }

        connection.acquire(false);

        try {
            const lines = this.scpi?.split("\n") ?? [];
            for (let i = 0; i < lines.length; i++) {
                const commandOrQueriesLine = lines[i];
                const commandOrQueries = commandOrQueriesLine.split(";");
                for (let j = 0; j < commandOrQueries.length; j++) {
                    const commandOrQuery = commandOrQueries[j].trim();
                    const matches = ScpiActionComponent.QUERY_REGEXP.exec(
                        commandOrQuery
                    );
                    if (matches) {
                        const output = matches.groups!.outputName.trim();
                        const query = matches.groups!.query.trim();
                        const result = await connection.query(query);
                        runningFlow.propagateValue(this, output, result);
                    } else {
                        let command = commandOrQuery;
                        let str = command;
                        ScpiActionComponent.COMMAND_REGEXP.lastIndex = 0;
                        while (true) {
                            let matches = str.match(
                                ScpiActionComponent.COMMAND_REGEXP
                            );
                            if (!matches) {
                                break;
                            }

                            const input = matches[1].trim();
                            const inputPropertyValue = this.getInputPropertyValue(
                                input
                            );
                            if (
                                inputPropertyValue &&
                                inputPropertyValue.value != undefined
                            ) {
                                const value = inputPropertyValue.value;

                                const i = matches.index!;

                                command =
                                    command.substring(0, i) +
                                    value +
                                    command.substring(
                                        i + matches[1].length + 2
                                    );
                                str = command.substring(i + value.length);
                            } else {
                                throw `missing scpi parameter ${input}`;
                            }
                        }

                        connection.command(command);
                    }
                }
            }
        } finally {
            connection.release();
        }

        return "@seqout";
    }

    @computed get body(): React.ReactNode {
        return (
            <ScpiBody className="body">
                <p>[{this.instrument}]</p>
                <pre>{this.scpi}</pre>
            </ScpiBody>
        );
    }
}

registerClass(ScpiActionComponent);

////////////////////////////////////////////////////////////////////////////////

export class OpenPageActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        properties: [],
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 30">
                <path d="M0 0h40v30H0V0zm36 8H4v18h32V8z" />
            </svg>
        )
    });
}

registerClass(OpenPageActionComponent);

////////////////////////////////////////////////////////////////////////////////

export class ClosePageActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        properties: [],
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 30">
                <path d="M0 0h40v30H0V0zm36 8H4v18h32V8zm-23.273 4.96l3.232-3.233L20 13.767l4.04-4.04 3.233 3.232L23.233 17l4.04 4.04-3.232 3.233L20 20.233l-4.04 4.04-3.233-3.232L16.767 17l-4.04-4.04z" />
            </svg>
        )
    });
}

registerClass(ClosePageActionComponent);

////////////////////////////////////////////////////////////////////////////////

const TrixEditorDiv = styled.div`
    position: absolute;
    background-color: #ffff88;
    border: 1px solid ${props => props.theme.borderColor};
    box-shadow: 2px 2px 4px rgba(128, 128, 128, 0.4);
    padding: 5px;
    .trix-button-group {
        border: none !important;
        margin-bottom: 5px;
    }
    .trix-button {
        border: none !important;
        font-size: 80%;
    }
    trix-editor {
        border: 1px solid ${props => props.theme.borderColor};
    }
    trix-toolbar .trix-button-group:not(:first-child) {
        margin-left: 5px;
    }
    &:focus {
        trix-toolbar {
            visibility: hidden;
        }
    }
`;

const TrixEditor = observer(
    ({
        value,
        setValue
    }: {
        value: string;
        setValue: (value: string) => void;
    }) => {
        const inputId = React.useMemo<string>(() => guid(), []);
        const editorId = React.useMemo<string>(() => guid(), []);

        React.useEffect(() => {
            const trixEditor = document.getElementById(editorId) as HTMLElement;

            if (value != trixEditor.innerHTML) {
                // console.log(
                //     `update trix "${value}" -> "${trixEditor.innerHTML}"`
                // );
                (trixEditor as any).editor.loadHTML(value);
            }

            const onBlur = (e: any) => {
                if (trixEditor.innerHTML != value) {
                    // console.log(
                    //     `fromTrix "${trixEditor.innerHTML}" -> "${value}"`
                    // );
                    setValue(trixEditor.innerHTML);
                }
            };
            trixEditor.addEventListener("trix-blur", onBlur, false);

            return () => {
                trixEditor.removeEventListener("trix-blur", onBlur, false);
            };
        }, [value]);

        var attributes: { [key: string]: string } = {
            id: editorId,
            input: inputId
        };

        return (
            <TrixEditorDiv
                className="eez-flow-editor-capture-pointers"
                tabIndex={0}
            >
                {React.createElement("trix-editor", attributes)}
                <input id={inputId} value={value ?? ""} type="hidden"></input>
            </TrixEditorDiv>
        );
    }
);

export class CommentActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        properties: [
            {
                name: "text",
                type: PropertyType.String
            }
        ],
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 14 13.5">
                <path d="M13 0H1C.45 0 0 .45 0 1v8c0 .55.45 1 1 1h2v3.5L6.5 10H13c.55 0 1-.45 1-1V1c0-.55-.45-1-1-1zm0 9H6l-2 2V9H1V1h12v8z" />
            </svg>
        )
    });

    @observable text: string;

    render(flowContext: IFlowContext) {
        const classInfo = getClassInfo(this);

        return (
            <>
                <div className="title-enclosure">
                    <div className="title">
                        {typeof classInfo.icon == "string" ? (
                            <img src={classInfo.icon} />
                        ) : (
                            classInfo.icon
                        )}
                    </div>
                </div>
                <div className="body">
                    <TrixEditor
                        value={this.text}
                        setValue={action((value: string) => {
                            const DocumentStore = getDocumentStore(this);
                            DocumentStore.updateObject(this, {
                                text: value
                            });
                        })}
                    ></TrixEditor>
                </div>
            </>
        );
    }
}

registerClass(CommentActionComponent);
