import React from "react";
import { observer } from "mobx-react";
import { ITreeNode, Tree } from "eez-studio-ui/tree";
import { Panel } from "project-editor/components/Panel";
import { action, computed, IObservableValue, observable } from "mobx";
import { getId, getLabel } from "project-editor/core/object";
import { QueueTask, RuntimeBase } from "project-editor/flow/runtime";
import { Component } from "project-editor/flow/component";
import { getFlow } from "project-editor/project/project";
import { MaximizeIcon } from "./DebuggerPanel";
////////////////////////////////////////////////////////////////////////////////

@observer
export class BreakpointsPanel extends React.Component<{
    runtime: RuntimeBase;
    collapsed?: IObservableValue<boolean>;
    maximized: boolean;
    onToggleMaximized: () => void;
}> {
    render() {
        return (
            <Panel
                id="project-editor/debugger/breakpoints"
                title="Breakpoints"
                collapsed={this.props.collapsed}
                buttons={[
                    <MaximizeIcon
                        key="toggle-maximize"
                        maximized={this.props.maximized}
                        onToggleMaximized={this.props.onToggleMaximized}
                    />
                ]}
                body={<BreakpointsList runtime={this.props.runtime} />}
            />
        );
    }
}

@observer
class BreakpointsList extends React.Component<{ runtime: RuntimeBase }> {
    @observable selectedBreakpoint: Component | undefined;

    @computed get rootNode(): ITreeNode<QueueTask> {
        let children = [
            ...this.props.runtime.DocumentStore.uiStateStore.breakpoints.keys()
        ].map(component => ({
            id: getId(component),
            label: `${getLabel(getFlow(component))}/${getLabel(component)}`,
            children: [],
            selected: component == this.selectedBreakpoint,
            expanded: false,
            data: component
        }));

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

        this.selectedBreakpoint = component;

        if (component) {
            this.props.runtime.showComponent(component);
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
