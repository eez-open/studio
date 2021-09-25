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
import { HistoryItem } from "project-editor/flow/debugger/history";

////////////////////////////////////////////////////////////////////////////////

@observer
export class HistoryPanel extends React.Component<{
    collapsed: IObservableValue<boolean>;
}> {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    render() {
        return (
            <Panel
                id="project-editor/runtime-info/history"
                title="History"
                collapsed={this.props.collapsed}
                buttons={
                    this.context.runtimeStore.isPaused
                        ? [
                              <IconAction
                                  key="clear"
                                  icon="material:delete"
                                  title="Clear history"
                                  onClick={
                                      this.context.runtimeStore.historyState
                                          .clearHistory
                                  }
                              ></IconAction>
                          ]
                        : []
                }
                body={
                    this.context.runtimeStore.isPaused ? (
                        <HistoryTree />
                    ) : (
                        <div />
                    )
                }
            />
        );
    }
}

@observer
class HistoryTree extends React.Component {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    @computed get rootNode(): ITreeNode<HistoryItem> {
        const selectedHistoryItem =
            this.context.runtimeStore.historyState.selectedHistoryItem;

        function getChildren(
            historyItems: HistoryItem[]
        ): ITreeNode<HistoryItem>[] {
            return historyItems.map(historyItem => ({
                id: historyItem.id,
                label: (
                    <div
                        className={classNames("history-item", {
                            error: historyItem.isError
                        })}
                    >
                        <small>{historyItem.date.toLocaleTimeString()}</small>
                        <span>{historyItem.label}</span>
                    </div>
                ),
                children: getChildren(historyItem.history),
                selected: historyItem === selectedHistoryItem,
                expanded: true,
                data: historyItem
            }));
        }

        const historyItems = this.context.runtimeStore.historyState.history
            .slice()
            .reverse();

        return {
            id: "root",
            label: "",
            children: getChildren(
                historyItems.filter(
                    historyItem =>
                        !this.context.runtimeStore.selectedFlowState ||
                        historyItem.flowState ===
                            this.context.runtimeStore.selectedFlowState
                )
            ),
            selected: false,
            expanded: true
        };
    }

    @action.bound
    selectNode(node?: ITreeNode<HistoryItem>) {
        const historyItem = node?.data;
        this.context.runtimeStore.historyState.selectedHistoryItem =
            historyItem;
        if (!historyItem) {
            return;
        }

        if (historyItem.flow) {
            this.context.navigationStore.showObject(historyItem.flow);
        } else {
            const objects: IEezObject[] = [];

            if (historyItem.sourceComponent) {
                objects.push(historyItem.sourceComponent);
            }

            if (historyItem.connectionLine) {
                objects.push(historyItem.connectionLine);
            }

            if (historyItem.targetComponent) {
                objects.push(historyItem.targetComponent);
            }

            if (objects.length > 0) {
                // navigate to the first object,
                // just to make sure that proper editor is opened
                this.context.navigationStore.showObject(objects[0]);

                const editorState =
                    this.context.editorsStore.activeEditor?.state;
                if (editorState instanceof FlowTabState) {
                    // select other object in the same editor
                    editorState.selectObjects(objects);

                    // ensure objects are visible on the screen
                    editorState.ensureSelectionVisible();
                }
            }
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
