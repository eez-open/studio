import React from "react";
import { computed, observable, action, makeObservable } from "mobx";
import { observer } from "mobx-react";

import { _map } from "eez-studio-shared/algorithm";
import { humanize, stringCompare } from "eez-studio-shared/string";

import { ITreeNode, Tree } from "eez-studio-ui/tree";

import {
    getProperty,
    IEezObject,
    IOnSelectParams,
    PropertyInfo
} from "project-editor/core/object";
import { ProjectContext } from "project-editor/project/context";
import { getAncestorOfType, getProjectEditorStore } from "project-editor/store";
import { Dialog, showDialog } from "eez-studio-ui/dialog";
import type { Component } from "project-editor/flow/component";
import {
    binaryOperators,
    builtInConstants,
    builtInFunctions,
    logicalOperators,
    unaryOperators
} from "./operations";
import {
    getArrayElementTypeFromType,
    getStructureFromType,
    isArrayType,
    isStructType,
    humanizeVariableType,
    isObjectType,
    getObjectVariableTypeFromType
} from "project-editor/features/variable/value-type";
import { ProjectEditor } from "project-editor/project-editor-interface";
import {
    FLOW_ITERATOR_INDEXES_VARIABLE,
    FLOW_ITERATOR_INDEX_VARIABLE
} from "project-editor/features/variable/defs";
import { parseIdentifier } from "project-editor/flow/expression";
import { IObjectVariableValueFieldDescription } from "eez-studio-types";

export const EXPR_MARK_START = "{<";
export const EXPR_MARK_END = ">}";

export async function expressionBuilder(
    object: IEezObject,
    propertyInfo: PropertyInfo,
    opts: {
        assignableExpression: boolean;
        title: string;
    },
    params?: IOnSelectParams
) {
    let disposed = false;

    return new Promise<{
        [propertyName: string]: string;
    }>((resolve, reject) => {
        const onDispose = () => {
            if (!disposed) {
                if (modalDialog) {
                    modalDialog.close();
                }
                disposed = true;
            }
        };

        const onOk = (value: any) => {
            resolve(value);
            onDispose();
        };

        const [modalDialog] = showDialog(
            <ProjectContext.Provider value={getProjectEditorStore(object)}>
                <SelectItemDialog
                    object={object}
                    propertyInfo={propertyInfo}
                    assignableExpression={opts.assignableExpression}
                    params={params}
                    onOk={onOk}
                    onCancel={onDispose}
                />
            </ProjectContext.Provider>,
            {
                jsPanel: Object.assign({ width: 1024, height: 600 }, opts)
            }
        );
    });
}

const VariableLabel = observer(
    ({ name, type }: { name: string; type: string }) => (
        <>
            <span className="name">{name}</span>
            <span className="type">{type}</span>
        </>
    )
);

const SelectItemDialog = observer(
    class SelectItemDialog extends React.Component<{
        object: IEezObject;
        propertyInfo: PropertyInfo;
        assignableExpression: boolean;
        params?: IOnSelectParams;
        onOk: (value: any) => void;
        onCancel: () => void;
    }> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        textarea: HTMLTextAreaElement;
        value: string;
        selection: string | undefined;

        constructor(props: any) {
            super(props);

            this.value =
                getProperty(
                    this.props.object,
                    this.props.propertyInfo.name
                )?.toString() || "";

            makeObservable(this, {
                value: observable,
                selection: observable,
                component: computed,
                flow: computed,
                componentInputs: computed,
                localVariables: computed,
                globalVariables: computed,
                rootNodeVariables: computed,
                rootNodeSystemVariables: computed,
                rootNodeOperations: computed,
                rootNodeFunctions: computed,
                rootNodeTextResources: computed
            });
        }

        componentDidMount() {
            let textInputSelection = this.props.params?.textInputSelection;
            if (
                !textInputSelection ||
                (textInputSelection.start == this.value.length &&
                    textInputSelection.end == this.value.length &&
                    textInputSelection.direction == "forward")
            ) {
                textInputSelection = {
                    start: 0,
                    end: this.value.length,
                    direction: "forward"
                };
            }

            this.textarea.focus();

            this.textarea.setSelectionRange(
                textInputSelection.start,
                textInputSelection.end,
                textInputSelection.direction === null
                    ? undefined
                    : textInputSelection.direction
            );
        }

        onOkEnabled = () => {
            return true;
        };

        onOk = () => {
            this.props.onOk({
                [this.props.propertyInfo.name]: this.value
            });

            return true;
        };

        onDoubleClick = action(() => {
            if (!this.selection) {
                return;
            }

            let value = this.selection;

            const start = this.textarea.selectionStart;
            const end = this.textarea.selectionEnd;

            if (start != null && end != null) {
                value =
                    this.value.substring(0, start) +
                    value +
                    this.value.substring(end);
            }

            this.value = value;
        });

        get component() {
            return getAncestorOfType(
                this.props.object,
                ProjectEditor.ComponentClass.classInfo
            ) as Component;
        }

        get flow() {
            return ProjectEditor.getFlow(this.component);
        }

        get componentInputs() {
            return this.component.inputs.filter(
                componentInput => !componentInput.name.startsWith("@")
            );
        }

        get localVariables() {
            const vars = [...this.flow.localVariables];
            vars.sort((a, b) => stringCompare(a.name, b.name));
            return vars;
        }

        get globalVariables() {
            const vars = [...this.context.project.allGlobalVariables.slice()];
            vars.sort((a, b) => stringCompare(a.name, b.name));
            return vars;
        }

        getTypeChildren(type: string, prefix: string): ITreeNode<string>[] {
            if (isArrayType(type)) {
                return this.getTypeChildren(
                    getArrayElementTypeFromType(type)!,
                    `${prefix}[]`
                );
            } else if (isStructType(type)) {
                const structure = getStructureFromType(
                    this.context.project,
                    type
                );
                if (structure) {
                    return structure.fields.map(field => {
                        const data = `${prefix}.${field.name}`;
                        return {
                            id: field.name,
                            label: (
                                <VariableLabel
                                    name={
                                        (prefix.endsWith("[]") ? "[]" : "") +
                                        "." +
                                        field.name
                                    }
                                    type={humanizeVariableType(field.type)}
                                />
                            ),
                            children: this.getTypeChildren(
                                field.type,
                                `${prefix}.${field.name}`
                            ),
                            selected: this.selection == data,
                            expanded: true,
                            data: data
                        };
                    });
                }
            } else if (isObjectType(type)) {
                const objectVariableType = getObjectVariableTypeFromType(type);
                if (objectVariableType) {
                    function getFields(
                        fieldDescriptions: IObjectVariableValueFieldDescription[],
                        prefix: string
                    ): ITreeNode<string>[] {
                        return fieldDescriptions.map(field => {
                            const data = `${prefix}.${field.name}`;
                            return {
                                id: field.name,
                                label:
                                    typeof field.valueType == "string" ? (
                                        <VariableLabel
                                            name={
                                                (prefix.endsWith("[]")
                                                    ? "[]"
                                                    : "") +
                                                "." +
                                                field.name
                                            }
                                            type={humanizeVariableType(
                                                field.valueType
                                            )}
                                        />
                                    ) : (
                                        `.${field.name}`
                                    ),
                                children:
                                    typeof field.valueType == "string"
                                        ? []
                                        : getFields(
                                              field.valueType,
                                              `${prefix}.${field.name}`
                                          ),
                                selected: selection == data,
                                expanded: true,
                                data: data
                            };
                        });
                    }
                    const selection = this.selection;
                    return getFields(
                        objectVariableType.valueFieldDescriptions,
                        prefix
                    );
                }
            }

            return [];
        }

        getUnaryOperators<
            T extends {
                [operator: string]: {
                    name: string;
                };
            }
        >(operators: T) {
            return _map(operators, (operator, operatorSign) => {
                const data = `${operatorSign}${EXPR_MARK_START}expr${EXPR_MARK_END}`;
                return {
                    id: operator.name,
                    label: (
                        <>
                            <span>{humanize(operator.name)}</span>
                            <span className="EezStudio_ExpressionBuilder_OperatorSign">
                                {operatorSign}
                            </span>
                        </>
                    ),
                    children: [],
                    selected: this.selection == data,
                    expanded: false,
                    data
                };
            });
        }

        getBinaryOperators<
            T extends {
                [operator: string]: {
                    name: string;
                };
            }
        >(operators: T) {
            return _map(operators, (operator, operatorSign) => {
                const data = `${EXPR_MARK_START}expr${EXPR_MARK_END} ${operatorSign} ${EXPR_MARK_START}expr${EXPR_MARK_END}`;
                return {
                    id: operator.name,
                    label: (
                        <>
                            <span>{humanize(operator.name)}</span>
                            <span className="EezStudio_ExpressionBuilder_OperatorSign">
                                {operatorSign}
                            </span>
                        </>
                    ),
                    children: [],
                    selected: this.selection == data,
                    expanded: false,
                    data
                };
            });
        }

        get rootNodeVariables(): ITreeNode<string> {
            const children: ITreeNode<string>[] = [];

            if (
                !this.props.assignableExpression &&
                this.componentInputs.length
            ) {
                children.push({
                    id: "component-inputs",
                    label: "Component inputs",
                    children: this.componentInputs.map(componentInput => ({
                        id: componentInput.name,
                        label: (
                            <VariableLabel
                                name={componentInput.name}
                                type={componentInput.type}
                            />
                        ),
                        children: this.getTypeChildren(
                            componentInput.type,
                            componentInput.name
                        ),
                        selected: this.selection == componentInput.name,
                        expanded: true,
                        data: componentInput.name
                    })),
                    selected: false,
                    expanded: true
                });
            }

            if (this.localVariables.length) {
                children.push({
                    id: "local-variables",
                    label: "Local variables",
                    children: this.localVariables.map(localVariable => ({
                        id: localVariable.name,
                        label: (
                            <VariableLabel
                                name={localVariable.name}
                                type={humanizeVariableType(localVariable.type)}
                            />
                        ),
                        children: this.getTypeChildren(
                            localVariable.type,
                            localVariable.name
                        ),
                        selected: this.selection == localVariable.name,
                        expanded: true,
                        data: localVariable.name
                    })),
                    selected: false,
                    expanded: true
                });
            }

            if (this.globalVariables.length) {
                children.push({
                    id: "global-variables",
                    label: "Global variables",
                    children: this.globalVariables.map(globalVariable => ({
                        id: globalVariable.name,
                        label: (
                            <VariableLabel
                                name={globalVariable.name}
                                type={humanizeVariableType(globalVariable.type)}
                            />
                        ),
                        children: this.getTypeChildren(
                            globalVariable.type,
                            globalVariable.name
                        ),
                        selected: this.selection == globalVariable.name,
                        expanded: true,
                        data: globalVariable.name
                    })),
                    selected: false,
                    expanded: true
                });
            }

            return observable({
                id: "all",
                label: "All",
                children,
                selected: false,
                expanded: true
            });
        }

        get rootNodeSystemVariables(): ITreeNode<string> {
            const children: ITreeNode<string>[] = [];

            if (!this.props.assignableExpression) {
                children.push({
                    id: "system-variables",
                    label: "System variables",
                    children: [
                        {
                            id: FLOW_ITERATOR_INDEX_VARIABLE,
                            label: FLOW_ITERATOR_INDEX_VARIABLE,
                            children: [],
                            selected:
                                this.selection == FLOW_ITERATOR_INDEX_VARIABLE,
                            expanded: false,
                            data: FLOW_ITERATOR_INDEX_VARIABLE
                        },
                        {
                            id: FLOW_ITERATOR_INDEXES_VARIABLE,
                            label: FLOW_ITERATOR_INDEXES_VARIABLE,
                            children: [],
                            selected:
                                this.selection ==
                                FLOW_ITERATOR_INDEXES_VARIABLE,
                            expanded: false,
                            data: FLOW_ITERATOR_INDEXES_VARIABLE
                        }
                    ],
                    selected: false,
                    expanded: true
                });

                if (this.context.project.variables.enums.length) {
                    children.push({
                        id: "enumerations",
                        label: "Enumerations",
                        children: this.context.project.variables.enums.map(
                            enumeration => ({
                                id: enumeration.name,
                                label: enumeration.name,
                                children: enumeration.members.map(member => {
                                    const data = `${enumeration.name}.${member.name}`;
                                    return {
                                        id: member.name,
                                        label: member.name,
                                        children: [],
                                        selected: this.selection == member.name,
                                        expanded: false,
                                        data
                                    };
                                }),
                                selected: false,
                                expanded: true,
                                data: undefined
                            })
                        ),
                        selected: false,
                        expanded: true
                    });
                }

                children.push({
                    id: "built-in-constants",
                    label: "Built-in Constants",
                    children: _map(
                        builtInConstants(this.context),
                        (constant, constantName) => ({
                            id: constantName,
                            label: constant.label
                                ? constant.label(constantName)
                                : constantName,
                            children: [],
                            selected: this.selection == constantName,
                            expanded: false,
                            data: constantName
                        })
                    ),
                    selected: false,
                    expanded: true
                });
            }

            return observable({
                id: "all",
                label: "All",
                children,
                selected: false,
                expanded: true
            });
        }

        get rootNodeOperations(): ITreeNode<string> {
            const children: ITreeNode<string>[] = [];

            if (!this.props.assignableExpression) {
                children.push({
                    id: "binary-operators",
                    label: "Binary operators",
                    children: this.getBinaryOperators(binaryOperators),
                    selected: false,
                    expanded: true
                });

                children.push({
                    id: "logical-operators",
                    label: "Logical operators",
                    children: this.getBinaryOperators(logicalOperators),
                    selected: false,
                    expanded: true
                });

                const conditionalOperatorData = `${EXPR_MARK_START}condition${EXPR_MARK_END} ? ${EXPR_MARK_START}exprIfTrue${EXPR_MARK_END} : ${EXPR_MARK_START}exprIfFalse${EXPR_MARK_END}`;
                children.push({
                    id: "conditional-operator",
                    label: (
                        <>
                            <span>Conditional operator</span>
                            <span className="EezStudio_ExpressionBuilder_OperatorSign">
                                A ? B : C
                            </span>
                        </>
                    ),
                    children: [],
                    selected: this.selection == conditionalOperatorData,
                    expanded: false,
                    data: conditionalOperatorData
                });

                children.push({
                    id: "unary-operators",
                    label: "Unary operators",
                    children: this.getUnaryOperators(unaryOperators),
                    selected: false,
                    expanded: true
                });
            }

            return observable({
                id: "all",
                label: "All",
                children,
                selected: false,
                expanded: true
            });
        }

        get rootNodeFunctions(): ITreeNode<string> {
            const children: ITreeNode<string>[] = [];

            if (!this.props.assignableExpression) {
                children.push({
                    id: "built-in-functions",
                    label: "Built-in Functions",
                    children: _map(builtInFunctions, (func, functionName) => {
                        const data = `${functionName}(${func.args
                            .map(
                                arg =>
                                    `${EXPR_MARK_START}${arg}${EXPR_MARK_END}`
                            )
                            .join(", ")})`;
                        return {
                            id: functionName,
                            label: functionName,
                            children: [],
                            selected: this.selection == data,
                            expanded: false,
                            data
                        };
                    }),
                    selected: false,
                    expanded: true
                });
            }

            return observable({
                id: "all",
                label: "All",
                children,
                selected: false,
                expanded: true
            });
        }

        get rootNodeTextResources(): ITreeNode<string> {
            const children: ITreeNode<string>[] = [];

            if (!this.props.assignableExpression) {
                if (this.context.project.texts) {
                    children.push({
                        id: "text-resources",
                        label: "Text resources",
                        children: _map(
                            this.context.project.texts.resources,
                            text => {
                                const data = `T"${text.resourceID}"`;
                                return {
                                    id: text.resourceID,
                                    label: text.resourceID,
                                    children: [],
                                    selected: this.selection == data,
                                    expanded: false,
                                    data
                                };
                            }
                        ),
                        selected: false,
                        expanded: true
                    });
                }
            }

            return observable({
                id: "all",
                label: "All",
                children,
                selected: false,
                expanded: true
            });
        }

        selectNode = action((node?: ITreeNode<string>) => {
            this.selection = node && node.data;
        });

        onSelectionChange = (
            event: React.SyntheticEvent<
                HTMLTextAreaElement | HTMLInputElement,
                Event
            >
        ) => {
            const start = event.currentTarget.selectionStart;
            const end = event.currentTarget.selectionEnd;
            if (!(typeof start == "number") || !(typeof end == "number")) {
                return;
            }

            const value = event.currentTarget.value;

            let expressionStart: number | undefined;
            for (let i = start; i >= 0; i--) {
                if (
                    value[i] == EXPR_MARK_START[0] &&
                    value[i + 1] == EXPR_MARK_START[1]
                ) {
                    expressionStart = i;
                    break;
                }
            }

            if (expressionStart === undefined) {
                return;
            }

            let expressionEnd: number | undefined;
            for (let i = end; i < value.length; i++) {
                if (
                    value[i] == EXPR_MARK_END[1] &&
                    value[i - 1] == EXPR_MARK_END[0]
                ) {
                    expressionEnd = i + 1;
                    break;
                }
            }

            if (expressionEnd === undefined) {
                return;
            }

            const identifier = value.substring(
                expressionStart + 2,
                expressionEnd - 2
            );

            if (identifier.length == 0) {
                return;
            }

            let isIdentifier = false;
            try {
                isIdentifier = parseIdentifier(identifier);
            } catch (err) {
                return;
            }

            if (!isIdentifier) {
                return;
            }

            event.currentTarget.setSelectionRange(
                expressionStart,
                expressionEnd,
                event.currentTarget.selectionDirection ?? undefined
            );
        };

        render() {
            return (
                <Dialog
                    modal={false}
                    okButtonText="Ok"
                    okEnabled={this.onOkEnabled}
                    onOk={this.onOk}
                    onCancel={this.props.onCancel}
                >
                    <div className="EezStudio_ExpressionBuilder">
                        <textarea
                            ref={(ref: any) => (this.textarea = ref)}
                            className="form-control pre"
                            value={this.value}
                            onChange={action(
                                event => (this.value = event.target.value)
                            )}
                            onSelect={this.onSelectionChange}
                            style={{ resize: "none" }}
                            spellCheck={false}
                        />

                        <div className="EezStudio_ExpressionBuilder_Panels">
                            {this.rootNodeVariables.children.length > 0 && (
                                <Tree
                                    showOnlyChildren={true}
                                    rootNode={this.rootNodeVariables}
                                    selectNode={this.selectNode}
                                    onDoubleClick={this.onDoubleClick}
                                />
                            )}
                            {this.rootNodeSystemVariables.children.length >
                                0 && (
                                <Tree
                                    showOnlyChildren={true}
                                    rootNode={this.rootNodeSystemVariables}
                                    selectNode={this.selectNode}
                                    onDoubleClick={this.onDoubleClick}
                                />
                            )}
                            {this.rootNodeOperations.children.length > 0 && (
                                <Tree
                                    showOnlyChildren={true}
                                    rootNode={this.rootNodeOperations}
                                    selectNode={this.selectNode}
                                    onDoubleClick={this.onDoubleClick}
                                />
                            )}
                            {this.rootNodeFunctions.children.length > 0 && (
                                <Tree
                                    showOnlyChildren={true}
                                    rootNode={this.rootNodeFunctions}
                                    selectNode={this.selectNode}
                                    onDoubleClick={this.onDoubleClick}
                                />
                            )}
                            {this.rootNodeTextResources.children.length > 0 && (
                                <Tree
                                    showOnlyChildren={true}
                                    rootNode={this.rootNodeTextResources}
                                    selectNode={this.selectNode}
                                    onDoubleClick={this.onDoubleClick}
                                />
                            )}
                        </div>
                    </div>
                </Dialog>
            );
        }
    }
);
