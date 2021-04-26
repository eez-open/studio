import React from "react";
import { observer } from "mobx-react";
import classNames from "classnames";

import styled from "eez-studio-ui/styled-components";
import { guid } from "eez-studio-shared/guid";

import { ITreeNode, Tree } from "eez-studio-ui/tree";

import { ProjectContext } from "project-editor/project/context";
import { Panel } from "project-editor/components/Panel";
import { action, computed, observable, runInAction, toJS } from "mobx";
import { DocumentStoreClass } from "project-editor/core/store";
import { Action, findAction } from "project-editor/features/action/action";
import { ConnectionLine, Flow, FlowTabState } from "project-editor/flow/flow";
import {
    CallActionActionComponent,
    CatchErrorActionComponent,
    ErrorActionComponent,
    InputActionComponent,
    StartActionComponent
} from "project-editor/flow/action-components";
import {
    ActionComponent,
    Component,
    Widget
} from "project-editor/flow/component";
import {
    findPropertyByNameInObject,
    getLabel,
    IEezObject,
    PropertyType
} from "project-editor/core/object";
import { IconAction } from "eez-studio-ui/action";
import type {
    IDataContext,
    IFlowContext
} from "project-editor/flow//flow-interfaces";
import { LayoutViewWidget } from "./widgets";
import { visitObjects } from "project-editor/core/search";
import { isWebStudio } from "eez-studio-shared/util-electron";
import { Splitter } from "eez-studio-ui/splitter";
import { Page } from "project-editor/features/page/page";
import {
    PageEditor,
    PageTabState
} from "project-editor/features/page/PagesNavigation";

////////////////////////////////////////////////////////////////////////////////

const MAX_HISTORY_ITEMS = 10000;

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

interface QueueTask {
    runningFlow: RunningFlow;
    component: Component;
    input: string;
    inputData: InputData;
    connectionLine?: ConnectionLine;
}

interface StartQueueTask {
    runningFlow: RunningFlow;
    component: Component;
}

abstract class HistoryItem {
    date: Date = new Date();
    id = guid();
    @observable history: HistoryItem[] = [];

    constructor(
        public runningFlow: RunningFlow | undefined,
        public flow?: Flow,
        public sourceComponent?: Component,
        public targetComponent?: Component,
        public connectionLine?: ConnectionLine
    ) {}

    abstract get label(): string;

    get isError() {
        return false;
    }
}

export class RuntimeStoreClass {
    constructor(public DocumentStore: DocumentStoreClass) {
        (window as any).runtime = this;
    }

    @observable isRuntimeMode = false;
    @observable isStopped = false;
    @observable selectedPage: Page;

    setRuntimeMode = async () => {
        if (!this.isRuntimeMode) {
            runInAction(() => {
                this.isRuntimeMode = true;
                this.selectedRunningFlow = undefined;
                this.selectedHistoryItem = undefined;
                this.isStopped = false;
                this.DocumentStore.UIStateStore.showDebugInfo = false;
                this.selectedPage = this.DocumentStore.project.pages[0];

                this.DocumentStore.UIStateStore.pageRuntimeFrontFace = true;
                this.DocumentStore.dataContext.clearDataItemValues();

                this.queueIsEmpty = true;
                this.runningFlows = this.DocumentStore.project.pages
                    .filter(page => !page.isUsedAsCustomWidget)
                    .map(page => new RunningFlow(this, page));
            });

            await this.loadSettings();

            this.runningFlows.forEach(runningFlow => runningFlow.start());
            this.pumpQueue();
            EEZStudio.electron.ipcRenderer.send("preventAppSuspension", true);
        }
    };

    setEditorMode = async () => {
        if (this.isRuntimeMode) {
            this.stop();

            this.queue = [];

            runInAction(() => {
                this.runningFlows = [];
                this.history = [];
            });

            this.DocumentStore.EditorsStore.editors.forEach(editor => {
                if (editor.state instanceof FlowTabState) {
                    const flowTabState = editor.state;
                    runInAction(() => {
                        flowTabState.runningFlow = undefined;
                    });
                }
            });

            runInAction(() => (this.isRuntimeMode = false));
        }
    };

    async stop() {
        if (this.pumpTimeoutId) {
            clearTimeout(this.pumpTimeoutId);
            this.pumpTimeoutId = undefined;
        }

        while (this.isRunning) {
            await new Promise(resolve => setTimeout(resolve));
        }

        this.runningFlows.forEach(runningFlow => runningFlow.finish());
        EEZStudio.electron.ipcRenderer.send("preventAppSuspension", false);

        runInAction(() => {
            this.isStopped = true;
        });

        await this.saveSettings();
    }

    @computed get isRunning() {
        return (
            this.runningFlows.find(runningFlow => runningFlow.isRunning) !=
            undefined
        );
    }

    ////////////////////////////////////////

    queue: QueueTask[] = [];
    startQueue: StartQueueTask[] = [];
    pumpTimeoutId: any;
    @observable queueIsEmpty: boolean;

    @observable runningFlows: RunningFlow[] = [];

    @observable runningComponents: number;

    @computed get isIdle() {
        return this.isStopped || (this.queueIsEmpty && !this.isRunning);
    }

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

        if (this.startQueue.length > 0) {
            while (true) {
                const startTask = this.startQueue.shift();
                if (!startTask) {
                    break;
                }

                const { runningFlow, component } = startTask;

                const componentState = runningFlow.getComponentState(component);
                componentState.run();
            }
        }

        if (this.queue.length > 0) {
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
        }

        this.pumpTimeoutId = setTimeout(this.pumpQueue);

        runInAction(() => (this.queueIsEmpty = this.queue.length === 0));
    };

    @action
    executeWidgetAction(flowContext: IFlowContext, widget: Widget) {
        this.queueIsEmpty = false;

        if (this.isStopped) {
            return;
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
                const parentRunningFlow = flowContext.runningFlow! as RunningFlow;
                const runningFlow = new RunningFlow(
                    this,
                    action,
                    parentRunningFlow
                );
                this.addHistoryItem(
                    new ExecuteWidgetActionHistoryItem(runningFlow, widget)
                );
                parentRunningFlow.runningFlows.push(runningFlow);
                runningFlow.startAction();
            } else {
                this.addHistoryItem(
                    new WidgetActionNotFoundHistoryItem(undefined, widget)
                );
            }
        } else {
            this.addHistoryItem(
                new WidgetActionNotDefinedHistoryItem(undefined, widget)
            );
        }
    }

    removeRunningFlow(runningFlow: RunningFlow) {
        runInAction(() => {
            this.runningFlows.splice(this.runningFlows.indexOf(runningFlow), 1);
        });
    }

    ////////////////////////////////////////
    // RUNNING FLOWS PANEL

    @observable selectedRunningFlow: RunningFlow | undefined;

    ////////////////////////////////////////
    // HISTORY PANEL

    @observable history: HistoryItem[] = [];
    @observable selectedHistoryItem: HistoryItem | undefined;

    @action
    addHistoryItem(historyItem: HistoryItem) {
        // if (historyItem instanceof OutputValueHistoryItem) {
        //     for (let i = this.history.length - 1; i >= 0; i--) {
        //         const parentHistoryItem = this.history[i];
        //         if (
        //             parentHistoryItem instanceof
        //                 ExecuteComponentHistoryItem &&
        //             parentHistoryItem.componentState ==
        //                 historyItem.componentState
        //         ) {
        //             parentHistoryItem.history.push(historyItem);
        //             return;
        //         }
        //     }
        // }

        this.history.push(historyItem);

        if (this.history.length > MAX_HISTORY_ITEMS) {
            this.history.shift();
        }
    }

    @action.bound
    clearHistory() {
        this.history = [];
    }

    ////////////////////////////////////////

    @computed get selectedPageElement() {
        return (
            <PageEditor
                editor={{
                    object: this.selectedPage,
                    state: new PageTabState(this.selectedPage)
                }}
            ></PageEditor>
        );
    }

    renderRuntimePanel() {
        return <RuntimePanel />;
    }

    ////////////////////////////////////////
    // RUNTIME SETTINGS

    @observable settings: any = {};

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

        const fs = EEZStudio.remote.require("fs");

        return new Promise<void>(resolve => {
            fs.readFile(filePath, "utf8", (err: any, data: string) => {
                if (err) {
                    // TODO
                    console.error(err);
                } else {
                    runInAction(() => {
                        this.settings = JSON.parse(data);
                    });
                    console.log("Runtime settings loaded");
                }
                resolve();
            });
        });
    }

    async saveSettings() {
        if (isWebStudio()) {
            return;
        }

        const filePath = this.getSettingsFilePath();
        if (!filePath) {
            return;
        }

        const fs = EEZStudio.remote.require("fs");

        return new Promise<void>(resolve => {
            fs.writeFile(
                this.getSettingsFilePath(),
                JSON.stringify(toJS(this.settings), undefined, "  "),
                "utf8",
                (err: any) => {
                    if (err) {
                        // TODO
                        console.error(err);
                    } else {
                        console.log("Runtime settings saved");
                    }

                    resolve();
                }
            );
        });
    }
}

////////////////////////////////////////////////////////////////////////////////

export type InputPropertyValue = InputData;

export class ComponentState {
    inputsData = new Map<string, InputData>();
    @observable _inputPropertyValues = new Map<string, InputPropertyValue>();
    @observable isRunning: boolean = false;
    @observable runningState: any;
    dispose: (() => void) | undefined = undefined;

    constructor(public runningFlow: RunningFlow, public component: Component) {}

    getInputValue(input: string) {
        return this.inputsData.get(input);
    }

    getInputPropertyValue(input: string) {
        return this._inputPropertyValues.get(input);
    }

    setInputData(input: string, inputData: InputData) {
        this.inputsData.set(input, inputData);
    }

    isReadyToRun() {
        if (this.component instanceof LayoutViewWidget) {
            return true;
        }

        if (this.component instanceof Widget) {
            return this.inputsData.size > 0;
        }

        if (this.component instanceof CatchErrorActionComponent) {
            return !!this.inputsData.get("message");
        }

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

        if (this.component instanceof StartActionComponent) {
            const parentRunningFlow = this.runningFlow.parentRunningFlow;
            if (parentRunningFlow) {
                const parentComponent = this.runningFlow.component;
                if (parentComponent) {
                    const parentComponentState = parentRunningFlow.getComponentState(
                        parentComponent
                    );
                    if (
                        parentRunningFlow.flow.connectionLines.find(
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

        this.runningFlow.RuntimeStore.addHistoryItem(
            new ExecuteComponentHistoryItem(
                this.runningFlow,
                this.component,
                this
            )
        );

        this.isRunning = true;

        try {
            this.dispose = await this.component.execute(
                this.runningFlow,
                this.dispose
            );
        } catch (err) {
            runInAction(() => {
                this.runningFlow.hasError = true;
            });
            this.runningFlow.RuntimeStore.addHistoryItem(
                new ExecutionErrorHistoryItem(
                    this.runningFlow,
                    this.component,
                    err
                )
            );

            const catchErrorOutput = this.findCatchErrorOutput();
            if (catchErrorOutput) {
                catchErrorOutput.connectionLines.forEach(connectionLine => {
                    this.runningFlow.RuntimeStore.queue.push({
                        runningFlow:
                            catchErrorOutput.componentState.runningFlow,
                        component: connectionLine.targetComponent!,
                        input: connectionLine.input,
                        inputData: {
                            time: Date.now(),
                            value: err
                        },
                        connectionLine
                    });
                });
            } else {
                let runningFlow: RunningFlow | undefined;
                if (this.component instanceof ErrorActionComponent) {
                    runningFlow = this.runningFlow.parentRunningFlow;
                } else {
                    runningFlow = this.runningFlow;
                }

                const catchErrorActionComponentState =
                    runningFlow && runningFlow.findCatchErrorActionComponent();
                if (catchErrorActionComponentState) {
                    this.runningFlow.RuntimeStore.queue.push({
                        runningFlow: catchErrorActionComponentState.runningFlow,
                        component: catchErrorActionComponentState.component,
                        input: "message",
                        inputData: {
                            time: Date.now(),
                            value: err
                        }
                    });
                } else {
                    this.runningFlow.RuntimeStore.stop();
                }
            }
        } finally {
            runInAction(() => {
                this.runningFlow.RuntimeStore.queueIsEmpty = false;
                this.isRunning = false;
            });
        }

        if (
            !(this.component instanceof LayoutViewWidget) &&
            !(this.component instanceof CallActionActionComponent)
        ) {
            this.runningFlow.flow.connectionLines
                .filter(
                    connectionLine =>
                        connectionLine.sourceComponent == this.component &&
                        connectionLine.output === "@seqout"
                )
                .forEach(connectionLine => {
                    this.runningFlow.RuntimeStore.queue.push({
                        runningFlow: this.runningFlow,
                        component: connectionLine.targetComponent!,
                        input: connectionLine.input,
                        inputData: {
                            time: Date.now(),
                            value: null
                        },
                        connectionLine
                    });
                });
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
        const connectionLines = this.runningFlow.flow.connectionLines.filter(
            connectionLine =>
                connectionLine.sourceComponent == this.component &&
                connectionLine.output === "@error" &&
                connectionLine.targetComponent
        );
        if (connectionLines.length > 0) {
            return { componentState: this, connectionLines };
        }

        if (this.runningFlow.parentRunningFlow && this.runningFlow.component) {
            return this.runningFlow.parentRunningFlow
                .getComponentState(this.runningFlow.component)
                .findCatchErrorOutput();
        }

        return undefined;
    }
}

export class RunningFlow {
    id = guid();

    componentStates = new Map<Component, ComponentState>();

    @observable runningFlows: RunningFlow[] = [];

    dataContext: IDataContext;

    @observable hasError = false;

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

    isVariableDeclared(component: Component, variableName: string): any {
        return this.dataContext.isVariableDeclared(variableName);
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

    declareVariable(component: Component, variableName: string, value: any) {
        return this.dataContext.declare(variableName, value);
    }

    @computed get isRunning(): boolean {
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
                    this.RuntimeStore.startQueue.push({
                        runningFlow: this,
                        component: visitResult.value
                    });
                }
            }
        }
    }

    finish() {
        this.runningFlows.forEach(runningFlow => runningFlow.finish());

        this.componentStates.forEach(componentState => componentState.finish());

        this.RuntimeStore.addHistoryItem(
            new ActionEndHistoryItem(this, this.flow!)
        );
    }

    startFromWidgetAction(widget: Component) {
        this.RuntimeStore.queueIsEmpty = false;
        this.executeWire(widget, "action");
    }

    startAction() {
        this.RuntimeStore.addHistoryItem(
            new ActionStartHistoryItem(this, this.flow!)
        );

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

    @action
    executeAction(component: Component, action: Action) {
        this.RuntimeStore.queueIsEmpty = false;
        const runningFlow = new RunningFlow(
            this.RuntimeStore,
            action,
            this,
            component
        );
        this.runningFlows.push(runningFlow);
        runningFlow.start();
        return runningFlow;
    }

    executeWire(component: Component, output: string) {
        const flow = this.flow!;

        flow.connectionLines
            .filter(
                connectionLine =>
                    connectionLine.source === component.wireID &&
                    connectionLine.output === output
            )
            .forEach(connectionLine => {
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
                        new NoConnectionHistoryItem(this, component, output)
                    );
                }
            });
    }

    propagateValue(
        sourceComponent: Component,
        output: string,
        value: any,
        outputName?: string
    ) {
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
                        this,
                        this.getComponentState(sourceComponent),
                        connectionLine,
                        outputName ?? output,
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

    findCatchErrorActionComponent(): ComponentState | undefined {
        const catchErrorActionComponent = this.flow.components.find(
            component => component instanceof CatchErrorActionComponent
        );
        if (catchErrorActionComponent) {
            return this.getComponentState(catchErrorActionComponent);
        }

        if (this.parentRunningFlow) {
            return this.parentRunningFlow.findCatchErrorActionComponent();
        }

        return undefined;
    }
}

////////////////////////////////////////////////////////////////////////////////

class ActionStartHistoryItem extends HistoryItem {
    constructor(public runningFlow: RunningFlow | undefined, flow: Flow) {
        super(runningFlow, flow);
    }

    get label() {
        return `Action start: ${getLabel(this.flow!)}`;
    }
}

class ActionEndHistoryItem extends HistoryItem {
    constructor(public runningFlow: RunningFlow | undefined, flow: Flow) {
        super(runningFlow, flow);
    }

    get label() {
        return `Action end: ${getLabel(this.flow!)}`;
    }
}

class ExecuteComponentHistoryItem extends HistoryItem {
    constructor(
        public runningFlow: RunningFlow | undefined,
        sourceComponent: Component,
        public componentState: ComponentState
    ) {
        super(runningFlow, undefined, sourceComponent);
    }

    get label() {
        return `Execute component: ${getLabel(this.sourceComponent!)}`;
    }
}

class ExecuteWidgetActionHistoryItem extends HistoryItem {
    constructor(
        public runningFlow: RunningFlow | undefined,
        sourceComponent: Component
    ) {
        super(runningFlow, undefined, sourceComponent);
    }

    get label() {
        return `Execute widget action: ${getLabel(this.sourceComponent!)}`;
    }
}

class WidgetActionNotDefinedHistoryItem extends HistoryItem {
    constructor(
        public runningFlow: RunningFlow | undefined,
        sourceComponent: Component
    ) {
        super(runningFlow, undefined, sourceComponent);
    }

    get label() {
        return `Widget action not defined: ${getLabel(this.sourceComponent!)}`;
    }

    get isError() {
        return true;
    }
}

class WidgetActionNotFoundHistoryItem extends HistoryItem {
    constructor(
        public runningFlow: RunningFlow | undefined,
        sourceComponent: Component
    ) {
        super(runningFlow, undefined, sourceComponent);
    }

    get label() {
        return `Widget action not found: ${
            (this.sourceComponent as Widget).action
        }`;
    }

    get isError() {
        return true;
    }
}

class NoConnectionHistoryItem extends HistoryItem {
    constructor(
        public runningFlow: RunningFlow | undefined,
        sourceComponent: Component,
        public output?: string
    ) {
        super(runningFlow, undefined, sourceComponent);
    }

    get label() {
        return `Action ${getLabel(
            this.sourceComponent!
        )} has no connection from output ${this.output}`;
    }

    get isError() {
        return true;
    }
}

class OutputValueHistoryItem extends HistoryItem {
    constructor(
        public runningFlow: RunningFlow | undefined,
        public componentState: ComponentState,
        public connectionLine: ConnectionLine,
        public output?: string,
        public value?: any
    ) {
        super(
            runningFlow,
            undefined,
            connectionLine.sourceComponent!,
            connectionLine.targetComponent,
            connectionLine
        );
    }

    get label() {
        let value = this.value ?? null;
        if (value) {
            try {
                value = JSON.stringify(value);
            } catch (err) {
                try {
                    value = value?.toString();
                } catch (err) {
                    console.error(err, value);
                }
            }
        }

        return `Output value from [${this.output}] to [${getLabel(
            this.connectionLine.targetComponent!
        )}/${this.connectionLine.input}]: ${value}`;
    }
}

class ExecutionErrorHistoryItem extends HistoryItem {
    constructor(
        public runningFlow: RunningFlow | undefined,
        sourceComponent: Component,
        public error?: any
    ) {
        super(runningFlow, undefined, sourceComponent);
    }

    get label() {
        return `Execution error in ${getLabel(
            this.sourceComponent!
        )}: ${this.error.toString()}`;
    }

    get isError() {
        return true;
    }
}

////////////////////////////////////////////////////////////////////////////////

const RuntimePanelDiv = styled.div`
    flex-grow: 1;

    display: flex;
    flex-direction: column;

    .EezStudio_Tree {
        overflow: auto;
    }

    .running-flow {
        display: inline-flex;
        align-items: center;

        .error {
            color: red;
        }
    }

    .history-label {
        display: flex;
        justify-content: space-between;
    }

    .history-item {
        display: inline-flex;
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
        if (!this.context.RuntimeStore.isIdle) {
            return null;
        }

        return (
            <Panel
                id="runtime"
                title={"Runtime Info"}
                body={
                    <RuntimePanelDiv>
                        <Splitter
                            type="vertical"
                            persistId={`project-editor/runtime-info`}
                            sizes={`50%|50%`}
                            childrenOverflow="hidden"
                        >
                            <RunningFlowsPanel />
                            <HistoryPanel />
                        </Splitter>
                    </RuntimePanelDiv>
                }
            />
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
class RunningFlowsPanel extends React.Component {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    render() {
        return (
            <Panel
                id="project-editor/runtime-info/flows"
                title="History"
                body={<FlowsTree />}
            />
        );
    }
}

@observer
class FlowsTree extends React.Component {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    @computed get rootNode(): ITreeNode<RunningFlow> {
        const selectedRunningFlow = this.context.RuntimeStore
            .selectedRunningFlow;

        function getChildren(
            runningFlows: RunningFlow[]
        ): ITreeNode<RunningFlow>[] {
            return runningFlows.map(runningFlow => ({
                id: runningFlow.id,
                label: (
                    <div
                        className={classNames("running-flow", {
                            error: runningFlow.hasError
                        })}
                    >
                        {getLabel(runningFlow.flow)}
                    </div>
                ),
                children: getChildren(runningFlow.runningFlows),
                selected: runningFlow === selectedRunningFlow,
                expanded: true,
                data: runningFlow
            }));
        }

        return {
            id: "all",
            label: "All",
            children: getChildren(this.context.RuntimeStore.runningFlows),
            selected: !selectedRunningFlow,
            expanded: true
        };
    }

    @action.bound
    selectNode(node?: ITreeNode<RunningFlow>) {
        this.context.RuntimeStore.selectedHistoryItem = undefined;
        this.context.RuntimeStore.selectedRunningFlow = node?.data;

        const runningFlow = this.context.RuntimeStore.selectedRunningFlow;
        if (runningFlow) {
            this.context.NavigationStore.showObject(runningFlow.flow);

            const editorState = this.context.EditorsStore.activeEditor?.state;
            if (editorState instanceof FlowTabState) {
                setTimeout(() => {
                    runInAction(() => (editorState.runningFlow = runningFlow));
                }, 0);
            }
        }
    }

    render() {
        return (
            <Tree
                showOnlyChildren={false}
                rootNode={this.rootNode}
                selectNode={this.selectNode}
            />
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
class HistoryPanel extends React.Component {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    render() {
        return (
            <Panel
                id="project-editor/runtime-info/history"
                title="History"
                buttons={[
                    <IconAction
                        key="clear"
                        icon="material:clear"
                        title="Clear history"
                        onClick={this.context.RuntimeStore.clearHistory}
                    ></IconAction>
                ]}
                body={<HistoryTree />}
            />
        );
    }
}

@observer
class HistoryTree extends React.Component {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    @computed get rootNode(): ITreeNode<HistoryItem> {
        const selectedHistoryItem = this.context.RuntimeStore
            .selectedHistoryItem;

        function getChildren(
            historyItems: HistoryItem[]
        ): ITreeNode<HistoryItem>[] {
            return historyItems.map(historyItem => ({
                id: historyItem.id,
                label: (
                    <div
                        className={classNames("history-item", {
                            error: historyItem.isError
                        })}
                    >
                        <small>{historyItem.date.toLocaleTimeString()}</small>
                        <span>{historyItem.label}</span>
                    </div>
                ),
                children: getChildren(historyItem.history),
                selected: historyItem === selectedHistoryItem,
                expanded: true,
                data: historyItem
            }));
        }

        return {
            id: "root",
            label: "",
            children: getChildren(
                this.context.RuntimeStore.history.filter(
                    historyItem =>
                        !this.context.RuntimeStore.selectedRunningFlow ||
                        historyItem.runningFlow ===
                            this.context.RuntimeStore.selectedRunningFlow
                )
            ),
            selected: false,
            expanded: true
        };
    }

    @action.bound
    selectNode(node?: ITreeNode<HistoryItem>) {
        this.context.RuntimeStore.selectedHistoryItem = node?.data;

        if (this.context.RuntimeStore.selectedHistoryItem?.flow) {
            this.context.NavigationStore.showObject(
                this.context.RuntimeStore.selectedHistoryItem?.flow
            );
        } else {
            const objects: IEezObject[] = [];

            if (
                this.context.RuntimeStore.selectedHistoryItem?.sourceComponent
            ) {
                objects.push(
                    this.context.RuntimeStore.selectedHistoryItem
                        ?.sourceComponent
                );
            }

            if (this.context.RuntimeStore.selectedHistoryItem?.connectionLine) {
                objects.push(
                    this.context.RuntimeStore.selectedHistoryItem
                        ?.connectionLine
                );
            }

            if (
                this.context.RuntimeStore.selectedHistoryItem?.targetComponent
            ) {
                objects.push(
                    this.context.RuntimeStore.selectedHistoryItem
                        ?.targetComponent
                );
            }

            if (objects.length > 0) {
                this.context.NavigationStore.showObject(objects[0]);

                setTimeout(() => {
                    const editorState = this.context.EditorsStore.activeEditor
                        ?.state;
                    if (editorState instanceof FlowTabState) {
                        this.context.EditorsStore.activeEditor?.state?.selectObjects(
                            objects
                        );
                    }
                }, 0);
            }
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
