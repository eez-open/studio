import React from "react";
import { observer } from "mobx-react";
import { computedFn } from "mobx-utils";
import {
    computed,
    IObservableValue,
    observable,
    runInAction,
    action,
    makeObservable
} from "mobx";

import { Panel } from "project-editor/components/Panel";
import { IColumn, ITreeNode, TreeTable } from "eez-studio-ui/tree-table";
import type { IDataContext } from "project-editor/flow/flow-interfaces";
import type { Variable } from "project-editor/features/variable/variable";
import {
    getArrayElementTypeFromType,
    getStructureFromType
} from "project-editor/features/variable/value-type";
import { ConnectionLine, FlowTabState } from "project-editor/flow/flow";
import type { ComponentState, RuntimeBase } from "project-editor/flow/runtime";
import { getInputDisplayName } from "project-editor/flow/component";
import { evalExpressionGetValueType } from "project-editor/flow/expression";
import { IconAction } from "eez-studio-ui/action";
import { showGenericDialog } from "eez-studio-ui/generic-dialog";
import { validators } from "eez-studio-shared/validation";
import { ProjectEditor } from "project-editor/project-editor-interface";
import { getValueLabel } from "project-editor/features/variable/value-type";
import { stringCompare } from "eez-studio-shared/string";

////////////////////////////////////////////////////////////////////////////////

export function valueToString(value: any) {
    if (value === undefined) {
        return "undefined";
    }
    try {
        return JSON.stringify(value);
    } catch (err) {
        try {
            return value.toString();
        } catch (err) {
            return "err!";
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

export const WatchPanel = observer(
    class WatchPanel extends React.Component<{
        runtime: RuntimeBase;
    }> {
        onAddExpression = async () => {
            const result = await showGenericDialog({
                dialogDefinition: {
                    title: "New Watch Expression",
                    fields: [
                        {
                            name: "expression",
                            type: "string",
                            validators: [validators.required]
                        }
                    ]
                },
                values: {},
                dialogContext: this.props.runtime.DocumentStore.project
            });

            runInAction(() =>
                this.props.runtime.DocumentStore.uiStateStore.watchExpressions.push(
                    result.values.expression
                )
            );
        };

        onEditExpression = async () => {
            const i = this.selectedExpression.get();
            if (i == -1) {
                return;
            }

            const result = await showGenericDialog({
                dialogDefinition: {
                    title: "Edit Watch Expression",
                    fields: [
                        {
                            name: "expression",
                            type: "string",
                            validators: [validators.required]
                        }
                    ]
                },
                values: {
                    expression:
                        this.props.runtime.DocumentStore.uiStateStore
                            .watchExpressions[i]
                },
                dialogContext: this.props.runtime.DocumentStore.project
            });

            runInAction(
                () =>
                    (this.props.runtime.DocumentStore.uiStateStore.watchExpressions[
                        i
                    ] = result.values.expression)
            );
        };

        onDeleteEpression = action(() => {
            const i = this.selectedExpression.get();
            if (i == -1) {
                return;
            }

            runInAction(() =>
                this.props.runtime.DocumentStore.uiStateStore.watchExpressions.splice(
                    i,
                    1
                )
            );
        });

        selectedExpression = observable.box<number>(-1);

        render() {
            return (
                <div className="EezStudio_DebuggerPanel">
                    <Panel
                        id="project-editor/debugger/variables"
                        title=""
                        buttons={[
                            <IconAction
                                key="add"
                                icon="material:add"
                                iconSize={20}
                                title="Add Watch Expression"
                                onClick={this.onAddExpression}
                            />,
                            <IconAction
                                key="edit"
                                icon="material:edit"
                                iconSize={20}
                                title="Edit Watch Expression"
                                onClick={this.onEditExpression}
                                enabled={this.selectedExpression.get() != -1}
                            />,
                            <IconAction
                                key="delete"
                                icon="material:delete"
                                iconSize={20}
                                title="Delete Watch Expression"
                                onClick={this.onDeleteEpression}
                                enabled={this.selectedExpression.get() != -1}
                            />
                        ]}
                        body={
                            <WatchTable
                                runtime={this.props.runtime}
                                selectedExpression={this.selectedExpression}
                            />
                        }
                    />
                </div>
            );
        }
    }
);

const WatchTable = observer(
    class WatchTable extends React.Component<{
        runtime: RuntimeBase;
        selectedExpression: IObservableValue<number>;
    }> {
        constructor(props: {
            runtime: RuntimeBase;
            selectedExpression: IObservableValue<number>;
        }) {
            super(props);

            makeObservable(this, {
                columns: computed,
                watchExpressions: computed,
                globalVariables: computed,
                localVariables: computed,
                selectedComponent: computed,
                componentInputs: computed,
                rootNode: computed
            });
        }

        get columns() {
            let result: IColumn[] = [];

            result.push({
                name: "name",
                title: "Name"
            });

            result.push({
                name: "value",
                title: "Value"
            });

            result.push({
                name: "type",
                title: "Type"
            });

            return result;
        }

        getValueChildren = computedFn(
            (
                value: any,
                type: string | null
            ): (() => ITreeNode[]) | undefined => {
                const MAX_CHILDREN = 1000;

                if (Array.isArray(value) || value instanceof Uint8Array) {
                    return () => {
                        const elementType = type
                            ? getArrayElementTypeFromType(type)
                            : undefined;

                        const children: ITreeNode[] = [];

                        for (
                            let i = 0;
                            i < Math.min(value.length, MAX_CHILDREN);
                            i++
                        ) {
                            const elementValue = value[i];
                            const name = `[${i}]`;
                            const type = elementType ?? typeof elementValue;
                            const valueLabel = getValueLabel(
                                this.props.runtime.DocumentStore.project,
                                elementValue,
                                type
                            );

                            children.push(
                                observable({
                                    id: name,
                                    name,
                                    value: valueLabel,
                                    valueTitle: valueLabel,
                                    type: type,

                                    children: this.getValueChildren(
                                        elementValue,
                                        type
                                    ),
                                    selected: false,
                                    expanded: false
                                })
                            );
                        }

                        return children;
                    };
                }

                if (value != null && typeof value == "object") {
                    return () => {
                        let structure;
                        if (type) {
                            structure = getStructureFromType(
                                this.props.runtime.DocumentStore.project,
                                type
                            );
                        }

                        let numChildren = 0;

                        const children: ITreeNode[] = [];
                        for (const name in value) {
                            const propertyValue = value[name];

                            let fieldType: string | null = null;
                            if (structure) {
                                const field = structure.fieldsMap.get(name);
                                if (field) {
                                    fieldType = field.type;
                                }
                            }

                            const valueLabel = getValueLabel(
                                this.props.runtime.DocumentStore.project,
                                propertyValue,
                                fieldType
                            );

                            children.push(
                                observable({
                                    id: name,
                                    name,
                                    value: valueLabel,
                                    valueTitle: valueLabel,
                                    type: fieldType ?? typeof propertyValue,

                                    children: this.getValueChildren(
                                        propertyValue,
                                        fieldType
                                    ),
                                    selected: false,
                                    expanded: false
                                })
                            );

                            if (++numChildren == MAX_CHILDREN) {
                                break;
                            }
                        }
                        return children;
                    };
                }

                return undefined;
            }
        );

        get watchExpressions() {
            const result = this.selectedComponent;

            return observable({
                id: "expressions",
                name: "Expressions",
                value: undefined,
                type: "",
                children: () =>
                    this.props.runtime.DocumentStore.uiStateStore.watchExpressions.map(
                        (expression, i) => {
                            let watchExpressionLabel;
                            let value;
                            let type: any;
                            let className: string | undefined;
                            if (result) {
                                try {
                                    ({ value, valueType: type } =
                                        evalExpressionGetValueType(
                                            result.flowState,
                                            result.component,
                                            expression
                                        ));

                                    watchExpressionLabel = getValueLabel(
                                        this.props.runtime.DocumentStore
                                            .project,
                                        value,
                                        type
                                    );
                                } catch (err) {
                                    watchExpressionLabel = err.toString();
                                    type = "";
                                    className = "error";
                                }
                            } else {
                                watchExpressionLabel = "undefined";
                                type = "undefined";
                            }

                            return observable({
                                id: expression,

                                name: expression,
                                value: watchExpressionLabel,
                                valueTitle: watchExpressionLabel,
                                type,

                                children: this.getValueChildren(value, type),
                                selected: false,
                                expanded: false,
                                className,
                                data: i
                            });
                        }
                    ),
                selected: false,
                expanded: true
            });
        }

        getVariableTreeNodes = (variables: Variable[]) => {
            variables = variables.slice();
            variables.sort((a, b) => stringCompare(a.name, b.name));
            return variables.map(variable => {
                const flowState = this.props.runtime.selectedFlowState;

                let dataContext: IDataContext;
                if (flowState) {
                    dataContext = flowState.dataContext;
                } else {
                    dataContext = this.props.runtime.DocumentStore.dataContext;
                }

                const value = dataContext.get(variable.name);
                const valueLabel = getValueLabel(
                    this.props.runtime.DocumentStore.project,
                    value,
                    variable.type
                );

                return observable({
                    id: variable.name,

                    name: variable.name,
                    value: valueLabel,
                    valueTitle: valueLabel,
                    type: variable.type,

                    children: this.getValueChildren(value, variable.type),
                    selected: false,
                    expanded: false
                });
            });
        };

        get globalVariables() {
            return observable({
                id: "global-variables",
                name: "Global variables",
                value: undefined,
                type: "",
                children: () =>
                    this.getVariableTreeNodes(
                        this.props.runtime.DocumentStore.project
                            .allGlobalVariables
                    ),
                selected: false,
                expanded: true
            });
        }

        get localVariables() {
            const flowState = this.props.runtime.selectedFlowState;
            if (!flowState || flowState.flow.localVariables.length == 0) {
                return undefined;
            }

            return observable({
                id: "local-variables",
                name: "Local variables",
                value: undefined,
                type: "",
                children: () =>
                    this.getVariableTreeNodes(flowState.flow.localVariables),
                selected: false,
                expanded: true
            });
        }

        getComponentStateInputsTreeNodes = (componentState: ComponentState) => {
            const inputs = componentState.component.inputs.filter(
                input => input.name != "@seqin"
            );
            return inputs.map(input => {
                let value = componentState.getInputValue(input.name);

                let valueLabel = getValueLabel(
                    this.props.runtime.DocumentStore.project,
                    value,
                    null
                );

                return observable({
                    id: input.name,

                    name: getInputDisplayName(
                        componentState.component,
                        input.name
                    ),
                    value: valueLabel,
                    valueTitle: valueLabel,
                    type: input.type,

                    children: this.getValueChildren(value, null),
                    selected: false,
                    expanded: false
                });
            });
        };

        get selectedComponent() {
            const flowState = this.props.runtime.selectedFlowState;
            if (!flowState) {
                return undefined;
            }

            const editorState =
                this.props.runtime.DocumentStore.editorsStore.activeEditor
                    ?.state;
            if (!(editorState instanceof FlowTabState)) {
                return undefined;
            }

            const selectedObjects = editorState.selectedObjects;

            let component;
            if (selectedObjects.length == 1) {
                component = selectedObjects[0];
            } else if (selectedObjects.length == 3) {
                const connectionLines = selectedObjects.filter(
                    selectedObject => selectedObject instanceof ConnectionLine
                ) as ConnectionLine[];
                if (connectionLines.length == 1) {
                    component = connectionLines[0].targetComponent;
                }
            }
            if (!component) {
                return undefined;
            }
            if (!(component instanceof ProjectEditor.ComponentClass)) {
                return undefined;
            }

            return { flowState, component };
        }

        get componentInputs() {
            const result = this.selectedComponent;
            if (!result) {
                return undefined;
            }

            const { flowState, component } = result;

            const inputs = component.inputs.filter(
                input => input.name != "@seqin"
            );
            if (inputs.length == 0) {
                return undefined;
            }

            if (flowState.flow.components.indexOf(component) == -1) {
                return undefined;
            }

            const componentState = flowState.getComponentState(component);

            return observable({
                id: "component-inputs",
                name: "Component inputs",
                value: undefined,
                type: "",
                children: () =>
                    this.getComponentStateInputsTreeNodes(componentState),
                selected: false,
                expanded: true
            });
        }

        get rootNode(): ITreeNode {
            const treeNode: ITreeNode = {
                id: "root",
                label: "",
                children: () => {
                    const children: ITreeNode[] = [];

                    if (
                        this.props.runtime.DocumentStore.uiStateStore
                            .watchExpressions.length > 0
                    ) {
                        children.push(this.watchExpressions);
                    }

                    children.push(this.globalVariables);

                    const localVariables = this.localVariables;
                    if (localVariables) {
                        children.push(localVariables);
                    }

                    const componentInputs = this.componentInputs;
                    if (componentInputs) {
                        children.push(componentInputs);
                    }

                    return children;
                },
                selected: false,
                expanded: true
            };

            return treeNode;
        }

        selectedNode: ITreeNode | undefined;

        selectNode = action((node?: ITreeNode) => {
            if (this.selectedNode) {
                this.selectedNode.selected = false;
                this.selectedNode = undefined;
            }

            if (node && typeof node.data == "number") {
                this.props.selectedExpression.set(node.data);
                this.selectedNode = node;
                node.selected = true;
            } else {
                this.props.selectedExpression.set(-1);
            }
        });

        render() {
            return (
                <div className="EezStudio_DebuggerVariablesTable">
                    {
                        <TreeTable
                            columns={this.columns}
                            showOnlyChildren={true}
                            rootNode={this.rootNode}
                            selectNode={this.selectNode}
                        />
                    }
                </div>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////
