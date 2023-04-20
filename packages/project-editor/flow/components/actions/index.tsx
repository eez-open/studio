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
    MessageType,
    getId,
    IMessage
} from "project-editor/core/object";
import {
    getAncestorOfType,
    getChildOfObject,
    getListLabel,
    getProjectStore,
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
import { getProject, ProjectType } from "project-editor/project/project";
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
    getStructureFromType,
    ValueType,
    VariableTypeUI
} from "project-editor/features/variable/value-type";
import { specificGroup } from "project-editor/ui-components/PropertyGrid/groups";
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
    COMPONENT_TYPE_COMMENT_ACTION,
    COMPONENT_TYPE_SELECT_LANGUAGE_ACTION,
    COMPONENT_TYPE_SET_PAGE_DIRECTION_ACTION,
    COMPONENT_TYPE_ANIMATE_ACTION,
    COMPONENT_TYPE_ON_EVENT_ACTION,
    COMPONENT_TYPE_OVERRIDE_STYLE_ACTION,
    COMPONENT_TYPE_SORT_ARRAY_ACTION
} from "project-editor/flow/components/component_types";
import { makeEndInstruction } from "project-editor/flow/expression/instructions";
import { ProjectEditor } from "project-editor/project-editor-interface";
import { LANGUAGE_ICON, LOG_ICON } from "project-editor/ui-components/icons";
import { humanize } from "eez-studio-shared/string";
import { LeftArrow, RightArrow } from "project-editor/ui-components/icons";
import { Icon } from "eez-studio-ui/icon";
import type { IDashboardComponentContext } from "eez-studio-types";

const NOT_NAMED_LABEL = "<not named>";

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
        check: (
            inputActionComponent: InputActionComponent,
            messages: IMessage[]
        ) => {
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
        const flow = ProjectEditor.getFlow(this);
        dataBuffer.writeUint8(flow.inputComponents.indexOf(this));
    }
}

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
        check: (
            outputActionComponent: OutputActionComponent,
            messages: IMessage[]
        ) => {
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
        const flow = ProjectEditor.getFlow(this);
        dataBuffer.writeUint8(flow.outputComponents.indexOf(this));
    }
}

////////////////////////////////////////////////////////////////////////////////

export class EvalExprActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        flowComponentId: COMPONENT_TYPE_EVAL_EXPR_ACTION,
        label: () => "Evaluate",
        componentPaletteLabel: "Evaluate",
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

////////////////////////////////////////////////////////////////////////////////

export class WatchVariableActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        flowComponentId: COMPONENT_TYPE_WATCH_VARIABLE_ACTION,
        label: () => "Watch",
        componentPaletteLabel: "Watch",
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

////////////////////////////////////////////////////////////////////////////////

export class EvalJSExprActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        label: () => "Eval JS",
        componentPaletteLabel: "Eval JS",
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
        beforeLoadHook: (
            component: EvalJSExprActionComponent,
            jsComponent: Partial<EvalJSExprActionComponent>
        ) => {
            if (
                !jsComponent.customOutputs ||
                jsComponent.customOutputs.length == 0
            ) {
                jsComponent.customOutputs = [
                    {
                        name: "result",
                        type: "any"
                    }
                ] as any;
            }
        },
        check: (component: EvalJSExprActionComponent, messages: IMessage[]) => {
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
        },
        icon: (
            <svg viewBox="0 0 22.556997299194336 17.176000595092773">
                <path d="M4.912.27h3.751v10.514c0 4.738-2.271 6.392-5.899 6.392-.888 0-2.024-.148-2.764-.395l.42-3.036a6.18 6.18 0 0 0 1.925.296c1.58 0 2.567-.716 2.567-3.282V.27zm7.008 12.785c.987.518 2.567 1.037 4.171 1.037 1.728 0 2.641-.716 2.641-1.826 0-1.012-.79-1.629-2.789-2.32-2.764-.987-4.59-2.517-4.59-4.961C11.353 2.147 13.747 0 17.646 0c1.9 0 3.258.37 4.245.839l-.839 3.011a7.779 7.779 0 0 0-3.455-.79c-1.629 0-2.419.765-2.419 1.604 0 1.061.913 1.53 3.085 2.369 2.937 1.086 4.294 2.616 4.294 4.985 0 2.789-2.122 5.158-6.688 5.158-1.9 0-3.776-.518-4.714-1.037l.765-3.085z" />
            </svg>
        ),
        componentHeaderColor: "#A6BBCF",
        defaultValue: {
            customOutputs: [
                {
                    name: "result",
                    type: "any"
                }
            ]
        },

        execute: (context: IDashboardComponentContext) => {
            const expression = context.getStringParam(0);
            const expressionValues = context.getExpressionListParam(4);

            const values: any = {};
            for (let i = 0; i < expressionValues.length; i++) {
                const name = `_val${i}`;
                values[name] = expressionValues[i];
            }

            try {
                let result = eval(expression);

                context.propagateValue("result", result);
                context.propagateValueThroughSeqout();
            } catch (err) {
                console.info(
                    "Error in EvalJSExprActionComponent_execute",
                    err.toString()
                );
                context.throwError(err.toString());
            }
        }
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
                    `{${valueExpression}}`,
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
                assets.projectStore.outputSectionsStore.write(
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
        check: (setVariableItem: SetVariableEntry, messages: IMessage[]) => {
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
        },
        defaultValue: {},
        listLabel: (entry: SetVariableEntry, collapsed) =>
            !collapsed ? (
                ""
            ) : (
                <>
                    {entry.variable}
                    <LeftArrow />
                    {entry.value}
                </>
            )
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
                arrayItemOrientation: "vertical",
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
                    <pre key={getId(entry)}>
                        {`#${i + 1} `}
                        {getListLabel(entry, true)}
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

////////////////////////////////////////////////////////////////////////////////

class SwitchTest extends EezObject {
    condition: string;
    outputName: string;
    outputValue: string;

    static classInfo: ClassInfo = {
        properties: [
            makeExpressionProperty(
                {
                    name: "condition",
                    displayName: "When",
                    type: PropertyType.MultilineText
                },
                "boolean"
            ),
            {
                name: "outputName",
                displayName: "Then output",
                type: PropertyType.String,
                unique: componentOutputUnique
            },
            makeExpressionProperty(
                {
                    name: "outputValue",
                    displayName: "With value",
                    type: PropertyType.MultilineText
                },
                "any"
            )
        ],

        listLabel: (test: SwitchTest, collapsed) =>
            !collapsed
                ? ""
                : `WHEN ${test.condition} THEN OUTPUT ${test.outputName}${
                      test.outputValue ? ` WITH VALUE ${test.outputValue}` : ""
                  }`,

        check: (switchTest: SwitchTest, messages: IMessage[]) => {
            try {
                checkExpression(
                    getParent(getParent(switchTest)!)! as Component,
                    switchTest.condition
                );
            } catch (err) {
                messages.push(
                    new Message(
                        MessageType.ERROR,
                        `Invalid condition expression: ${err}`,
                        getChildOfObject(switchTest, "condition")
                    )
                );
            }

            if (switchTest.outputValue) {
                try {
                    checkExpression(
                        getParent(getParent(switchTest)!)! as Component,
                        switchTest.outputValue
                    );
                } catch (err) {
                    messages.push(
                        new Message(
                            MessageType.ERROR,
                            `Invalid output value expression: ${err}`,
                            getChildOfObject(switchTest, "outputValue")
                        )
                    );
                }
            }
        },

        updateObjectValueHook: (switchTest: SwitchTest, values: any) => {
            if (
                values.outputName != undefined &&
                switchTest.outputName != values.outputName
            ) {
                const component = getAncestorOfType<Component>(
                    switchTest,
                    Component.classInfo
                );
                if (component) {
                    ProjectEditor.getFlow(
                        component
                    ).rerouteConnectionLinesOutput(
                        component,
                        switchTest.outputName,
                        values.outputName
                    );
                }
            }
        },

        deleteObjectRefHook: (switchTest: SwitchTest) => {
            const component = getAncestorOfType<Component>(
                switchTest,
                Component.classInfo
            ) as Component;

            ProjectEditor.getFlow(component).deleteConnectionLinesFromOutput(
                component,
                switchTest.outputName
            );
        },

        defaultValue: {}
    };

    constructor() {
        super();

        makeObservable(this, {
            condition: observable,
            outputName: observable,
            outputValue: observable
        });
    }
}

export class SwitchActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        flowComponentId: COMPONENT_TYPE_SWITCH_ACTION,
        label: () => "SwitchCase",
        componentPaletteLabel: "SwitchCase",
        properties: [
            {
                name: "tests",
                displayName: "Cases",
                type: PropertyType.Array,
                typeClass: SwitchTest,
                arrayItemOrientation: "vertical",
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
                <path d="M21 17h-8l-3.5 -5h-6.5"></path>
                <path d="M21 7h-8l-3.495 5"></path>
                <path d="M18 10l3 -3l-3 -3"></path>
                <path d="M18 20l3 -3l-3 -3"></path>
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
                    type: "any" as ValueType,
                    isSequenceOutput: true,
                    isOptionalOutput: false
                }))
        ];
    }

    getBody(flowContext: IFlowContext): React.ReactNode {
        return (
            <div className="body">
                {this.tests.map((test, i) => (
                    <pre key={getId(test)}>
                        {`#${i + 1} `}
                        {test.condition}
                    </pre>
                ))}
            </div>
        );
    }

    buildFlowComponentSpecific(assets: Assets, dataBuffer: DataBuffer) {
        dataBuffer.writeArray(this.tests, test => {
            dataBuffer.writeUint32(
                this.buildOutputs.findIndex(
                    output => output.name == test.outputName
                )
            );

            dataBuffer.writeObjectOffset(() => {
                buildExpression(assets, dataBuffer, this, test.condition);
            });

            dataBuffer.writeObjectOffset(() => {
                buildExpression(
                    assets,
                    dataBuffer,
                    this,
                    test.outputValue || "true"
                );
            });
        });
    }
}

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
            assets.projectStore.outputSectionsStore.write(
                Section.OUTPUT,
                MessageType.ERROR,
                err.toString(),
                getChildOfObject(this, "value")
            );
            dataBuffer.writeUint16(assets.getConstantIndex(null, "null"));
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

export class DateNowActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        icon: (
            <svg viewBox="0 0 36 40">
                <path d="M12 18H8v4h4v-4zm8 0h-4v4h4v-4zm8 0h-4v4h4v-4zm4-14h-2V0h-4v4H10V0H6v4H4C1.78 4 .02 5.8.02 8L0 36c0 2.2 1.78 4 4 4h28c2.2 0 4-1.8 4-4V8c0-2.2-1.8-4-4-4zm0 32H4V14h28v22z" />
            </svg>
        ),
        componentHeaderColor: "#C0C0C0",
        execute: (context: IDashboardComponentContext) => {
            context.propagateValue("value", Date.now());
            context.propagateValueThroughSeqout();
        }
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

////////////////////////////////////////////////////////////////////////////////

export class SortArrayActionComponent extends ActionComponent {
    array: string;
    structureName: string;
    structureFieldName: string;
    ascending: boolean;
    ignoreCase: boolean;

    constructor() {
        super();
        makeObservable(this, {
            array: observable,
            structureName: observable,
            structureFieldName: observable,
            ascending: true,
            ignoreCase: true
        });
    }

    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        flowComponentId: COMPONENT_TYPE_SORT_ARRAY_ACTION,
        properties: [
            makeExpressionProperty(
                {
                    name: "array",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup
                },
                "array:any"
            ),
            {
                name: "structureName",
                type: PropertyType.ObjectReference,
                referencedObjectCollectionPath: "variables/structures",
                propertyGridGroup: specificGroup
            },
            {
                name: "structureFieldName",
                type: PropertyType.Enum,
                enumItems: (component: SortArrayActionComponent) => {
                    if (!component.structureName) {
                        return [];
                    }

                    const project = ProjectEditor.getProject(component);
                    const struct = getStructureFromType(
                        project,
                        `struct:${component.structureName}`
                    );
                    if (!struct) {
                        return [];
                    }

                    return struct.fields.map(field => ({
                        id: field.name,
                        label: field.name
                    }));
                },
                propertyGridGroup: specificGroup,
                hideInPropertyGrid: (component: SortArrayActionComponent) => {
                    if (!component.structureName) {
                        return true;
                    }

                    const project = ProjectEditor.getProject(component);
                    if (
                        !getStructureFromType(
                            project,
                            `struct:${component.structureName}`
                        )
                    ) {
                        return true;
                    }

                    return false;
                }
            },
            {
                name: "ascending",
                type: PropertyType.Boolean,
                checkboxStyleSwitch: true,
                propertyGridGroup: specificGroup
            },
            {
                name: "ignoreCase",
                type: PropertyType.Boolean,
                checkboxStyleSwitch: true,
                propertyGridGroup: specificGroup
            }
        ],
        icon: (
            <svg
                strokeWidth="2"
                stroke="currentColor"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                viewBox="0 0 24 24"
            >
                <path d="M0 0h24v24H0z" stroke="none" />
                <path d="M4 6h7m-7 6h7m-7 6h9m2-9 3-3 3 3m-3-3v12" />
            </svg>
        ),
        componentHeaderColor: "#C0C0C0",
        defaultValue: {
            ignoreCase: true,
            ascending: true
        },
        check: (component: SortArrayActionComponent, messages: IMessage[]) => {
            if (component.structureName) {
                const project = ProjectEditor.getProject(component);
                const struct = getStructureFromType(
                    project,
                    `struct:${component.structureName}`
                );
                if (!struct) {
                    messages.push(
                        propertyNotFoundMessage(component, "structureName")
                    );
                } else if (!component.structureFieldName) {
                    messages.push(
                        propertyNotSetMessage(component, "structureName")
                    );
                } else if (
                    !struct.fieldsMap.get(component.structureFieldName)
                ) {
                    messages.push(
                        propertyNotFoundMessage(component, "structureFieldName")
                    );
                }
            }
        }
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
                name: "result",
                type: "any" as ValueType,
                isSequenceOutput: false,
                isOptionalOutput: false
            }
        ];
    }

    getBody(flowContext: IFlowContext): React.ReactNode {
        let bodyText;
        if (this.structureName) {
            bodyText = `${this.array} BY ${this.structureName}.${this.structureFieldName}`;
        } else {
            bodyText = `${this.array}`;
        }

        bodyText += this.ascending ? " ASCENDING" : " DESCENDING";

        bodyText += this.ignoreCase ? " IGNORE CASE" : " CASE SENSITIVE";

        return (
            <div className="body">
                <pre>{bodyText}</pre>
            </div>
        );
    }

    buildFlowComponentSpecific(assets: Assets, dataBuffer: DataBuffer) {
        // arrayType
        if (this.structureName) {
            dataBuffer.writeInt32(
                assets.getTypeIndex(`array:struct:${this.structureName}`)
            );
        } else {
            dataBuffer.writeInt32(-1);
        }

        // structFieldIndex
        dataBuffer.writeInt32(
            assets.projectStore.typesStore.getFieldIndex(
                `struct:${this.structureName}`,
                this.structureFieldName
            ) ?? -1
        );

        // flags
        const SORT_ARRAY_FLAG_ASCENDING = 1 << 0;
        const SORT_ARRAY_FLAG_IGNORE_CASE = 1 << 1;
        let flags = 0;
        if (this.ascending) {
            flags |= SORT_ARRAY_FLAG_ASCENDING;
        }
        if (this.ignoreCase) {
            flags |= SORT_ARRAY_FLAG_IGNORE_CASE;
        }
        dataBuffer.writeUint32(flags);
    }
}

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
        icon: LOG_ICON,
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

    getBody(flowContext: IFlowContext): React.ReactNode {
        if (
            this.value === "value" &&
            this.customInputs.find(customInput => customInput.name === "value")
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
                return "CallAction";
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
        check: (component: CallActionActionComponent, messages: IMessage[]) => {
            if (!component.action) {
                messages.push(propertyNotSetMessage(component, "action"));
            } else {
                const action = ProjectEditor.findAction(
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

        const action = ProjectEditor.findAction(getProject(this), this.action);
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
                        name: inputActionComponent.objID,
                        displayName: inputActionComponent.name
                            ? inputActionComponent.name
                            : NOT_NAMED_LABEL,
                        type: inputActionComponent.inputType,
                        isSequenceInput: false,
                        isOptionalInput: false
                    })
                );

                inputs.unshift({
                    name: "@seqin",
                    type: "any" as ValueType,
                    isSequenceInput: true,
                    isOptionalInput: !action.startComponent,
                    alwaysBuild: action.startComponent ? true : false
                });
            }
        } else {
            inputs = [];
        }

        return [...super.getInputs(), ...inputs];
    }

    getOutputs() {
        let outputs: ComponentOutput[];

        const action = ProjectEditor.findAction(getProject(this), this.action);
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
                        name: outputActionComponent.objID,
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
        const action = ProjectEditor.findAction(getProject(this), this.action);
        if (action) {
            getProjectStore(this).navigationStore.showObjects(
                [action],
                true,
                false,
                false
            );
        }
    }

    buildFlowComponentSpecific(assets: Assets, dataBuffer: DataBuffer) {
        const action = ProjectEditor.findAction(getProject(this), this.action);
        if (action) {
            if (
                assets.option == "buildFiles" &&
                action.implementationType == "native"
            ) {
                // flowIndex
                dataBuffer.writeInt16(
                    assets.flows.length +
                        assets.getWidgetActionIndex(this, "action")
                );
                // inputsStartIndex
                dataBuffer.writeUint8(0);
                // outputsStartIndex
                dataBuffer.writeUint8(0);
            } else {
                // flowIndex
                const flowIndex = assets.flows.indexOf(action);
                dataBuffer.writeInt16(flowIndex);

                // inputsStartIndex
                if (action.inputComponents.length > 0) {
                    dataBuffer.writeUint8(
                        this.buildInputs.findIndex(
                            input =>
                                input.name == action.inputComponents[0].objID
                        )
                    );
                } else {
                    dataBuffer.writeUint8(0);
                }

                // outputsStartIndex
                if (action.outputComponents.length > 0) {
                    dataBuffer.writeUint8(
                        this.buildOutputs.findIndex(
                            output =>
                                output.name == action.outputComponents[0].objID
                        )
                    );
                } else {
                    dataBuffer.writeUint8(0);
                }
            }
        } else {
            // flowIndex
            dataBuffer.writeInt16(-1);
            // inputsStartIndex
            dataBuffer.writeUint8(0);
            // outputsStartIndex
            dataBuffer.writeUint8(0);
        }
    }
}

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
        componentPaletteGroupName: "Dashboard Specific",
        execute: (context: IDashboardComponentContext) => {
            const actionName = context.evalProperty<string>("action");

            if (actionName == undefined || typeof actionName != "string") {
                context.throwError(`Invalid action name property`);
                return;
            }

            const flowIndex =
                context.WasmFlowRuntime.assetsMap.actionFlowIndexes[actionName];
            if (flowIndex == undefined) {
                context.throwError(`Invalid action name: ${actionName}`);
                return;
            }

            context.executeCallAction(flowIndex);
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
                <path d="M4 12v-3a3 3 0 0 1 3 -3h13m-3 -3l3 3l-3 3"></path>
                <path d="M20 12v3a3 3 0 0 1 -3 3h-13m3 3l-3 -3l3 -3"></path>
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

////////////////////////////////////////////////////////////////////////////////

export class OnEventActionComponent extends ActionComponent {
    event: string;

    constructor() {
        super();
        makeObservable(this, {
            event: observable
        });
    }

    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        flowComponentId: COMPONENT_TYPE_ON_EVENT_ACTION,
        componentPaletteGroupName: "GUI Actions",
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType !== ProjectType.LVGL,

        properties: [
            {
                name: "event",
                type: PropertyType.Enum,
                enumItems: [
                    { id: "page_open", label: "Page open" },
                    { id: "page_close", label: "Page close" }
                ],
                propertyGridGroup: specificGroup
            }
        ],

        icon: (
            <svg
                strokeWidth="2"
                stroke="currentColor"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                viewBox="0 0 24 24"
            >
                <path d="M0 0h24v24H0z" stroke="none" />
                <rect x="4" y="5" width="16" height="16" rx="2" />
                <path d="M16 3v4M8 3v4m-4 4h16M8 15h2v2H8z" />
            </svg>
        ),
        componentHeaderColor: "#DEB887"
    });

    getBody(flowContext: IFlowContext): React.ReactNode {
        return (
            <div className="body">
                <pre>{humanize(this.event)}</pre>
            </div>
        );
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

    buildFlowComponentSpecific(assets: Assets, dataBuffer: DataBuffer) {
        // event
        const FLOW_EVENT_OPEN_PAGE = 0;
        const FLOW_EVENT_CLOSE_PAGE = 1;

        let event: number = 0;

        if (this.event == "page_open") {
            event = FLOW_EVENT_OPEN_PAGE;
        } else if (this.event == "page_close") {
            event = FLOW_EVENT_CLOSE_PAGE;
        }

        dataBuffer.writeUint8(event);
    }
}

////////////////////////////////////////////////////////////////////////////////

export class ShowPageActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        flowComponentId: COMPONENT_TYPE_SHOW_PAGE_ACTION,
        componentPaletteGroupName: "GUI Actions",
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType !== ProjectType.LVGL,
        properties: [
            {
                name: "page",
                type: PropertyType.ObjectReference,
                propertyGridGroup: specificGroup,
                referencedObjectCollectionPath: "pages"
            }
        ],
        check: (object: ShowPageActionComponent, messages: IMessage[]) => {
            if (!object.page) {
                messages.push(propertyNotSetMessage(object, "page"));
            } else {
                let page = ProjectEditor.findPage(
                    getProject(object),
                    object.page
                );
                if (!page) {
                    messages.push(propertyNotFoundMessage(object, "page"));
                }
            }
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

////////////////////////////////////////////////////////////////////////////////

const MESSAGE_BOX_TYPE_INFO = 1;
const MESSAGE_BOX_TYPE_ERROR = 2;
const MESSAGE_BOX_TYPE_QUESTION = 3;

export class ShowMessageBoxActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        flowComponentId: COMPONENT_TYPE_SHOW_MESSAGE_BOX_ACTION,
        componentPaletteGroupName: "GUI Actions",
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType !== ProjectType.LVGL,
        properties: [
            {
                name: "messageType",
                type: PropertyType.Enum,
                enumItems: [
                    { id: MESSAGE_BOX_TYPE_INFO, label: "Info" },
                    { id: MESSAGE_BOX_TYPE_ERROR, label: "Error" },
                    { id: MESSAGE_BOX_TYPE_QUESTION, label: "Question" }
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
            ),
            makeExpressionProperty(
                {
                    name: "buttons",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup,
                    hideInPropertyGrid: (
                        component: ShowMessageBoxActionComponent
                    ) => component.messageType != MESSAGE_BOX_TYPE_QUESTION
                },
                "array:string"
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
    buttons: string;

    constructor() {
        super();

        makeObservable(this, {
            messageType: observable,
            message: observable,
            buttons: observable
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
                        : this.messageType == MESSAGE_BOX_TYPE_QUESTION
                        ? "Question: "
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

////////////////////////////////////////////////////////////////////////////////

export class ShowKeyboardActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        flowComponentId: COMPONENT_TYPE_SHOW_KEYBOARD_ACTION,
        componentPaletteGroupName: "GUI Actions",
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType !== ProjectType.LVGL,
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

////////////////////////////////////////////////////////////////////////////////

export class ShowKeypadActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        flowComponentId: COMPONENT_TYPE_SHOW_KEYPAD_ACTION,
        componentPaletteGroupName: "GUI Actions",
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType !== ProjectType.LVGL,
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

////////////////////////////////////////////////////////////////////////////////

export class SelectLanguageActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        flowComponentId: COMPONENT_TYPE_SELECT_LANGUAGE_ACTION,
        componentPaletteGroupName: "GUI Actions",
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType !== ProjectType.LVGL,
        properties: [
            makeExpressionProperty(
                {
                    name: "language",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup
                },
                "any"
            )
        ],
        icon: LANGUAGE_ICON,
        componentHeaderColor: "#DEB887"
    });

    language: string;

    constructor() {
        super();

        makeObservable(this, {
            language: observable
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

////////////////////////////////////////////////////////////////////////////////

export class SetPageDirectionActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        flowComponentId: COMPONENT_TYPE_SET_PAGE_DIRECTION_ACTION,
        componentPaletteGroupName: "GUI Actions",
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType !== ProjectType.LVGL,
        properties: [
            {
                name: "direction",
                type: PropertyType.Enum,
                enumItems: [
                    { id: "LTR", label: "LTR" },
                    { id: "RTL", label: "RTL" }
                ],
                propertyGridGroup: specificGroup
            }
        ],
        icon: LANGUAGE_ICON,
        componentHeaderColor: "#DEB887"
    });

    direction: string;

    constructor() {
        super();

        makeObservable(this, {
            direction: observable
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
                <pre>{this.direction}</pre>
            </div>
        );
    }

    buildFlowComponentSpecific(assets: Assets, dataBuffer: DataBuffer) {
        dataBuffer.writeUint8(this.direction == "LTR" ? 0 : 1);
    }
}

export class OverrideStyleActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        flowComponentId: COMPONENT_TYPE_OVERRIDE_STYLE_ACTION,
        componentPaletteGroupName: "GUI Actions",
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType !== ProjectType.LVGL &&
            projectType !== ProjectType.DASHBOARD,
        properties: [
            {
                name: "fromStyle",
                type: PropertyType.ObjectReference,
                referencedObjectCollectionPath: "styles",
                propertyGridGroup: specificGroup
            },
            {
                name: "toStyle",
                type: PropertyType.ObjectReference,
                referencedObjectCollectionPath: "styles",
                propertyGridGroup: specificGroup
            }
        ],
        icon: <Icon icon="material:format_color_fill" size={17} />,
        componentHeaderColor: "#DEB887"
    });

    fromStyle: string;
    toStyle: string;

    constructor() {
        super();

        makeObservable(this, {
            fromStyle: observable,
            toStyle: observable
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
                <pre>
                    {this.fromStyle}
                    <RightArrow />
                    {this.toStyle}
                </pre>
            </div>
        );
    }

    buildFlowComponentSpecific(assets: Assets, dataBuffer: DataBuffer) {
        // fromStyle
        dataBuffer.writeInt16(assets.getStyleIndex(this, "fromStyle"));
        // toStyle
        dataBuffer.writeInt16(assets.getStyleIndex(this, "toStyle"));
    }
}

////////////////////////////////////////////////////////////////////////////////

export class AnimateActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        flowComponentId: COMPONENT_TYPE_ANIMATE_ACTION,
        componentPaletteGroupName: "GUI Actions",
        properties: [
            makeExpressionProperty(
                {
                    name: "from",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup
                },
                "float"
            ),
            makeExpressionProperty(
                {
                    name: "to",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup
                },
                "float"
            ),
            makeExpressionProperty(
                {
                    name: "speed",
                    type: PropertyType.MultilineText,
                    propertyGridGroup: specificGroup
                },
                "float"
            )
        ],
        beforeLoadHook: (
            component: AnimateActionComponent,
            jsComponent: Partial<AnimateActionComponent>
        ) => {
            if (jsComponent.from == undefined) {
                jsComponent.from = "Flow.pageTimelinePosition()";
            }

            if ((jsComponent as any).time != undefined) {
                jsComponent.to = (jsComponent as any).time;
            }

            if (jsComponent.speed == undefined) {
                jsComponent.speed = "1";
            }
        },
        icon: (
            <svg
                strokeWidth="2"
                stroke="currentColor"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                viewBox="0 0 24 24"
            >
                <path d="M0 0h24v24H0z" stroke="none" />
                <rect x="4" y="4" width="16" height="16" rx="2" />
                <path d="M8 4v16m8-16v16M4 8h4m-4 8h4m-4-4h16m-4-4h4m-4 8h4" />
            </svg>
        ),
        componentHeaderColor: "#DEB887",
        defaultValue: {
            from: "Flow.pageTimelinePosition()"
        }
    });

    from: string;
    to: string;
    speed: string;

    constructor() {
        super();

        makeObservable(this, {
            from: observable,
            to: observable,
            speed: observable
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
                <pre>
                    {this.from != "Flow.pageTimelinePosition()"
                        ? `From: ${this.from} s, `
                        : ""}
                    To: {this.to} s
                    {this.speed != "1" ? `, Speed: ${this.speed}` : ""}
                </pre>
            </div>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

export class NoopActionComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        flowComponentId: COMPONENT_TYPE_NOOP_ACTION,
        componentPaletteLabel: "NoOp",
        properties: [
            {
                name: "name",
                type: PropertyType.String,
                propertyGridGroup: specificGroup
            }
        ],
        check: (
            inputActionComponent: InputActionComponent,
            messages: IMessage[]
        ) => {
            if (!inputActionComponent.name) {
                messages.push(
                    propertyNotSetMessage(inputActionComponent, "name")
                );
            }
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
                    if (
                        !document.activeElement?.classList.contains(
                            "trix-input"
                        )
                    ) {
                        trixToolbar.style.visibility = "";
                    }
                }

                if (trixEditor.innerHTML != value) {
                    setValue(trixEditor.innerHTML);
                }
            };
            const onAttachmentAdd = (event: any) => {
                const reader = new FileReader();
                reader.addEventListener(
                    "load",
                    function () {
                        event.attachment.setAttributes({
                            url: reader.result
                        });

                        (trixEditor as any).editor.loadHTML(
                            trixEditor.innerHTML
                        );
                    },
                    false
                );
                reader.readAsDataURL(event.attachment.file);
            };

            trixEditor.addEventListener("trix-change", onChange, false);
            trixEditor.addEventListener("trix-focus", onFocus, false);
            trixEditor.addEventListener("trix-blur", onBlur, false);
            trixEditor.addEventListener(
                "trix-attachment-add",
                onAttachmentAdd,
                false
            );

            return () => {
                trixEditor.removeEventListener("trix-change", onChange, false);
                trixEditor.removeEventListener("trix-focus", onFocus, false);
                trixEditor.removeEventListener("trix-blur", onBlur, false);
                trixEditor.removeEventListener(
                    "trix-attachment-add",
                    onAttachmentAdd,
                    false
                );
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
            },
            {
                name: "description",
                type: PropertyType.String,
                hideInPropertyGrid: () => true
            }
        ],
        beforeLoadHook: (
            object: CommentActionComponent,
            jsObject: Partial<CommentActionComponent>
        ) => {
            if (jsObject.description) {
                delete jsObject.description;
            }
        },
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
                    const projectStore = getProjectStore(this);
                    projectStore.updateObject(this, {
                        text: value
                    });
                })}
            ></TrixEditor>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

registerClass("StartActionComponent", StartActionComponent);
registerClass("EndActionComponent", EndActionComponent);
registerClass("InputActionComponent", InputActionComponent);
registerClass("OutputActionComponent", OutputActionComponent);

registerClass("EvalExprActionComponent", EvalExprActionComponent);
registerClass("EvalJSExprActionComponent", EvalJSExprActionComponent);
registerClass("WatchVariableActionComponent", WatchVariableActionComponent);

registerClass("SetVariableActionComponent", SetVariableActionComponent);

registerClass("SwitchActionComponent", SwitchActionComponent);
registerClass("CompareActionComponent", CompareActionComponent);
registerClass("IsTrueActionComponent", IsTrueActionComponent);

registerClass("DelayActionComponent", DelayActionComponent);

registerClass("LoopActionComponent", LoopActionComponent);
registerClass("CounterActionComponent", CounterActionComponent);

registerClass("ConstantActionComponent", ConstantActionComponent);
registerClass("DateNowActionComponent", DateNowActionComponent);

registerClass("SortArrayActionComponent", SortArrayActionComponent);

registerClass("LogActionComponent", LogActionComponent);

registerClass("ReadSettingActionComponent", ReadSettingActionComponent);
registerClass("WriteSettingsActionComponent", WriteSettingsActionComponent);

registerClass("CallActionActionComponent", CallActionActionComponent);
registerClass(
    "DynamicCallActionActionComponent",
    DynamicCallActionActionComponent
);

registerClass("OnEventActionComponent", OnEventActionComponent);

registerClass("ShowPageActionComponent", ShowPageActionComponent);
registerClass("ShowMessageBoxActionComponent", ShowMessageBoxActionComponent);
registerClass("ShowKeyboardActionComponent", ShowKeyboardActionComponent);
registerClass("ShowKeypadActionComponent", ShowKeypadActionComponent);
registerClass("SelectLanguageActionComponent", SelectLanguageActionComponent);
registerClass(
    "SetPageDirectionActionComponent",
    SetPageDirectionActionComponent
);
registerClass("OverrideStyleActionComponent", OverrideStyleActionComponent);

registerClass("AnimateActionComponent", AnimateActionComponent);

registerClass("ErrorActionComponent", ErrorActionComponent);
registerClass("CatchErrorActionComponent", CatchErrorActionComponent);

registerClass("NoopActionComponent", NoopActionComponent);
registerClass("CommentActionComponent", CommentActionComponent);
