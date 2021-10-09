import React from "react";
import { observer } from "mobx-react";
import { Panel } from "project-editor/components/Panel";
import { computed, IObservableValue, observable } from "mobx";
import { IColumn, ITreeNode, TreeTable } from "eez-studio-ui/tree-table";
import { IDataContext } from "eez-studio-types";
import {
    getArrayElementTypeFromType,
    getEnumTypeNameFromType,
    getStructureFromType,
    isEnumType,
    Variable
} from "project-editor/features/variable/variable";
import { computedFn } from "mobx-utils";
import { ConnectionLine, FlowTabState } from "project-editor/flow/flow";
import { Component } from "project-editor/flow/component";
import { ComponentState, RuntimeBase } from "project-editor/flow/runtime";
import { getInputName } from "project-editor/flow/debugger/logs";
import { MaximizeIcon } from "./DebuggerPanel";

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

@observer
export class WatchPanel extends React.Component<{
    runtime: RuntimeBase;
    collapsed?: IObservableValue<boolean>;
    maximized: boolean;
    onToggleMaximized: () => void;
}> {
    render() {
        return (
            <Panel
                id="project-editor/debugger/variables"
                title="Watch"
                collapsed={this.props.collapsed}
                buttons={[
                    <MaximizeIcon
                        key="toggle-maximize"
                        maximized={this.props.maximized}
                        onToggleMaximized={this.props.onToggleMaximized}
                    />
                ]}
                body={<WatchTable runtime={this.props.runtime} />}
            />
        );
    }
}

@observer
class WatchTable extends React.Component<{ runtime: RuntimeBase }> {
    @computed
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

    getValueLabel(value: any, type: string | null) {
        if (value === undefined) {
            return "undefined";
        }

        if (value == "null") {
            return "null";
        }

        if (type) {
            if (isEnumType(type)) {
                const enumTypeName = getEnumTypeNameFromType(type);
                if (enumTypeName) {
                    const enumType =
                        this.props.runtime.DocumentStore.project.variables.enumsMap.get(
                            enumTypeName
                        );
                    if (enumType) {
                        const enumMember = enumType.members.find(
                            member => member.value == value
                        );
                        if (enumMember) {
                            return enumMember.name;
                        }
                    }
                }
            }
        }

        if (Array.isArray(value)) {
            return `${value.length} element(s)`;
        }

        if (typeof value == "object") {
            try {
                return JSON.stringify(value);
            } catch (err) {
                return "[object]";
            }
        }

        if (typeof value == "string") {
            return `"${value}"`;
        }

        return value.toString();
    }

    getValueChildren = computedFn(
        (value: any, type: string | null): (() => ITreeNode[]) | undefined => {
            if (Array.isArray(value)) {
                return () => {
                    const elementType = type
                        ? getArrayElementTypeFromType(type)
                        : undefined;

                    return value.map((element, i) => {
                        const elementValue = value[i];
                        const name = `[${i}]`;
                        const type = elementType ?? typeof elementValue;
                        return observable({
                            id: name,
                            name,
                            value: this.getValueLabel(elementValue, type),
                            type: type,

                            children: this.getValueChildren(elementValue, type),
                            selected: false,
                            expanded: false
                        });
                    }) as ITreeNode[];
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

                        children.push(
                            observable({
                                id: name,
                                name,
                                value: this.getValueLabel(
                                    propertyValue,
                                    fieldType
                                ),
                                type: fieldType ?? typeof propertyValue,

                                children: this.getValueChildren(
                                    propertyValue,
                                    fieldType
                                ),
                                selected: false,
                                expanded: false
                            })
                        );
                    }
                    return children;
                };
            }

            return undefined;
        }
    );

    getVariableTreeNodes = (variables: Variable[]) => {
        return variables.map(variable => {
            const flowState = this.props.runtime.selectedFlowState;

            let dataContext: IDataContext;
            if (flowState) {
                dataContext = flowState.dataContext;
            } else {
                dataContext = this.props.runtime.DocumentStore.dataContext;
            }

            const value = dataContext.get(variable.name);

            return observable({
                id: variable.name,

                name: variable.name,
                value: this.getValueLabel(value, variable.type),
                type: variable.type,

                children: this.getValueChildren(value, variable.type),
                selected: false,
                expanded: false
            });
        });
    };

    @computed get globalVariables() {
        return observable({
            id: "global-variables",
            name: "Global variables",
            value: undefined,
            type: "",
            children: () =>
                this.getVariableTreeNodes(
                    this.props.runtime.DocumentStore.project.variables
                        .globalVariables
                ),
            selected: false,
            expanded: true
        });
    }

    @computed get localVariables() {
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

            return observable({
                id: input.name,

                name: getInputName(componentState.component, input.name),
                value: this.getValueLabel(value, null),
                type: typeof value,

                children: this.getValueChildren(value, null),
                selected: false,
                expanded: false
            });
        });
    };

    @computed get componentInputs() {
        const flowState = this.props.runtime.selectedFlowState;
        if (!flowState) {
            return undefined;
        }

        const editorState =
            this.props.runtime.DocumentStore.editorsStore.activeEditor?.state;
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
        if (!(component instanceof Component)) {
            return undefined;
        }

        const inputs = component.inputs.filter(input => input.name != "@seqin");
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

    @computed get rootNode(): ITreeNode {
        const treeNode: ITreeNode = {
            id: "root",
            label: "",
            children: () => {
                const children = [this.globalVariables];

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

    selectNode = (node?: ITreeNode) => {};

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
