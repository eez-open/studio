import React from "react";
import { action, IObservableValue } from "mobx";
import { observer } from "mobx-react";
import classNames from "classnames";
import { FixedSizeList as List } from "react-window";
import AutoSizer from "react-virtualized-auto-sizer";

import { IconAction } from "eez-studio-ui/action";

import { IEezObject } from "project-editor/core/object";
import { ProjectContext } from "project-editor/project/context";
import { Panel } from "project-editor/components/Panel";
import { FlowTabState } from "project-editor/flow/flow";
import { LogItem } from "project-editor/flow/debugger/logs";

////////////////////////////////////////////////////////////////////////////////

@observer
export class LogsPanel extends React.Component<{
    collapsed: IObservableValue<boolean>;
}> {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    render() {
        return (
            <Panel
                id="project-editor/runtime-info/logs"
                title="Logs"
                collapsed={this.props.collapsed}
                buttons={[
                    <IconAction
                        key="clear"
                        icon="material:delete"
                        title="Clear logs"
                        onClick={this.context.runtimeStore.logsState.clear}
                    ></IconAction>
                ]}
                body={<LogList />}
            />
        );
    }
}

@observer
class LogList extends React.Component {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    render() {
        const itemCount = this.context.runtimeStore.logsState.logs.length;
        return (
            <div style={{ height: "100%" }}>
                <AutoSizer>
                    {({ width, height }) => (
                        <List
                            itemCount={itemCount}
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

    @action.bound
    selectNode(logItem: LogItem) {
        this.context.runtimeStore.logsState.selectedLogItem = logItem;
        if (!logItem) {
            return;
        }

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
        const logItem =
            this.context.runtimeStore.logsState.logs[
                this.context.runtimeStore.logsState.logs.length -
                    this.props.index -
                    1
            ];

        return (
            <div
                className={classNames("log-item", logItem.type, {
                    selected:
                        logItem ==
                        this.context.runtimeStore.logsState.selectedLogItem
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
