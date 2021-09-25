import React from "react";
import { observer } from "mobx-react";
import { ITreeNode, Tree } from "eez-studio-ui/tree";
import { ProjectContext } from "project-editor/project/context";
import { Panel } from "project-editor/components/Panel";
import { action, computed, IObservableValue, observable } from "mobx";
import { getId, getLabel } from "project-editor/core/object";
import { QueueTask } from "project-editor/flow/runtime";
import { Component } from "project-editor/flow/component";
import { getFlow } from "project-editor/project/project";

////////////////////////////////////////////////////////////////////////////////

@observer
export class BreakpointsPanel extends React.Component<{
    collapsed: IObservableValue<boolean>;
}> {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    render() {
        return (
            <Panel
                id="project-editor/debugger/breakpoints"
                title="Breakpoints"
                collapsed={this.props.collapsed}
                body={<BreakpointsList />}
            />
        );
    }
}

@observer
class BreakpointsList extends React.Component {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    @observable selectedBreakpoint: Component | undefined;

    @computed get rootNode(): ITreeNode<QueueTask> {
        let children = [...this.context.runtimeStore.breakpoints.keys()].map(
            component => ({
                id: getId(component),
                label: `${getLabel(getFlow(component))}/${getLabel(component)}`,
                children: [],
                selected: component == this.selectedBreakpoint,
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

        this.selectedBreakpoint = component;

        if (component) {
            this.context.runtimeStore.showComponent(component);
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
