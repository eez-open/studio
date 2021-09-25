import React from "react";
import { observer } from "mobx-react";
import classNames from "classnames";
import { ITreeNode, Tree } from "eez-studio-ui/tree";
import { ProjectContext } from "project-editor/project/context";
import { Panel } from "project-editor/components/Panel";
import { action, computed, IObservableValue, runInAction } from "mobx";
import { FlowTabState } from "project-editor/flow/flow";
import { getLabel } from "project-editor/core/object";
import { FlowState } from "project-editor/flow/runtime";

////////////////////////////////////////////////////////////////////////////////

@observer
export class ActiveFlowsPanel extends React.Component<{
    collapsed: IObservableValue<boolean>;
}> {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    render() {
        return (
            <Panel
                id="project-editor/debugger/flows"
                title="Active flows"
                collapsed={this.props.collapsed}
                body={<FlowsTree />}
            />
        );
    }
}

@observer
class FlowsTree extends React.Component {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    @computed get rootNode(): ITreeNode<FlowState> {
        const selectedFlowState = this.context.runtimeStore.selectedFlowState;

        function getChildren(flowStates: FlowState[]): ITreeNode<FlowState>[] {
            return flowStates.map(flowState => ({
                id: flowState.id,
                label: (
                    <div
                        className={classNames("running-flow", {
                            error: flowState.hasError
                        })}
                    >
                        {getLabel(flowState.flow)}
                    </div>
                ),
                children: getChildren(flowState.flowStates),
                selected: flowState === selectedFlowState,
                expanded: true,
                data: flowState
            }));
        }

        return {
            id: "all",
            label: "All",
            children: getChildren(this.context.runtimeStore.flowStates),
            selected: !selectedFlowState,
            expanded: true
        };
    }

    @action.bound
    selectNode(node?: ITreeNode<FlowState>) {
        this.context.runtimeStore.historyState.selectedHistoryItem = undefined;

        const flowState = node?.data;

        this.context.runtimeStore.selectedFlowState = flowState;

        if (flowState) {
            this.context.navigationStore.showObject(flowState.flow);

            const editorState = this.context.editorsStore.activeEditor?.state;
            if (editorState instanceof FlowTabState) {
                setTimeout(() => {
                    runInAction(() => (editorState.flowState = flowState));
                }, 0);
            }
        }
    }

    render() {
        return (
            <Tree
                showOnlyChildren={false}
                rootNode={this.rootNode}
                selectNode={this.selectNode}
            />
        );
    }
}
