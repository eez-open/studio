import React from "react";
import { observer } from "mobx-react";
import classNames from "classnames";

import styled from "eez-studio-ui/styled-components";
import { guid } from "eez-studio-shared/guid";

import { ITreeNode, Tree } from "eez-studio-ui/tree";
import { IListNode, List } from "eez-studio-ui/list";

import { ProjectContext } from "project-editor/project/context";
import { Panel } from "project-editor/components/Panel";
import { action, computed, observable, runInAction } from "mobx";
import { DocumentStoreClass } from "project-editor/core/store";
import { findAction } from "project-editor/features/action/action";
import { ConnectionLine, Flow } from "project-editor/flow/flow";
import { InputActionComponent } from "project-editor/flow/action-components";
import {
    ActionComponent,
    Component,
    Widget
} from "project-editor/flow/component";
import { getLabel, IEezObject } from "project-editor/core/object";
import { Toolbar } from "eez-studio-ui/toolbar";
import { IconAction } from "eez-studio-ui/action";
import type {
    IDataContext,
    IFlowContext
} from "project-editor/flow//flow-interfaces";
import { LayoutViewWidget } from "./widgets";

////////////////////////////////////////////////////////////////////////////////

const MAX_HISTORY_ITEMS = 1000;

////////////////////////////////////////////////////////////////////////////////

/*

system inputs: @start, @seqin
system outputs: @seqout

*/

////////////////////////////////////////////////////////////////////////////////

interface InputData {
    time: number;
    value: any;
}

interface QueueTask {
    runningFlow: RunningFlow;
    component: Component;
    input: string;
    inputData: InputData;
    connectionLine?: ConnectionLine;
}

export class RuntimeStoreClass {
    constructor(public DocumentStore: DocumentStoreClass) {}

    ////////////////////////////////////////

    @observable isRuntimeMode = false;

    isStopped = false;

    @action.bound
    setRuntimeMode() {
        if (!this.isRuntimeMode) {
            this.isRuntimeMode = true;
            this.isStopped = false;
            this.start();
        }
    }

    setEditorMode = async () => {
        if (this.isRuntimeMode) {
            this.stop();

            this.queue = [];
            runInAction(() => {
                this.runningFlows = [];
                this.history = [];
            });

            runInAction(() => (this.isRuntimeMode = false));
        }
    };

    start() {
        this.startSpeedCalculation();

        this.queue = [];

        this.runningFlows = this.DocumentStore.project.pages
            .filter(page => !page.isUsedAsCustomWidget)
            .map(page => new RunningFlow(this, page));

        this.runningFlows.forEach(runningFlow => runningFlow.start());

        this.pumpQueue();

        EEZStudio.electron.ipcRenderer.send("preventAppSuspension", true);
    }

    async stop() {
        if (this.pumpTimeoutId) {
            clearTimeout(this.pumpTimeoutId);
        }

        while (this.isRunning) {
            await new Promise(resolve => setTimeout(resolve));
        }

        this.runningFlows.forEach(runningFlow => runningFlow.finish());
        EEZStudio.electron.ipcRenderer.send("preventAppSuspension", false);

        this.stopSpeedCalculation();

        this.isStopped = true;
    }

    get isRunning() {
        return (
            this.runningFlows.find(runningFlow => runningFlow.isRunning) !=
            undefined
        );
    }

    ////////////////////////////////////////

    queue: QueueTask[] = [];
    pumpTimeoutId: any;

    @observable runningFlows: RunningFlow[] = [];

    getRunningFlow(flow: Flow) {
        for (let runningFlow of this.runningFlows) {
            if (runningFlow.flow === flow) {
                return runningFlow;
            }
        }

        for (let runningFlow of this.runningFlows) {
            const childRunningFlow = runningFlow.getRunningFlow(flow);
            if (childRunningFlow) {
                return childRunningFlow;
            }
        }

        return undefined;
    }

    pumpQueue = async () => {
        this.pumpTimeoutId = undefined;

        this.calculateSpeed();

        const runningComponents = [];

        while (true) {
            const task = this.queue.shift();
            if (!task) {
                break;
            }

            const {
                runningFlow,
                component,
                input,
                inputData,
                connectionLine
            } = task;

            const componentState = runningFlow.getComponentState(component);

            if (componentState.isRunning) {
                runningComponents.push(task);
            } else {
                componentState.setInputData(input, inputData);

                if (componentState.isReadyToRun()) {
                    componentState.run();
                }

                if (connectionLine) {
                    connectionLine.setActive();
                }
            }
        }

        this.queue.unshift(...runningComponents);

        this.pumpTimeoutId = setTimeout(this.pumpQueue);
    };

    isComponentReadyToRun(runningFlow: RunningFlow, component: Component) {
        return false;
    }

    @action
    executeWidgetAction(flowContext: IFlowContext, widget: Widget) {
        if (this.isStopped) {
            this.start();
        }

        if (widget.isOutputProperty("action")) {
            (flowContext.runningFlow as RunningFlow).startFromWidgetAction(
                widget
            );
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

    addRunningFlow(runningFlow: RunningFlow) {
        runInAction(() => {
            this.runningFlows.push(runningFlow);
        });
    }

    removeRunningFlow(runningFlow: RunningFlow) {
        runInAction(() => {
            this.runningFlows.splice(this.runningFlows.indexOf(runningFlow), 1);
        });
    }

    ////////////////////////////////////////
    // SPEED CALCULATION

    numExecutedTasks: number = 0;
    measureSpeedTime: number;
    @observable speed: number;

    startSpeedCalculation() {
        this.measureSpeedTime = new Date().getTime();
        this.numExecutedTasks = 0;
    }

    onTaskExecuted() {
        this.numExecutedTasks++;
    }

    calculateSpeed() {
        const time = new Date().getTime();
        if (time - this.measureSpeedTime >= 1000) {
            runInAction(() => {
                this.speed = this.numExecutedTasks;
            });
            this.numExecutedTasks = 0;
            this.measureSpeedTime = time;
        }
    }

    stopSpeedCalculation() {
        runInAction(() => {
            this.speed = 0;
        });
    }

    ////////////////////////////////////////
    // HISTORY

    @observable history: HistoryItem[] = [];
    @observable selectedHistoryItem: HistoryItem | undefined;

    addHistoryItem(historyItem: HistoryItem) {
        runInAction(() => {
            this.history.push(historyItem);
            if (this.history.length > MAX_HISTORY_ITEMS) {
                this.history.shift();
            }
        });
    }

    @action.bound
    clearHistory() {
        this.history = [];
    }

    ////////////////////////////////////////

    render() {
        return <RuntimePanel />;
    }
}

////////////////////////////////////////////////////////////////////////////////

export type InputPropertyValue = InputData;

class ComponentState {
    inputsData = new Map<string, InputData>();

    @observable _inputPropertyValues = new Map<string, InputPropertyValue>();

    runningState: any;

    isRunning: boolean = false;

    getInputPropertyValue(input: string) {
        return this._inputPropertyValues.get(input);
    }

    constructor(public runningFlow: RunningFlow, public component: Component) {}

    setInputData(input: string, inputData: InputData) {
        this.inputsData.set(input, inputData);
    }

    isReadyToRun() {
        if (
            this.runningFlow.flow.connectionLines.find(
                connectionLine =>
                    connectionLine.targetComponent == this.component &&
                    connectionLine.input === "@seqin"
            ) &&
            !this.inputsData.has("@seqin")
        ) {
            return false;
        }

        if (
            this.component.inputs.find(
                input => !this.inputsData.has(input.name)
            )
        ) {
            return false;
        }

        if (this.component instanceof InputActionComponent) {
            return false;
        }

        return true;
    }

    @action
    async run() {
        for (let [key, value] of this.inputsData) {
            this._inputPropertyValues.set(key, value);
        }

        if (this.component instanceof ActionComponent) {
            this.runningFlow.RuntimeStore.addHistoryItem(
                new ExecuteActionComponentHistoryItem(this.component)
            );

            this.isRunning = true;

            try {
                await this.component.execute(this.runningFlow);
            } catch (err) {
                this.runningFlow.RuntimeStore.addHistoryItem(
                    new ExecutionErrorHistoryItem(this.component, err)
                );

                this.runningFlow.RuntimeStore.stop();
            } finally {
                this.isRunning = false;
            }

            this.runningFlow.RuntimeStore.onTaskExecuted();

            const connectionLine = this.runningFlow.flow.connectionLines.find(
                connectionLine =>
                    connectionLine.sourceComponent == this.component &&
                    connectionLine.output === "@seqout"
            );

            if (connectionLine && connectionLine.targetComponent) {
                this.runningFlow.RuntimeStore.queue.push({
                    runningFlow: this.runningFlow,
                    component: connectionLine.targetComponent,
                    input: connectionLine.input,
                    inputData: {
                        time: Date.now(),
                        value: null
                    },
                    connectionLine
                });
            }
        } else if (this.component instanceof LayoutViewWidget) {
            const page = this.component.getLayoutPage(
                this.runningFlow.RuntimeStore.DocumentStore.dataContext
            );
            if (page) {
                const runningFlow = this.runningFlow.getRunningFlowByComponent(
                    this.component
                );
                if (runningFlow) {
                    for (let [input, inputData] of this.inputsData) {
                        for (let component of page.components) {
                            if (component instanceof InputActionComponent) {
                                if (component.wireID === input) {
                                    runningFlow?.propagateValue(
                                        component,
                                        "@seqout",
                                        inputData.value
                                    );
                                }
                            }
                        }
                    }
                }
            }
        }

        this.inputsData.delete("@seqin");
    }
}

export class RunningFlow {
    id = guid();

    componentStates = new Map<Component, ComponentState>();

    runningFlows: RunningFlow[] = [];

    dataContext: IDataContext;

    constructor(
        public RuntimeStore: RuntimeStoreClass,
        public flow: Flow,
        public parentRunningFlow?: RunningFlow,
        public component?: Component
    ) {
        this.dataContext = this.RuntimeStore.DocumentStore.dataContext.createWithLocalVariables();
    }

    get label() {
        return getLabel(this.flow);
    }

    getRunningFlow(flow: Flow): RunningFlow | undefined {
        for (let runningFlow of this.runningFlows) {
            if (runningFlow.flow === flow) {
                return runningFlow;
            }
        }

        for (let runningFlow of this.runningFlows) {
            const childRunningFlow = runningFlow.getRunningFlow(flow);
            if (childRunningFlow) {
                return childRunningFlow;
            }
        }

        return undefined;
    }

    getRunningFlowByComponent(component: Component): RunningFlow | undefined {
        for (let runningFlow of this.runningFlows) {
            if (runningFlow.component === component) {
                return runningFlow;
            }
        }

        return undefined;
    }

    getComponentState(component: Component) {
        let componentState = this.componentStates.get(component);
        if (!componentState) {
            componentState = new ComponentState(this, component);
            this.componentStates.set(component, componentState);
        }
        return componentState;
    }

    getInputPropertyValue(component: Component, input: string) {
        return this.getComponentState(component).getInputPropertyValue(input);
    }

    getComponentRunningState<T>(component: Component): T {
        return this.getComponentState(component).runningState;
    }

    getVariable(component: Component, variableName: string): any {
        return this.dataContext.get(variableName);
    }

    setVariable(component: Component, variableName: string, value: any) {
        return this.dataContext.set(variableName, value);
    }

    declareVariable(component: Component, variableName: string, value: any) {
        return this.dataContext.declare(variableName, value);
    }

    setComponentRunningState<T>(component: Component, runningState: T) {
        this.getComponentState(component).runningState = runningState;
    }

    get isRunning(): boolean {
        for (let [_, componentState] of this.componentStates) {
            if (componentState.isRunning) {
                return true;
            }
        }

        return (
            this.runningFlows.find(runningFlow => runningFlow.isRunning) !=
            undefined
        );
    }

    start() {
        this.flow.components.forEach(component => component.onStart(this));

        this.flow.components.forEach(component => {
            this.RuntimeStore.queue.push({
                runningFlow: this,
                component,
                input: "@start",
                inputData: {
                    time: Date.now(),
                    value: null
                }
            });

            if (component instanceof LayoutViewWidget) {
                const page = component.getLayoutPage(
                    this.RuntimeStore.DocumentStore.dataContext
                );

                if (page) {
                    const runningFlow = new RunningFlow(
                        this.RuntimeStore,
                        page,
                        this,
                        component
                    );
                    this.runningFlows.push(runningFlow);

                    runningFlow.start();
                }
            }
        });
    }

    finish() {
        this.runningFlows.forEach(runningFlow => runningFlow.finish());

        this.flow.components.forEach(component => component.onFinish(this));

        this.RuntimeStore.addHistoryItem(new ActionEndHistoryItem(this.flow!));
    }

    startFromWidgetAction(widget: Component) {
        this.executeWire(widget, "action");
    }

    startAction() {
        this.RuntimeStore.addHistoryItem(new ActionStartHistoryItem(action));

        const inputActionComponent = this.flow.components.find(
            component => component instanceof InputActionComponent
        ) as ActionComponent;

        if (inputActionComponent) {
            this.RuntimeStore.queue.push({
                runningFlow: this,
                component: inputActionComponent,
                input: "input",
                inputData: {
                    time: Date.now(),
                    value: null
                }
            });
        } else {
            // TODO report
        }
    }

    executeWire(component: Component, output: string) {
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

            this.RuntimeStore.queue.push({
                runningFlow: this,
                component: actionNode,
                input: connectionLine.input,
                inputData: {
                    time: Date.now(),
                    value: null
                },
                connectionLine
            });
        } else {
            this.RuntimeStore.addHistoryItem(
                new NoConnectionHistoryItem(component, output)
            );
        }
    }

    propagateValue(sourceComponent: Component, output: string, value: any) {
        this.flow.connectionLines.forEach(connectionLine => {
            if (
                connectionLine.source === sourceComponent.wireID &&
                connectionLine.output === output
            ) {
                const targetComponent = this.flow.wiredComponents.get(
                    connectionLine.target
                );

                if (!targetComponent) {
                    return;
                }

                connectionLine.setActive();

                this.RuntimeStore.addHistoryItem(
                    new OutputValueHistoryItem(
                        sourceComponent,
                        connectionLine.output,
                        value
                    )
                );

                this.RuntimeStore.queue.push({
                    runningFlow: this,
                    component: targetComponent,
                    input: connectionLine.input,
                    inputData: {
                        time: Date.now(),
                        value
                    },
                    connectionLine
                });
            }
        });
    }
}

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
        return `Output value from [${getLabel(this.object)}/${this.output}]: ${
            this.value?.toString() ?? "NULL"
        }`;
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
                        <SpeedPane />
                        <RunningFlowsPane />

                        {this.context.RuntimeStore.speed === 0 && (
                            <HistoryPane />
                        )}
                    </RuntimePanelDiv>
                }
            />
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
class SpeedPane extends React.Component {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    render() {
        return (
            <div>
                Speed: {this.context.RuntimeStore.speed} actions per second
            </div>
        );
    }
}

@observer
class RunningFlowsPane extends React.Component {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    render() {
        return (
            <>
                <div>
                    <label>Running flows:</label>
                </div>
                <div className="running-flows">
                    <RunningFlows />
                </div>
            </>
        );
    }
}

@observer
class HistoryPane extends React.Component {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    render() {
        return (
            <>
                <div className="history-label">
                    <label>History:</label>
                    <Toolbar>
                        {this.context.RuntimeStore.history.length > 0 && (
                            <IconAction
                                icon="material:clear"
                                title="Clear history"
                                onClick={this.context.RuntimeStore.clearHistory}
                            ></IconAction>
                        )}
                    </Toolbar>
                </div>
                <div className="history">
                    <History />
                </div>
            </>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
class RunningFlows extends React.Component {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    @computed get rootNode(): ITreeNode<RunningFlow> {
        function getChildren(
            runningFlows: RunningFlow[]
        ): ITreeNode<RunningFlow>[] {
            return runningFlows.map(runningFlow => ({
                id: runningFlow.id,
                label: getLabel(runningFlow.flow),
                children: getChildren(runningFlow.runningFlows),
                selected: false,
                expanded: true,
                data: runningFlow
            }));
        }

        return {
            id: "root",
            label: "",
            children: getChildren(this.context.RuntimeStore.runningFlows),
            selected: false,
            expanded: true
        };
    }

    selectNode() {}

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

////////////////////////////////////////////////////////////////////////////////

@observer
class History extends React.Component {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    @computed get nodes(): IListNode<HistoryItem>[] {
        return this.context.RuntimeStore.history.map(historyItem => ({
            id: historyItem.id,
            data: historyItem,
            selected:
                this.context.RuntimeStore.selectedHistoryItem === historyItem
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
