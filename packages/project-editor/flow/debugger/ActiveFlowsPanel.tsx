import React from "react";
import { observer } from "mobx-react";
import classNames from "classnames";
import { ITreeNode, Tree } from "eez-studio-ui/tree";
import { action, computed } from "mobx";
import { FlowState, RuntimeBase } from "project-editor/flow/runtime";
import { getLabel } from "project-editor/core/store";

////////////////////////////////////////////////////////////////////////////////

@observer
export class ActiveFlowsPanel extends React.Component<{
    runtime: RuntimeBase;
}> {
    render() {
        return <FlowsTree runtime={this.props.runtime} />;
    }
}

@observer
class FlowsTree extends React.Component<{ runtime: RuntimeBase }> {
    @computed get rootNode(): ITreeNode<FlowState> {
        const selectedFlowState = this.props.runtime.selectedFlowState;

        function getChildren(flowStates: FlowState[]): ITreeNode<FlowState>[] {
            return flowStates.map(flowState => ({
                id: flowState.id,
                label: (
                    <div
                        className={classNames("running-flow", {
                            error: !!flowState.error
                        })}
                    >
                        <span
                            style={{
                                opacity: flowState.isFinished
                                    ? "0.5"
                                    : undefined
                            }}
                        >
                            {getLabel(flowState.flow)}
                        </span>
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
            children: getChildren(this.props.runtime.flowStates),
            selected: false,
            expanded: true
        };
    }

    @action.bound
    selectNode(node?: ITreeNode<FlowState>) {
        this.props.runtime.logs.selectedLogItem = undefined;

        const flowState = node?.data;

        this.props.runtime.selectedFlowState = flowState;

        this.props.runtime.showSelectedFlowState();
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
