import React from "react";
import { observer } from "mobx-react";
import { IListNode, List } from "eez-studio-ui/list";
import { Panel } from "project-editor/components/Panel";
import { action, computed, IObservableValue, makeObservable } from "mobx";
import { getId } from "project-editor/core/object";
import type { Component } from "project-editor/flow/component";
import { ProjectContext } from "project-editor/project/context";
import { IconAction } from "eez-studio-ui/action";
import { getLabel } from "project-editor/store";
import { ProjectEditor } from "project-editor/project-editor-interface";

export const BreakpointsPanel = observer(
    class BreakpointsPanel extends React.Component<{}> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        constructor(props: {}) {
            super(props);

            makeObservable(this, {
                allBreakpointsEnabled: computed,
                allBreakpointsDisabled: computed
            });
        }

        get allBreakpointsEnabled() {
            for (const enabled of this.context.uiStateStore.breakpoints.values()) {
                if (!enabled) {
                    return false;
                }
            }
            return true;
        }

        get allBreakpointsDisabled() {
            for (const enabled of this.context.uiStateStore.breakpoints.values()) {
                if (enabled) {
                    return false;
                }
            }
            return true;
        }

        toggleEnableAll = () => {
            if (this.allBreakpointsEnabled) {
                this.context.uiStateStore.breakpoints.forEach(
                    (enabled, breakpoint) => {
                        if (enabled) {
                            this.context.uiStateStore.disableBreakpoint(
                                breakpoint
                            );
                        }
                    }
                );
            } else {
                this.context.uiStateStore.breakpoints.forEach(
                    (enabled, breakpoint) => {
                        if (!enabled) {
                            this.context.uiStateStore.enableBreakpoint(
                                breakpoint
                            );
                        }
                    }
                );
            }
        };

        removeSelected = action(() => {
            const selectedBreakpoint =
                this.context.uiStateStore.selectedBreakpoint.get();
            if (selectedBreakpoint) {
                this.context.uiStateStore.removeBreakpoint(selectedBreakpoint);
                this.context.uiStateStore.selectedBreakpoint.set(undefined);
            }
        });

        removeAll = action(() => {
            [...this.context.uiStateStore.breakpoints.keys()].forEach(
                breakpoint =>
                    this.context.uiStateStore.removeBreakpoint(breakpoint)
            );
        });

        render() {
            const buttons = [
                <IconAction
                    key="toggle-enable-all"
                    icon={
                        this.allBreakpointsEnabled
                            ? "material:check_box"
                            : this.allBreakpointsDisabled
                            ? "material:check_box_outline_blank"
                            : "material:indeterminate_check_box"
                    }
                    iconSize={16}
                    title={
                        this.allBreakpointsEnabled
                            ? "Disable all breakpoints"
                            : "Enable all breakpoints"
                    }
                    onClick={this.toggleEnableAll}
                    enabled={this.context.uiStateStore.breakpoints.size > 0}
                />,
                <IconAction
                    key="remove-selected"
                    icon={"material:delete"}
                    iconSize={16}
                    title="Remove selected breakpoint"
                    onClick={this.removeSelected}
                    enabled={
                        !!this.context.uiStateStore.selectedBreakpoint.get()
                    }
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

            return (
                <Panel
                    id="project-editor/debugger/breakpoints"
                    title=""
                    buttons={buttons}
                    body={
                        <BreakpointsList
                            selectedBreakpoint={
                                this.context.uiStateStore.selectedBreakpoint
                            }
                        />
                    }
                />
            );
        }
    }
);

const BreakpointsList = observer(
    class BreakpointsList extends React.Component<{
        selectedBreakpoint: IObservableValue<Component | undefined>;
    }> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        constructor(props: {
            selectedBreakpoint: IObservableValue<Component | undefined>;
        }) {
            super(props);

            makeObservable(this, {
                nodes: computed,
                selectNode: action.bound
            });
        }

        get nodes(): IListNode<Component>[] {
            return [...this.context.uiStateStore.breakpoints.keys()].map(
                component => ({
                    id: getId(component),
                    label: <BreakpointItem component={component} />,
                    data: component,
                    selected: component == this.props.selectedBreakpoint.get()
                })
            );
        }

        selectNode(node?: IListNode<Component>) {
            const component = node && node.data;

            this.props.selectedBreakpoint.set(component);

            if (component) {
                if (this.context.runtime) {
                    this.context.runtime.showComponent(component);
                } else {
                    this.context.navigationStore.showObjects(
                        [component],
                        true,
                        false,
                        false
                    );
                }
            }
        }

        render() {
            return (
                <List
                    className="EezStudio_BreakpointsList"
                    nodes={this.nodes}
                    selectNode={this.selectNode}
                />
            );
        }
    }
);

const BreakpointItem = observer(
    class BreakpointItem extends React.Component<{
        component: Component;
    }> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
            const checked = event.target.checked;
            setTimeout(() => {
                if (checked) {
                    this.context.uiStateStore.enableBreakpoint(
                        this.props.component
                    );
                } else {
                    this.context.uiStateStore.disableBreakpoint(
                        this.props.component
                    );
                }
            });
        };

        render() {
            const { component } = this.props;
            const checked =
                this.context.uiStateStore.isBreakpointEnabledForComponent(
                    component
                );
            return (
                <div className="form-check">
                    <input
                        className="form-check-input"
                        type="checkbox"
                        checked={checked}
                        onChange={this.onChange}
                        title={
                            checked ? "Disable breakpoint" : "Enable breakpoint"
                        }
                    />
                    <label className="form-check-label">
                        {getLabel(ProjectEditor.getFlow(component))}/
                        {getLabel(component)}
                    </label>
                </div>
            );
        }
    }
);
