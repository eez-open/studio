import React from "react";
import { observer } from "mobx-react";
import classNames from "classnames";

import { ITreeNode, Tree } from "eez-studio-ui/tree";

import { ProjectContext } from "project-editor/project/context";
import { Panel } from "project-editor/components/Panel";
import { action, computed, runInAction } from "mobx";
import { FlowTabState } from "project-editor/flow/flow";
import { getLabel } from "project-editor/core/object";
import { Splitter } from "eez-studio-ui/splitter";
import { HistoryPanel } from "./history";
import { FlowState } from "./runtime";
import { Toolbar } from "eez-studio-ui/toolbar";
import { ButtonAction } from "eez-studio-ui/action";

////////////////////////////////////////////////////////////////////////////////

@observer
export class DebuggerPanel extends React.Component {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    render() {
        return (
            <Panel
                id="runtime"
                title={"Runtime Info"}
                body={
                    <div className="EezStudio_RuntimePanel">
                        <Toolbar>
                            <ButtonAction
                                text="Single step"
                                title="Single step"
                                onClick={() =>
                                    this.context.RuntimeStore.runSingleStep()
                                }
                            />
                        </Toolbar>
                        <Splitter
                            type="vertical"
                            persistId={`project-editor/runtime-info`}
                            sizes={`50%|50%`}
                            childrenOverflow="hidden"
                        >
                            <FlowStatesPanel />
                            <HistoryPanel />
                        </Splitter>
                    </div>
                }
            />
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
class FlowStatesPanel extends React.Component {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    render() {
        return (
            <Panel
                id="project-editor/runtime-info/flows"
                title="History"
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
        const selectedFlowState = this.context.RuntimeStore.selectedFlowState;

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
            children: getChildren(this.context.RuntimeStore.flowStates),
            selected: !selectedFlowState,
            expanded: true
        };
    }

    @action.bound
    selectNode(node?: ITreeNode<FlowState>) {
        this.context.RuntimeStore.historyState.selectedHistoryItem = undefined;
        this.context.RuntimeStore.selectedFlowState = node?.data;

        const flowState = this.context.RuntimeStore.selectedFlowState;
        if (flowState) {
            this.context.NavigationStore.showObject(flowState.flow);

            const editorState = this.context.EditorsStore.activeEditor?.state;
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
