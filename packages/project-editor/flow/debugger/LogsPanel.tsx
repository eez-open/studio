import React from "react";
import { action, computed, IObservableValue } from "mobx";
import { observer } from "mobx-react";
import classNames from "classnames";

import { IconAction } from "eez-studio-ui/action";
import { ITreeNode, Tree } from "eez-studio-ui/tree";

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
                buttons={
                    this.context.runtimeStore.isPaused
                        ? [
                              <IconAction
                                  key="clear"
                                  icon="material:delete"
                                  title="Clear logs"
                                  onClick={
                                      this.context.runtimeStore.logsState.clear
                                  }
                              ></IconAction>
                          ]
                        : []
                }
                body={
                    this.context.runtimeStore.isPaused ? <LogList /> : <div />
                }
            />
        );
    }
}

@observer
class LogList extends React.Component {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    @computed get rootNode(): ITreeNode<LogItem> {
        const selectedLogItem =
            this.context.runtimeStore.logsState.selectedLogItem;

        function getChildren(logItems: LogItem[]): ITreeNode<LogItem>[] {
            return logItems.map(logItem => ({
                id: logItem.id,
                label: (
                    <div className={classNames("log-item", logItem.type)}>
                        <small>{logItem.date.toLocaleTimeString()}</small>
                        <span>{logItem.label}</span>
                    </div>
                ),
                children: [],
                selected: logItem === selectedLogItem,
                expanded: false,
                data: logItem
            }));
        }

        const logItems = this.context.runtimeStore.logsState.logs
            .slice()
            .reverse();

        return {
            id: "root",
            label: "",
            children: getChildren(
                logItems.filter(
                    logItem =>
                        !this.context.runtimeStore.selectedFlowState ||
                        logItem.flowState ===
                            this.context.runtimeStore.selectedFlowState
                )
            ),
            selected: false,
            expanded: true
        };
    }

    @action.bound
    selectNode(node?: ITreeNode<LogItem>) {
        const logItem = node?.data;
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
        return (
            <Tree
                showOnlyChildren={true}
                rootNode={this.rootNode}
                selectNode={this.selectNode}
            />
        );
    }
}
