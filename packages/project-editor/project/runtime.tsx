import React from "react";
import { observer } from "mobx-react";

import styled from "eez-studio-ui/styled-components";
import { guid } from "eez-studio-shared/guid";

import { IListNode, List } from "eez-studio-ui/list";

import { ProjectContext } from "project-editor/project/context";
import { Panel } from "project-editor/components/Panel";
import { action, computed, observable } from "mobx";
import { DocumentStoreClass } from "project-editor/core/store";
import { Action, findAction } from "project-editor/features/action/action";
import { Flow } from "project-editor/features/gui/flow";
import { InputActionComponent } from "project-editor/features/gui/action-components";
import { ActionComponent, Widget } from "project-editor/features/gui/component";
import { getLabel, IEezObject } from "project-editor/core/object";
import { Toolbar } from "eez-studio-ui/toolbar";
import { IconAction } from "eez-studio-ui/action";

////////////////////////////////////////////////////////////////////////////////

enum HistoryItemType {
    ACTION_START,
    ACTION_END,
    EXECUTE_ACTION_COMPONENT,
    EXECUTE_WIDGET_ACTION,
    WIDGET_ACTION_NOT_DEFINED,
    WIDGET_ACTION_NOT_FOUND,
    NO_CONNECTION
}

class HistoryItem {
    date: Date;
    id = guid();

    constructor(
        public type: HistoryItemType,
        public object: IEezObject,
        public output?: string
    ) {
        this.date = new Date();
    }

    get label() {
        if (this.type == HistoryItemType.ACTION_START) {
            return `Action start: ${getLabel(this.object)}`;
        } else if (this.type == HistoryItemType.ACTION_END) {
            return `Action end: ${getLabel(this.object)}`;
        } else if (this.type == HistoryItemType.EXECUTE_ACTION_COMPONENT) {
            return `Execute action component: ${getLabel(this.object)}`;
        } else if (this.type == HistoryItemType.EXECUTE_WIDGET_ACTION) {
            return `Execture widget action: ${getLabel(this.object)}`;
        } else if (this.type == HistoryItemType.WIDGET_ACTION_NOT_DEFINED) {
            return `Widget action not defined: ${getLabel(this.object)}`;
        } else if (this.type == HistoryItemType.WIDGET_ACTION_NOT_FOUND) {
            return `Widget action not found: ${(this.object as Widget).action}`;
        } else if (this.type == HistoryItemType.NO_CONNECTION) {
            return `Action ${getLabel(
                this.object
            )} has no connection from output ${this.output}`;
        }
        return "TODO...";
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

    @action addHistoryItem(
        type: HistoryItemType,
        object: IEezObject,
        output?: string
    ) {
        this.history.push(new HistoryItem(type, object, output));
    }

    @action
    executeWidgetAction(widget: Widget) {
        if (widget.action) {
            const action = findAction(
                this.DocumentStore.project,
                widget.action
            );
            if (action) {
                this.addHistoryItem(
                    HistoryItemType.EXECUTE_WIDGET_ACTION,
                    widget
                );
                this.executeAction(action);
            } else {
                this.addHistoryItem(
                    HistoryItemType.WIDGET_ACTION_NOT_FOUND,
                    widget
                );
            }
        } else {
            this.addHistoryItem(
                HistoryItemType.WIDGET_ACTION_NOT_DEFINED,
                widget
            );
        }
    }

    @action
    executeAction(action: Action) {
        this.addHistoryItem(HistoryItemType.ACTION_START, action);
        this.executeFlow(action);
    }

    executeFlow(flow: Flow) {
        this.flow = flow;
        const inputActionComponent = flow.components.find(
            component => component instanceof InputActionComponent
        ) as ActionComponent;
        if (inputActionComponent) {
            this.executeActionComponent(inputActionComponent, "input");
        }
    }

    @action
    async executeActionComponent(
        actionComponent: ActionComponent,
        input: string
    ) {
        const flow = this.flow!;

        this.addHistoryItem(
            HistoryItemType.EXECUTE_ACTION_COMPONENT,
            actionComponent
        );

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
                this.executeActionComponent(actionNode, connectionLine.input);
                return;
            } else {
                this.addHistoryItem(
                    HistoryItemType.NO_CONNECTION,
                    actionComponent,
                    output
                );
            }
        }

        this.addHistoryItem(HistoryItemType.ACTION_END, flow);
        this.flow = undefined;
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
            <div className="history-item">
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
