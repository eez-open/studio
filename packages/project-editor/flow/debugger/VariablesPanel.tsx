import React from "react";
import { observer } from "mobx-react";
import { ProjectContext } from "project-editor/project/context";
import { Panel } from "project-editor/components/Panel";
import { computed, IObservableValue } from "mobx";
import { IColumn, Table } from "eez-studio-ui/table";
import { IDataContext } from "eez-studio-types";

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
            title: "Name",
            sortEnabled: true
        });

        result.push({
            name: "scope",
            title: "Scope",
            sortEnabled: true
        });
        result.push({
            name: "value",
            title: "Value",
            sortEnabled: true
        });

        return result;
    }

    @computed
    get rows() {
        const flowState = this.context.runtimeStore.selectedFlowState;

        let dataContext: IDataContext;
        if (flowState) {
            dataContext = flowState.dataContext;
        } else {
            dataContext = this.context.dataContext;
        }

        const globalVariables =
            this.context.project.variables.globalVariables.map(variable => ({
                id: `global/${variable.name}`,
                selected: false,
                name: variable.name,
                scope: "Global",
                value: valueToString(dataContext.get(variable.name))
            }));

        if (!flowState) {
            return globalVariables;
        }

        const localVariables = flowState.flow.localVariables.map(variable => ({
            id: `local/${variable.name}`,
            selected: false,
            name: variable.name,
            scope: "Local",
            value: valueToString(dataContext.get(variable.name))
        }));

        return [...globalVariables, ...localVariables];
    }

    render() {
        return (
            <div className="EezStudio_DebuggerVariablesTable">
                <Table
                    persistId="project-editor/debugger/variables/table"
                    columns={this.columns}
                    rows={this.rows}
                    defaultSortColumn="name"
                />
            </div>
        );
    }
}
