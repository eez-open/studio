import React from "react";
import { observable, action, autorun, runInAction } from "mobx";
import { observer } from "mobx-react";

import { _find, _range } from "eez-studio-shared/algorithm";

import {
    registerClass,
    PropertyType,
    makeDerivedClassInfo,
    PropertyInfo,
    specificGroup,
    IEezObject
} from "project-editor/core/object";
import { getDocumentStore } from "project-editor/core/store";

import type { IFlowContext } from "project-editor/flow/flow-interfaces";

import { styled } from "eez-studio-ui/styled-components";
import { guid } from "eez-studio-shared/guid";

import {
    ActionComponent,
    makeToggablePropertyToInput
} from "project-editor/flow/component";

import { RunningFlow } from "project-editor/flow/runtime";
import { findAction } from "project-editor/features/action/action";
import { getFlow, getProject } from "project-editor/project/project";
import { onSelectItem } from "project-editor/components/SelectItem";
import { findPage } from "project-editor/features/page/page";
import { Assets, DataBuffer } from "project-editor/features/page/build/assets";
import {
    buildAssignableExpression,
    evalConstantExpression
} from "project-editor/flow/expression";

const LeftArrow = () => (
    <div style={{ marginTop: -2, padding: "0 8px" }}>
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            strokeWidth="2"
            stroke="currentColor"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
            <line x1="5" y1="12" x2="19" y2="12"></line>
            <line x1="5" y1="12" x2="9" y2="16"></line>
            <line x1="5" y1="12" x2="9" y2="8"></line>
        </svg>
    </div>
);
////////////////////////////////////////////////////////////////////////////////

export class StartActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        flowComponentId: 1001,

        icon: (
            <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 10.699999809265137 12"
            >
                <path d="M.5 12c-.3 0-.5-.2-.5-.5V.5C0 .2.2 0 .5 0s.5.2.5.5v11c0 .3-.2.5-.5.5zm10.2-6L4 2v8l6.7-4z" />
            </svg>
        ),
        componentHeaderColor: "#74c8ce"
    });
}

registerClass(StartActionComponent);

////////////////////////////////////////////////////////////////////////////////

export class EndActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        flowComponentId: 1002,

        icon: (
            <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 10.699999809265137 12"
            >
                <path d="M6.7 6L0 2v8l6.7-4zm3.5 6c-.3 0-.5-.2-.5-.5V.5c0-.3.2-.5.5-.5s.5.2.5.5v11c0 .3-.3.5-.5.5z" />
            </svg>
        ),
        componentHeaderColor: "#74c8ce"
    });

    async execute(runningFlow: RunningFlow) {
        if (runningFlow.parentRunningFlow && runningFlow.component) {
            runningFlow.parentRunningFlow.propagateValue(
                runningFlow.component,
                "@seqout",
                null
            );
        }
        return undefined;
    }
}

registerClass(EndActionComponent);

////////////////////////////////////////////////////////////////////////////////

export class InputActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        flowComponentId: 1003,

        properties: [
            {
                name: "name",
                type: PropertyType.String,
                propertyGridGroup: specificGroup
            }
        ],
        label: (component: InputActionComponent) => {
            if (!component.name) {
                return ActionComponent.classInfo.label!(component);
            }
            return component.name;
        },
        icon: (
            <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                <path d="M7 4v16l13 -8z"></path>
            </svg>
        ),
        componentHeaderColor: "#abc2a6"
    });

    @observable name: string;
}

registerClass(InputActionComponent);

////////////////////////////////////////////////////////////////////////////////

export class OutputActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        flowComponentId: 1004,

        properties: [
            {
                name: "name",
                type: PropertyType.String,
                propertyGridGroup: specificGroup
            }
        ],
        label: (component: OutputActionComponent) => {
            if (!component.name) {
                return ActionComponent.classInfo.label!(component);
            }
            return component.name;
        },
        icon: (
            <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                <rect x="5" y="5" width="14" height="14" rx="2"></rect>
            </svg>
        ),
        componentHeaderColor: "#abc2a6"
    });

    @observable name: string;

    async execute(runningFlow: RunningFlow) {
        const componentState = runningFlow.getComponentState(this);
        const value = componentState.getInputValue("@seqin");
        if (
            value &&
            runningFlow.parentRunningFlow &&
            runningFlow.component &&
            this.name
        ) {
            runningFlow.parentRunningFlow.propagateValue(
                runningFlow.component,
                this.wireID,
                value.value,
                this.name
            );
        }
        return undefined;
    }
}

registerClass(OutputActionComponent);

////////////////////////////////////////////////////////////////////////////////

export class GetVariableActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        flowComponentId: 1005,

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
                width="24"
                height="24"
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                <path d="M5 4c-2.5 5 -2.5 10 0 16m14 -16c2.5 5 2.5 10 0 16m-10 -11h1c1 0 1 1 2.016 3.527c.984 2.473 .984 3.473 1.984 3.473h1"></path>
                <path d="M8 16c1.5 0 3 -2 4 -3.5s2.5 -3.5 4 -3.5"></path>
            </svg>
        ),
        componentHeaderColor: "#A6BBCF"
    });

    @observable variable: string;

    getOutputs() {
        return [
            ...super.getOutputs(),
            {
                name: "variable",
                displayName: (component: GetVariableActionComponent) =>
                    component.variable,
                type: PropertyType.Any
            }
        ];
    }

    async execute(runningFlow: RunningFlow, dispose: (() => void) | undefined) {
        if (dispose) {
            return dispose;
        }

        let first = true;
        let lastValue: any = undefined;

        return autorun(() => {
            if (runningFlow.isVariableDeclared(this, this.variable)) {
                const value = runningFlow.getVariable(this, this.variable);
                if (first || value !== lastValue) {
                    first = false;
                    lastValue = value;
                    runningFlow.propagateValue(this, "variable", value);
                }
            }
        });
    }
}

registerClass(GetVariableActionComponent);

////////////////////////////////////////////////////////////////////////////////

export class EvalActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        flowComponentId: 1006,

        properties: [
            {
                name: "expression",
                type: PropertyType.MultilineText,
                propertyGridGroup: specificGroup
            }
        ],
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1664 1792">
                <path d="M384 1536q0-53-37.5-90.5T256 1408t-90.5 37.5T128 1536t37.5 90.5T256 1664t90.5-37.5T384 1536zm384 0q0-53-37.5-90.5T640 1408t-90.5 37.5T512 1536t37.5 90.5T640 1664t90.5-37.5T768 1536zm-384-384q0-53-37.5-90.5T256 1024t-90.5 37.5T128 1152t37.5 90.5T256 1280t90.5-37.5T384 1152zm768 384q0-53-37.5-90.5T1024 1408t-90.5 37.5T896 1536t37.5 90.5 90.5 37.5 90.5-37.5 37.5-90.5zm-384-384q0-53-37.5-90.5T640 1024t-90.5 37.5T512 1152t37.5 90.5T640 1280t90.5-37.5T768 1152zM384 768q0-53-37.5-90.5T256 640t-90.5 37.5T128 768t37.5 90.5T256 896t90.5-37.5T384 768zm768 384q0-53-37.5-90.5T1024 1024t-90.5 37.5T896 1152t37.5 90.5 90.5 37.5 90.5-37.5 37.5-90.5zM768 768q0-53-37.5-90.5T640 640t-90.5 37.5T512 768t37.5 90.5T640 896t90.5-37.5T768 768zm768 768v-384q0-52-38-90t-90-38-90 38-38 90v384q0 52 38 90t90 38 90-38 38-90zm-384-768q0-53-37.5-90.5T1024 640t-90.5 37.5T896 768t37.5 90.5T1024 896t90.5-37.5T1152 768zm384-320V192q0-26-19-45t-45-19H192q-26 0-45 19t-19 45v256q0 26 19 45t45 19h1280q26 0 45-19t19-45zm0 320q0-53-37.5-90.5T1408 640t-90.5 37.5T1280 768t37.5 90.5T1408 896t90.5-37.5T1536 768zm128-640v1536q0 52-38 90t-90 38H128q-52 0-90-38t-38-90V128q0-52 38-90t90-38h1408q52 0 90 38t38 90z" />
            </svg>
        ),
        componentHeaderColor: "#A6BBCF",
        updateObjectValueHook: (object: EvalActionComponent, values: any) => {
            if (values.expression) {
                const { inputs: inputsBefore, outputs: outputsBefore } =
                    EvalActionComponent.parse(object.expression);

                const { inputs: inputsAfter, outputs: outputsAfter } =
                    EvalActionComponent.parse(values.expression);

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

    @observable expression: string;

    static readonly PARAMS_REGEXP = /\{([^\}]+)\}/;

    static parse(expression: string) {
        const inputs = new Set<string>();
        const outputs = new Set<string>();

        if (expression) {
            EvalActionComponent.PARAMS_REGEXP.lastIndex = 0;
            let str = expression;
            while (true) {
                let matches = str.match(EvalActionComponent.PARAMS_REGEXP);
                if (!matches) {
                    break;
                }
                const input = matches[1].trim();
                inputs.add(input);
                str = str.substring(matches.index! + matches[1].length);
            }
        }

        return {
            inputs: Array.from(inputs.keys()),
            outputs: Array.from(outputs.keys())
        };
    }

    getInputs() {
        return [
            ...super.getInputs(),
            ...EvalActionComponent.parse(this.expression).inputs.map(input => ({
                name: input,
                displayName: input,
                type: PropertyType.Any
            }))
        ];
    }

    getOutputs() {
        return [
            ...super.getOutputs(),
            {
                name: "result",
                type: PropertyType.Any
            }
        ];
    }

    getBody(flowContext: IFlowContext): React.ReactNode {
        return (
            <div className="body">
                <pre>{this.expression}</pre>
            </div>
        );
    }

    expandExpression(runningFlow: RunningFlow) {
        let expression = this.expression;
        let values: any = {};

        EvalActionComponent.parse(expression).inputs.forEach(input => {
            const inputPropertyValue = runningFlow.getInputPropertyValue(
                this,
                input
            );
            values[input] = inputPropertyValue && inputPropertyValue.value;
            expression = expression.replace(
                new RegExp(`\{${input}\}`, "g"),
                `values.${input}`
            );
        });

        return { expression, values };
    }

    async execute(runningFlow: RunningFlow) {
        // try {
        const { expression, values } = this.expandExpression(runningFlow);
        values;
        let result = eval(expression);
        runningFlow.propagateValue(this, "result", result);
        // } catch (err) {
        //     runningFlow.propagateValue(this, "result", err);
        // }
        return undefined;
    }
}

registerClass(EvalActionComponent);

////////////////////////////////////////////////////////////////////////////////

const SetVariableBody = styled.div`
    display: flex;
    align-items: baseline;
    pre.single {
        flex-grow: 1;
        text-align: center;
    }
`;

export class SetVariableActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        flowComponentId: 1007,

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
                width="24"
                height="24"
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                <path d="M5 9h14m-14 6h14"></path>
            </svg>
        ),
        componentHeaderColor: "#A6BBCF"
    });

    @observable variable: string;
    @observable value: string;

    getBody(flowContext: IFlowContext): React.ReactNode {
        if (this.isInputProperty("value")) {
            return (
                <SetVariableBody className="body">
                    <pre className="single">{this.variable}</pre>
                </SetVariableBody>
            );
        }
        return (
            <SetVariableBody className="body">
                <div>
                    <pre>{this.variable}</pre>
                </div>
                <LeftArrow />
                <div style={{ textAlign: "left" }}>
                    <pre>{this.value}</pre>
                </div>
            </SetVariableBody>
        );
    }

    async execute(runningFlow: RunningFlow) {
        let value = runningFlow.getPropertyValue(this, "value");
        runningFlow.setVariable(this, this.variable, value);
        return undefined;
    }

    buildFlowComponentSpecific(assets: Assets, dataBuffer: DataBuffer) {
        buildAssignableExpression(assets, dataBuffer, this, this.variable);
    }
}

registerClass(SetVariableActionComponent);

////////////////////////////////////////////////////////////////////////////////

const CompareActionComponentDiv = styled.div`
    display: flex;
    align-items: center;
    white-space: nowrap;
`;

export class CompareActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        flowComponentId: 1009,

        properties: [
            makeToggablePropertyToInput({
                name: "A",
                displayName: "A",
                type: PropertyType.JSON,
                propertyGridGroup: specificGroup
            }),
            makeToggablePropertyToInput({
                name: "B",
                displayName: "B",
                type: PropertyType.JSON,
                propertyGridGroup: specificGroup,
                hideInPropertyGrid: (object: CompareActionComponent) => {
                    return object.operator == "NOT";
                }
            }),
            makeToggablePropertyToInput({
                name: "C",
                displayName: "C",
                type: PropertyType.JSON,
                propertyGridGroup: specificGroup,
                hideInPropertyGrid: (object: CompareActionComponent) => {
                    return object.operator !== "BETWEEN";
                }
            }),
            {
                name: "operator",
                type: PropertyType.Enum,
                enumItems: [
                    { id: "=", label: "=" },
                    { id: "<", label: "<" },
                    { id: ">", label: ">" },
                    { id: "<=", label: "<=" },
                    { id: ">=", label: ">=" },
                    { id: "<>", label: "<>" },
                    { id: "NOT", label: "NOT" },
                    { id: "AND", label: "AND" },
                    { id: "OR", label: "OR" },
                    { id: "XOR", label: "XOR" },
                    { id: "BETWEEN", label: "BETWEEN" }
                ]
            }
        ],
        icon: (
            <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                <path d="M8 8a3.5 3 0 0 1 3.5 -3h1a3.5 3 0 0 1 3.5 3a3 3 0 0 1 -2 3a3 4 0 0 0 -2 4"></path>
                <line x1="12" y1="19" x2="12" y2="19.01"></line>
            </svg>
        ),
        componentHeaderColor: "#AAAA66",
        defaultValue: {
            operator: "="
        }
    });

    @observable A: string;
    @observable B: string;
    @observable C: string;
    @observable operator: string;

    getOutputs() {
        return [
            ...super.getOutputs(),
            {
                name: "True",
                type: PropertyType.Null
            },
            {
                name: "False",
                type: PropertyType.Null
            }
        ];
    }

    getBody(flowContext: IFlowContext): React.ReactNode {
        if (this.operator == "NOT") {
            return (
                <CompareActionComponentDiv className="body">
                    {" NOT "}
                    {this.isInputProperty("A") ? "A" : this.A}
                </CompareActionComponentDiv>
            );
        }

        if (this.operator == "BETWEEN") {
            return (
                <CompareActionComponentDiv className="body">
                    {this.isInputProperty("B") ? "B" : this.B} {" <= "}
                    {this.isInputProperty("A") ? "A" : this.A} {" <= "}
                    {this.isInputProperty("C") ? "C" : this.C}
                </CompareActionComponentDiv>
            );
        }

        return (
            <CompareActionComponentDiv className="body">
                {this.isInputProperty("A") ? "A" : this.A} {this.operator}{" "}
                {this.isInputProperty("B") ? "B" : this.B}
            </CompareActionComponentDiv>
        );
    }

    async execute(runningFlow: RunningFlow) {
        let result;
        let A = runningFlow.getPropertyValue(this, "A");

        if (this.operator == "NOT") {
            result = !A;
        } else {
            let B = runningFlow.getPropertyValue(this, "B");
            if (this.operator === "=") {
                result = A === B;
            } else if (this.operator === "<") {
                result = A < B;
            } else if (this.operator === ">") {
                result = A > B;
            } else if (this.operator === "<=") {
                result = A <= B;
            } else if (this.operator === ">=") {
                result = A >= B;
            } else if (this.operator === "<>") {
                result = A !== B;
            } else if (this.operator === "AND") {
                result = A && B;
            } else if (this.operator === "OR") {
                result = A || B;
            } else if (this.operator === "XOR") {
                result = A ? !B : B;
            } else if (this.operator === "BETWEEN") {
                let C = runningFlow.getPropertyValue(this, "C");
                result = A >= B && A <= C;
            }
        }

        if (result) {
            runningFlow.propagateValue(this, "True", true);
        } else {
            runningFlow.propagateValue(this, "False", false);
        }
        return undefined;
    }
}

registerClass(CompareActionComponent);

////////////////////////////////////////////////////////////////////////////////

export class IsTrueActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        flowComponentId: 1010,

        properties: [
            makeToggablePropertyToInput({
                name: "value",
                type: PropertyType.Any,
                propertyGridGroup: specificGroup
            })
        ],
        icon: (
            <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                <path d="M5 12l5 5l10 -10"></path>
            </svg>
        ),
        componentHeaderColor: "#AAAA66",
        defaultValue: {
            asInputProperties: ["value"]
        }
    });

    @observable value: any;

    getOutputs() {
        return [
            ...super.getOutputs(),
            {
                name: "True",
                displayName: "Yes",
                type: PropertyType.Null
            },
            {
                name: "False",
                displayName: "No",
                type: PropertyType.Null
            }
        ];
    }

    async execute(runningFlow: RunningFlow) {
        let value = runningFlow.getPropertyValue(this, "value");

        if (value) {
            runningFlow.propagateValue(this, "True", true);
        } else {
            runningFlow.propagateValue(this, "False", false);
        }
        return undefined;
    }
}

registerClass(IsTrueActionComponent);

////////////////////////////////////////////////////////////////////////////////

export class ConstantActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        flowComponentId: 1011,

        properties: [
            {
                name: "value",
                type: PropertyType.JSON,
                propertyGridGroup: specificGroup
            }
        ],
        icon: (
            <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                <rect x="7" y="3" width="14" height="14" rx="2"></rect>
                <path d="M17 17v2a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-10a2 2 0 0 1 2 -2h2"></path>
                <path d="M14 14v-8l-2 2"></path>
            </svg>
        ),
        componentHeaderColor: "#C0C0C0"
    });

    @observable value: string;

    getOutputs() {
        return [
            ...super.getOutputs(),
            {
                name: "value",
                displayName: this.value,
                type: PropertyType.Any
            }
        ];
    }

    async execute(runningFlow: RunningFlow) {
        runningFlow.propagateValue(this, "value", JSON.parse(this.value));
        return undefined;
    }

    buildFlowComponentSpecific(assets: Assets, dataBuffer: DataBuffer) {
        dataBuffer.writeUint16(
            assets.getConstantIndex(
                evalConstantExpression(assets.rootProject, this.value)
            )
        );
    }
}

registerClass(ConstantActionComponent);

////////////////////////////////////////////////////////////////////////////////

export class DateNowActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        flowComponentId: 1012,

        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 40">
                <path d="M12 18H8v4h4v-4zm8 0h-4v4h4v-4zm8 0h-4v4h4v-4zm4-14h-2V0h-4v4H10V0H6v4H4C1.78 4 .02 5.8.02 8L0 36c0 2.2 1.78 4 4 4h28c2.2 0 4-1.8 4-4V8c0-2.2-1.8-4-4-4zm0 32H4V14h28v22z" />
            </svg>
        ),
        componentHeaderColor: "#C0C0C0"
    });

    getOutputs() {
        return [
            ...super.getOutputs(),
            {
                name: "value",
                type: PropertyType.Any
            }
        ];
    }

    async execute(runningFlow: RunningFlow) {
        runningFlow.propagateValue(this, "value", Date.now());
        return undefined;
    }
}

registerClass(DateNowActionComponent);

////////////////////////////////////////////////////////////////////////////////

export class ReadSettingActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        flowComponentId: 1013,

        properties: [
            makeToggablePropertyToInput({
                name: "key",
                type: PropertyType.String,
                propertyGridGroup: specificGroup
            })
        ],
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1100 1179">
                <path d="M135 156L277 14q14-14 35-14t35 14l77 77-212 212-77-76q-14-15-14-36t14-35zm520 168l210-210q14-14 24.5-10t10.5 25l-2 599q-1 20-15.5 35T847 778l-597 1q-21 0-25-10.5t10-24.5l208-208-154-155 212-212zM50 879h1000q21 0 35.5 14.5T1100 929v250H0V929q0-21 14.5-35.5T50 879zm850 100v50h100v-50H900z" />
            </svg>
        ),
        componentHeaderColor: "#C0DEED"
    });

    @observable key: string;

    getOutputs() {
        return [
            ...super.getOutputs(),
            {
                name: "value",
                type: PropertyType.Any
            }
        ];
    }

    getBody(flowContext: IFlowContext): React.ReactNode {
        let key;
        if (flowContext.runningFlow) {
            key = flowContext.runningFlow.getPropertyValue(this, "key");
        } else {
            key = this.key;
        }

        return key ? (
            <div className="body">
                <pre>{key}</pre>
            </div>
        ) : null;
    }

    async execute(runningFlow: RunningFlow) {
        let key = runningFlow.getPropertyValue(this, "key");
        runningFlow.propagateValue(
            this,
            "value",
            runningFlow.RuntimeStore.readSettings(key)
        );
        return undefined;
    }
}

registerClass(ReadSettingActionComponent);

////////////////////////////////////////////////////////////////////////////////

export class WriteSettingsActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        flowComponentId: 1014,

        properties: [
            makeToggablePropertyToInput({
                name: "key",
                type: PropertyType.String,
                propertyGridGroup: specificGroup
            })
        ],
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1100 1200">
                <path d="M350 0l599 2q20 1 35 15.5T999 53l1 597q0 21-10.5 25T965 665L757 457 602 611 390 399l155-154L335 35q-14-14-10-24.5T350 0zm174 688l-76 77q-15 14-36 14t-35-14L235 623q-14-14-14-35t14-35l77-77zM50 900h1000q21 0 35.5 14.5T1100 950v250H0V950q0-21 14.5-35.5T50 900zm850 100v50h100v-50H900z" />
            </svg>
        ),
        componentHeaderColor: "#C0DEED"
    });

    @observable key: string;

    getInputs() {
        return [
            ...super.getInputs(),
            {
                name: "value",
                type: PropertyType.Any
            }
        ];
    }

    getBody(flowContext: IFlowContext): React.ReactNode {
        let key;
        if (flowContext.runningFlow) {
            key = flowContext.runningFlow.getPropertyValue(this, "key");
        } else {
            key = this.key;
        }

        return key ? (
            <div className="body">
                <pre>{key}</pre>
            </div>
        ) : null;
    }

    async execute(runningFlow: RunningFlow) {
        let key = runningFlow.getPropertyValue(this, "key");
        const inputPropertyValue = runningFlow.getInputPropertyValue(
            this,
            "value"
        );
        runningFlow.RuntimeStore.writeSettings(key, inputPropertyValue?.value);
        return undefined;
    }
}

registerClass(WriteSettingsActionComponent);

////////////////////////////////////////////////////////////////////////////////

export class LogActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        flowComponentId: 1015,

        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 448">
                <path d="M223.988 0C128.473 0 46.934 59.804 14.727 144h34.639c9.396-20.484 22.457-39.35 38.868-55.762C124.497 51.973 172.709 32 223.988 32c51.286 0 99.504 19.973 135.771 56.239C396.027 124.505 416 172.719 416 224c0 51.285-19.973 99.501-56.239 135.765C323.494 396.029 275.275 416 223.988 416c-51.281 0-99.493-19.971-135.755-56.234C71.821 343.354 58.76 324.486 49.362 304H14.725c32.206 84.201 113.746 144 209.264 144C347.703 448 448 347.715 448 224 448 100.298 347.703 0 223.988 0z" />
                <path d="M174.863 291.883l22.627 22.627L288 224l-90.51-90.51-22.628 22.628L226.745 208H0v32h226.745z" />
            </svg>
        ),
        componentHeaderColor: "#C0DEED"
    });

    @observable countValue: number;

    getInputs() {
        return [
            ...super.getInputs(),
            {
                name: "value",
                type: PropertyType.Any
            }
        ];
    }

    async execute(runningFlow: RunningFlow) {
        const componentState = runningFlow.getComponentState(this);
        const value = componentState.getInputValue("value");
        console.log(value);
        return undefined;
    }
}

registerClass(LogActionComponent);

////////////////////////////////////////////////////////////////////////////////

export class CallActionActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        flowComponentId: 1016,

        properties: [
            makeToggablePropertyToInput({
                name: "action",
                type: PropertyType.ObjectReference,
                referencedObjectCollectionPath: "actions",
                propertyGridGroup: specificGroup,
                onSelect: (object: IEezObject, propertyInfo: PropertyInfo) =>
                    onSelectItem(object, propertyInfo, {
                        title: propertyInfo.onSelectTitle!,
                        width: 800
                    }),
                onSelectTitle: "Select Action"
            })
        ],
        label: (component: CallActionActionComponent) => {
            if (!component.action) {
                return ActionComponent.classInfo.label!(component);
            }
            return component.action;
        },
        icon: (
            <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                <path d="M7 4a12.25 12.25 0 0 0 0 16"></path>
                <path d="M17 4a12.25 12.25 0 0 1 0 16"></path>
            </svg>
        ),
        componentHeaderColor: "#C7E9C0",
        open: (object: CallActionActionComponent) => {
            object.open();
        }
    });

    @observable action: string;

    getInputs() {
        const action = findAction(getProject(this), this.action);
        if (!action) {
            return super.getInputs();
        }

        const inputs = action.components
            .filter(component => component instanceof InputActionComponent)
            .sort((a, b) => a.top - b.top)
            .map((inputActionComponent: InputActionComponent) => ({
                name: inputActionComponent.wireID,
                displayName: inputActionComponent.name,
                type: PropertyType.Any
            }));

        return [...super.getInputs(), ...inputs];
    }

    getOutputs() {
        const action = findAction(getProject(this), this.action);
        if (!action) {
            return super.getOutputs();
        }

        const outputs = action.components
            .filter(component => component instanceof OutputActionComponent)
            .sort((a, b) => a.top - b.top)
            .map((outputActionComponent: OutputActionComponent) => ({
                name: outputActionComponent.wireID,
                displayName: outputActionComponent.name,
                type: PropertyType.Any
            }));

        return [...super.getOutputs(), ...outputs];
    }

    async execute(runningFlow: RunningFlow) {
        const actionName = runningFlow.getPropertyValue(this, "action");
        const action = findAction(getProject(this), actionName);
        if (!action) {
            return;
        }

        const actionRunningFlow = runningFlow.executeAction(this, action);

        const componentState = runningFlow.getComponentState(this);
        for (let [input, inputData] of componentState.inputsData) {
            for (let component of action.components) {
                if (component instanceof InputActionComponent) {
                    if (component.wireID === input) {
                        actionRunningFlow.propagateValue(
                            component,
                            "@seqout",
                            inputData.value
                        );
                    }
                }
            }
        }
        return undefined;
    }

    open() {
        const action = findAction(getProject(this), this.action);
        if (action) {
            getDocumentStore(this).NavigationStore.showObject(action);
        }
    }
}

registerClass(CallActionActionComponent);

////////////////////////////////////////////////////////////////////////////////

const TrixEditorDiv = styled.div`
    position: relative;
    background-color: #ffff88;
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
        flowComponentId: 1017,

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
        ),
        componentHeaderColor: "#ffff88"
    });

    @observable text: string;

    getBody(flowContext: IFlowContext): React.ReactNode {
        return (
            <TrixEditor
                value={this.text}
                setValue={action((value: string) => {
                    const DocumentStore = getDocumentStore(this);
                    DocumentStore.updateObject(this, {
                        text: value
                    });
                })}
            ></TrixEditor>
        );
    }
}

registerClass(CommentActionComponent);

////////////////////////////////////////////////////////////////////////////////

export class DelayActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        flowComponentId: 1018,

        properties: [
            makeToggablePropertyToInput({
                name: "milliseconds",
                type: PropertyType.Number
            })
        ],
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">
                <path d="M7.5 5.1c0 .3-.2.5-.5.5H5c-.3 0-.5-.2-.5-.5v-2c0-.3.2-.5.5-.5s.5.2.5.5v1.5H7c.2 0 .5.3.5.5zM10 5c0-2.8-2.2-5-5-5S0 2.2 0 5s2.2 5 5 5 5-2.2 5-5zM9 5c0 2.2-1.8 4-4 4S1 7.2 1 5s1.8-4 4-4 4 1.8 4 4z" />
            </svg>
        ),
        componentHeaderColor: "#E6E0F8"
    });

    @observable milliseconds: number;

    getBody(flowContext: IFlowContext): React.ReactNode {
        return (
            <div className="body">
                <pre>{this.milliseconds} ms</pre>
            </div>
        );
    }

    async execute(runningFlow: RunningFlow) {
        const milliseconds = runningFlow.getPropertyValue(this, "milliseconds");
        await new Promise<void>(resolve =>
            setTimeout(resolve, milliseconds ?? 0)
        );
        return undefined;
    }
}

registerClass(DelayActionComponent);

////////////////////////////////////////////////////////////////////////////////

export class ErrorActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        flowComponentId: 1019,

        properties: [
            makeToggablePropertyToInput({
                name: "message",
                type: PropertyType.String,
                propertyGridGroup: specificGroup
            })
        ],
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">
                <path d="M18 26h4v4h-4zm0-16h4v12h-4zm1.99-10C8.94 0 0 8.95 0 20s8.94 20 19.99 20S40 31.05 40 20 31.04 0 19.99 0zM20 36c-8.84 0-16-7.16-16-16S11.16 4 20 4s16 7.16 16 16-7.16 16-16 16z" />
            </svg>
        ),
        componentHeaderColor: "#fc9b9b"
    });

    @observable message: number;

    getBody(flowContext: IFlowContext): React.ReactNode {
        if (this.isInputProperty("message")) {
            return null;
        }
        return (
            <div className="body">
                <pre>{this.message}</pre>
            </div>
        );
    }

    async execute(runningFlow: RunningFlow) {
        const message = runningFlow.getPropertyValue(this, "message");
        throw message;
        return undefined;
    }
}

registerClass(ErrorActionComponent);

////////////////////////////////////////////////////////////////////////////////

export class CatchErrorActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        flowComponentId: 1020,

        properties: [],
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">
                <path d="M20 0C8.96 0 0 8.95 0 20s8.96 20 20 20 20-8.95 20-20S31.04 0 20 0zm2 30h-4v-4h4v4zm0-8h-4V10h4v12z" />
            </svg>
        ),
        componentHeaderColor: "#FFAAAA"
    });

    getOutputs() {
        return [
            ...super.getOutputs(),
            {
                name: "Message",
                type: PropertyType.String
            }
        ];
    }

    async execute(runningFlow: RunningFlow) {
        const messageInputValue = runningFlow.getInputValue(this, "message");
        runningFlow.propagateValue(
            this,
            "Message",
            messageInputValue?.value ?? "unknow error"
        );

        return undefined;
    }
}

registerClass(CatchErrorActionComponent);

////////////////////////////////////////////////////////////////////////////////

class CounterRunningState {
    constructor(public value: number) {}
}

export class CounterActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        flowComponentId: 1021,

        properties: [
            {
                name: "countValue",
                type: PropertyType.String
            }
        ],
        icon: (
            <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                <path d="M9 4.55a8 8 0 0 1 6 14.9m0 -4.45v5h5"></path>
                <line x1="5.63" y1="7.16" x2="5.63" y2="7.17"></line>
                <line x1="4.06" y1="11" x2="4.06" y2="11.01"></line>
                <line x1="4.63" y1="15.1" x2="4.63" y2="15.11"></line>
                <line x1="7.16" y1="18.37" x2="7.16" y2="18.38"></line>
                <line x1="11" y1="19.94" x2="11" y2="19.95"></line>
            </svg>
        ),
        componentHeaderColor: "#E2D96E"
    });

    @observable countValue: number;

    getOutputs() {
        return [
            ...super.getOutputs(),
            {
                name: "done",
                type: PropertyType.Null
            }
        ];
    }

    getBody(flowContext: IFlowContext): React.ReactNode {
        return (
            <div className="body">
                <pre>{this.countValue}</pre>
            </div>
        );
    }

    async execute(runningFlow: RunningFlow) {
        let counterRunningState =
            runningFlow.getComponentRunningState<CounterRunningState>(this);

        if (!counterRunningState) {
            counterRunningState = new CounterRunningState(this.countValue);
            runningFlow.setComponentRunningState(this, counterRunningState);
        }

        if (counterRunningState.value == 0) {
            runningFlow.propagateValue(this, "done", null);
        } else {
            counterRunningState.value--;
        }

        return undefined;
    }
}

registerClass(CounterActionComponent);

////////////////////////////////////////////////////////////////////////////////

export class ShowPageActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        flowComponentId: 1022,

        properties: [
            {
                name: "page",
                type: PropertyType.String
            }
        ],
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36">
                <path d="M0 20h16V0H0v20zm0 16h16V24H0v12zm20 0h16V16H20v20zm0-36v12h16V0H20z" />
            </svg>
        ),
        componentHeaderColor: "#DEB887"
    });

    @observable page: string;

    getBody(flowContext: IFlowContext): React.ReactNode {
        return (
            <div className="body">
                <pre>{this.page}</pre>
            </div>
        );
    }

    async execute(runningFlow: RunningFlow) {
        if (!this.page) {
            throw "page not specified";
        }
        const page = findPage(
            runningFlow.RuntimeStore.DocumentStore.project,
            this.page
        );
        if (!page) {
            throw "page not found";
        }

        runInAction(() => {
            runningFlow.RuntimeStore.selectedPage = page;
        });

        return undefined;
    }
}

registerClass(ShowPageActionComponent);

////////////////////////////////////////////////////////////////////////////////

import "project-editor/flow/action-components/instrument";
