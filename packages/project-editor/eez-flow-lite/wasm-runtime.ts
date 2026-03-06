import {
    runInAction
} from "mobx";

import {
    FlowState,
    QueueTask,
    RuntimeBase,
    SingleStepMode,
    StateMachineAction
} from "project-editor/flow/runtime/runtime";
import { ValueType, ValueWithType } from "eez-studio-types";
import { Widget, Component } from "project-editor/flow/component";

import {
    evalAssignableExpression,
    evalExpression,
    IExpressionContext
} from "project-editor/eez-flow-lite/expression";

import { IFlowContext } from "project-editor/flow/flow-interfaces";
import { type ProjectStore } from "project-editor/store";
import {
    CallActionActionComponent,
    DelayActionComponent,
    EndActionComponent,
    IsTrueActionComponent,
    LabelOutActionComponent,
    LogActionComponent,
    LoopActionComponent,
    SetVariableActionComponent,
    StartActionComponent,
    SwitchActionComponent
} from "project-editor/flow/components/actions";
import { DataContext } from "project-editor/features/variable/variable";
import type { Action } from "project-editor/features/action/action";

export abstract class EezFlowLiteWasmRuntime extends RuntimeBase {
    dataContext: DataContext;
    delays: {
        time: number;
        flowState: FlowState;
        component: DelayActionComponent;
    }[] = [];
    continueExecution: boolean;

    constructor(public projectStore: ProjectStore) {
        super(projectStore);
        this.dataContext = new DataContext(projectStore.project);

        this.selectedPage = projectStore.project.pages[0];
    }

    processQueue() {
        if (this.isRunning || this.isResumed || this.isSingleStep) {
            const startTime = Date.now();

            const newDelays = [];
            for (const delay of this.delays) {
                if (this.getTick() >= delay.time) {
                    this.addToQueueConnectionLines(
                        delay.flowState,
                        delay.component,
                        "@seqout"
                    );
                } else {
                    newDelays.push(delay);
                }
            }
            this.delays = newDelays;

            let task: QueueTask | undefined;
            while (this.queue.length > 0 && Date.now() - startTime < 16) {
                task = this.queue[0];

                const { connectionLine } = task;
                const component = connectionLine!.targetComponent;
                if (
                    !this.continueExecution &&
                    !this.isSingleStep &&
                    this.projectStore.uiStateStore.isBreakpointEnabledForComponent(
                        component
                    )
                ) {
                    if (!this.isDebuggerActive) {
                        this.toggleDebugger();
                    } else {
                        this.transition(StateMachineAction.PAUSE);
                    }
                    break;
                } else {
                    runInAction(() => {
                        this.queue.shift();
                    });

                    this.executeTask(task);
                    this.continueExecution = false;

                    if (this.isSingleStep) {
                        this.transition(StateMachineAction.PAUSE);
                        break;
                    }
                }
            }
        }
    }

    executeTask(task: QueueTask) {
        const { flowState, connectionLine } = task;

        const component = connectionLine!.targetComponent;

        if (component instanceof SetVariableActionComponent) {
            for (const entry of component.entries) {
                const variable = evalAssignableExpression(
                    flowState.expressionContext,
                    component,
                    entry.variable
                );

                let value = evalExpression(
                    flowState.expressionContext,
                    component,
                    entry.value
                );

                if (variable.valueType == "integer") {
                    value = value | 0;
                }

                flowState.dataContext.set(variable.name, value);
            }
        } else if (component instanceof IsTrueActionComponent) {
            const condition = evalExpression(
                flowState.expressionContext,
                component,
                component.value
            );

            if (condition) {
                this.addToQueueConnectionLines(flowState, component, "True");
            } else {
                this.addToQueueConnectionLines(flowState, component, "False");
            }
        } else if (component instanceof SwitchActionComponent) {
            for (
                let test_index = 0;
                test_index < component.tests.length;
                test_index++
            ) {
                const test = component.tests[test_index];

                const condition = evalExpression(
                    flowState.expressionContext,
                    component,
                    test.condition
                );

                if (condition) {
                    this.addToQueueConnectionLines(
                        flowState,
                        component,
                        test.outputName
                    );
                    break;
                }
            }
        } else if (component instanceof LoopActionComponent) {
            const variable = evalAssignableExpression(
                flowState.expressionContext,
                component,
                component.variable
            );

            let from = evalExpression(
                flowState.expressionContext,
                component,
                component.from
            );

            let to = evalExpression(
                flowState.expressionContext,
                component,
                component.to
            );
            let step = evalExpression(
                flowState.expressionContext,
                component,
                component.step
            );

            let variableValue;
            if (connectionLine!.input == "start") {
                variableValue = from;
            } else {
                variableValue = flowState.dataContext.get(variable.name) + step;
            }

            flowState.dataContext.set(variable.name, variableValue);

            if (step > 0 ? variableValue <= to : variableValue >= to) {
                this.addToQueueConnectionLines(flowState, component, "@seqout");
            } else {
                this.addToQueueConnectionLines(flowState, component, "done");
            }

            return;
        } else if (component instanceof DelayActionComponent) {
            const milliseconds = evalExpression(
                flowState.expressionContext,
                component,
                component.milliseconds
            );

            const delay = this.delays.find(
                delay =>
                    delay.component == component && delay.flowState == flowState
            );
            if (!delay) {
                this.delays.push({
                    time: this.getTick() + milliseconds,
                    flowState,
                    component
                });
            }

            return;
        } else if (component instanceof LogActionComponent) {
            const message = evalExpression(
                flowState.expressionContext,
                component,
                component.value
            );

            flowState.log("info", message + "", component);
        } else if (component instanceof CallActionActionComponent) {
            const action = this.projectStore.project.actions.find(
                action => action.name == component.action
            );
            if (action) {
                this.executeAction(action, flowState, component);
            }
        } else if (component instanceof EndActionComponent) {
            if (flowState.parentFlowState) {
                runInAction(() => (flowState.isFinished = true));
                this.cleanupFlowStates();

                if (flowState.component) {
                    this.addToQueueConnectionLines(
                        flowState.parentFlowState,
                        flowState.component,
                        "@seqout"
                    );
                }
            }
            return;
        } else if (component instanceof LabelOutActionComponent) {
            if (component.labelInComponent) {
                this.addToQueueConnectionLines(
                    flowState,
                    component.labelInComponent,
                    "@seqout"
                );
            }
        } else {
            if (!this.executeTaskSpecific(task)) {
                return;
            }
        }

        this.addToQueueConnectionLines(flowState, component, "@seqout");
    }

    abstract executeTaskSpecific(task: QueueTask): boolean;

    addToQueueConnectionLines(
        flowState: FlowState,
        component: Component,
        outputName: string
    ) {
        const connectionLines = flowState.flow.connectionLines.filter(
            connectionLine =>
                connectionLine.sourceComponent == component &&
                connectionLine.output == outputName
        );

        for (const connectionLine of connectionLines) {
            this.unshiftTask({
                flowState,
                component,
                connectionLine
            });
            this.setActiveConnectionLine(connectionLine);
        }
    }

    executeAction(
        action: Action,
        flowState: FlowState,
        component?: CallActionActionComponent
    ) {
        const startComponent = action.components.find(
            component => component instanceof StartActionComponent
        );

        if (startComponent) {
            const actionFlowState = new FlowState(
                this,
                action,
                flowState,
                component
            );

            actionFlowState.dataContext =
                flowState.dataContext.createWithLocalVariables([
                    ...action.userProperties.map(userProperty => {
                        const arg =
                            component?.userPropertyValues.values[
                                userProperty.id
                            ];

                        let value = arg
                            ? evalExpression(
                                  flowState.expressionContext,
                                  component,
                                  arg
                              )
                            : undefined;

                        return {
                            name: userProperty.name,
                            fullName: userProperty.name,
                            type: userProperty.type,
                            defaultValue: value,
                            defaultValueList: undefined,
                            persistent: false
                        };
                    }),
                    ...action.localVariables
                ]);

            actionFlowState.expressionContext = {
                dataContext: actionFlowState.dataContext,
                flowState: actionFlowState,
                projectStore: this.projectStore
            };

            runInAction(() => {
                this.flowStates.push(actionFlowState);
            });

            this.addToQueueConnectionLines(
                actionFlowState,
                startComponent,
                "@seqout"
            );
        }
    }
    
    //
    // RuntimeBase implementation
    //

    doStartRuntime(isDebuggerActive: boolean): Promise<void> {
        console.log(
            "Starting runtime with isDebuggerActive =",
            isDebuggerActive
        );

        runInAction(() => {
            for (const page of this.projectStore.project.pages) {
                const flowState = new FlowState(this, page);

                flowState.dataContext =
                    this.dataContext.createWithLocalVariables(
                        page.localVariables
                    );

                flowState.expressionContext = {
                    dataContext: flowState.dataContext,
                    flowState,
                    projectStore: this.projectStore
                };

                for (const component of page.components) {
                    if (component instanceof StartActionComponent) {
                        const connectionLines = page.connectionLines.filter(
                            connectionLine =>
                                connectionLine.sourceComponent == component
                        );

                        for (const connectionLine of connectionLines) {
                            this.pushTask({
                                flowState,
                                component,
                                connectionLine
                            });
                        }
                    }
                }

                this.flowStates.push(flowState);
            }
        });

        if (isDebuggerActive) {
            this.transition(StateMachineAction.PAUSE);
        } else {
            this.transition(StateMachineAction.RUN);
        }

        return Promise.resolve();
    }

    doStopRuntime(notifyUser: boolean): Promise<void> {
        console.log("Stopping runtime with notifyUser =", notifyUser);
        return Promise.resolve();
    }

    toggleDebugger(): void {
        console.log("Toggling debugger");

        if (this.isDebuggerActive) {
            if (this.isPaused) {
                this.resume();
            } else {
                this.transition(StateMachineAction.RUN);
            }

            runInAction(() => {
                this.isDebuggerActive = false;
                this.projectStore.uiStateStore.pageRuntimeFrontFace = true;
            });
        } else {
            this.pause();
        }
    }

    resume(): void {
        console.log("Resuming runtime");

        this.continueExecution = true;
        this.singleStepQueueTask = undefined;
        this.singleStepLastSkippedTask = undefined;
        this.transition(StateMachineAction.RUN);

        if (this.isDebuggerActive) {
            this.projectStore.editorsStore.openEditor(this.selectedPage);
        }
    }

    pause(): void {
        console.log("Pausing runtime");

        runInAction(() => {
            this.isDebuggerActive = true;
            this.projectStore.uiStateStore.pageRuntimeFrontFace = false;
        });

        this.transition(StateMachineAction.PAUSE);
    }

    runSingleStep(singleStepMode?: SingleStepMode): void {
        console.log("Running single step with mode =", singleStepMode);

        if (singleStepMode != undefined) {
            this.singleStepMode = singleStepMode;
            this.transition(StateMachineAction.SINGLE_STEP);
        }
    }

    executeWidgetAction(
        flowContext: IFlowContext,
        widget: Widget,
        actionName: string,
        value: any,
        valueType: ValueType
    ): void {
        console.log(
            "Executing widget action with widget =",
            widget,
            "actionName =",
            actionName,
            "value =",
            value,
            "valueType =",
            valueType
        );
    }

    readSettings(key: string) {
        console.log("Reading settings with key =", key);
    }

    writeSettings(key: string, value: any): void {
        console.log("Writing settings with key =", key, "value =", value);
    }

    startFlow(flowState: FlowState): Promise<void> {
        console.log("Starting flow with state =", flowState);
        return Promise.resolve();
    }

    propagateValue(
        flowState: FlowState,
        sourceComponent: Component,
        output: string,
        value: any,
        outputName?: string
    ): void {
        console.log(
            "Propagating value with flowState =",
            flowState,
            "sourceComponent =",
            sourceComponent,
            "output =",
            output,
            "value =",
            value,
            "outputName =",
            outputName
        );
    }

    throwError(
        flowState: FlowState,
        component: Component,
        message: string
    ): void {
        console.log(
            "Throwing error with flowState =",
            flowState,
            "component =",
            component,
            "message =",
            message
        );
    }

    assignValue(
        expressionContext: IExpressionContext,
        component: Component,
        assignableExpression: string,
        value: any
    ): void {
        console.log(
            "Assigning value with expressionContext =",
            expressionContext,
            "component =",
            component,
            "assignableExpression =",
            assignableExpression,
            "value =",
            value
        );
    }

    destroyObjectLocalVariables(flowState: FlowState): void {
        console.log(
            "Destroying object local variables with flowState =",
            flowState
        );
    }

    evalProperty(
        flowState: IFlowContext,
        widget: Widget,
        propertyName: string
    ) {
        console.log(
            "Evaluating property with flowState =",
            flowState,
            "widget =",
            widget,
            "propertyName =",
            propertyName
        );
    }

    evalPropertyWithType(
        flowState: IFlowContext,
        widget: Widget,
        propertyName: string
    ): ValueWithType | undefined {
        console.log(
            "Evaluating property with type with flowState =",
            flowState,
            "widget =",
            widget,
            "propertyName =",
            propertyName
        );
        return undefined;
    }
}
