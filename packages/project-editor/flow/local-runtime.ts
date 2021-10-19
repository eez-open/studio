import fs from "fs";
import { action, computed, observable, runInAction, toJS } from "mobx";
import { DocumentStoreClass } from "project-editor/core/store";
import { findAction } from "project-editor/features/action/action";
import { Component, Widget } from "project-editor/flow/component";
import type { IFlowContext } from "project-editor/flow/flow-interfaces";
import { isWebStudio } from "eez-studio-shared/util-electron";
import {
    ExecuteWidgetActionLogItem,
    WidgetActionNotDefinedLogItem,
    WidgetActionNotFoundLogItem
} from "project-editor/flow/debugger/logs";
import { FLOW_ITERATOR_INDEX_VARIABLE } from "project-editor/features/variable/defs";
import { getObjectTypeClassFromType } from "project-editor/features/variable/value-type";
import * as notification from "eez-studio-ui/notification";
import {
    StateMachineAction,
    FlowState,
    QueueTask,
    RuntimeBase
} from "project-editor/flow/runtime";
import { InputActionComponent } from "project-editor/flow/action-components";
import { ProjectEditor } from "project-editor/project-editor-interface";

export class LocalRuntime extends RuntimeBase {
    pumpTimeoutId: any;
    @observable settings: any = {};
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

        await this.loadSettings();

        await this.loadPersistentVariables();

        await this.constructCustomGlobalVariables();

        for (const flowState of this.flowStates) {
            await flowState.start();
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

    async loadPersistentVariables() {
        if (this.settings.__persistentVariables) {
            for (const variable of this.DocumentStore.project.variables
                .globalVariables) {
                if (variable.persistent) {
                    const saveValue =
                        this.settings.__persistentVariables[variable.name];
                    if (saveValue) {
                        const aClass = getObjectTypeClassFromType(
                            variable.type
                        );
                        if (aClass && aClass.classInfo.onObjectVariableLoad) {
                            const value =
                                await aClass.classInfo.onObjectVariableLoad(
                                    saveValue
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
    }

    async savePersistentVariables() {
        for (const variable of this.DocumentStore.project.variables
            .globalVariables) {
            if (variable.persistent) {
                const value = this.DocumentStore.dataContext.get(variable.name);
                if (value != null) {
                    const aClass = getObjectTypeClassFromType(variable.type);
                    if (aClass && aClass.classInfo.onObjectVariableSave) {
                        const saveValue =
                            await aClass.classInfo.onObjectVariableSave(
                                this.DocumentStore.dataContext.get(
                                    variable.name
                                )
                            );

                        runInAction(() => {
                            if (!this.settings.__persistentVariables) {
                                this.settings.__persistentVariables = {};
                            }
                            this.settings.__persistentVariables[variable.name] =
                                saveValue;
                        });
                    }
                }
            }
        }
    }

    async constructCustomGlobalVariables() {
        for (const variable of this.DocumentStore.project.variables
            .globalVariables) {
            let value = this.DocumentStore.dataContext.get(variable.name);
            if (value == null) {
                const aClass = getObjectTypeClassFromType(variable.type);
                if (aClass && aClass.classInfo.onObjectVariableConstructor) {
                    value = await aClass.classInfo.onObjectVariableConstructor(
                        variable
                    );
                    this.DocumentStore.dataContext.set(variable.name, value);
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
        await this.saveSettings();

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

                        await componentState.run();

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
    executeWidgetAction(flowContext: IFlowContext, widget: Widget) {
        if (this.isStopped) {
            return;
        }

        const parentFlowState = findWidgetFlowState(this, widget);
        if (!parentFlowState) {
            return;
        }

        const it = flowContext.dataContext.get(FLOW_ITERATOR_INDEX_VARIABLE);

        if (widget.isOutputProperty("action")) {
            parentFlowState.propagateValue(widget, "action", it);
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
                        newFlowState.propagateValue(component, "@seqout", it);
                    }
                }

                parentFlowState.flowStates.push(newFlowState);

                newFlowState.executeStartAction();
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

    readSettings(key: string) {
        return this.settings[key];
    }

    @action
    writeSettings(key: string, value: any) {
        this.settings[key] = value;
    }

    getSettingsFilePath() {
        if (this.DocumentStore.filePath) {
            return this.DocumentStore.filePath + "-runtime-settings";
        }
        return undefined;
    }

    async loadSettings() {
        if (isWebStudio()) {
            return;
        }

        const filePath = this.getSettingsFilePath();
        if (!filePath) {
            return;
        }

        try {
            const data = await fs.promises.readFile(filePath, "utf8");
            runInAction(() => {
                try {
                    this.settings = JSON.parse(data);
                } catch (err) {
                    console.error(err);
                    this.settings = {};
                }
            });
        } catch (err) {}
    }

    async saveSettings() {
        if (isWebStudio()) {
            return;
        }

        const filePath = this.getSettingsFilePath();
        if (!filePath) {
            return;
        }

        await this.savePersistentVariables();

        try {
            await fs.promises.writeFile(
                filePath,
                JSON.stringify(toJS(this.settings), undefined, "  "),
                "utf8"
            );
        } catch (err) {
            notification.error("Failed to save runtime settings: " + err);
        }
    }

    onBreakpointAdded(component: Component) {}

    onBreakpointRemoved(component: Component) {}

    onBreakpointEnabled(component: Component) {}

    onBreakpointDisabled(component: Component) {}
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
