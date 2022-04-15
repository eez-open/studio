import React from "react";
import { observable, action, runInAction, makeObservable } from "mobx";
import { observer } from "mobx-react";
import classNames from "classnames";

import { _find, _range } from "eez-studio-shared/algorithm";

import {
    registerClass,
    PropertyType,
    makeDerivedClassInfo,
    IEezObject,
    EezObject,
    ClassInfo,
    getParent,
    MessageType
} from "project-editor/core/object";
import {
    getChildOfObject,
    getDocumentStore,
    Message,
    propertyNotFoundMessage,
    propertyNotSetMessage,
    Section
} from "project-editor/store";

import type {
    IFlowContext,
    IResizeHandler
} from "project-editor/flow/flow-interfaces";

import { guid } from "eez-studio-shared/guid";

import {
    ActionComponent,
    AutoSize,
    Component,
    ComponentInput,
    ComponentOutput,
    componentOutputUnique,
    makeAssignableExpressionProperty,
    makeExpressionProperty,
    outputIsOptionalIfAtLeastOneOutputExists
} from "project-editor/flow/component";

import { findAction } from "project-editor/features/action/action";
import { getFlow, getProject } from "project-editor/project/project";
import { findPage } from "project-editor/features/page/page";
import { Assets, DataBuffer } from "project-editor/build/assets";
import {
    buildAssignableExpression,
    buildExpression,
    checkAssignableExpression,
    checkExpression,
    evalConstantExpression
} from "project-editor/flow/expression";
import { calcComponentGeometry } from "project-editor/flow/editor/render";
import {
    ValueType,
    VariableTypeUI
} from "project-editor/features/variable/value-type";
import { specificGroup } from "project-editor/components/PropertyGrid/groups";
import {
    COMPONENT_TYPE_START_ACTION,
    COMPONENT_TYPE_END_ACTION,
    COMPONENT_TYPE_INPUT_ACTION,
    COMPONENT_TYPE_OUTPUT_ACTION,
    COMPONENT_TYPE_WATCH_VARIABLE_ACTION,
    COMPONENT_TYPE_EVAL_EXPR_ACTION,
    COMPONENT_TYPE_SET_VARIABLE_ACTION,
    COMPONENT_TYPE_SWITCH_ACTION,
    COMPONENT_TYPE_COMPARE_ACTION,
    COMPONENT_TYPE_IS_TRUE_ACTION,
    COMPONENT_TYPE_CONSTANT_ACTION,
    COMPONENT_TYPE_LOG_ACTION,
    COMPONENT_TYPE_CALL_ACTION_ACTION,
    COMPONENT_TYPE_DELAY_ACTION,
    COMPONENT_TYPE_ERROR_ACTION,
    COMPONENT_TYPE_CATCH_ERROR_ACTION,
    COMPONENT_TYPE_COUNTER_ACTION,
    COMPONENT_TYPE_LOOP_ACTION,
    COMPONENT_TYPE_SHOW_PAGE_ACTION,
    COMPONENT_TYPE_SHOW_MESSAGE_BOX_ACTION,
    COMPONENT_TYPE_SHOW_KEYBOARD_ACTION,
    COMPONENT_TYPE_SHOW_KEYPAD_ACTION,
    COMPONENT_TYPE_NOOP_ACTION,
    COMPONENT_TYPE_COMMENT_ACTION
} from "project-editor/flow/components/component_types";
import { makeEndInstruction } from "project-editor/flow/expression/instructions";

const NOT_NAMED_LABEL = "<not named>";

export const LeftArrow = () => (
    <div style={{ marginTop: -2, padding: "0 8px" }}>
        <svg
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

export const RightArrow = () => (
    <svg
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
        <line x1="5" y1="12" x2="19" y2="12"></line>
        <line x1="15" y1="16" x2="19" y2="12"></line>
        <line x1="15" y1="8" x2="19" y2="12"></line>
    </svg>
);

////////////////////////////////////////////////////////////////////////////////

export class StartActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        flowComponentId: COMPONENT_TYPE_START_ACTION,

        icon: (
            <svg viewBox="0 0 10.699999809265137 12">
                <path d="M.5 12c-.3 0-.5-.2-.5-.5V.5C0 .2.2 0 .5 0s.5.2.5.5v11c0 .3-.2.5-.5.5zm10.2-6L4 2v8l6.7-4z" />
            </svg>
        ),
        componentHeaderColor: "#74c8ce"
    });

    getOutputs() {
        return [
            ...super.getOutputs(),
            {
                name: "@seqout",
                type: "null" as ValueType,
                isSequenceOutput: true,
                isOptionalOutput: false
            }
        ];
    }
}

registerClass("StartActionComponent", StartActionComponent);

////////////////////////////////////////////////////////////////////////////////

export class EndActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        flowComponentId: COMPONENT_TYPE_END_ACTION,

        icon: (
            <svg viewBox="0 0 10.699999809265137 12">
                <path d="M6.7 6L0 2v8l6.7-4zm3.5 6c-.3 0-.5-.2-.5-.5V.5c0-.3.2-.5.5-.5s.5.2.5.5v11c0 .3-.3.5-.5.5z" />
            </svg>
        ),
        componentHeaderColor: "#74c8ce"
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
}

registerClass("EndActionComponent", EndActionComponent);

////////////////////////////////////////////////////////////////////////////////

export class InputActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        flowComponentId: COMPONENT_TYPE_INPUT_ACTION,

        properties: [
            {
                name: "name",
                type: PropertyType.String,
                propertyGridGroup: specificGroup
            },
            {
                name: "inputType",
                displayName: "Type",
                type: PropertyType.String,
                propertyGridColumnComponent: VariableTypeUI,
                propertyGridGroup: specificGroup
            }
        ],
        check: (inputActionComponent: InputActionComponent) => {
            let messages: Message[] = [];
            if (!inputActionComponent.name) {
                messages.push(
                    propertyNotSetMessage(inputActionComponent, "name")
                );
            }
            if (!inputActionComponent.inputType) {
                messages.push(
                    propertyNotSetMessage(inputActionComponent, "inputType")
                );
            }
            return messages;
        },
        label: (component: InputActionComponent) => {
            if (!component.name) {
                return NOT_NAMED_LABEL;
            }
            return component.name;
        },
        icon: (
            <svg
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

    name: string;
    inputType: ValueType;

    constructor() {
        super();

        makeObservable(this, {
            name: observable,
            inputType: observable
        });
    }

    getOutputs() {
        return [
            ...super.getOutputs(),
            {
                name: "@seqout",
                type: this.inputType,
                isSequenceOutput: true,
                isOptionalOutput: false
            }
        ];
    }

    buildFlowComponentSpecific(assets: Assets, dataBuffer: DataBuffer) {
        const flow = getFlow(this);
        dataBuffer.writeUint8(flow.inputComponents.indexOf(this));
    }
}

registerClass("InputActionComponent", InputActionComponent);

////////////////////////////////////////////////////////////////////////////////

export class OutputActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        flowComponentId: COMPONENT_TYPE_OUTPUT_ACTION,

        properties: [
            {
                name: "name",
                type: PropertyType.String,
                propertyGridGroup: specificGroup
            },
            {
                name: "outputType",
                displayName: "Type",
                type: PropertyType.String,
                propertyGridColumnComponent: VariableTypeUI,
                propertyGridGroup: specificGroup
            }
        ],
        check: (outputActionComponent: OutputActionComponent) => {
            let messages: Message[] = [];
            if (!outputActionComponent.name) {
                messages.push(
                    propertyNotSetMessage(outputActionComponent, "name")
                );
            }
            if (!outputActionComponent.outputType) {
                messages.push(
                    propertyNotSetMessage(outputActionComponent, "outputType")
                );
            }
            return messages;
        },
        label: (component: OutputActionComponent) => {
            if (!component.name) {
                return NOT_NAMED_LABEL;
            }
            return component.name;
        },
        icon: (
            <svg
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

    name: string;
    outputType: ValueType;

    constructor() {
        super();

        makeObservable(this, {
            name: observable,
            outputType: observable
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

    buildFlowComponentSpecific(assets: Assets, dataBuffer: DataBuffer) {
        const flow = getFlow(this);
        dataBuffer.writeUint8(flow.outputComponents.indexOf(this));
    }
}

registerClass("OutputActionComponent", OutputActionComponent);

////////////////////////////////////////////////////////////////////////////////

export class EvalExprActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        flowComponentId: COMPONENT_TYPE_EVAL_EXPR_ACTION,
        label: () => "Eval Expression",
        componentPaletteLabel: "Eval expr.",
        properties: [
            makeExpressionProperty(
                {
                    name: "expression",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup
                },
                "any"
            )
        ],
        icon: (
            <svg viewBox="0 0 1664 1792">
                <path d="M384 1536q0-53-37.5-90.5T256 1408t-90.5 37.5T128 1536t37.5 90.5T256 1664t90.5-37.5T384 1536zm384 0q0-53-37.5-90.5T640 1408t-90.5 37.5T512 1536t37.5 90.5T640 1664t90.5-37.5T768 1536zm-384-384q0-53-37.5-90.5T256 1024t-90.5 37.5T128 1152t37.5 90.5T256 1280t90.5-37.5T384 1152zm768 384q0-53-37.5-90.5T1024 1408t-90.5 37.5T896 1536t37.5 90.5 90.5 37.5 90.5-37.5 37.5-90.5zm-384-384q0-53-37.5-90.5T640 1024t-90.5 37.5T512 1152t37.5 90.5T640 1280t90.5-37.5T768 1152zM384 768q0-53-37.5-90.5T256 640t-90.5 37.5T128 768t37.5 90.5T256 896t90.5-37.5T384 768zm768 384q0-53-37.5-90.5T1024 1024t-90.5 37.5T896 1152t37.5 90.5 90.5 37.5 90.5-37.5 37.5-90.5zM768 768q0-53-37.5-90.5T640 640t-90.5 37.5T512 768t37.5 90.5T640 896t90.5-37.5T768 768zm768 768v-384q0-52-38-90t-90-38-90 38-38 90v384q0 52 38 90t90 38 90-38 38-90zm-384-768q0-53-37.5-90.5T1024 640t-90.5 37.5T896 768t37.5 90.5T1024 896t90.5-37.5T1152 768zm384-320V192q0-26-19-45t-45-19H192q-26 0-45 19t-19 45v256q0 26 19 45t45 19h1280q26 0 45-19t19-45zm0 320q0-53-37.5-90.5T1408 640t-90.5 37.5T1280 768t37.5 90.5T1408 896t90.5-37.5T1536 768zm128-640v1536q0 52-38 90t-90 38H128q-52 0-90-38t-38-90V128q0-52 38-90t90-38h1408q52 0 90 38t38 90z" />
            </svg>
        ),
        componentHeaderColor: "#A6BBCF"
    });

    expression: string;

    constructor() {
        super();

        makeObservable(this, {
            expression: observable
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

    getOutputs(): ComponentOutput[] {
        return [
            ...super.getOutputs(),
            {
                name: "@seqout",
                type: "null",
                isSequenceOutput: true,
                isOptionalOutput: true
            },
            {
                name: "result",
                type: "any",
                isSequenceOutput: false,
                isOptionalOutput: false
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
}

registerClass("EvalExprActionComponent", EvalExprActionComponent);

////////////////////////////////////////////////////////////////////////////////

export class WatchVariableActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        flowComponentId: COMPONENT_TYPE_WATCH_VARIABLE_ACTION,
        properties: [
            makeExpressionProperty(
                {
                    name: "variable",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup
                },
                "any"
            )
        ],
        icon: (
            <svg
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                <circle cx="12" cy="12" r="2"></circle>
                <path d="M22 12c-2.667 4.667 -6 7 -10 7s-7.333 -2.333 -10 -7c2.667 -4.667 6 -7 10 -7s7.333 2.333 10 7"></path>
            </svg>
        ),
        componentHeaderColor: "#A6BBCF"
    });

    variable: string;

    constructor() {
        super();

        makeObservable(this, {
            variable: observable
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
                name: "variable",
                displayName: "changed",
                type: "any" as ValueType,
                isSequenceOutput: false,
                isOptionalOutput: false
            }
        ];
    }

    getBody() {
        return (
            <div className="body">
                <pre>{this.variable}</pre>
            </div>
        );
    }
}

registerClass("WatchVariableActionComponent", WatchVariableActionComponent);

////////////////////////////////////////////////////////////////////////////////

export class EvalJSExprActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        label: () => "Eval JS expression",
        componentPaletteLabel: "Eval JS expr.",
        componentPaletteGroupName: "Dashboard Specific",
        properties: [
            {
                name: "expression",
                type: PropertyType.MultilineText,
                propertyGridGroup: specificGroup,
                monospaceFont: true,
                disableSpellcheck: true
            }
        ],
        check: (component: EvalJSExprActionComponent) => {
            let messages: Message[] = [];

            const { valueExpressions } = component.expandExpressionForBuild();

            valueExpressions.forEach(valueExpression => {
                try {
                    checkExpression(component, valueExpression);
                } catch (err) {
                    messages.push(
                        new Message(
                            MessageType.ERROR,
                            `Invalid expression "${valueExpression}": ${err}`,
                            getChildOfObject(component, "expression")
                        )
                    );
                }
            });

            return messages;
        },
        icon: (
            <svg viewBox="0 0 22.556997299194336 17.176000595092773">
                <path d="M4.912.27h3.751v10.514c0 4.738-2.271 6.392-5.899 6.392-.888 0-2.024-.148-2.764-.395l.42-3.036a6.18 6.18 0 0 0 1.925.296c1.58 0 2.567-.716 2.567-3.282V.27zm7.008 12.785c.987.518 2.567 1.037 4.171 1.037 1.728 0 2.641-.716 2.641-1.826 0-1.012-.79-1.629-2.789-2.32-2.764-.987-4.59-2.517-4.59-4.961C11.353 2.147 13.747 0 17.646 0c1.9 0 3.258.37 4.245.839l-.839 3.011a7.779 7.779 0 0 0-3.455-.79c-1.629 0-2.419.765-2.419 1.604 0 1.061.913 1.53 3.085 2.369 2.937 1.086 4.294 2.616 4.294 4.985 0 2.789-2.122 5.158-6.688 5.158-1.9 0-3.776-.518-4.714-1.037l.765-3.085z" />
            </svg>
        ),
        componentHeaderColor: "#A6BBCF"
    });

    expression: string;

    static readonly PARAMS_REGEXP = /\{([^\}]+)\}/;

    constructor() {
        super();

        makeObservable(this, {
            expression: observable
        });
    }

    static parse(expression: string) {
        const inputs = new Set<string>();

        if (expression) {
            EvalJSExprActionComponent.PARAMS_REGEXP.lastIndex = 0;
            let str = expression;
            while (true) {
                let matches = str.match(
                    EvalJSExprActionComponent.PARAMS_REGEXP
                );
                if (!matches) {
                    break;
                }
                const input = matches[1].trim();
                inputs.add(input);
                str = str.substring(matches.index! + matches[1].length);
            }
        }

        return Array.from(inputs.keys());
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
                name: "result",
                type: "any",
                isSequenceOutput: false,
                isOptionalOutput: false
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

    expandExpressionForBuild() {
        let expression = this.expression;
        let valueExpressions: any[] = [];

        EvalJSExprActionComponent.parse(expression).forEach(
            (valueExpression, i) => {
                const name = `_val${i}`;
                valueExpressions.push(valueExpression);
                expression = expression.replace(
                    new RegExp(`\{${valueExpression}\}`, "g"),
                    `values.${name}`
                );
            }
        );

        return { expression, valueExpressions };
    }

    buildFlowComponentSpecific(assets: Assets, dataBuffer: DataBuffer) {
        const { expression, valueExpressions } =
            this.expandExpressionForBuild();

        dataBuffer.writeObjectOffset(() => dataBuffer.writeString(expression));

        dataBuffer.writeArray(valueExpressions, valueExpression => {
            try {
                // as property
                buildExpression(assets, dataBuffer, this, valueExpression);
            } catch (err) {
                assets.DocumentStore.outputSectionsStore.write(
                    Section.OUTPUT,
                    MessageType.ERROR,
                    err,
                    getChildOfObject(this, "expression")
                );

                dataBuffer.writeUint16NonAligned(makeEndInstruction());
            }
        });
    }
}

registerClass("EvalJSExprActionComponent", EvalJSExprActionComponent);

////////////////////////////////////////////////////////////////////////////////

class SetVariableEntry extends EezObject {
    variable: string;
    value: string;

    static classInfo: ClassInfo = {
        properties: [
            makeAssignableExpressionProperty(
                {
                    name: "variable",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup
                },
                "any"
            ),
            makeExpressionProperty(
                {
                    name: "value",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup
                },
                "any"
            )
        ],
        check: (setVariableItem: SetVariableEntry) => {
            let messages: Message[] = [];

            try {
                checkAssignableExpression(
                    getParent(getParent(setVariableItem)!)! as Component,
                    setVariableItem.variable
                );
            } catch (err) {
                messages.push(
                    new Message(
                        MessageType.ERROR,
                        `Invalid assignable expression: ${err}`,
                        getChildOfObject(setVariableItem, "variable")
                    )
                );
            }

            try {
                checkExpression(
                    getParent(getParent(setVariableItem)!)! as Component,
                    setVariableItem.value
                );
            } catch (err) {
                messages.push(
                    new Message(
                        MessageType.ERROR,
                        `Invalid expression: ${err}`,
                        getChildOfObject(setVariableItem, "value")
                    )
                );
            }

            return messages;
        },
        defaultValue: {}
    };

    constructor() {
        super();

        makeObservable(this, {
            variable: observable,
            value: observable
        });
    }
}

export class SetVariableActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        flowComponentId: COMPONENT_TYPE_SET_VARIABLE_ACTION,
        properties: [
            {
                name: "entries",
                type: PropertyType.Array,
                typeClass: SetVariableEntry,
                propertyGridGroup: specificGroup,
                partOfNavigation: false,
                enumerable: false,
                defaultValue: []
            }
        ],
        beforeLoadHook: (
            component: SetVariableActionComponent,
            objectJS: any
        ) => {
            if (objectJS.entries == undefined) {
                objectJS.entries = [
                    {
                        variable: objectJS.variable,
                        value: objectJS.value
                    }
                ];
                delete objectJS.variable;
                delete objectJS.value;
            }
        },
        icon: (
            <svg
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
        componentHeaderColor: "#A6BBCF",
        defaultValue: {
            entries: []
        }
    });

    entries: SetVariableEntry[];

    constructor() {
        super();

        makeObservable(this, {
            entries: observable
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
            <div className="body">
                {this.entries.map((entry, i) => (
                    <pre key={i}>
                        {entry.variable}
                        <LeftArrow />
                        {entry.value}
                    </pre>
                ))}
            </div>
        );
    }

    buildFlowComponentSpecific(assets: Assets, dataBuffer: DataBuffer) {
        dataBuffer.writeArray(this.entries, entry => {
            dataBuffer.writeObjectOffset(() =>
                buildAssignableExpression(
                    assets,
                    dataBuffer,
                    this,
                    entry.variable
                )
            );
            dataBuffer.writeObjectOffset(() =>
                buildExpression(assets, dataBuffer, this, entry.value)
            );
        });
    }
}

registerClass("SetVariableActionComponent", SetVariableActionComponent);

////////////////////////////////////////////////////////////////////////////////

class SwitchTest extends EezObject {
    condition: string;
    outputName: string;

    static classInfo: ClassInfo = {
        properties: [
            makeExpressionProperty(
                {
                    name: "condition",
                    type: PropertyType.MultilineText
                },
                "boolean"
            ),
            {
                name: "outputName",
                type: PropertyType.String,
                unique: componentOutputUnique
            }
        ],
        check: (switchTest: SwitchTest) => {
            let messages: Message[] = [];
            try {
                checkExpression(
                    getParent(getParent(switchTest)!)! as Component,
                    switchTest.condition
                );
            } catch (err) {
                messages.push(
                    new Message(
                        MessageType.ERROR,
                        `Invalid expression: ${err}`,
                        getChildOfObject(switchTest, "condition")
                    )
                );
            }
            return messages;
        },
        defaultValue: {}
    };

    constructor() {
        super();

        makeObservable(this, {
            condition: observable,
            outputName: observable
        });
    }
}

export class SwitchActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        flowComponentId: COMPONENT_TYPE_SWITCH_ACTION,

        properties: [
            {
                name: "tests",
                type: PropertyType.Array,
                typeClass: SwitchTest,
                propertyGridGroup: specificGroup,
                partOfNavigation: false,
                enumerable: false,
                defaultValue: []
            }
        ],
        icon: (
            <svg
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
        defaultValue: {}
    });

    tests: SwitchTest[];

    constructor() {
        super();

        makeObservable(this, {
            tests: observable
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

    getOutputs(): ComponentOutput[] {
        return [
            ...super.getOutputs(),
            {
                name: "@seqout",
                type: "null" as ValueType,
                isSequenceOutput: true,
                isOptionalOutput: true
            },
            ...this.tests
                .filter(test => !!test.outputName)
                .map(test => ({
                    name: test.outputName,
                    type: "boolean" as ValueType,
                    isSequenceOutput: true,
                    isOptionalOutput: false
                }))
        ];
    }

    getBody(flowContext: IFlowContext): React.ReactNode {
        return (
            <div className="body">
                {this.tests.map(test => (
                    <pre key={test.outputName}>{test.condition}</pre>
                ))}
            </div>
        );
    }

    buildFlowComponentSpecific(assets: Assets, dataBuffer: DataBuffer) {
        dataBuffer.writeArray(this.tests, test => {
            dataBuffer.writeUint8(
                this.buildOutputs.findIndex(
                    output => output.name == test.outputName
                )
            );
            buildExpression(assets, dataBuffer, this, test.condition);
        });
    }
}

registerClass("SwitchActionComponent", SwitchActionComponent);

////////////////////////////////////////////////////////////////////////////////

export class CompareActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        flowComponentId: COMPONENT_TYPE_COMPARE_ACTION,
        properties: [
            makeExpressionProperty(
                {
                    name: "A",
                    displayName: "A",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup
                },
                "any"
            ),
            makeExpressionProperty(
                {
                    name: "B",
                    displayName: "B",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup,
                    hideInPropertyGrid: (object: CompareActionComponent) => {
                        return object.operator == "NOT";
                    }
                },
                "any"
            ),
            makeExpressionProperty(
                {
                    name: "C",
                    displayName: "C",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup,
                    hideInPropertyGrid: (object: CompareActionComponent) => {
                        return object.operator !== "BETWEEN";
                    }
                },
                "any"
            ),
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
                ],
                propertyGridGroup: specificGroup
            }
        ],
        icon: (
            <svg
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

    A: string;
    B: string;
    C: string;
    operator: string;

    constructor() {
        super();

        makeObservable(this, {
            A: observable,
            B: observable,
            C: observable,
            operator: observable
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
                name: "True",
                type: "boolean",
                isSequenceOutput: true,
                isOptionalOutput: outputIsOptionalIfAtLeastOneOutputExists
            },
            {
                name: "False",
                type: "boolean",
                isSequenceOutput: true,
                isOptionalOutput: outputIsOptionalIfAtLeastOneOutputExists
            }
        ];
    }

    getBody(flowContext: IFlowContext): React.ReactNode {
        if (this.operator == "NOT") {
            return (
                <div className="body">
                    <pre>
                        {" NOT "}
                        {this.isInputProperty("A") ? "A" : this.A}
                    </pre>
                </div>
            );
        }

        if (this.operator == "BETWEEN") {
            return (
                <div className="body">
                    <pre>
                        {this.isInputProperty("B") ? "B" : this.B} {" <= "}
                        {this.isInputProperty("A") ? "A" : this.A} {" <= "}
                        {this.isInputProperty("C") ? "C" : this.C}
                    </pre>
                </div>
            );
        }

        return (
            <div className="body">
                <pre>
                    {this.isInputProperty("A") ? "A" : this.A} {this.operator}{" "}
                    {this.isInputProperty("B") ? "B" : this.B}
                </pre>
            </div>
        );
    }

    buildFlowComponentSpecific(assets: Assets, dataBuffer: DataBuffer) {
        let condition;

        if (this.operator == "=") {
            condition = `(${this.A}) == (${this.B})`;
        } else if (this.operator == "<") {
            condition = `(${this.A}) < (${this.B})`;
        } else if (this.operator == ">") {
            condition = `(${this.A}) > (${this.B})`;
        } else if (this.operator == "<=") {
            condition = `(${this.A}) <= (${this.B})`;
        } else if (this.operator == ">=") {
            condition = `(${this.A}) >= (${this.B})`;
        } else if (this.operator == "<>") {
            condition = `(${this.A}) != (${this.B})`;
        } else if (this.operator == "NOT") {
            condition = `!(${this.A})`;
        } else if (this.operator == "AND") {
            condition = `(${this.A}) && (${this.B})`;
        } else if (this.operator == "OR") {
            condition = `(${this.A}) || (${this.B})`;
        } else if (this.operator == "XOR") {
            condition = `((${this.A}) && !(${this.B})) || (!(${this.A}) && (${this.B}))`;
        } else {
            condition = `((${this.A}) >= (${this.B})) && ((${this.A}) <= (${this.C}))`;
        }

        buildExpression(assets, dataBuffer, this, condition);
    }
}

registerClass("CompareActionComponent", CompareActionComponent);

////////////////////////////////////////////////////////////////////////////////

export class IsTrueActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        flowComponentId: COMPONENT_TYPE_IS_TRUE_ACTION,
        properties: [
            makeExpressionProperty(
                {
                    name: "value",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup
                },
                "boolean"
            )
        ],
        icon: (
            <svg
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
            value: "value",
            customInputs: [
                {
                    name: "value",
                    type: "any"
                }
            ]
        }
    });

    value: any;

    constructor() {
        super();

        makeObservable(this, {
            value: observable
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
                name: "True",
                displayName: "Yes",
                type: "boolean",
                isSequenceOutput: true,
                isOptionalOutput: outputIsOptionalIfAtLeastOneOutputExists
            },
            {
                name: "False",
                displayName: "No",
                type: "boolean",
                isSequenceOutput: true,
                isOptionalOutput: outputIsOptionalIfAtLeastOneOutputExists
            }
        ];
    }

    getBody(flowContext: IFlowContext): React.ReactNode {
        if (
            this.customInputs.length == 1 &&
            this.customInputs[0].name == this.value
        ) {
            return null;
        }

        return (
            <div className="body">
                <pre>{this.value}</pre>
            </div>
        );
    }
}

registerClass("IsTrueActionComponent", IsTrueActionComponent);

////////////////////////////////////////////////////////////////////////////////

export class ConstantActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        flowComponentId: COMPONENT_TYPE_CONSTANT_ACTION,

        properties: [
            makeExpressionProperty(
                {
                    name: "value",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup,
                    expressionIsConstant: true
                },
                "string"
            )
        ],
        icon: (
            <svg
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

    value: string;

    constructor() {
        super();

        makeObservable(this, {
            value: observable
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
                name: "value",
                displayName: this.value,
                type: "any",
                isSequenceOutput: false,
                isOptionalOutput: false
            }
        ];
    }

    buildFlowComponentSpecific(assets: Assets, dataBuffer: DataBuffer) {
        try {
            const { value, valueType } = evalConstantExpression(
                assets.rootProject,
                this.value
            );
            dataBuffer.writeUint16(assets.getConstantIndex(value, valueType));
        } catch (err) {
            assets.DocumentStore.outputSectionsStore.write(
                Section.OUTPUT,
                MessageType.ERROR,
                err.toString(),
                getChildOfObject(this, "value")
            );
            dataBuffer.writeUint16(assets.getConstantIndex(null, "null"));
        }
    }
}

registerClass("ConstantActionComponent", ConstantActionComponent);

////////////////////////////////////////////////////////////////////////////////

export class DateNowActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        icon: (
            <svg viewBox="0 0 36 40">
                <path d="M12 18H8v4h4v-4zm8 0h-4v4h4v-4zm8 0h-4v4h4v-4zm4-14h-2V0h-4v4H10V0H6v4H4C1.78 4 .02 5.8.02 8L0 36c0 2.2 1.78 4 4 4h28c2.2 0 4-1.8 4-4V8c0-2.2-1.8-4-4-4zm0 32H4V14h28v22z" />
            </svg>
        ),
        componentHeaderColor: "#C0C0C0"
    });

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
                name: "value",
                type: "date",
                isSequenceOutput: false,
                isOptionalOutput: false
            }
        ];
    }
}

registerClass("DateNowActionComponent", DateNowActionComponent);

////////////////////////////////////////////////////////////////////////////////

export class ReadSettingActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        properties: [
            makeExpressionProperty(
                {
                    name: "key",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup
                },
                "string"
            )
        ],
        icon: (
            <svg viewBox="0 0 1100 1179">
                <path d="M135 156L277 14q14-14 35-14t35 14l77 77-212 212-77-76q-14-15-14-36t14-35zm520 168l210-210q14-14 24.5-10t10.5 25l-2 599q-1 20-15.5 35T847 778l-597 1q-21 0-25-10.5t10-24.5l208-208-154-155 212-212zM50 879h1000q21 0 35.5 14.5T1100 929v250H0V929q0-21 14.5-35.5T50 879zm850 100v50h100v-50H900z" />
            </svg>
        ),
        componentHeaderColor: "#C0DEED"
    });

    key: string;

    constructor() {
        super();

        makeObservable(this, {
            key: observable
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

    getOutputs(): ComponentOutput[] {
        return [
            ...super.getOutputs(),
            {
                name: "@seqout",
                type: "null" as ValueType,
                isSequenceOutput: true,
                isOptionalOutput: false
            },
            {
                name: "value",
                type: "any",
                isSequenceOutput: false,
                isOptionalOutput: false
            }
        ];
    }

    getBody(flowContext: IFlowContext): React.ReactNode {
        let key;
        if (flowContext.flowState) {
            key = flowContext.flowState.evalExpression(this, this.key);
        } else {
            key = this.key;
        }

        return key ? (
            <div className="body">
                <pre>{key}</pre>
            </div>
        ) : null;
    }
}

registerClass("ReadSettingActionComponent", ReadSettingActionComponent);

////////////////////////////////////////////////////////////////////////////////

export class WriteSettingsActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        properties: [
            makeExpressionProperty(
                {
                    name: "key",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup
                },
                "string"
            ),
            makeExpressionProperty(
                {
                    name: "value",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup
                },
                "any"
            )
        ],
        icon: (
            <svg viewBox="0 0 1100 1200">
                <path d="M350 0l599 2q20 1 35 15.5T999 53l1 597q0 21-10.5 25T965 665L757 457 602 611 390 399l155-154L335 35q-14-14-10-24.5T350 0zm174 688l-76 77q-15 14-36 14t-35-14L235 623q-14-14-14-35t14-35l77-77zM50 900h1000q21 0 35.5 14.5T1100 950v250H0V950q0-21 14.5-35.5T50 900zm850 100v50h100v-50H900z" />
            </svg>
        ),
        componentHeaderColor: "#C0DEED"
    });

    key: string;
    value: string;

    constructor() {
        super();

        makeObservable(this, {
            key: observable,
            value: observable
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
                isOptionalOutput: false
            }
        ];
    }
}

registerClass("WriteSettingsActionComponent", WriteSettingsActionComponent);

////////////////////////////////////////////////////////////////////////////////

export class LogActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        flowComponentId: COMPONENT_TYPE_LOG_ACTION,
        properties: [
            makeExpressionProperty(
                {
                    name: "value",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup
                },
                "string"
            )
        ],
        beforeLoadHook: (object: LogActionComponent, objectJS: any) => {
            if (
                !objectJS.hasOwnProperty("value") &&
                objectJS.customInputs == undefined
            ) {
                objectJS.customInputs = [
                    {
                        name: "value",
                        type: "string"
                    }
                ];
                objectJS.value = "value";
            }
        },
        icon: (
            <svg viewBox="0 0 448 448">
                <path d="M223.988 0C128.473 0 46.934 59.804 14.727 144h34.639c9.396-20.484 22.457-39.35 38.868-55.762C124.497 51.973 172.709 32 223.988 32c51.286 0 99.504 19.973 135.771 56.239C396.027 124.505 416 172.719 416 224c0 51.285-19.973 99.501-56.239 135.765C323.494 396.029 275.275 416 223.988 416c-51.281 0-99.493-19.971-135.755-56.234C71.821 343.354 58.76 324.486 49.362 304H14.725c32.206 84.201 113.746 144 209.264 144C347.703 448 448 347.715 448 224 448 100.298 347.703 0 223.988 0z" />
                <path d="M174.863 291.883l22.627 22.627L288 224l-90.51-90.51-22.628 22.628L226.745 208H0v32h226.745z" />
            </svg>
        ),
        componentHeaderColor: "#C0DEED"
    });

    value: string;

    constructor() {
        super();

        makeObservable(this, {
            value: observable
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
}

registerClass("LogActionComponent", LogActionComponent);

////////////////////////////////////////////////////////////////////////////////

export class CallActionActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        flowComponentId: COMPONENT_TYPE_CALL_ACTION_ACTION,

        properties: [
            makeExpressionProperty(
                {
                    name: "action",
                    type: PropertyType.ObjectReference,
                    referencedObjectCollectionPath: "actions",
                    propertyGridGroup: specificGroup
                },
                "string"
            )
        ],
        label: (component: CallActionActionComponent) => {
            if (!component.action) {
                return ActionComponent.classInfo.label!(component);
            }
            return component.action;
        },
        icon: (
            <svg
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
        },
        check: (component: CallActionActionComponent) => {
            let messages: Message[] = [];

            if (!component.action) {
                messages.push(propertyNotSetMessage(component, "action"));
            } else {
                const action = findAction(
                    getProject(component),
                    component.action
                );
                if (!action) {
                    messages.push(
                        new Message(
                            MessageType.ERROR,
                            `Action "${component.action}" not found`,
                            getChildOfObject(component, "action")
                        )
                    );
                }
            }

            return messages;
        }
    });

    action: string;

    constructor() {
        super();

        makeObservable(this, {
            action: observable
        });
    }

    getInputs(): ComponentInput[] {
        let inputs: ComponentInput[];

        const action = findAction(getProject(this), this.action);
        if (action) {
            if (action.implementationType == "native") {
                inputs = [
                    {
                        name: "@seqin",
                        type: "any" as ValueType,
                        isSequenceInput: true,
                        isOptionalInput: false
                    }
                ];
            } else {
                inputs = action.inputComponents.map(
                    (inputActionComponent: InputActionComponent) => ({
                        name: inputActionComponent.wireID,
                        displayName: inputActionComponent.name
                            ? inputActionComponent.name
                            : NOT_NAMED_LABEL,
                        type: inputActionComponent.inputType,
                        isSequenceInput: false,
                        isOptionalInput: false
                    })
                );

                if (action.startComponent) {
                    inputs.unshift({
                        name: "@seqin",
                        type: "any" as ValueType,
                        isSequenceInput: true,
                        isOptionalInput: false
                    });
                }
            }
        } else {
            inputs = [];
        }

        return [...super.getInputs(), ...inputs];
    }

    getOutputs() {
        let outputs: ComponentOutput[];

        const action = findAction(getProject(this), this.action);
        if (action) {
            if (action.implementationType == "native") {
                outputs = [
                    {
                        name: "@seqout",
                        type: "null" as ValueType,
                        isSequenceOutput: true,
                        isOptionalOutput: true
                    }
                ];
            } else {
                outputs = action.outputComponents.map(
                    (outputActionComponent: OutputActionComponent) => ({
                        name: outputActionComponent.wireID,
                        displayName: outputActionComponent.name
                            ? outputActionComponent.name
                            : NOT_NAMED_LABEL,
                        type: outputActionComponent.outputType,
                        isSequenceOutput: false,
                        isOptionalOutput: true
                    })
                );
                if (action.endComponent) {
                    outputs.unshift({
                        name: "@seqout",
                        type: "null" as ValueType,
                        isSequenceOutput: true,
                        isOptionalOutput: true
                    });
                }
            }
        } else {
            outputs = [];
        }

        return [...super.getOutputs(), ...outputs];
    }

    open() {
        const action = findAction(getProject(this), this.action);
        if (action) {
            getDocumentStore(this).navigationStore.showObjects(
                [action],
                true,
                false,
                false
            );
        }
    }

    buildFlowComponentSpecific(assets: Assets, dataBuffer: DataBuffer) {
        const action = findAction(getProject(this), this.action);
        if (action) {
            if (action.implementationType == "native") {
                dataBuffer.writeInt16(
                    assets.flows.length +
                        assets.getWidgetActionIndex(this, "action")
                );
                dataBuffer.writeUint8(0);
                dataBuffer.writeUint8(0);
            } else {
                const flowIndex = assets.flows.indexOf(action);
                dataBuffer.writeInt16(flowIndex);

                if (action.inputComponents.length > 0) {
                    dataBuffer.writeUint8(
                        this.buildInputs.findIndex(
                            input =>
                                input.name == action.inputComponents[0].wireID
                        )
                    );
                } else {
                    dataBuffer.writeUint8(0);
                }

                if (action.outputComponents.length > 0) {
                    dataBuffer.writeUint8(
                        this.buildOutputs.findIndex(
                            output =>
                                output.name == action.outputComponents[0].wireID
                        )
                    );
                } else {
                    dataBuffer.writeUint8(0);
                }
            }
        } else {
            dataBuffer.writeInt16(-1);
            dataBuffer.writeUint8(0);
            dataBuffer.writeUint8(0);
        }
    }
}

registerClass("CallActionActionComponent", CallActionActionComponent);

////////////////////////////////////////////////////////////////////////////////

export class DynamicCallActionActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        properties: [
            makeExpressionProperty(
                {
                    name: "action",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup
                },
                "string"
            )
        ],
        icon: (
            <svg
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
        componentPaletteGroupName: "Dashboard Specific"
    });

    action: string;

    constructor() {
        super();

        makeObservable(this, {
            action: observable
        });
    }

    getInputs(): ComponentInput[] {
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
}

registerClass(
    "DynamicCallActionActionComponent",
    DynamicCallActionActionComponent
);

////////////////////////////////////////////////////////////////////////////////

export class DelayActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        flowComponentId: COMPONENT_TYPE_DELAY_ACTION,
        properties: [
            makeExpressionProperty(
                {
                    name: "milliseconds",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup
                },
                "integer"
            )
        ],
        icon: (
            <svg viewBox="0 0 10 10">
                <path d="M7.5 5.1c0 .3-.2.5-.5.5H5c-.3 0-.5-.2-.5-.5v-2c0-.3.2-.5.5-.5s.5.2.5.5v1.5H7c.2 0 .5.3.5.5zM10 5c0-2.8-2.2-5-5-5S0 2.2 0 5s2.2 5 5 5 5-2.2 5-5zM9 5c0 2.2-1.8 4-4 4S1 7.2 1 5s1.8-4 4-4 4 1.8 4 4z" />
            </svg>
        ),
        componentHeaderColor: "#E6E0F8"
    });

    milliseconds: string;

    constructor() {
        super();

        makeObservable(this, {
            milliseconds: observable
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
                isOptionalOutput: false
            }
        ];
    }

    getBody(flowContext: IFlowContext): React.ReactNode {
        return (
            <div className="body">
                <pre>{this.milliseconds} ms</pre>
            </div>
        );
    }
}

registerClass("DelayActionComponent", DelayActionComponent);

////////////////////////////////////////////////////////////////////////////////

export class ErrorActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        flowComponentId: COMPONENT_TYPE_ERROR_ACTION,
        properties: [
            makeExpressionProperty(
                {
                    name: "message",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup
                },
                "string"
            )
        ],
        icon: (
            <svg viewBox="0 0 40 40">
                <path d="M18 26h4v4h-4zm0-16h4v12h-4zm1.99-10C8.94 0 0 8.95 0 20s8.94 20 19.99 20S40 31.05 40 20 31.04 0 19.99 0zM20 36c-8.84 0-16-7.16-16-16S11.16 4 20 4s16 7.16 16 16-7.16 16-16 16z" />
            </svg>
        ),
        componentHeaderColor: "#fc9b9b"
    });

    message: string;

    constructor() {
        super();

        makeObservable(this, {
            message: observable
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
}

registerClass("ErrorActionComponent", ErrorActionComponent);

////////////////////////////////////////////////////////////////////////////////

export class CatchErrorActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        flowComponentId: COMPONENT_TYPE_CATCH_ERROR_ACTION,
        properties: [],
        icon: (
            <svg viewBox="0 0 40 40">
                <path d="M20 0C8.96 0 0 8.95 0 20s8.96 20 20 20 20-8.95 20-20S31.04 0 20 0zm2 30h-4v-4h4v4zm0-8h-4V10h4v12z" />
            </svg>
        ),
        componentHeaderColor: "#FFAAAA"
    });

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
                name: "Message",
                type: "string",
                isSequenceOutput: false,
                isOptionalOutput: false
            }
        ];
    }
}

registerClass("CatchErrorActionComponent", CatchErrorActionComponent);

////////////////////////////////////////////////////////////////////////////////

export class CounterActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        flowComponentId: COMPONENT_TYPE_COUNTER_ACTION,
        properties: [
            makeExpressionProperty(
                {
                    name: "countValue",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup
                },
                "integer"
            )
        ],
        icon: (
            <svg
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

    countValue: number;

    constructor() {
        super();

        makeObservable(this, {
            countValue: observable
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

    getOutputs(): ComponentOutput[] {
        return [
            ...super.getOutputs(),
            {
                name: "@seqout",
                type: "null" as ValueType,
                isSequenceOutput: true,
                isOptionalOutput: false
            },
            {
                name: "done",
                type: "null",
                isSequenceOutput: true,
                isOptionalOutput: true
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
}

registerClass("CounterActionComponent", CounterActionComponent);

////////////////////////////////////////////////////////////////////////////////

export class LoopActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        flowComponentId: COMPONENT_TYPE_LOOP_ACTION,

        properties: [
            makeAssignableExpressionProperty(
                {
                    name: "variable",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup
                },
                "integer"
            ),
            makeExpressionProperty(
                {
                    name: "from",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup
                },
                "integer"
            ),
            makeExpressionProperty(
                {
                    name: "to",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup
                },
                "integer"
            ),
            makeExpressionProperty(
                {
                    name: "step",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup
                },
                "integer"
            ),
            {
                name: "version",
                type: PropertyType.Number,
                hideInPropertyGrid: true
            }
        ],
        beforeLoadHook: (object: IEezObject, jsObject: any) => {
            if (jsObject.version == undefined) {
                jsObject.version = 1;
                jsObject.to = jsObject.to + " - 1";
            }
        },
        icon: (
            <svg
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
        componentHeaderColor: "#E2D96E",
        defaultValue: {
            from: "0",
            step: "1",
            version: 1
        }
    });

    variable: string;
    from: string;
    to: string;
    step: string;

    constructor() {
        super();

        makeObservable(this, {
            variable: observable,
            from: observable,
            to: observable,
            step: observable
        });
    }

    getInputs() {
        return [
            {
                name: "start",
                type: "any" as ValueType,
                isSequenceInput: true,
                isOptionalInput: false
            },
            {
                name: "next",
                type: "any" as ValueType,
                isSequenceInput: true,
                isOptionalInput: false
            },
            ...super.getInputs()
        ];
    }

    getOutputs(): ComponentOutput[] {
        return [
            ...super.getOutputs(),
            {
                name: "@seqout",
                type: "null" as ValueType,
                isSequenceOutput: true,
                isOptionalOutput: false
            },
            {
                name: "done",
                type: "null",
                isSequenceOutput: true,
                isOptionalOutput: true
            }
        ];
    }

    getBody(flowContext: IFlowContext): React.ReactNode {
        return (
            <div className="body">
                <pre>
                    {this.variable} <LeftArrow />[ {this.from} ... {this.to} ]
                    {this.step !== "1" ? ` step ${this.step}` : ""}
                </pre>
            </div>
        );
    }
}

registerClass("LoopActionComponent", LoopActionComponent);

////////////////////////////////////////////////////////////////////////////////

export class ShowPageActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        flowComponentId: COMPONENT_TYPE_SHOW_PAGE_ACTION,
        properties: [
            {
                name: "page",
                type: PropertyType.ObjectReference,
                propertyGridGroup: specificGroup,
                referencedObjectCollectionPath: "pages"
            }
        ],
        check: (object: ShowPageActionComponent) => {
            let messages: Message[] = [];

            if (!object.page) {
                messages.push(propertyNotSetMessage(object, "page"));
            } else {
                let page = findPage(getProject(object), object.page);
                if (!page) {
                    messages.push(propertyNotFoundMessage(object, "page"));
                }
            }

            return messages;
        },
        icon: (
            <svg viewBox="0 0 36 36">
                <path d="M0 20h16V0H0v20zm0 16h16V24H0v12zm20 0h16V16H20v20zm0-36v12h16V0H20z" />
            </svg>
        ),
        componentHeaderColor: "#DEB887"
    });

    page: string;

    constructor() {
        super();

        makeObservable(this, {
            page: observable
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

    getBody(flowContext: IFlowContext): React.ReactNode {
        return (
            <div className="body">
                <pre>{this.page}</pre>
            </div>
        );
    }

    buildFlowComponentSpecific(assets: Assets, dataBuffer: DataBuffer) {
        // page
        let page: number = 0;
        if (this.page) {
            page = assets.getPageIndex(this, "page");
        }
        dataBuffer.writeInt16(page);
    }
}

registerClass("ShowPageActionComponent", ShowPageActionComponent);

////////////////////////////////////////////////////////////////////////////////

const MESSAGE_BOX_TYPE_INFO = 1;
const MESSAGE_BOX_TYPE_ERROR = 2;

export class ShowMessageBoxActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        flowComponentId: COMPONENT_TYPE_SHOW_MESSAGE_BOX_ACTION,
        properties: [
            {
                name: "messageType",
                type: PropertyType.Enum,
                enumItems: [
                    { id: MESSAGE_BOX_TYPE_INFO, label: "Info" },
                    { id: MESSAGE_BOX_TYPE_ERROR, label: "Error" }
                ],
                propertyGridGroup: specificGroup
            },
            makeExpressionProperty(
                {
                    name: "message",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup
                },
                "string"
            )
        ],
        icon: (
            <svg
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path d="M0 0h24v24H0z" stroke="none" />
                <path d="M4 21V8a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H8l-4 4M8 9h8M8 13h6" />
            </svg>
        ),
        componentHeaderColor: "#DEB887"
    });

    messageType: number;
    message: string;

    constructor() {
        super();

        makeObservable(this, {
            messageType: observable,
            message: observable
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

    getBody(flowContext: IFlowContext): React.ReactNode {
        return (
            <div className="body">
                <pre>
                    {this.messageType == MESSAGE_BOX_TYPE_INFO
                        ? "Info: "
                        : this.messageType == MESSAGE_BOX_TYPE_ERROR
                        ? "Error: "
                        : ""}
                    : {this.message}
                </pre>
            </div>
        );
    }

    buildFlowComponentSpecific(assets: Assets, dataBuffer: DataBuffer) {
        // type
        dataBuffer.writeUint8(this.messageType);
    }
}

registerClass("ShowMessageBoxActionComponent", ShowMessageBoxActionComponent);

////////////////////////////////////////////////////////////////////////////////

export class ShowKeyboardActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        flowComponentId: COMPONENT_TYPE_SHOW_KEYBOARD_ACTION,
        properties: [
            makeExpressionProperty(
                {
                    name: "label",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup
                },
                "string"
            ),
            makeExpressionProperty(
                {
                    name: "initalText",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup
                },
                "string"
            ),
            makeExpressionProperty(
                {
                    name: "minChars",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup
                },
                "integer"
            ),
            makeExpressionProperty(
                {
                    name: "maxChars",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup
                },
                "integer"
            ),
            {
                name: "password",
                type: PropertyType.Boolean,
                propertyGridGroup: specificGroup
            }
        ],
        icon: (
            <svg
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path d="M0 0h24v24H0z" stroke="none" />
                <rect x="2" y="6" width="20" height="12" rx="2" />
                <path d="M6 10h0M10 10h0M14 10h0M18 10h0M6 14v.01M18 14v.01M10 14h4" />
            </svg>
        ),
        componentHeaderColor: "#DEB887"
    });

    label: string;
    initalText: string;
    minChars: string;
    maxChars: string;
    password: boolean;

    constructor() {
        super();

        makeObservable(this, {
            label: observable,
            initalText: observable,
            minChars: observable,
            maxChars: observable,
            password: observable
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
                name: "result",
                type: "string" as ValueType,
                isSequenceOutput: false,
                isOptionalOutput: false
            },
            {
                name: "canceled",
                type: "null" as ValueType,
                isSequenceOutput: false,
                isOptionalOutput: true
            }
        ];
    }

    getBody(flowContext: IFlowContext): React.ReactNode {
        return (
            <div className="body">
                <pre>
                    {this.label ? this.label + ": " : ""} {this.initalText}
                </pre>
            </div>
        );
    }

    buildFlowComponentSpecific(assets: Assets, dataBuffer: DataBuffer) {
        // type
        dataBuffer.writeUint8(this.password ? 1 : 0);
    }
}

registerClass("ShowKeyboardActionComponent", ShowKeyboardActionComponent);

////////////////////////////////////////////////////////////////////////////////

export class ShowKeypadActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        flowComponentId: COMPONENT_TYPE_SHOW_KEYPAD_ACTION,
        properties: [
            makeExpressionProperty(
                {
                    name: "label",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup
                },
                "string"
            ),
            makeExpressionProperty(
                {
                    name: "initalValue",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup
                },
                "float"
            ),
            makeExpressionProperty(
                {
                    name: "min",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup
                },
                "integer"
            ),
            makeExpressionProperty(
                {
                    name: "max",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup
                },
                "integer"
            ),
            makeExpressionProperty(
                {
                    name: "precision",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup
                },
                "float"
            ),
            makeExpressionProperty(
                {
                    name: "unit",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup
                },
                "string"
            )
        ],
        icon: (
            <svg viewBox="0 0 50 50">
                <path d="M5 3c-1.103 0-2 .897-2 2v4c0 1.103.897 2 2 2h8c1.103 0 2-.897 2-2V5c0-1.103-.897-2-2-2H5zm16 0c-1.103 0-2 .897-2 2v4c0 1.103.897 2 2 2h8c1.103 0 2-.897 2-2V5c0-1.103-.897-2-2-2h-8zm16 0c-1.103 0-2 .897-2 2v4c0 1.103.897 2 2 2h8c1.103 0 2-.897 2-2V5c0-1.103-.897-2-2-2h-8zM5 15c-1.103 0-2 .897-2 2v4c0 1.103.897 2 2 2h8c1.103 0 2-.897 2-2v-4c0-1.103-.897-2-2-2H5zm16 0c-1.103 0-2 .897-2 2v4c0 1.103.897 2 2 2h8c1.103 0 2-.897 2-2v-4c0-1.103-.897-2-2-2h-8zm16 0c-1.103 0-2 .897-2 2v4c0 1.103.897 2 2 2h8c1.103 0 2-.897 2-2v-4c0-1.103-.897-2-2-2h-8zM5 27c-1.103 0-2 .897-2 2v4c0 1.103.897 2 2 2h8c1.103 0 2-.897 2-2v-4c0-1.103-.897-2-2-2H5zm16 0c-1.103 0-2 .897-2 2v4c0 1.103.897 2 2 2h8c1.103 0 2-.897 2-2v-4c0-1.103-.897-2-2-2h-8zm16 0c-1.103 0-2 .897-2 2v4c0 1.103.897 2 2 2h8c1.103 0 2-.897 2-2v-4c0-1.103-.897-2-2-2h-8zM21 39c-1.103 0-2 .897-2 2v4c0 1.103.897 2 2 2h8c1.103 0 2-.897 2-2v-4c0-1.103-.897-2-2-2h-8z" />
            </svg>
        ),
        componentHeaderColor: "#DEB887"
    });

    label: string;
    initalValue: string;
    min: string;
    max: string;
    precision: string;
    unit: string;

    constructor() {
        super();

        makeObservable(this, {
            label: observable,
            initalValue: observable,
            min: observable,
            max: observable,
            precision: observable,
            unit: observable
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
                name: "result",
                type: "float" as ValueType,
                isSequenceOutput: false,
                isOptionalOutput: false
            },
            {
                name: "canceled",
                type: "null" as ValueType,
                isSequenceOutput: false,
                isOptionalOutput: true
            }
        ];
    }

    getBody(flowContext: IFlowContext): React.ReactNode {
        return (
            <div className="body">
                <pre>
                    {this.label && this.label != '""' ? this.label + ": " : ""}{" "}
                    {this.initalValue}
                </pre>
            </div>
        );
    }
}

registerClass("ShowKeypadActionComponent", ShowKeypadActionComponent);

////////////////////////////////////////////////////////////////////////////////

export class NoopActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        flowComponentId: COMPONENT_TYPE_NOOP_ACTION,

        properties: [
            {
                name: "name",
                type: PropertyType.String,
                propertyGridGroup: specificGroup
            }
        ],
        check: (inputActionComponent: InputActionComponent) => {
            let messages: Message[] = [];
            if (!inputActionComponent.name) {
                messages.push(
                    propertyNotSetMessage(inputActionComponent, "name")
                );
            }
            return messages;
        },
        label: (component: InputActionComponent) => {
            if (!component.name) {
                return NOT_NAMED_LABEL;
            }
            return component.name;
        },
        icon: (
            <svg
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path d="M0 0h24v24H0z" stroke="none" />
                <rect x="4" y="4" width="16" height="16" rx="2" />
            </svg>
        ),
        componentHeaderColor: "#fff5c2"
    });

    name: string;

    constructor() {
        super();

        makeObservable(this, {
            name: observable
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
}

registerClass("NoopActionComponent", NoopActionComponent);

////////////////////////////////////////////////////////////////////////////////

const TrixEditor = observer(
    ({
        component,
        flowContext,
        value,
        setValue
    }: {
        component: CommentActionComponent;
        flowContext: IFlowContext;
        value: string;
        setValue: (value: string) => void;
    }) => {
        const inputId = React.useMemo<string>(() => guid(), []);
        const editorId = React.useMemo<string>(() => guid(), []);

        React.useEffect(() => {
            const trixEditor = document.getElementById(editorId) as HTMLElement;

            if (value != trixEditor.innerHTML) {
                (trixEditor as any).editor.loadHTML(value);
            }

            const onChange = () => {
                const geometry = calcComponentGeometry(
                    component,
                    trixEditor.closest(
                        ".EezStudio_ComponentEnclosure"
                    )! as HTMLElement,
                    flowContext
                );

                runInAction(() => {
                    component.geometry = geometry;
                });
            };
            const onFocus = () => {
                const trixToolbar =
                    trixEditor.parentElement?.querySelector("trix-toolbar");
                if (trixToolbar instanceof HTMLElement) {
                    trixToolbar.style.visibility = "visible";
                }

                if (trixEditor.innerHTML != value) {
                    setValue(trixEditor.innerHTML);
                }
            };
            const onBlur = () => {
                const trixToolbar =
                    trixEditor.parentElement?.querySelector("trix-toolbar");
                if (trixToolbar instanceof HTMLElement) {
                    trixToolbar.style.visibility = "";
                }

                if (trixEditor.innerHTML != value) {
                    setValue(trixEditor.innerHTML);
                }
            };
            trixEditor.addEventListener("trix-change", onChange, false);
            trixEditor.addEventListener("trix-focus", onFocus, false);
            trixEditor.addEventListener("trix-blur", onBlur, false);

            return () => {
                trixEditor.removeEventListener("trix-change", onChange, false);
                trixEditor.removeEventListener("trix-focus", onFocus, false);
                trixEditor.removeEventListener("trix-blur", onBlur, false);
            };
        }, [value]);

        var attributes: { [key: string]: string } = {
            id: editorId,
            input: inputId
        };

        return (
            <div className="EezStudio_TrixEditor" tabIndex={0}>
                {React.createElement("trix-editor", attributes)}
                <input id={inputId} value={value ?? ""} type="hidden"></input>
            </div>
        );
    }
);

export class CommentActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        flowComponentId: COMPONENT_TYPE_COMMENT_ACTION,

        label: () => "",

        properties: [
            {
                name: "text",
                type: PropertyType.String,
                hideInPropertyGrid: true
            }
        ],
        icon: (
            <svg viewBox="0 0 14 13.5">
                <path d="M13 0H1C.45 0 0 .45 0 1v8c0 .55.45 1 1 1h2v3.5L6.5 10H13c.55 0 1-.45 1-1V1c0-.55-.45-1-1-1zm0 9H6l-2 2V9H1V1h12v8z" />
            </svg>
        ),
        componentHeaderColor: "#fff5c2",
        isFlowExecutableComponent: false,
        getResizeHandlers(object: CommentActionComponent) {
            return object.getResizeHandlers();
        },
        defaultValue: {
            left: 0,
            top: 0,
            width: 435,
            height: 134
        }
    });

    text: string;

    constructor() {
        super();

        makeObservable(this, {
            text: observable
        });
    }

    get autoSize(): AutoSize {
        return "height";
    }

    getResizeHandlers(): IResizeHandler[] | undefined | false {
        return [
            {
                x: 0,
                y: 50,
                type: "w-resize"
            },
            {
                x: 100,
                y: 50,
                type: "e-resize"
            }
        ];
    }

    getClassName() {
        return classNames(
            super.getClassName(),
            "EezStudio_CommentActionComponent"
        );
    }

    getBody(flowContext: IFlowContext): React.ReactNode {
        return (
            <TrixEditor
                component={this}
                flowContext={flowContext}
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

registerClass("CommentActionComponent", CommentActionComponent);
