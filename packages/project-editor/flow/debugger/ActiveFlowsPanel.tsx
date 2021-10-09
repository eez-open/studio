import React from "react";
import { observer } from "mobx-react";
import classNames from "classnames";
import { ITreeNode, Tree } from "eez-studio-ui/tree";
import { Panel } from "project-editor/components/Panel";
import { action, computed, IObservableValue } from "mobx";
import { getLabel } from "project-editor/core/object";
import { FlowState, RuntimeBase } from "project-editor/flow/runtime";
import { MaximizeIcon } from "./DebuggerPanel";

////////////////////////////////////////////////////////////////////////////////

@observer
export class ActiveFlowsPanel extends React.Component<{
    runtime: RuntimeBase;
    collapsed?: IObservableValue<boolean>;
    maximized: boolean;
    onToggleMaximized: () => void;
}> {
    render() {
        return (
            <Panel
                id="project-editor/debugger/flows"
                title="Active flows"
                collapsed={this.props.collapsed}
                buttons={[
                    <MaximizeIcon
                        key="toggle-maximize"
                        maximized={this.props.maximized}
                        onToggleMaximized={this.props.onToggleMaximized}
                    />
                ]}
                body={<FlowsTree runtime={this.props.runtime} />}
            />
        );
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
