import React from "react";
import { computed, observable, action, makeObservable } from "mobx";
import { observer } from "mobx-react";

import { _map } from "eez-studio-shared/algorithm";
import { humanize } from "eez-studio-shared/string";

import { ITreeNode, Tree } from "eez-studio-ui/tree";

import {
    getProperty,
    IEezObject,
    IOnSelectParams,
    PropertyInfo
} from "project-editor/core/object";
import { ProjectContext } from "project-editor/project/context";
import { getAncestorOfType, getDocumentStore } from "project-editor/store";
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
    humanizeVariableType
} from "project-editor/features/variable/value-type";
import { ProjectEditor } from "project-editor/project-editor-interface";
import {
    FLOW_ITERATOR_INDEXES_VARIABLE,
    FLOW_ITERATOR_INDEX_VARIABLE
} from "project-editor/features/variable/defs";

export const EXPR_MARK_START = "{<";
export const EXPR_MARK_END = ">}";

export async function expressionBuilder(
    object: IEezObject,
    propertyInfo: PropertyInfo,
    opts: {
        assignableExpression: boolean;
        title: string;
        width: number;
        height?: number;
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
            <ProjectContext.Provider value={getDocumentStore(object)}>
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
                jsPanel: Object.assign({}, opts)
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

        selection: string | undefined;

        onOkEnabled = () => {
            return this.selection != undefined;
        };

        onOk = () => {
            const { object, propertyInfo, params } = this.props;

            if (!this.selection) {
                return;
            }

            let value = this.selection;

            if (
                params &&
                params.textInputSelection &&
                params.textInputSelection.start != null &&
                params.textInputSelection.end != null
            ) {
                const existingValue: string =
                    getProperty(object, propertyInfo.name) || "";
                value =
                    existingValue.substring(
                        0,
                        params.textInputSelection.start
                    ) +
                    value +
                    existingValue.substring(params.textInputSelection.end);
            }

            this.props.onOk({
                [propertyInfo.name]: value
            });

            return true;
        };

        constructor(props: any) {
            super(props);

            makeObservable(this, {
                selection: observable,
                component: computed,
                flow: computed,
                componentInputs: computed,
                localVariables: computed,
                globalVariables: computed,
                rootNode: computed
            });
        }

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
            return this.flow.localVariables;
        }

        get globalVariables() {
            return this.context.project.allGlobalVariables;
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
                    label: `${humanize(operator.name)} (${operatorSign})`,
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
                    label: `${humanize(operator.name)} (${operatorSign})`,
                    children: [],
                    selected: this.selection == data,
                    expanded: false,
                    data
                };
            });
        }

        get rootNode(): ITreeNode<string> {
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
                        expanded: false,
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
                    label: "Conditional operator (condition ? exprIfTrue : exprIfFalse)",
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

                children.push({
                    id: "built-in-constants",
                    label: "Built-in Constants",
                    children: _map(
                        builtInConstants,
                        (constant, constantName) => ({
                            id: constantName,
                            label: constantName,
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

        selectNode = action((node?: ITreeNode<string>) => {
            this.selection = node && node.data;
        });

        render() {
            return (
                <Dialog
                    modal={false}
                    okButtonText="Select"
                    okEnabled={this.onOkEnabled}
                    onOk={this.onOk}
                    onCancel={this.props.onCancel}
                >
                    <div className="EezStudio_ExpressionBuilder">
                        <Tree
                            showOnlyChildren={true}
                            rootNode={this.rootNode}
                            selectNode={this.selectNode}
                            onDoubleClick={this.onOk}
                        />
                    </div>
                </Dialog>
            );
        }
    }
);
