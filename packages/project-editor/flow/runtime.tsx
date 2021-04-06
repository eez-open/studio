import React from "react";
import { observer } from "mobx-react";
import classNames from "classnames";

import styled from "eez-studio-ui/styled-components";
import { guid } from "eez-studio-shared/guid";

import { IListNode, List } from "eez-studio-ui/list";

import { ProjectContext } from "project-editor/project/context";
import { Panel } from "project-editor/components/Panel";
import { action, computed, observable, runInAction } from "mobx";
import { DocumentStoreClass } from "project-editor/core/store";
import { findAction } from "project-editor/features/action/action";
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
import { getFlow } from "project-editor/project/project";

const MAX_HISTORY_ITEMS = 1000;

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

export class RunningFlow {
    id = guid();
    interrupt = false;

    constructor(public RuntimeStore: RuntimeStoreClass, public flow: Flow) {}

    get label() {
        return getLabel(this.flow);
    }

    onStart() {
        this.flow.components.forEach(component => component.onStart(this));
    }

    onEnd() {
        this.flow.components.forEach(component => component.onEnd(this));
    }

    startFromWidgetAction(widget: Component) {
        this.onStart();
        this.executeWire(widget, "action");
    }

    startAction() {
        this.RuntimeStore.addHistoryItem(new ActionStartHistoryItem(action));

        this.onStart();

        const inputActionComponent = this.flow.components.find(
            component => component instanceof InputActionComponent
        ) as ActionComponent;

        if (inputActionComponent) {
            this.executeActionComponent(inputActionComponent, "input");
        } else {
            // TODO report
        }
    }

    stop() {
        this.interrupt = true;
    }

    executeActionComponent(actionComponent: ActionComponent, input: string) {
        this.RuntimeStore.queue.push({
            runningFlow: this,
            actionComponent,
            input
        });
    }

    async doExecuteActionComponent(
        actionComponent: ActionComponent,
        input: string
    ) {
        this.RuntimeStore.addHistoryItem(
            new ExecuteActionComponentHistoryItem(actionComponent)
        );

        try {
            const output = await actionComponent.execute(this);
            if (output) {
                this.executeWire(actionComponent, output);
                return;
            }
        } catch (err) {
            this.RuntimeStore.addHistoryItem(
                new ExecutionErrorHistoryItem(actionComponent, err)
            );
        }

        this.endFlow();
    }

    executeWire(component: Component, output: string) {
        if (this.interrupt) {
            this.endFlow();
            return;
        }

        const flow = this.flow!;

        const connectionLine = flow.connectionLines.find(
            connectionLine =>
                connectionLine.source === component.wireID &&
                connectionLine.output === output
        );

        if (connectionLine) {
            connectionLine.setActive();
            const actionNode = flow.wiredComponents.get(
                connectionLine.target
            ) as ActionComponent;
            this.executeActionComponent(actionNode, connectionLine.input);
        } else {
            this.RuntimeStore.addHistoryItem(
                new NoConnectionHistoryItem(component, output)
            );
            this.endFlow();
        }
    }

    propagateValue(sourceComponent: Component, output: string, value: any) {
        const flow = this.flow;
        if (!flow) {
            return;
        }

        flow.connectionLines.forEach(connectionLine => {
            if (
                connectionLine.source === sourceComponent.wireID &&
                connectionLine.output === output
            ) {
                const targetComponent = flow.wiredComponents.get(
                    connectionLine.target
                );

                if (targetComponent) {
                    connectionLine.setActive();

                    this.RuntimeStore.addHistoryItem(
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
            }
        });
    }

    @action
    endFlow() {
        this.onEnd();
        this.RuntimeStore.addHistoryItem(new ActionEndHistoryItem(this.flow!));
        this.RuntimeStore.endRunningFlow(this);
    }
}

////////////////////////////////////////////////////////////////////////////////

export class RuntimeStoreClass {
    @observable isRuntimeMode = false;

    queue: {
        runningFlow: RunningFlow;
        actionComponent: ActionComponent;
        input: string;
    }[] = [];
    pumpTimeoutId: any;
    numExecutedTasks: number = 0;
    measureSpeedTime: number;
    @observable speed: number;

    @observable runningFlows: RunningFlow[] = [];

    @observable history: HistoryItem[] = [];
    @observable selectedHistoryItem: HistoryItem | undefined;

    constructor(public DocumentStore: DocumentStoreClass) {}

    @action.bound
    setRuntimeMode() {
        if (!this.isRuntimeMode) {
            this.isRuntimeMode = true;
            this.measureSpeedTime = new Date().getTime();
            this.numExecutedTasks = 0;
            this.pumpQueue();
        }
    }

    setEditorMode = async () => {
        if (this.isRuntimeMode) {
            await this.stopAllRunningFlows();
            runInAction(() => (this.isRuntimeMode = false));
        }
    };

    addRunningFlow(runningFlow: RunningFlow) {
        EEZStudio.electron.ipcRenderer.send("preventAppSuspension", true);
        this.runningFlows.push(runningFlow);
    }

    pumpQueue = async () => {
        this.pumpTimeoutId = undefined;

        const time = new Date().getTime();

        if (time - this.measureSpeedTime >= 1000) {
            runInAction(() => {
                this.speed = this.numExecutedTasks;
            });
            this.numExecutedTasks = 0;
            this.measureSpeedTime = time;
        }

        while (await this.executeNextTask()) {
            this.numExecutedTasks++;
            if (new Date().getTime() - time > 100) {
                break;
            }
        }

        this.pumpTimeoutId = setTimeout(this.pumpQueue);
    };

    async executeNextTask() {
        const task = this.queue.shift();
        if (task) {
            const { runningFlow, actionComponent, input } = task;
            await runningFlow.doExecuteActionComponent(actionComponent, input);
            return true;
        }
        return false;
    }

    @action addHistoryItem(historyItem: HistoryItem) {
        this.history.push(historyItem);
        if (this.history.length > MAX_HISTORY_ITEMS) {
            this.history.shift();
        }
    }

    @action
    executeWidgetAction(widget: Widget) {
        if (widget.isOutputProperty("action")) {
            const flow = getFlow(widget);

            const runningFlow = new RunningFlow(this, flow);
            this.addRunningFlow(runningFlow);
            runningFlow.startFromWidgetAction(widget);
        } else if (widget.action) {
            const action = findAction(
                this.DocumentStore.project,
                widget.action
            );

            if (action) {
                this.addHistoryItem(new ExecuteWidgetActionHistoryItem(widget));
                const runningFlow = new RunningFlow(this, action);
                this.addRunningFlow(runningFlow);
                runningFlow.startAction();
            } else {
                this.addHistoryItem(
                    new WidgetActionNotFoundHistoryItem(widget)
                );
            }
        } else {
            this.addHistoryItem(new WidgetActionNotDefinedHistoryItem(widget));
        }
    }

    endRunningFlow(runningFlow: RunningFlow) {
        this.runningFlows.splice(this.runningFlows.indexOf(runningFlow), 1);
        if (this.runningFlows.length === 0) {
            EEZStudio.electron.ipcRenderer.send("preventAppSuspension", false);
        }
    }

    async stopAllRunningFlows() {
        if (this.pumpTimeoutId) {
            clearTimeout(this.pumpTimeoutId);
            this.pumpTimeoutId = undefined;
        }

        this.runningFlows.forEach(runningFlow => runningFlow.stop());

        while (this.runningFlows.length > 0) {
            await this.executeNextTask();
            await new Promise<void>(resolve => setTimeout(resolve));
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

    .running-flows,
    .history {
        border: 1px solid ${props => props.theme.borderColor};
        overflow: auto;
        background-color: white;
    }

    .running-flows {
        height: 150px;
    }

    .running-flow {
        flex-grow: 1 !important;
        display: flex;
        justify-content: space-between;
    }

    .history-label {
        display: flex;
        justify-content: space-between;
    }

    .history {
        height: 300px;
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
                        {this.context.RuntimeStore.runningFlows.length > 0 && (
                            <>
                                <div>
                                    Speed: {this.context.RuntimeStore.speed}{" "}
                                    actions per second
                                </div>
                                <div>
                                    <label>Running flows:</label>
                                </div>
                                <div className="running-flows">
                                    <RunningFlows />
                                </div>
                            </>
                        )}

                        {this.context.RuntimeStore.runningFlows.length == 0 && (
                            <>
                                <div className="history-label">
                                    <label>History:</label>
                                    <Toolbar>
                                        {this.context.RuntimeStore.history
                                            .length > 0 && (
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
                            </>
                        )}
                    </RuntimePanelDiv>
                }
            />
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
class RunningFlows extends React.Component {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    @computed get nodes(): IListNode<RunningFlow>[] {
        return this.context.RuntimeStore.runningFlows
            .slice()
            .reverse()
            .map(runningFlow => ({
                id: runningFlow.id,
                data: runningFlow,
                selected: false
            }));
    }

    renderNode = (node: IListNode<RunningFlow>) => {
        const runningFlow = node.data;
        return (
            <div className="running-flow">
                <span>{runningFlow.label}</span>
                <IconAction
                    icon="material:stop"
                    title="Stop"
                    onClick={() => runningFlow.stop()}
                ></IconAction>
            </div>
        );
    };

    render() {
        return <List nodes={this.nodes} renderNode={this.renderNode} />;
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
