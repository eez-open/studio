import { guid } from "eez-studio-shared/guid";

import { action, computed, observable, runInAction } from "mobx";
import {
    DocumentStoreClass,
    findPropertyByNameInObject,
    getLabel
} from "project-editor/core/store";
import { ConnectionLine, Flow, FlowTabState } from "project-editor/flow/flow";
import { CatchErrorActionComponent } from "project-editor/flow/action-components";
import { Component, Widget } from "project-editor/flow/component";
import { IEezObject, PropertyType } from "project-editor/core/object";
import type {
    IDataContext,
    IFlowContext
} from "project-editor/flow//flow-interfaces";
import { Page } from "project-editor/features/page/page";
import {
    ActionEndLogItem,
    LogItem,
    RuntimeLogs
} from "project-editor/flow/debugger/logs";
import { LogItemType } from "project-editor/flow/flow-interfaces";
import { valueToString } from "project-editor/flow/debugger/WatchPanel";
import { evalExpression } from "project-editor/flow/expression/expression";

////////////////////////////////////////////////////////////////////////////////

/*

system inputs: @seqin
system outputs: @seqout

*/

////////////////////////////////////////////////////////////////////////////////

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

    @observable _selectedPage: Page;
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

    get selectedPage() {
        return this._selectedPage;
    }

    set selectedPage(value: Page) {
        runInAction(() => {
            this._selectedPage = value;
        });

        if (
            this.state == State.STARTING ||
            (this.isDebuggerActive && !this.isPaused)
        ) {
            this.DocumentStore.navigationStore.setSelection([
                this.selectedPage
            ]);
        }
    }

    constructor(public DocumentStore: DocumentStoreClass) {
        this.selectedPage = this.DocumentStore.project.pages[0];
    }

    startRuntime(isDebuggerActive: boolean) {
        this.DocumentStore.dataContext.clear();

        if (isDebuggerActive) {
            this.transition(StateMachineAction.START_WITH_DEBUGGER);
        } else {
            this.transition(StateMachineAction.START_WITHOUT_DEBUGGER);
        }

        this.doStartRuntime(isDebuggerActive);
    }

    async stopRuntime(notifyUser: boolean) {
        if (this.state == State.STOPPED) {
            return;
        }

        this.transition(StateMachineAction.STOP);

        await this.doStopRuntime(notifyUser);

        this.DocumentStore.dataContext.clear();
    }

    @action
    stopRuntimeWithError(error: string) {
        this.error = error;
        this.stopRuntime(true);
    }

    @action private setState(state: State) {
        let wasDebuggerActive = this.state;

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

        if (!wasDebuggerActive && this.isDebuggerActive) {
            this.DocumentStore.uiStateStore.pageRuntimeFrontFace = false;
        } else if (wasDebuggerActive && !this.isDebuggerActive) {
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
                this.DocumentStore.uiStateStore.pageRuntimeFrontFace = true;
            } else if (action == StateMachineAction.START_WITH_DEBUGGER) {
                this.setState(State.STARTING_WITH_DEBUGGER);
                this.DocumentStore.uiStateStore.pageRuntimeFrontFace = false;
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
        } else if (this.state == State.STOPPED) {
            if (action == StateMachineAction.PAUSE) {
                this.isDebuggerActive = true;
                this.DocumentStore.uiStateStore.pageRuntimeFrontFace = false;
                return;
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

    ////////////////////////////////////////

    getFlowState(flow: Flow) {
        if (this.selectedFlowState?.flow == flow) {
            return this.selectedFlowState;
        }

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
        flowState.numActiveComponents++;

        if (this.state == State.PAUSED) {
            this.showNextQueueTask();
        }
    }

    removeQueueTasksForFlowState(flowState: FlowState) {
        runInAction(() => {
            const queueTasksBefore = flowState.runtime.queue.length;
            flowState.runtime.queue = flowState.runtime.queue.filter(
                queueTask => queueTask.flowState != flowState
            );
            const queueTasksAfter = flowState.runtime.queue.length;
            flowState.numActiveComponents -= queueTasksBefore - queueTasksAfter;
        });
    }

    @action
    showNextQueueTask() {
        const nextQueueTask = this.queue.length > 0 ? this.queue[0] : undefined;

        this.selectQueueTask(nextQueueTask);

        if (nextQueueTask) {
            setTimeout(() => this.showQueueTask(nextQueueTask), 10);
        } else {
            // deselect all objects
            const editorState =
                this.DocumentStore.editorsStore.activeEditor?.state;
            if (editorState instanceof FlowTabState) {
                editorState.selectObjects([]);
            }
        }
    }

    selectFlowStateForFlow(flow: Flow) {
        this.selectedFlowState = this.getFlowState(flow);
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
            this.DocumentStore.navigationStore.showObject(flowState.flow, {
                selectInEditor: false
            });
        }
    }

    showComponent(component: Component) {
        this.DocumentStore.navigationStore.showObject(component, {
            selectInEditor: false
        });

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
        this.DocumentStore.navigationStore.showObject(objects[0], {
            selectInEditor: false
        });

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

    // ABSTRACT FUNCTIONS

    abstract doStartRuntime(isDebuggerActive: boolean): Promise<void>;
    abstract doStopRuntime(notifyUser: boolean): Promise<void>;

    abstract toggleDebugger(): void;

    abstract resume(): void;

    abstract pause(): void;

    abstract runSingleStep(): void;

    abstract executeWidgetAction(
        flowContext: IFlowContext,
        widget: Widget
    ): void;

    abstract readSettings(key: string): any;
    abstract writeSettings(key: string, value: any): void;

    abstract startFlow(flowState: FlowState): Promise<void>;

    abstract propagateValue(
        flowState: FlowState,
        sourceComponent: Component,
        output: string,
        value: any,
        outputName?: string
    ): void;

    abstract assignValue(
        flowState: FlowState,
        component: Component,
        assignableExpression: string,
        value: any
    ): void;
}

export class FlowState {
    id = guid();
    componentStates = new Map<Component, ComponentState>();
    @observable flowStates: FlowState[] = [];
    dataContext: IDataContext;
    @observable error: string | undefined = undefined;
    @observable isFinished: boolean = false;
    numActiveComponents = 0;

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

    getInputValue(component: Component, input: string) {
        return this.getComponentState(component).getInputValue(input);
    }

    getPropertyValue(component: Component, propertyName: string) {
        if (component.isInputProperty(propertyName)) {
            return this.getInputValue(component, propertyName);
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

    evalExpression(component: Component, expression: string): any {
        return evalExpression(this, component, expression);
    }

    getComponentRunningState<T>(component: Component): T | undefined {
        return this.getComponentState(component).runningState;
    }

    @action
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
    finish() {
        this.flowStates.forEach(flowState => flowState.finish());

        this.componentStates.forEach(componentState => componentState.finish());

        this.runtime.logs.addLogItem(new ActionEndLogItem(this));

        this.isFinished = true;
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

export class ComponentState {
    @observable inputsData = new Map<string, any>();
    @observable isRunning: boolean = false;
    @observable runningState: any;
    dispose: (() => void) | undefined = undefined;

    constructor(public flowState: FlowState, public component: Component) {}

    getInputValue(input: string) {
        return this.inputsData.get(input);
    }

    @action
    setInputData(input: string, inputData: any) {
        this.inputsData.set(input, inputData);
    }

    get connectedSequenceInputsSet() {
        const inputConnections = new Set<string>();
        for (const connectionLine of this.flowState.flow.connectionLines) {
            if (
                connectionLine.targetComponent == this.component &&
                this.sequenceInputs.find(
                    input => input.name == connectionLine.input
                )
            ) {
                inputConnections.add(connectionLine.input);
            }
        }
        return inputConnections;
    }

    get sequenceInputs() {
        return this.component.inputs.filter(input => input.isSequenceInput);
    }

    get mandatoryDataInputs() {
        return this.component.inputs.filter(
            input => !input.isSequenceInput && !input.isOptionalInput
        );
    }

    finish() {
        if (this.dispose) {
            this.dispose();
        }
    }
}
