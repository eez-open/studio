import React from "react";
import { observer } from "mobx-react";
import classNames from "classnames";
import { ITreeNode, Tree } from "eez-studio-ui/tree";
import { action, computed, makeObservable } from "mobx";
import { FlowState, RuntimeBase } from "project-editor/flow/runtime/runtime";
import { getFlowStateLabel } from "project-editor/flow/debugger/logs";
import { Panel } from "project-editor/ui-components/Panel";
import { ProjectContext } from "project-editor/project/context";

////////////////////////////////////////////////////////////////////////////////

export const ActiveFlowsPanel = observer(
    class ActiveFlowsPanel extends React.Component<{
        runtime: RuntimeBase;
    }> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        render() {
            return (
                <div className="EezStudio_DebuggerPanel">
                    <Panel
                        id="project-editor/debugger/active-flows"
                        title=""
                        buttons={[
                            <div
                                key="show-finished-flows"
                                className="form-check"
                                style={{
                                    minHeight: "auto",
                                    padding: "5px 10px 5px 0",
                                    margin: 0
                                }}
                            >
                                <input
                                    className="form-check-input"
                                    type="checkbox"
                                    id="EezStudio_DebuggerPanel_ActiveFlows_ShowFinishedFlows"
                                    checked={
                                        this.context.uiStateStore
                                            .showFinishedFlowsInDebugger
                                    }
                                    onChange={action(
                                        (
                                            event: React.ChangeEvent<HTMLInputElement>
                                        ) => {
                                            this.context.uiStateStore.showFinishedFlowsInDebugger =
                                                event.target.checked;
                                        }
                                    )}
                                />
                                <label
                                    className="form-check-label"
                                    htmlFor="EezStudio_DebuggerPanel_ActiveFlows_ShowFinishedFlows"
                                >
                                    Show finished flows
                                </label>
                            </div>
                        ]}
                        body={<FlowsTree runtime={this.props.runtime} />}
                    ></Panel>
                </div>
            );
        }
    }
);

const FlowsTree = observer(
    class FlowsTree extends React.Component<{ runtime: RuntimeBase }> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        constructor(props: { runtime: RuntimeBase }) {
            super(props);

            makeObservable(this, {
                rootNode: computed,
                selectNode: action.bound
            });
        }

        get rootNode(): ITreeNode<FlowState> {
            const selectedFlowState = this.props.runtime.selectedFlowState;

            const showFinishedFlowsInDebugger =
                this.context.uiStateStore.showFinishedFlowsInDebugger;

            function getChildren(
                flowStates: FlowState[]
            ): ITreeNode<FlowState>[] {
                return flowStates
                    .filter(
                        flowState =>
                            !flowState.isFinished || showFinishedFlowsInDebugger
                    )
                    .map(flowState => ({
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
