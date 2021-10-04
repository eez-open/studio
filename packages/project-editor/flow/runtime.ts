import { guid } from "eez-studio-shared/guid";

import { action, computed, observable, runInAction } from "mobx";
import { DocumentStoreClass } from "project-editor/core/store";
import { ConnectionLine, Flow, FlowTabState } from "project-editor/flow/flow";
import {
    CatchErrorActionComponent,
    ErrorActionComponent,
    InputActionComponent,
    StartActionComponent
} from "project-editor/flow/action-components";
import { Component, Widget } from "project-editor/flow/component";
import {
    findPropertyByNameInObject,
    getClassInfo,
    getLabel,
    IEezObject,
    PropertyType
} from "project-editor/core/object";
import type {
    IDataContext,
    IFlowContext
} from "project-editor/flow//flow-interfaces";
import { visitObjects } from "project-editor/core/search";
import { Page } from "project-editor/features/page/page";
import {
    ActionEndLogItem,
    ActionStartLogItem,
    ExecuteComponentLogItem,
    ExecutionErrorLogItem,
    LogItem,
    RuntimeLogs,
    NoStartActionComponentLogItem,
    OutputValueLogItem
} from "project-editor/flow/debugger/logs";
import { LogItemType } from "project-editor/flow/flow-interfaces";
import { valueToString } from "project-editor/flow/debugger/WatchPanel";
import { Action } from "project-editor/features/action/action";

////////////////////////////////////////////////////////////////////////////////

/*

system inputs: @seqin
system outputs: @seqout

*/

////////////////////////////////////////////////////////////////////////////////

interface InputData {
    time: number;
    value: any;
}

export interface QueueTask {
    id: number;
    flowState: FlowState;
    component: Component;
    connectionLine?: ConnectionLine;
}

enum State {
    STARTING = "STARTING",
    STARTING_WITHOUT_DEBUGGER = "STARTING_WITHOUT_DEBUGGER",
    STARTING_WITH_DEBUGGER = "STARTING_WITH_DEBUGGER",
    RUNNING = "RUNNING",
    PAUSED = "PAUSED",
    RESUMED = "RESUMED",
    SINGLE_STEP = "SINGLE_STEP",
    STOPPED = "STOPPED"
}

export enum StateMachineAction {
    START_WITHOUT_DEBUGGER = "START_WITHOUT_DEBUGGER",
    START_WITH_DEBUGGER = "START_WITH_DEBUGGER",
    RUN = "RUN",
    RESUME = "RESUME",
    PAUSE = "PAUSE",
    SINGLE_STEP = "SINGLE_STEP",
    STOP = "STOP"
}

export abstract class RuntimeBase {
    @observable state: State = State.STARTING;
    @observable isDebuggerActive = false;
    @observable globalVariablesInitialized = false;

    @observable selectedPage: Page;
    @observable selectedFlowState: FlowState | undefined;
    @observable selectedQueueTask: QueueTask | undefined;

    @observable error: string | undefined;

    queueTaskId = 0;
    @observable queue: QueueTask[] = [];

    @observable flowStates: FlowState[] = [];

    logs = new RuntimeLogs();

    get isPaused() {
        return this.state == State.PAUSED;
    }

    get isSingleStep() {
        return this.state == State.SINGLE_STEP;
    }

    get isResumed() {
        return this.state == State.RESUMED;
    }

    get isStopped() {
        return this.state == State.STOPPED;
    }

    constructor(public DocumentStore: DocumentStoreClass) {
        this.selectedPage = this.DocumentStore.project.pages[0];
    }

    startRuntime(isDebuggerActive: boolean) {
        if (isDebuggerActive) {
            this.transition(StateMachineAction.START_WITH_DEBUGGER);
        } else {
            this.transition(StateMachineAction.START_WITHOUT_DEBUGGER);
        }

        this.doStartRuntime(isDebuggerActive);
    }

    stopRuntime(notifyUser: boolean) {
        if (this.state == State.STOPPED) {
            return;
        }

        this.transition(StateMachineAction.STOP);

        this.doStopRuntime(notifyUser);
    }

    abstract doStartRuntime(isDebuggerActive: boolean): any;
    abstract doStopRuntime(notifyUser: boolean): any;

    @action
    stopRuntimeWithError(error: string) {
        this.error = error;
        this.stopRuntime(true);
    }

    @action private setState(state: State) {
        const wasDebuggerActive = this.isDebuggerActive;

        this.state = state;

        if (
            this.state == State.STARTING_WITH_DEBUGGER ||
            this.state == State.PAUSED ||
            this.state == State.RESUMED ||
            this.state == State.SINGLE_STEP
        ) {
            this.isDebuggerActive = true;
        } else if (
            this.state == State.STARTING_WITHOUT_DEBUGGER ||
            this.state == State.RUNNING
        ) {
            this.isDebuggerActive = false;
        }

        const isDebuggerActive = this.isDebuggerActive;

        if (!wasDebuggerActive && isDebuggerActive) {
            this.DocumentStore.uiStateStore.pageRuntimeFrontFace = false;
        } else if (wasDebuggerActive && !isDebuggerActive) {
            this.DocumentStore.uiStateStore.pageRuntimeFrontFace = true;
        }

        if (this.state == State.PAUSED) {
            this.showNextQueueTask();
        }
    }

    @action
    transition(action: StateMachineAction) {
        const wasState = this.state;

        if (this.state == State.STARTING) {
            if (action == StateMachineAction.START_WITHOUT_DEBUGGER) {
                this.setState(State.STARTING_WITHOUT_DEBUGGER);
            } else if (action == StateMachineAction.START_WITH_DEBUGGER) {
                this.setState(State.STARTING_WITH_DEBUGGER);
            }
        } else if (this.state == State.STARTING_WITHOUT_DEBUGGER) {
            if (action == StateMachineAction.RUN) {
                this.setState(State.RUNNING);
            }
        } else if (this.state == State.STARTING_WITH_DEBUGGER) {
            if (action == StateMachineAction.PAUSE) {
                this.setState(State.PAUSED);
            }
        } else if (this.state == State.RUNNING) {
            if (action == StateMachineAction.PAUSE) {
                this.setState(State.PAUSED);
            }
        } else if (this.state == State.PAUSED) {
            if (action == StateMachineAction.RUN) {
                this.setState(State.RUNNING);
            } else if (action == StateMachineAction.RESUME) {
                this.setState(State.RESUMED);
            } else if (action == StateMachineAction.SINGLE_STEP) {
                this.setState(State.SINGLE_STEP);
            }
        } else if (this.state == State.RESUMED) {
            if (action == StateMachineAction.RUN) {
                this.setState(State.RUNNING);
            } else if (action == StateMachineAction.PAUSE) {
                this.setState(State.PAUSED);
            }
        } else if (this.state == State.SINGLE_STEP) {
            if (action == StateMachineAction.PAUSE) {
                this.setState(State.PAUSED);
            }
        }

        if (action == StateMachineAction.STOP) {
            this.setState(State.STOPPED);
        }

        if (wasState == this.state) {
            console.error(
                `INVALID TRANSITION: state=${wasState} action=${action}`
            );
        } else {
            console.info(
                `Transition: stateBefore=${wasState} action=${action} stateAfter=${this.state}`
            );
        }
    }

    abstract toggleDebugger(): void;

    abstract resume(): void;

    abstract pause(): void;

    abstract runSingleStep(): void;

    ////////////////////////////////////////

    getFlowState(flow: Flow) {
        for (let flowState of this.flowStates) {
            if (flowState.flow === flow) {
                return flowState;
            }
        }

        for (let flowState of this.flowStates) {
            const childFlowState = flowState.getFlowState(flow);
            if (childFlowState) {
                return childFlowState;
            }
        }

        return undefined;
    }

    @action
    pushTask({
        flowState,
        component,
        connectionLine
    }: {
        flowState: FlowState;
        component: Component;
        connectionLine?: ConnectionLine;
    }) {
        this.queue.push({
            id: ++this.queueTaskId,
            flowState,
            component,
            connectionLine
        });
    }

    @action
    showNextQueueTask() {
        const nextQueueTask = this.queue.length > 0 ? this.queue[0] : undefined;

        this.selectQueueTask(nextQueueTask);

        if (nextQueueTask) {
            setTimeout(() => this.showQueueTask(nextQueueTask), 10);
        }
    }

    abstract executeWidgetAction(
        flowContext: IFlowContext,
        widget: Widget
    ): void;

    removeFlowState(flowState: FlowState) {
        let flowStates: FlowState[];
        if (flowState.parentFlowState) {
            flowStates = flowState.parentFlowState.flowStates;
        } else {
            flowStates = this.flowStates;
        }

        const i = flowStates.indexOf(flowState);

        if (i == -1) {
            console.error("UNEXPECTED!");
            return;
        }

        runInAction(() => {
            flowStates.splice(i, 1);
        });
    }

    selectQueueTask(queueTask: QueueTask | undefined) {
        this.selectedQueueTask = queueTask;
        if (queueTask) {
            this.selectedFlowState = queueTask.flowState;
            this.showSelectedFlowState();
        }
    }

    showSelectedFlowState() {
        const flowState = this.selectedFlowState;
        if (flowState) {
            this.DocumentStore.navigationStore.showObject(flowState.flow);

            const editorState =
                this.DocumentStore.editorsStore.activeEditor?.state;
            if (editorState instanceof FlowTabState) {
                setTimeout(() => {
                    runInAction(() => (editorState.flowState = flowState));
                }, 0);
            }
        }
    }

    showComponent(component: Component) {
        this.DocumentStore.navigationStore.showObject(component);

        const editorState = this.DocumentStore.editorsStore.activeEditor?.state;
        if (editorState instanceof FlowTabState) {
            editorState.ensureSelectionVisible();
        }
    }

    showQueueTask(queueTask: QueueTask) {
        const objects: IEezObject[] = [];

        if (
            queueTask.connectionLine &&
            queueTask.connectionLine.sourceComponent &&
            queueTask.connectionLine.targetComponent
        ) {
            objects.push(queueTask.connectionLine.sourceComponent);
            objects.push(queueTask.connectionLine);
            objects.push(queueTask.connectionLine.targetComponent);
        } else {
            objects.push(queueTask.component);
        }

        // navigate to the first object,
        // just to make sure that proper editor is opened
        this.DocumentStore.navigationStore.showObject(objects[0]);

        const editorState = this.DocumentStore.editorsStore.activeEditor?.state;
        if (editorState instanceof FlowTabState) {
            // select other object in the same editor
            editorState.selectObjects(objects);

            // ensure objects are visible on the screen
            editorState.ensureSelectionVisible();
        }
    }

    onBreakpointAdded(component: Component) {}

    onBreakpointRemoved(component: Component) {}

    onBreakpointEnabled(component: Component) {}

    onBreakpointDisabled(component: Component) {}

    abstract readSettings(key: string): any;
    abstract writeSettings(key: string, value: any): void;
}

export class FlowState {
    id = guid();
    componentStates = new Map<Component, ComponentState>();
    @observable flowStates: FlowState[] = [];
    dataContext: IDataContext;
    @observable error: string | undefined = undefined;

    constructor(
        public runtime: RuntimeBase,
        public flow: Flow,
        public parentFlowState?: FlowState,
        public component?: Component
    ) {
        this.dataContext =
            this.runtime.DocumentStore.dataContext.createWithLocalVariables(
                flow.localVariables
            );
    }

    get DocumentStore() {
        return this.runtime.DocumentStore;
    }

    get flowState() {
        return this;
    }

    get label() {
        return getLabel(this.flow);
    }

    getFlowState(flow: Flow): FlowState | undefined {
        for (let flowState of this.flowStates) {
            if (flowState.flow === flow) {
                return flowState;
            }
        }

        for (let flowState of this.flowStates) {
            const childFlowState = flowState.getFlowState(flow);
            if (childFlowState) {
                return childFlowState;
            }
        }

        return undefined;
    }

    getFlowStateByComponent(component: Component): FlowState | undefined {
        for (let flowState of this.flowStates) {
            if (flowState.component === component) {
                return flowState;
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

    getPropertyValue(component: Component, propertyName: string) {
        if (component.isInputProperty(propertyName)) {
            const inputPropertyValue = this.getInputPropertyValue(
                component,
                propertyName
            );
            return inputPropertyValue && inputPropertyValue.value;
        } else {
            const value = (component as any)[propertyName];

            if (value == undefined) {
                return value;
            }

            let propertyInfo = findPropertyByNameInObject(
                component,
                propertyName
            );

            if (propertyInfo && propertyInfo.type === PropertyType.JSON) {
                return JSON.parse(value);
            } else {
                return value;
            }
        }
    }

    getInputValue(component: Component, input: string) {
        return this.getComponentState(component).getInputValue(input);
    }

    getInputPropertyValue(component: Component, input: string) {
        return this.getComponentState(component).getInputPropertyValue(input);
    }

    getComponentRunningState<T>(component: Component): T {
        return this.getComponentState(component).runningState;
    }

    setComponentRunningState<T>(component: Component, runningState: T) {
        this.getComponentState(component).runningState = runningState;
    }

    getVariable(component: Component, variableName: string): any {
        return this.dataContext.get(variableName);
    }

    setVariable(component: Component, variableName: string, value: any) {
        return this.dataContext.set(variableName, value);
    }

    @computed get isRunning(): boolean {
        for (let [_, componentState] of this.componentStates) {
            if (componentState.isRunning) {
                return true;
            }
        }

        return (
            this.flowStates.find(flowState => flowState.isRunning) != undefined
        );
    }

    @action
    async start() {
        let componentState: ComponentState | undefined = undefined;

        const v = visitObjects(this.flow);
        while (true) {
            let visitResult = v.next();
            if (visitResult.done) {
                break;
            }
            if (visitResult.value instanceof Component) {
                if (!componentState) {
                    componentState = new ComponentState(
                        this,
                        visitResult.value
                    );
                } else {
                    componentState.component = visitResult.value;
                }

                if (componentState.isReadyToRun()) {
                    if (componentState.component instanceof Widget) {
                        await componentState.run();
                    } else {
                        this.runtime.pushTask({
                            flowState: this,
                            component: visitResult.value
                        });
                    }
                }
            }
        }
    }

    finish() {
        this.flowStates.forEach(flowState => flowState.finish());

        this.componentStates.forEach(componentState => componentState.finish());

        this.runtime.logs.addLogItem(new ActionEndLogItem(this));
    }

    executeStartAction() {
        this.runtime.logs.addLogItem(new ActionStartLogItem(this));

        const startActionComponent = this.flow.components.find(
            component => component instanceof StartActionComponent
        ) as StartActionComponent;

        if (startActionComponent) {
            runInAction(() =>
                this.runtime.pushTask({
                    flowState: this,
                    component: startActionComponent
                })
            );
        } else {
            this.runtime.logs.addLogItem(
                new NoStartActionComponentLogItem(this)
            );

            this.runtime.error = this.error = "No Start action component";

            this.flowState.runtime.stopRuntime(true);
        }
    }

    @action
    executeAction(component: Component, action: Action) {
        const flowState = new FlowState(this.runtime, action, this, component);
        this.flowStates.push(flowState);
        flowState.start();
        return flowState;
    }

    propagateValue(
        sourceComponent: Component,
        output: string,
        value: any,
        outputName?: string
    ) {
        this.flow.connectionLines.forEach(connectionLine => {
            if (
                connectionLine.sourceComponent === sourceComponent &&
                connectionLine.output === output &&
                connectionLine.targetComponent
            ) {
                connectionLine.setActive();

                this.runtime.logs.addLogItem(
                    new OutputValueLogItem(
                        this,
                        connectionLine,
                        outputName ?? output,
                        value
                    )
                );

                this.setInputValue(
                    connectionLine.targetComponent,
                    connectionLine.input,
                    value,
                    connectionLine
                );
            }
        });
    }

    setInputValue(
        component: Component,
        input: string,
        value: any,
        connectionLine?: ConnectionLine
    ) {
        const componentState = this.getComponentState(component);

        componentState.setInputData(input, {
            time: Date.now(),
            value
        });

        if (componentState.isReadyToRun()) {
            this.runtime.pushTask({
                flowState: this,
                component,
                connectionLine
            });
        }
    }

    findCatchErrorActionComponent(): ComponentState | undefined {
        const catchErrorActionComponent = this.flow.components.find(
            component => component instanceof CatchErrorActionComponent
        );
        if (catchErrorActionComponent) {
            return this.getComponentState(catchErrorActionComponent);
        }

        if (this.parentFlowState) {
            return this.parentFlowState.findCatchErrorActionComponent();
        }

        return undefined;
    }

    log(type: LogItemType, message: string, component: Component | undefined) {
        this.runtime.logs.addLogItem(
            new LogItem(type, message, this, component)
        );
    }

    logScpi(message: string, component: Component) {
        this.runtime.logs.addLogItem(
            new LogItem("scpi", message, this, component)
        );
    }

    logInfo(value: any, component: Component) {
        this.runtime.logs.addLogItem(
            new LogItem("scpi", valueToString(value), this, component)
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

export type InputPropertyValue = InputData;

export class ComponentState {
    @observable inputsData = new Map<string, InputData>();
    @observable _inputPropertyValues = new Map<string, InputPropertyValue>();
    @observable isRunning: boolean = false;
    @observable runningState: any;
    dispose: (() => void) | undefined = undefined;

    constructor(public flowState: FlowState, public component: Component) {}

    getInputValue(input: string) {
        return this.inputsData.get(input);
    }

    getInputPropertyValue(input: string) {
        return this._inputPropertyValues.get(input);
    }

    @action
    setInputData(input: string, inputData: InputData) {
        this.inputsData.set(input, inputData);
    }

    isReadyToRun() {
        if (getClassInfo(this.component).isFlowExecutableComponent === false) {
            return false;
        }

        if (this.component instanceof Widget) {
            return true;
        }

        if (this.component instanceof CatchErrorActionComponent) {
            return !!this.inputsData.get("message");
        }

        if (
            this.flowState.flow.connectionLines.find(
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
                input =>
                    input.name != "@seqin" && !this.inputsData.has(input.name)
            )
        ) {
            return false;
        }

        if (this.component instanceof InputActionComponent) {
            return false;
        }

        if (this.component instanceof StartActionComponent) {
            const parentFlowState = this.flowState.parentFlowState;
            if (parentFlowState) {
                const parentComponent = this.flowState.component;
                if (parentComponent) {
                    const parentComponentState =
                        parentFlowState.getComponentState(parentComponent);
                    if (
                        parentFlowState.flow.connectionLines.find(
                            connectionLine =>
                                connectionLine.targetComponent ==
                                    parentComponent &&
                                connectionLine.input === "@seqin"
                        )
                    ) {
                        if (!parentComponentState.inputsData.has("@seqin")) {
                            return false;
                        }
                    }
                }
            }
        }

        return true;
    }

    @action
    async run() {
        for (let [key, value] of this.inputsData) {
            this._inputPropertyValues.set(key, value);
        }

        this.flowState.runtime.logs.addLogItem(
            new ExecuteComponentLogItem(this.flowState, this.component)
        );

        runInAction(() => {
            this.isRunning = true;
        });

        let propagateThroughSeqout = false;

        try {
            const result = await this.component.execute(
                this.flowState,
                this.dispose
            );
            if (result == undefined) {
                propagateThroughSeqout = true;
            } else {
                if (typeof result == "boolean") {
                    propagateThroughSeqout = false;
                } else {
                    this.dispose = result;
                    propagateThroughSeqout = true;
                }
            }
        } catch (err) {
            runInAction(() => {
                this.flowState.runtime.error = err.toString();
                this.flowState.error = err.toString();
            });

            this.flowState.runtime.logs.addLogItem(
                new ExecutionErrorLogItem(this.flowState, this.component, err)
            );

            const catchErrorOutput = this.findCatchErrorOutput();
            if (catchErrorOutput) {
                catchErrorOutput.connectionLines.forEach(connectionLine => {
                    this.flowState.runtime.logs.addLogItem(
                        new OutputValueLogItem(
                            catchErrorOutput.componentState.flowState,
                            connectionLine,
                            "@error",
                            err
                        )
                    );

                    this.flowState.propagateValue(
                        this.component,
                        "@error",
                        err
                    );
                });
            } else {
                let flowState: FlowState | undefined;
                if (this.component instanceof ErrorActionComponent) {
                    flowState = this.flowState.parentFlowState;
                } else {
                    flowState = this.flowState;
                }

                const catchErrorActionComponentState =
                    flowState && flowState.findCatchErrorActionComponent();
                if (catchErrorActionComponentState) {
                    catchErrorActionComponentState.flowState.setInputValue(
                        catchErrorActionComponentState.component,
                        "message",
                        err
                    );
                } else {
                    this.flowState.runtime.stopRuntime(true);
                }
            }
        } finally {
            runInAction(() => {
                this.isRunning = false;
            });
        }

        if (propagateThroughSeqout) {
            this.flowState.propagateValue(this.component, "@seqout", null);
        }

        this.inputsData.delete("@seqin");
    }

    finish() {
        if (this.dispose) {
            this.dispose();
        }
    }

    findCatchErrorOutput():
        | {
              componentState: ComponentState;
              connectionLines: ConnectionLine[];
          }
        | undefined {
        const connectionLines = this.flowState.flow.connectionLines.filter(
            connectionLine =>
                connectionLine.sourceComponent == this.component &&
                connectionLine.output === "@error" &&
                connectionLine.targetComponent
        );
        if (connectionLines.length > 0) {
            return { componentState: this, connectionLines };
        }

        if (this.flowState.parentFlowState && this.flowState.component) {
            return this.flowState.parentFlowState
                .getComponentState(this.flowState.component)
                .findCatchErrorOutput();
        }

        return undefined;
    }
}
