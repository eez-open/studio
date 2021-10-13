import React from "react";
import { action, computed, IObservableValue, observable } from "mobx";
import { observer } from "mobx-react";
import classNames from "classnames";
import { FixedSizeList as List } from "react-window";
import AutoSizer from "react-virtualized-auto-sizer";

import { IconAction } from "eez-studio-ui/action";

import { IEezObject } from "project-editor/core/object";
import { Panel } from "project-editor/components/Panel";
import { FlowTabState } from "project-editor/flow/flow";
import { LogItem } from "project-editor/flow/debugger/logs";
import { RuntimeBase } from "project-editor/flow/runtime";
import { ProjectContext } from "project-editor/project/context";
import { MaximizeIcon } from "./DebuggerPanel";

////////////////////////////////////////////////////////////////////////////////

type Filter = "all" | "scpi" | "error";

const logsPanelFilter = observable.box<Filter>("all");

@observer
export class LogsPanel extends React.Component<{
    runtime: RuntimeBase;
    collapsed?: IObservableValue<boolean>;
    maximized: boolean;
    onToggleMaximized: () => void;
}> {
    onChangeFilter = action((event: React.ChangeEvent<HTMLSelectElement>) => {
        logsPanelFilter.set(event.currentTarget.value as Filter);
    });

    render() {
        return (
            <Panel
                id="project-editor/runtime-info/logs"
                title="Logs"
                collapsed={this.props.collapsed}
                buttons={[
                    <div key="filter">
                        <span style={{ marginRight: 5 }}>Filter:</span>
                        <select
                            className="form-select"
                            value={logsPanelFilter.get()}
                            onChange={this.onChangeFilter}
                        >
                            <option value="all">All</option>
                            <option value="scpi">SCPI</option>
                            <option value="error">Error</option>
                        </select>
                    </div>,
                    <IconAction
                        key="clear"
                        icon="material:delete"
                        iconSize={20}
                        title="Clear logs"
                        onClick={this.props.runtime.logs.clear}
                    ></IconAction>,

                    <MaximizeIcon
                        key="toggle-maximize"
                        maximized={this.props.maximized}
                        onToggleMaximized={this.props.onToggleMaximized}
                    />
                ]}
                body={
                    <LogList
                        runtime={this.props.runtime}
                        filter={logsPanelFilter.get()}
                    />
                }
            />
        );
    }
}

@observer
class LogList extends React.Component<{
    runtime: RuntimeBase;
    filter: Filter;
}> {
    @computed get logs() {
        const logs = this.props.runtime.logs.logs.slice().reverse();
        if (this.props.filter == "all") {
            return logs;
        }
        return logs.filter(logItem => logItem.type == this.props.filter);
    }

    render() {
        const itemCount = this.logs.length;
        return (
            <div style={{ height: "100%" }}>
                <AutoSizer>
                    {({ width, height }) => (
                        <List
                            itemCount={itemCount}
                            itemData={
                                {
                                    logs: this.logs
                                } as any
                            }
                            itemSize={24}
                            width={width}
                            height={height}
                        >
                            {LogItemRow}
                        </List>
                    )}
                </AutoSizer>
            </div>
        );
    }
}

@observer
class LogItemRow extends React.Component<{
    index: number;
    style: React.CSSProperties;
    data: LogItem;
}> {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    get runtime() {
        return this.context.runtime!;
    }

    @action.bound
    selectNode(logItem: LogItem) {
        this.runtime.logs.selectedLogItem = logItem;
        if (!logItem) {
            return;
        }

        this.runtime.selectedFlowState = logItem.flowState;

        const objects: IEezObject[] = [];

        if (logItem.connectionLine) {
            if (logItem.connectionLine.sourceComponent) {
                objects.push(logItem.connectionLine.sourceComponent);
            }

            if (logItem.connectionLine) {
                objects.push(logItem.connectionLine);
            }

            if (logItem.connectionLine.targetComponent) {
                objects.push(logItem.connectionLine.targetComponent);
            }
        } else if (logItem.component) {
            objects.push(logItem.component);
        }

        if (objects.length > 0) {
            // navigate to the first object,
            // just to make sure that proper editor is opened
            this.context.navigationStore.showObject(objects[0]);

            const editorState = this.context.editorsStore.activeEditor?.state;
            if (editorState instanceof FlowTabState) {
                // select other object in the same editor
                editorState.selectObjects(objects);

                // ensure objects are visible on the screen
                editorState.ensureSelectionVisible();
            }
        } else if (logItem.flowState?.flow) {
            this.context.navigationStore.showObject(logItem.flowState?.flow);
        }
    }

    render() {
        const logItem = (this.props.data as any).logs[this.props.index];

        return (
            <div
                className={classNames("log-item", logItem.type, {
                    selected: logItem == this.runtime.logs.selectedLogItem
                })}
                style={this.props.style}
                onClick={() => this.selectNode(logItem)}
            >
                <small>{logItem.date.toLocaleTimeString()}</small>
                <span>{logItem.label}</span>
            </div>
        );
    }
}
