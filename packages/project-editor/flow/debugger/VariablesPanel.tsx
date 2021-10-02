import React from "react";
import { observer } from "mobx-react";
import { ProjectContext } from "project-editor/project/context";
import { Panel } from "project-editor/components/Panel";
import { computed, IObservableValue, observable } from "mobx";
import { IColumn, ITreeNode, TreeTable } from "eez-studio-ui/tree-table";
import { IDataContext } from "eez-studio-types";
import {
    getArrayElementTypeFromType,
    getStructureFromType,
    Variable
} from "project-editor/features/variable/variable";
import { computedFn } from "mobx-utils";

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
export class VariablesPanel extends React.Component<{
    collapsed: IObservableValue<boolean>;
}> {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    render() {
        return (
            <Panel
                id="project-editor/debugger/variables"
                title="Variables"
                collapsed={this.props.collapsed}
                body={<VariablesTable />}
            />
        );
    }
}

@observer
class VariablesTable extends React.Component {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

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

    getValueLabel(value: any) {
        if (value === undefined) {
            return "undefined";
        }

        if (value == "null") {
            return "null";
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
                        : null;

                    return value.map((element, i) => {
                        const elementValue = value[i];
                        const name = `[${i}]`;
                        return observable({
                            id: name,
                            name,
                            value: this.getValueLabel(elementValue),
                            type: elementType ?? "?",

                            children: this.getValueChildren(
                                elementValue,
                                elementType
                            ),
                            selected: false,
                            expanded: false
                        });
                    }) as ITreeNode[];
                };
            }

            if (typeof value == "object") {
                return () => {
                    let structure;
                    if (type) {
                        structure = getStructureFromType(
                            this.context.project,
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
                                value: this.getValueLabel(propertyValue),
                                type: fieldType ?? "?",

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
            const flowState = this.context.runtimeStore.selectedFlowState;

            let dataContext: IDataContext;
            if (flowState) {
                dataContext = flowState.dataContext;
            } else {
                dataContext = this.context.dataContext;
            }

            const value = dataContext.get(variable.name);

            return observable({
                id: variable.name,

                name: variable.name,
                value: this.getValueLabel(value),
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
            name: "Global",
            value: undefined,
            type: "",
            children: () =>
                this.getVariableTreeNodes(
                    this.context.project.variables.globalVariables
                ),
            selected: false,
            expanded: true
        });
    }

    @computed get localVariables() {
        const flowState = this.context.runtimeStore.selectedFlowState;
        if (!flowState || flowState.flow.localVariables.length == 0) {
            return undefined;
        }

        return observable({
            id: "local-variables",
            name: "Local",
            value: undefined,
            type: "",
            children: () =>
                this.getVariableTreeNodes(flowState.flow.localVariables),
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
