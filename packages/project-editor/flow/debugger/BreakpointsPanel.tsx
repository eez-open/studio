import React from "react";
import { observer } from "mobx-react";
import { ITreeNode, Tree } from "eez-studio-ui/tree";
import { Panel } from "project-editor/components/Panel";
import { action, computed, IObservableValue, observable } from "mobx";
import { getId, getLabel } from "project-editor/core/object";
import { QueueTask } from "project-editor/flow/runtime";
import { Component } from "project-editor/flow/component";
import { getFlow } from "project-editor/project/project";
import { MaximizeIcon } from "./DebuggerPanel";
import { ProjectContext } from "project-editor/project/context";
import { IconAction } from "eez-studio-ui/action";

@observer
export class BreakpointsPanel extends React.Component<{
    collapsed?: IObservableValue<boolean>;
    maximized?: boolean;
    onToggleMaximized?: () => void;
}> {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    @observable selectedBreakpoint = observable.box<Component | undefined>(
        undefined
    );

    toggleEnable = () => {
        const selectedBreakpoint = this.selectedBreakpoint.get();
        if (selectedBreakpoint) {
            if (
                this.context.uiStateStore.isBreakpointEnabledForComponent(
                    selectedBreakpoint
                )
            ) {
                this.context.uiStateStore.disableBreakpoint(selectedBreakpoint);
            } else {
                this.context.uiStateStore.enableBreakpoint(selectedBreakpoint);
            }
        }
    };

    removeSelected = action(() => {
        const selectedBreakpoint = this.selectedBreakpoint.get();
        if (selectedBreakpoint) {
            this.context.uiStateStore.removeBreakpoint(selectedBreakpoint);
            this.selectedBreakpoint.set(undefined);
        }
    });

    toggleEnableAll = () => {
        const breakpoint = this.context.uiStateStore.breakpoints
            .keys()
            .next().value;
        if (
            breakpoint &&
            this.context.uiStateStore.isBreakpointEnabledForComponent(
                breakpoint
            )
        ) {
            this.context.uiStateStore.breakpoints.forEach(
                (enabled, breakpoint) => {
                    if (enabled) {
                        this.context.uiStateStore.disableBreakpoint(breakpoint);
                    }
                }
            );
        } else {
            this.context.uiStateStore.breakpoints.forEach(
                (enabled, breakpoint) => {
                    if (!enabled) {
                        this.context.uiStateStore.enableBreakpoint(breakpoint);
                    }
                }
            );
        }
    };

    removeAll = action(() => {
        this.context.uiStateStore.breakpoints.clear();
        this.selectedBreakpoint.set(undefined);
    });

    render() {
        const buttons = [
            <IconAction
                key="toggle-enable"
                icon={"material:check_box_outline_blank"}
                iconSize={16}
                title={"Toggle enable/disable selected component"}
                onClick={this.toggleEnable}
                enabled={!!this.selectedBreakpoint.get()}
            />,
            <IconAction
                key="toggle-enable-all"
                icon={"material:check_box"}
                iconSize={16}
                title={"Toggle enable/disable all breakpoints"}
                onClick={this.toggleEnableAll}
                enabled={this.context.uiStateStore.breakpoints.size > 0}
            />,
            <IconAction
                key="remove-selected"
                icon={"material:delete"}
                iconSize={16}
                title="Remove selected breakpoint"
                onClick={this.removeSelected}
                enabled={!!this.selectedBreakpoint.get()}
            />,
            <IconAction
                key="remove-all"
                icon={"material:delete_sweep"}
                iconSize={16}
                title="Remove all breakpoints"
                onClick={this.removeAll}
                enabled={this.context.uiStateStore.breakpoints.size > 0}
            />
        ];

        if (this.props.maximized && this.props.onToggleMaximized) {
            buttons.push(
                <MaximizeIcon
                    key="toggle-maximize"
                    maximized={this.props.maximized}
                    onToggleMaximized={this.props.onToggleMaximized}
                />
            );
        }

        return (
            <Panel
                id="project-editor/debugger/breakpoints"
                title="Breakpoints"
                collapsed={this.props.collapsed}
                buttons={buttons}
                body={
                    <BreakpointsList
                        selectedBreakpoint={this.selectedBreakpoint}
                    />
                }
            />
        );
    }
}

@observer
class BreakpointsList extends React.Component<{
    selectedBreakpoint: IObservableValue<Component | undefined>;
}> {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    @computed get rootNode(): ITreeNode<QueueTask> {
        let children = [...this.context.uiStateStore.breakpoints.keys()].map(
            component => ({
                id: getId(component),
                label: `${getLabel(getFlow(component))}/${getLabel(component)}`,
                children: [],
                selected: component == this.props.selectedBreakpoint.get(),
                expanded: false,
                data: component
            })
        );

        return {
            id: "root",
            label: "",
            children,
            selected: false,
            expanded: true
        };
    }

    @action.bound
    selectNode(node?: ITreeNode<Component>) {
        const component = node && node.data;

        this.props.selectedBreakpoint.set(component);

        if (component) {
            if (this.context.runtime) {
                this.context.runtime.showComponent(component);
            } else {
                this.context.navigationStore.showObject(component);
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
