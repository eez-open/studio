import React from "react";
import { observer } from "mobx-react";
import classNames from "classnames";

import styled from "eez-studio-ui/styled-components";
import { guid } from "eez-studio-shared/guid";

import { IListNode, List } from "eez-studio-ui/list";

import { ProjectContext } from "project-editor/project/context";
import { Panel } from "project-editor/components/Panel";
import { action, computed, observable } from "mobx";
import { DocumentStoreClass } from "project-editor/core/store";
import { Action, findAction } from "project-editor/features/action/action";
import { Flow } from "project-editor/flow/flow";
import { InputActionComponent } from "project-editor/flow/action-components";
import {
    ActionComponent,
    Component,
    Widget
} from "project-editor/flow/component";
import { getLabel, IEezObject } from "project-editor/core/object";
import { Toolbar } from "eez-studio-ui/toolbar";
import { IconAction } from "eez-studio-ui/action";

////////////////////////////////////////////////////////////////////////////////

abstract class HistoryItem {
    date: Date = new Date();
    id = guid();

    abstract get label(): string;
    abstract get object(): IEezObject | undefined;
    get isError() {
        return false;
    }
}

class ActionStartHistoryItem extends HistoryItem {
    constructor(public object: IEezObject) {
        super();
    }

    get label() {
        return `Action start: ${getLabel(this.object)}`;
    }
}

class ActionEndHistoryItem extends HistoryItem {
    constructor(public object: IEezObject) {
        super();
    }

    get label() {
        return `Action end: ${getLabel(this.object)}`;
    }
}

class ExecuteActionComponentHistoryItem extends HistoryItem {
    constructor(public object: IEezObject) {
        super();
    }

    get label() {
        return `Execute action component: ${getLabel(this.object)}`;
    }
}

class ExecuteWidgetActionHistoryItem extends HistoryItem {
    constructor(public object: IEezObject) {
        super();
    }

    get label() {
        return `Execute widget action: ${getLabel(this.object)}`;
    }
}

class WidgetActionNotDefinedHistoryItem extends HistoryItem {
    constructor(public object: IEezObject) {
        super();
    }

    get label() {
        return `Widget action not defined: ${getLabel(this.object)}`;
    }

    get isError() {
        return true;
    }
}

class WidgetActionNotFoundHistoryItem extends HistoryItem {
    constructor(public object: IEezObject) {
        super();
    }

    get label() {
        return `Widget action not found: ${(this.object as Widget).action}`;
    }

    get isError() {
        return true;
    }
}

class NoConnectionHistoryItem extends HistoryItem {
    constructor(public object: IEezObject, public output?: string) {
        super();
    }

    get label() {
        return `Action ${getLabel(this.object)} has no connection from output ${
            this.output
        }`;
    }

    get isError() {
        return true;
    }
}

class OutputValueHistoryItem extends HistoryItem {
    constructor(
        public object: IEezObject,
        public output?: string,
        public value?: any
    ) {
        super();
    }

    get label() {
        return `Output value from [${getLabel(this.object)}/${
            this.output
        }]: ${this.value.toString()}`;
    }
}

class ExecutionErrorHistoryItem extends HistoryItem {
    constructor(public object: IEezObject, public error?: any) {
        super();
    }

    get label() {
        return `Execution error in ${getLabel(
            this.object
        )}: ${this.error.toString()}`;
    }

    get isError() {
        return true;
    }
}

////////////////////////////////////////////////////////////////////////////////

export class RuntimeStoreClass {
    @observable isRuntimeMode = false;
    @observable flow: Flow | undefined;
    @observable history: HistoryItem[] = [];

    @observable selectedHistoryItem: HistoryItem | undefined;

    constructor(public DocumentStore: DocumentStoreClass) {}

    @action.bound
    setRuntimeMode() {
        this.isRuntimeMode = true;
    }

    @action.bound
    setEditorMode() {
        this.isRuntimeMode = false;
    }

    @action addHistoryItem(historyItem: HistoryItem) {
        this.history.push(historyItem);
    }

    @action
    executeWidgetAction(widget: Widget) {
        if (widget.action) {
            const action = findAction(
                this.DocumentStore.project,
                widget.action
            );
            if (action) {
                this.addHistoryItem(new ExecuteWidgetActionHistoryItem(widget));
                this.executeAction(action);
            } else {
                this.addHistoryItem(
                    new WidgetActionNotFoundHistoryItem(widget)
                );
            }
        } else {
            this.addHistoryItem(new WidgetActionNotDefinedHistoryItem(widget));
        }
    }

    @action
    executeAction(action: Action) {
        this.addHistoryItem(new ActionStartHistoryItem(action));
        this.executeFlow(action);
    }

    executeFlow(flow: Flow) {
        this.flow = flow;

        flow.components.forEach(component => component.executePureFunction());

        const inputActionComponent = flow.components.find(
            component => component instanceof InputActionComponent
        ) as ActionComponent;
        if (inputActionComponent) {
            this.executeActionComponent(inputActionComponent, "input");
        } else {
            // TODO report
        }
    }

    @action
    async executeActionComponent(
        actionComponent: ActionComponent,
        input: string
    ) {
        const flow = this.flow!;

        this.addHistoryItem(
            new ExecuteActionComponentHistoryItem(actionComponent)
        );

        try {
            const output = await actionComponent.execute(input);

            if (output) {
                const connectionLine = flow.connectionLines.find(
                    connectionLine =>
                        connectionLine.source === actionComponent.wireID &&
                        connectionLine.output === output
                );

                if (connectionLine) {
                    const actionNode = flow.wiredComponents.get(
                        connectionLine.target
                    ) as ActionComponent;
                    this.executeActionComponent(
                        actionNode,
                        connectionLine.input
                    );
                    return;
                } else {
                    this.addHistoryItem(
                        new NoConnectionHistoryItem(actionComponent, output)
                    );
                }
            }
        } catch (err) {
            this.addHistoryItem(
                new ExecutionErrorHistoryItem(actionComponent, err)
            );
        }

        this.addHistoryItem(new ActionEndHistoryItem(flow));
        this.flow = undefined;
    }

    propagateValue(sourceComponent: Component, output: string, value: any) {
        const flow = this.flow;
        if (!flow) {
            return;
        }

        const connectionLine = flow.connectionLines.find(
            connectionLine =>
                connectionLine.source === sourceComponent.wireID &&
                connectionLine.output === output
        );

        if (connectionLine) {
            const targetComponent = flow.wiredComponents.get(
                connectionLine.target
            );

            if (targetComponent) {
                this.addHistoryItem(
                    new OutputValueHistoryItem(
                        sourceComponent,
                        connectionLine.output,
                        value
                    )
                );

                targetComponent.setInputPropertyValue(
                    connectionLine.input,
                    value
                );
            } else {
                // TODO report
            }
        } else {
            // TODO report
        }
    }

    render() {
        return <RuntimePanel />;
    }

    @action.bound
    clearHistory() {
        this.history = [];
    }
}

////////////////////////////////////////////////////////////////////////////////

const RuntimePanelDiv = styled.div`
    flex-grow: 1;
    background-color: ${props => props.theme.panelHeaderColor};
    overflow: auto;
    padding: 10px;

    .history-label {
        display: flex;
        justify-content: space-between;
    }

    .history {
        border: 1px solid ${props => props.theme.borderColor};
        min-height: 200px;
        max-height: 400px;
        overflow: auto;
        background-color: white;
    }

    .history-item {
        display: flex;
        align-items: center;

        small {
            margin-right: 5px;
        }

        .error {
            color: red;
        }
    }
`;

@observer
class RuntimePanel extends React.Component {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    render() {
        return (
            <Panel
                id="runtime"
                title={"Runtime Info"}
                body={
                    <RuntimePanelDiv>
                        <div className="history-label">
                            <label>History:</label>
                            <Toolbar>
                                {this.context.RuntimeStore.history.length >
                                    0 && (
                                    <IconAction
                                        icon="material:clear"
                                        title="Clear history"
                                        onClick={
                                            this.context.RuntimeStore
                                                .clearHistory
                                        }
                                    ></IconAction>
                                )}
                            </Toolbar>
                        </div>
                        <div className="history">
                            <History />
                        </div>
                    </RuntimePanelDiv>
                }
            />
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
class History extends React.Component {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    @computed get nodes(): IListNode<HistoryItem>[] {
        return this.context.RuntimeStore.history
            .slice()
            .reverse()
            .map(historyItem => ({
                id: historyItem.id,
                data: historyItem,
                selected:
                    this.context.RuntimeStore.selectedHistoryItem ===
                    historyItem
            }));
    }

    @action.bound
    selectNode(node?: IListNode<HistoryItem>) {
        this.context.RuntimeStore.selectedHistoryItem = node?.data;
        const object = this.context.RuntimeStore.selectedHistoryItem?.object;
        if (object) {
            this.context.NavigationStore.showObject(object);
        }
    }

    renderNode = (node: IListNode<HistoryItem>) => {
        const historyItem = node.data;
        return (
            <div
                className={classNames("history-item", {
                    error: historyItem.isError
                })}
            >
                <small>{historyItem.date.toLocaleTimeString()}</small>
                <span>{historyItem.label}</span>
            </div>
        );
    };

    render() {
        return (
            <List
                nodes={this.nodes}
                selectNode={this.selectNode}
                renderNode={this.renderNode}
            />
        );
    }
}
