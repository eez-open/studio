import React from "react";
import { observer } from "mobx-react";
import classNames from "classnames";
import { ITreeNode, Tree } from "eez-studio-ui/tree";
import { action, computed, makeObservable } from "mobx";
import { FlowState, RuntimeBase } from "project-editor/flow/runtime/runtime";
import { getFlowStateLabel } from "project-editor/flow/debugger/logs";

////////////////////////////////////////////////////////////////////////////////

export const ActiveFlowsPanel = observer(
    class ActiveFlowsPanel extends React.Component<{
        runtime: RuntimeBase;
    }> {
        render() {
            return (
                <div className="EezStudio_DebuggerPanel">
                    <FlowsTree runtime={this.props.runtime} />
                </div>
            );
        }
    }
);

const FlowsTree = observer(
    class FlowsTree extends React.Component<{ runtime: RuntimeBase }> {
        constructor(props: { runtime: RuntimeBase }) {
            super(props);

            makeObservable(this, {
                rootNode: computed,
                selectNode: action.bound
            });
        }

        get rootNode(): ITreeNode<FlowState> {
            const selectedFlowState = this.props.runtime.selectedFlowState;

            function getChildren(
                flowStates: FlowState[]
            ): ITreeNode<FlowState>[] {
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
                                {getFlowStateLabel(flowState)}
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
);
