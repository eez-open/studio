import { action, computed, runInAction } from "mobx";
import { DocumentStoreClass, getClassInfo } from "project-editor/core/store";
import { Action, findAction } from "project-editor/features/action/action";
import { Component, Widget } from "project-editor/flow/component";
import type { IFlowContext } from "project-editor/flow/flow-interfaces";
import {
    ActionStartLogItem,
    ExecuteComponentLogItem,
    ExecuteWidgetActionLogItem,
    ExecutionErrorLogItem,
    NoStartActionComponentLogItem,
    OutputValueLogItem,
    WidgetActionNotDefinedLogItem,
    WidgetActionNotFoundLogItem
} from "project-editor/flow/debugger/logs";
import { FLOW_ITERATOR_INDEXES_VARIABLE } from "project-editor/features/variable/defs";
import * as notification from "eez-studio-ui/notification";
import {
    StateMachineAction,
    FlowState,
    QueueTask,
    RuntimeBase,
    ComponentState
} from "project-editor/flow/runtime";
import {
    CatchErrorActionComponent,
    ErrorActionComponent,
    InputActionComponent,
    StartActionComponent
} from "project-editor/flow/components/actions";
import { ProjectEditor } from "project-editor/project-editor-interface";
import type { ConnectionLine } from "project-editor/flow/flow";
import { visitObjects } from "project-editor/core/search";
import { evalAssignableExpression } from "project-editor/flow/expression/expression";
import {
    getObjectVariableTypeFromType,
    isObjectType
} from "project-editor/features/variable/value-type";

export class LocalRuntime extends RuntimeBase {
    pumpTimeoutId: any;
    _lastBreakpointTaks: QueueTask | undefined;

    constructor(public DocumentStore: DocumentStoreClass) {
        super(DocumentStore);
    }

    doStartRuntime = async (isDebuggerActive: boolean) => {
        runInAction(() => {
            this.flowStates = this.DocumentStore.project.pages
                .filter(page => !page.isUsedAsCustomWidget)
                .map(page => new FlowState(this, page));
        });

        await this.DocumentStore.runtimeSettings.loadPersistentVariables();
        await this.constructObjectGlobalVariables();

        for (const flowState of this.flowStates) {
            await this.startFlow(flowState);
        }
        this.pumpQueue();

        EEZStudio.electron.ipcRenderer.send("preventAppSuspension", true);

        if (isDebuggerActive) {
            this.transition(StateMachineAction.PAUSE);
        } else {
            this.transition(StateMachineAction.RUN);
        }

        if (this.isPaused) {
            this.showNextQueueTask();
        }

        if (!this.isStopped) {
            notification.success(`Flow started`, {
                autoClose: 1000
            });
        }
    };

    async constructObjectGlobalVariables() {
        for (const variable of this.DocumentStore.project.variables
            .globalVariables) {
            let value = this.DocumentStore.dataContext.get(variable.name);
            if (value == null) {
                const objectVariableType = getObjectVariableTypeFromType(
                    variable.type
                );
                if (objectVariableType) {
                    const constructorParams =
                        await objectVariableType.editConstructorParams(
                            variable,
                            null
                        );
                    if (constructorParams) {
                        const value = objectVariableType.constructorFunction(
                            constructorParams,
                            true
                        );
                        this.DocumentStore.dataContext.set(
                            variable.name,
                            value
                        );
                    }
                }
            }
        }
    }

    async destroyObjectGlobalVariables() {
        for (const variable of this.DocumentStore.project.variables
            .globalVariables) {
            let value = this.DocumentStore.dataContext.get(variable.name);
            if (value) {
                const objectVariableType = getObjectVariableTypeFromType(
                    variable.type
                );
                if (objectVariableType && objectVariableType.destroy) {
                    objectVariableType.destroy(value);
                }
            }
        }
    }

    async destroyObjectLocalVariables(flowState: FlowState) {
        for (const variable of flowState.flow.localVariables) {
            let value = flowState.dataContext.get(variable.name);
            if (value) {
                const objectVariableType = getObjectVariableTypeFromType(
                    variable.type
                );
                if (objectVariableType && objectVariableType.destroy) {
                    objectVariableType.destroy(value);
                }
            }
        }
    }

    @computed get isAnyFlowStateRunning() {
        return (
            this.flowStates.find(flowState => flowState.isRunning) != undefined
        );
    }

    async doStopRuntime(notifyUser = false) {
        if (this.pumpTimeoutId) {
            clearTimeout(this.pumpTimeoutId);
            this.pumpTimeoutId = undefined;
        }

        let startTime = Date.now();
        while (this.isAnyFlowStateRunning) {
            await new Promise(resolve => setTimeout(resolve));
            if (Date.now() - startTime > 3000) {
                break;
            }
        }

        this.flowStates.forEach(flowState => flowState.finish());

        this.destroyObjectGlobalVariables();

        await this.DocumentStore.runtimeSettings.savePersistentVariables();

        EEZStudio.electron.ipcRenderer.send("preventAppSuspension", false);

        if (notifyUser) {
            if (this.error) {
                notification.error(`Flow stopped with error: ${this.error}`);
            } else {
                notification.success("Flow stopped", {
                    autoClose: 1000
                });
            }
        }
    }

    toggleDebugger() {
        if (this.isDebuggerActive) {
            this.transition(StateMachineAction.RUN);
        } else {
            this.transition(StateMachineAction.PAUSE);
        }
    }

    @action
    resume() {
        this.transition(StateMachineAction.RESUME);
    }

    @action
    pause() {
        this.transition(StateMachineAction.PAUSE);
    }

    @action
    runSingleStep() {
        this.transition(StateMachineAction.SINGLE_STEP);
    }

    pumpQueue = async () => {
        this.pumpTimeoutId = undefined;

        if (!(this.isDebuggerActive && this.isPaused)) {
            if (this.queue.length > 0) {
                const runningComponents: QueueTask[] = [];

                let singleStep = this.isSingleStep;

                const queueLength = this.queue.length;

                for (let i = 0; i < queueLength; i++) {
                    let task: QueueTask | undefined;
                    runInAction(() => (task = this.queue.shift()));
                    if (!task) {
                        break;
                    }

                    const { flowState, component, connectionLine } = task;

                    const componentState =
                        flowState.getComponentState(component);

                    if (componentState.isRunning) {
                        runningComponents.push(task);
                    } else {
                        if (
                            this.DocumentStore.uiStateStore.isBreakpointEnabledForComponent(
                                component
                            )
                        ) {
                            if (
                                this.isDebuggerActive &&
                                !singleStep &&
                                task != this._lastBreakpointTaks
                            ) {
                                this._lastBreakpointTaks = task;
                                runningComponents.push(task);
                                singleStep = true;
                                break;
                            }
                        }

                        this._lastBreakpointTaks = undefined;

                        await this.run(componentState);

                        if (connectionLine) {
                            connectionLine.setActive();
                        }
                    }

                    if (singleStep) {
                        break;
                    }

                    if (this.isDebuggerActive && this.isPaused) {
                        break;
                    }
                }

                runInAction(() => this.queue.unshift(...runningComponents));

                if (singleStep) {
                    this.transition(StateMachineAction.PAUSE);
                }
            }
        }

        if (!this.isStopped) {
            this.pumpTimeoutId = setTimeout(this.pumpQueue);
        }
    };

    @action
    async startFlow(flowState: FlowState) {
        let componentState: ComponentState | undefined = undefined;

        const v = visitObjects(flowState.flow);
        while (true) {
            let visitResult = v.next();
            if (visitResult.done) {
                break;
            }
            if (visitResult.value instanceof Component) {
                if (!componentState) {
                    componentState = new ComponentState(
                        flowState,
                        visitResult.value
                    );
                } else {
                    componentState.component = visitResult.value;
                }

                if (this.isReadyToRun(componentState)) {
                    if (componentState.component instanceof Widget) {
                        await this.run(componentState);
                    } else {
                        this.pushTask({
                            flowState,
                            component: visitResult.value
                        });
                    }
                }
            }
        }
    }

    @action
    executeWidgetAction(flowContext: IFlowContext, widget: Widget) {
        if (this.isStopped) {
            return;
        }

        const parentFlowState = findWidgetFlowState(this, widget);
        if (!parentFlowState) {
            return;
        }

        let iterators = flowContext.dataContext.get(
            FLOW_ITERATOR_INDEXES_VARIABLE
        );
        if (iterators && iterators.length == 1) {
            iterators = iterators[0];
        }

        if (widget.isOutputProperty("action")) {
            this.propagateValue(parentFlowState, widget, "action", iterators);
        } else if (widget.action) {
            // execute action given by name
            const action = findAction(
                this.DocumentStore.project,
                widget.action
            );

            if (action) {
                const newFlowState = new FlowState(
                    this,
                    action,
                    parentFlowState
                );

                this.logs.addLogItem(
                    new ExecuteWidgetActionLogItem(newFlowState, widget)
                );

                for (let component of newFlowState.flow.components) {
                    if (component instanceof InputActionComponent) {
                        this.propagateValue(
                            newFlowState,
                            component,
                            "@seqout",
                            iterators
                        );
                    }
                }

                parentFlowState.flowStates.push(newFlowState);

                this.executeStartAction(newFlowState);
            } else {
                this.logs.addLogItem(
                    new WidgetActionNotFoundLogItem(undefined, widget)
                );
            }
        } else {
            this.logs.addLogItem(
                new WidgetActionNotDefinedLogItem(undefined, widget)
            );
        }
    }

    executeStartAction(flowState: FlowState) {
        this.logs.addLogItem(new ActionStartLogItem(flowState));

        const startActionComponent = flowState.flow.components.find(
            component => component instanceof StartActionComponent
        ) as StartActionComponent;

        if (startActionComponent) {
            runInAction(() =>
                this.pushTask({
                    flowState,
                    component: startActionComponent
                })
            );
        } else {
            this.logs.addLogItem(new NoStartActionComponentLogItem(flowState));

            this.error = this.error = "No Start action component";

            this.stopRuntime(true);
        }
    }

    readSettings(key: string) {
        return this.DocumentStore.runtimeSettings.settings[key];
    }

    @action
    writeSettings(key: string, value: any) {
        this.DocumentStore.runtimeSettings.settings[key] = value;
    }

    onBreakpointAdded(component: Component) {}

    onBreakpointRemoved(component: Component) {}

    onBreakpointEnabled(component: Component) {}

    onBreakpointDisabled(component: Component) {}

    propagateValue(
        flowState: FlowState,
        sourceComponent: Component,
        output: string,
        value: any,
        outputName?: string
    ) {
        for (const connectionLine of flowState.flow.connectionLines) {
            if (
                connectionLine.sourceComponent === sourceComponent &&
                connectionLine.output === output &&
                connectionLine.targetComponent
            ) {
                connectionLine.setActive();

                this.logs.addLogItem(
                    new OutputValueLogItem(
                        flowState,
                        connectionLine,
                        outputName ?? output,
                        value
                    )
                );

                this.setInputValue(
                    flowState,
                    connectionLine.targetComponent,
                    connectionLine.input,
                    value,
                    connectionLine
                );
            }
        }
    }

    setInputValue(
        flowState: FlowState,
        component: Component,
        input: string,
        value: any,
        connectionLine?: ConnectionLine
    ) {
        const componentState = flowState.getComponentState(component);

        componentState.setInputData(input, value);

        if (this.isReadyToRun(componentState)) {
            this.pushTask({
                flowState,
                component,
                connectionLine
            });
        }
    }

    isReadyToRun(componentState: ComponentState) {
        if (
            getClassInfo(componentState.component).isFlowExecutableComponent ===
            false
        ) {
            return false;
        }

        if (componentState.component instanceof Widget) {
            return true;
        }

        if (componentState.component instanceof CatchErrorActionComponent) {
            return !!componentState.inputsData.get("message");
        }

        // if there is any connected sequence input then at least one should be filled
        if (
            componentState.connectedSequenceInputsSet.size > 0 &&
            !componentState.sequenceInputs.find(input =>
                componentState.inputsData.has(input.name)
            )
        ) {
            return false;
        }

        // all mandatory data inputs should be filled
        if (
            componentState.mandatoryDataInputs.find(
                input => !componentState.inputsData.has(input.name)
            )
        ) {
            return false;
        }

        if (componentState.component instanceof InputActionComponent) {
            return false;
        }

        if (componentState.component instanceof StartActionComponent) {
            const parentFlowState = componentState.flowState.parentFlowState;
            if (parentFlowState) {
                const parentComponent = componentState.flowState.component;
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
    async run(componentState: ComponentState) {
        componentState.flowState.runtime.logs.addLogItem(
            new ExecuteComponentLogItem(
                componentState.flowState,
                componentState.component
            )
        );

        runInAction(() => {
            componentState.isRunning = true;
        });

        let propagateThroughSeqout = false;

        try {
            if (componentState.flowState.isFinished) {
                //throw "The flow has already finished execution.";
            }

            const result = await componentState.component.execute(
                componentState.flowState,
                componentState.dispose
            );

            if (result == undefined) {
                propagateThroughSeqout = true;
                runInAction(() => (componentState.dispose = undefined));
            } else {
                if (typeof result == "boolean") {
                    propagateThroughSeqout = false;
                    runInAction(() => (componentState.dispose = undefined));
                } else {
                    runInAction(() => (componentState.dispose = result));
                    propagateThroughSeqout = true;
                }
            }
        } catch (err) {
            this.throwError(
                componentState.flowState,
                componentState.component,
                err.toString()
            );
        } finally {
            --componentState.flowState.numActiveComponents;

            runInAction(() => {
                componentState.isRunning = false;
            });
        }

        if (propagateThroughSeqout) {
            this.propagateValue(
                componentState.flowState,
                componentState.component,
                "@seqout",
                null
            );
        }

        componentState.component.inputs.forEach(input => {
            if (input.isSequenceInput) {
                componentState.inputsData.delete(input.name);
            }
        });

        componentState.markInputsDataRead();

        if (
            propagateThroughSeqout &&
            !componentState.flowState.hasAnyDiposableComponent
        ) {
            if (
                componentState.flowState.numActiveComponents == 0 &&
                componentState.flowState.flow instanceof Action &&
                !componentState.flowState.flowStates.find(
                    flowState => !flowState.isFinished
                )
            ) {
                runInAction(() => (componentState.flowState.isFinished = true));
            }
        }
    }

    throwError(flowState: FlowState, component: Component, message: string) {
        runInAction(() => {
            flowState.runtime.error = flowState.error = message;
        });

        if (component instanceof ErrorActionComponent) {
            flowState.log("error", `Error: ${message}`, component);
        } else {
            flowState.runtime.logs.addLogItem(
                new ExecutionErrorLogItem(flowState, component, message)
            );
        }

        const componentState = flowState.getComponentState(component);

        const catchErrorOutput = this.findCatchErrorOutput(componentState);
        if (!flowState.isFinished && catchErrorOutput) {
            this.propagateValue(flowState, component, "@error", message);
        } else {
            let flowState: FlowState | undefined;
            if (component instanceof ErrorActionComponent) {
                flowState = componentState.flowState.parentFlowState;
            } else {
                flowState = componentState.flowState;
            }

            const catchErrorActionComponentState =
                flowState && flowState.findCatchErrorActionComponent();
            if (catchErrorActionComponentState) {
                // remove from the queue all the tasks beloging to this flow state
                componentState.flowState.runtime.removeQueueTasksForFlowState(
                    componentState.flowState
                );

                if (
                    catchErrorActionComponentState.flowState !=
                        componentState.flowState &&
                    componentState.flowState.flow instanceof
                        ProjectEditor.ActionClass
                ) {
                    runInAction(
                        () => (componentState.flowState.isFinished = true)
                    );
                }

                this.setInputValue(
                    catchErrorActionComponentState.flowState,
                    catchErrorActionComponentState.component,
                    "message",
                    message
                );
            } else {
                componentState.flowState.runtime.stopRuntime(true);
            }
        }
    }

    findCatchErrorOutput(componentState: ComponentState):
        | {
              componentState: ComponentState;
              connectionLines: ConnectionLine[];
          }
        | undefined {
        const connectionLines =
            componentState.flowState.flow.connectionLines.filter(
                connectionLine =>
                    connectionLine.sourceComponent ==
                        componentState.component &&
                    connectionLine.output === "@error" &&
                    connectionLine.targetComponent
            );
        if (connectionLines.length > 0) {
            return { componentState, connectionLines };
        }

        if (
            componentState.flowState.parentFlowState &&
            componentState.flowState.component
        ) {
            return this.findCatchErrorOutput(
                componentState.flowState.parentFlowState.getComponentState(
                    componentState.flowState.component
                )
            );
        }

        return undefined;
    }

    assignValue(
        flowState: FlowState,
        component: Component,
        assignableExpression: string,
        value: any
    ) {
        const result = evalAssignableExpression(
            flowState,
            component,
            assignableExpression
        );

        if (isObjectType(result.valueType) && value != null) {
            const objectVariableType = getObjectVariableTypeFromType(
                result.valueType
            );
            if (objectVariableType) {
                value = objectVariableType?.constructorFunction(value, true);
            }
        }

        if (result.isOutput()) {
            this.propagateValue(flowState, component, result.name, value);
        } else if (result.isLocalVariable()) {
            flowState.dataContext.set(result.name, value);
        } else if (result.isGlobalVariable()) {
            flowState.dataContext.set(result.name, value);
        } else if (result.isFlowValue()) {
            runInAction(() => (result.object[result.name] = value));
        } else {
            throw "Not an assignable expression";
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

function findWidgetFlowState(runtime: RuntimeBase, widget: Widget) {
    const widgetFlow = ProjectEditor.getFlow(widget);

    if (
        runtime.selectedFlowState &&
        !runtime.selectedFlowState.isFinished &&
        runtime.selectedFlowState.flow == widgetFlow
    ) {
        return runtime.selectedFlowState;
    }

    function findInFlowStates(flowStates: FlowState[]): FlowState | undefined {
        for (let i = 0; i < flowStates.length; i++) {
            const flowState = flowStates[i];
            if (!flowState.isFinished && flowState.flow == widgetFlow) {
                return flowState;
            }

            const childFlowState = findInFlowStates(flowState.flowStates);
            if (childFlowState) {
                return childFlowState;
            }
        }

        return undefined;
    }

    return findInFlowStates(runtime.flowStates);
}
