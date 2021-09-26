import { guid } from "eez-studio-shared/guid";

import { action, computed, observable, runInAction, toJS } from "mobx";
import { DocumentStoreClass } from "project-editor/core/store";
import { Action, findAction } from "project-editor/features/action/action";
import { ConnectionLine, Flow, FlowTabState } from "project-editor/flow/flow";
import {
    CallActionActionComponent,
    CatchErrorActionComponent,
    CommentActionComponent,
    ErrorActionComponent,
    InputActionComponent,
    StartActionComponent
} from "project-editor/flow/action-components";
import { Component, Widget } from "project-editor/flow/component";
import {
    findPropertyByNameInObject,
    getLabel,
    IEezObject,
    PropertyType
} from "project-editor/core/object";
import type {
    IDataContext,
    IFlowContext
} from "project-editor/flow//flow-interfaces";
import { LayoutViewWidget } from "./widgets";
import { visitObjects } from "project-editor/core/search";
import { isWebStudio } from "eez-studio-shared/util-electron";
import { Page } from "project-editor/features/page/page";
import { showSelectInstrumentDialog } from "./action-components/instrument";
import * as notification from "eez-studio-ui/notification";
import { Connection, getConnection } from "instrument/window/connection";
import {
    ActionEndLogItem,
    ActionStartLogItem,
    ExecuteComponentLogItem,
    ExecuteWidgetActionLogItem,
    ExecutionErrorLogItem,
    LogItem,
    LogsState,
    NoStartActionComponentLogItem,
    OutputValueLogItem,
    WidgetActionNotDefinedLogItem,
    WidgetActionNotFoundLogItem
} from "project-editor/flow/debugger/logs";
import { valueToString } from "./debugger/VariablesPanel";

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

export class RuntimeStoreClass {
    constructor(public DocumentStore: DocumentStoreClass) {
        (window as any).runtime = this;
    }

    @observable isRuntimeMode = false;
    @observable isStopped = false;
    @observable selectedPage: Page;

    @observable hasError = false;

    @observable isDebuggerActive = false;
    @observable isPaused = false;
    @observable singleStep = false;
    resumed = false;

    setRuntimeMode = async (isDebuggerActive: boolean) => {
        if (!this.isRuntimeMode) {
            if (this.DocumentStore.isAppletProject) {
                if (!(await this.startApplet())) {
                    return;
                }
            }

            this.queueTaskId = 0;

            runInAction(() => {
                this.isRuntimeMode = true;
                this.DocumentStore.uiStateStore.pageRuntimeFrontFace =
                    !isDebuggerActive;
                this.selectedFlowState = undefined;
                this.logsState.selectedLogItem = undefined;
                this.isStopped = false;
                this.hasError = false;
                this.isDebuggerActive = isDebuggerActive;
                this.isPaused = isDebuggerActive;
                this.singleStep = false;
                this.selectedPage = this.DocumentStore.project.pages[0];
                this.selectedQueueTask = undefined;

                if (this.DocumentStore.isDashboardProject) {
                    this.DocumentStore.dataContext.clearRuntimeValues();
                }

                if (this.DocumentStore.isDashboardProject) {
                    this.flowStates = this.DocumentStore.project.pages
                        .filter(page => !page.isUsedAsCustomWidget)
                        .map(page => new FlowState(this, page));
                }
            });

            if (this.DocumentStore.isDashboardProject) {
                await this.loadSettings();

                this.flowStates.forEach(flowState => flowState.start());
                this.pumpQueue();
                EEZStudio.electron.ipcRenderer.send(
                    "preventAppSuspension",
                    true
                );
            }
        }
    };

    setEditorMode = async () => {
        if (this.isRuntimeMode) {
            await this.stop();

            runInAction(() => (this.queue = []));
            this.queueTaskId = 0;

            if (this.DocumentStore.isDashboardProject) {
                runInAction(() => {
                    this.flowStates = [];
                    this.logsState.clear();
                    this.hasError = false;
                });

                this.DocumentStore.editorsStore.editors.forEach(editor => {
                    if (editor.state instanceof FlowTabState) {
                        const flowTabState = editor.state;
                        runInAction(() => {
                            flowTabState.flowState = undefined;
                        });
                    }
                });
            }

            runInAction(() => (this.isRuntimeMode = false));
        }
    };

    async stop() {
        if (!this.isRuntimeMode) {
            return;
        }

        if (this.DocumentStore.isDashboardProject) {
            if (this.pumpTimeoutId) {
                clearTimeout(this.pumpTimeoutId);
                this.pumpTimeoutId = undefined;
            }

            while (this.isRunning) {
                await new Promise(resolve => setTimeout(resolve));
            }

            this.flowStates.forEach(flowState => flowState.finish());
            EEZStudio.electron.ipcRenderer.send("preventAppSuspension", false);

            runInAction(() => {
                this.isStopped = true;
            });

            await this.saveSettings();
        } else {
            await this.stopApplet();
        }
    }

    @computed get isRunning() {
        return (
            this.flowStates.find(flowState => flowState.isRunning) != undefined
        );
    }

    @action
    toggleDebugger() {
        this.isDebuggerActive = !this.isDebuggerActive;
        this.isPaused = this.isDebuggerActive;
        this.DocumentStore.uiStateStore.pageRuntimeFrontFace =
            !this.isDebuggerActive;
    }

    @action
    resume() {
        this.isPaused = false;
        this.singleStep = false;
        this.resumed = true;
    }

    @action
    pause() {
        this.isPaused = true;
        this.singleStep = false;
    }

    @action
    runSingleStep() {
        if (this.isPaused) {
            this.isPaused = false;
            this.singleStep = true;
        }
    }

    ////////////////////////////////////////

    connection: Connection | undefined;

    async startApplet() {
        await this.DocumentStore.build();

        const instrument = await showSelectInstrumentDialog();

        if (!instrument) {
            return false;
        }

        const toastId = notification.info("Uploading app...", {
            autoClose: false
        });

        instrument.connection.connect();

        const editor = instrument.getEditor();
        editor.onCreate();

        await new Promise<void>(resolve => setTimeout(resolve, 1000));

        const connection = getConnection(editor);
        if (!connection || !instrument.isConnected) {
            notification.update(toastId, {
                type: notification.ERROR,
                render: `Instrument not connected`,
                autoClose: 1000
            });
            return;
        }

        this.connection = connection;

        try {
            await connection.acquire(false);
        } catch (err) {
            notification.update(toastId, {
                type: notification.ERROR,
                render: `Error: ${err.toString()}`,
                autoClose: 1000
            });
            return false;
        }

        try {
            const path = EEZStudio.remote.require("path");

            const destinationFolderPath =
                this.DocumentStore.getAbsoluteFilePath(
                    this.DocumentStore.project.settings.build
                        .destinationFolder || "."
                );

            const destinationFileName = `${path.basename(
                this.DocumentStore.filePath,
                ".eez-project"
            )}.app`;

            const sourceFilePath = `${destinationFolderPath}/${destinationFileName}`;

            await new Promise<void>((resolve, reject) => {
                const uploadInstructions = Object.assign(
                    {},
                    connection.instrument.defaultFileUploadInstructions,
                    {
                        sourceFilePath,
                        destinationFileName,
                        destinationFolderPath: "/Scripts"
                    }
                );

                connection.upload(uploadInstructions, resolve, reject);
            });

            connection.command(`SYST:DEL 100`);

            const runningScript = await connection.query(`SCR:RUN?`);
            if (runningScript != "" && runningScript != `""`) {
                connection.command(`SCR:STOP`);
                connection.command(`SYST:DEL 100`);
            }

            connection.command(`SCR:RUN "/Scripts/${destinationFileName}"`);

            notification.update(toastId, {
                type: notification.SUCCESS,
                render: `App started`,
                autoClose: 1000
            });
            return true;
        } catch (err) {
            notification.update(toastId, {
                type: notification.ERROR,
                render: `Error: ${err.toString()}`,
                autoClose: 1000
            });
            return false;
        } finally {
            connection.release();
        }
    }

    async stopApplet() {
        const connection = this.connection;
        this.connection = undefined;

        if (!connection) {
            return;
        }

        if (!connection.isConnected) {
            return;
        }

        try {
            await connection.acquire(false);
        } catch (err) {
            notification.error(`Error: ${err.toString()}`);
            return;
        }

        try {
            const runningScript = await connection.query(`SCR:RUN?`);
            if (runningScript != "" && runningScript != `""`) {
                connection.command(`SCR:STOP`);
                notification.success("App stopped");
            }
        } catch (err) {
            notification.error(`Error: ${err.toString()}`);
        } finally {
            connection.release();
        }
    }

    ////////////////////////////////////////

    queueTaskId: 0;
    @observable queue: QueueTask[] = [];
    pumpTimeoutId: any;

    @observable flowStates: FlowState[] = [];

    @observable runningComponents: number;

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

        if (this.isDebuggerActive && this.isPaused && !this.selectedQueueTask) {
            const nextQueueTask = this.queue[0];

            runInAction(() => {
                this.selectQueueTask(nextQueueTask);
            });

            if (nextQueueTask) {
                this.showQueueTask(nextQueueTask);
            }
        }
    }

    pumpQueue = async () => {
        this.pumpTimeoutId = undefined;

        if (!(this.isDebuggerActive && this.isPaused)) {
            if (this.queue.length > 0) {
                const runningComponents: QueueTask[] = [];

                let singleStep = this.singleStep;

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
                            this.isDebuggerActive &&
                            !singleStep &&
                            !this.resumed &&
                            this.breakpoints.has(component)
                        ) {
                            runningComponents.push(task);
                            singleStep = true;
                            break;
                        }

                        await componentState.run();

                        if (connectionLine) {
                            connectionLine.setActive();
                        }
                    }

                    this.resumed = false;

                    if (singleStep) {
                        break;
                    }

                    if (this.isDebuggerActive && this.isPaused) {
                        break;
                    }
                }

                this.resumed = false;

                runInAction(() => this.queue.unshift(...runningComponents));

                if (singleStep) {
                    const nextQueueTask =
                        this.queue.length > 0 ? this.queue[0] : undefined;

                    runInAction(() => {
                        this.isPaused = true;
                        this.singleStep = false;
                        this.selectQueueTask(nextQueueTask);
                    });

                    if (nextQueueTask) {
                        this.showQueueTask(nextQueueTask);
                    }
                }
            }
        }

        this.pumpTimeoutId = setTimeout(this.pumpQueue);
    };

    @action
    executeWidgetAction(flowContext: IFlowContext, widget: Widget) {
        if (this.isStopped) {
            return;
        }

        const parentFlowState = flowContext.flowState! as FlowState;

        if (widget.isOutputProperty("action")) {
            parentFlowState.propagateValue(widget, "action", null);
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

                this.logsState.addLogItem(
                    new ExecuteWidgetActionLogItem(newFlowState, widget)
                );

                parentFlowState.flowStates.push(newFlowState);

                newFlowState.executeStartAction();
            } else {
                this.logsState.addLogItem(
                    new WidgetActionNotFoundLogItem(undefined, widget)
                );
            }
        } else {
            this.logsState.addLogItem(
                new WidgetActionNotDefinedLogItem(undefined, widget)
            );
        }
    }

    removeFlowState(flowState: FlowState) {
        runInAction(() => {
            this.flowStates.splice(this.flowStates.indexOf(flowState), 1);
        });
    }

    ////////////////////////////////////////
    // RUNNING FLOWS PANEL

    @observable selectedFlowState: FlowState | undefined;

    ////////////////////////////////////////
    // HISTORY

    logsState = new LogsState();

    ////////////////////////////////////////
    // RUNTIME SETTINGS

    @observable settings: any = {};
    _settingsModified: boolean;

    readSettings(key: string) {
        return this.settings[key];
    }

    @action
    writeSettings(key: string, value: any) {
        this.settings[key] = value;
        this._settingsModified = true;
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

        if (!this._settingsModified) {
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
                        this._settingsModified = false;
                        console.log("Runtime settings saved");
                    }

                    resolve();
                }
            );
        });
    }

    @computed get error() {
        return "Unknown error";
    }

    ////////////////////////////////////////
    // DEBUGGER

    @observable selectedQueueTask: QueueTask | undefined;

    selectQueueTask(queueTask: QueueTask | undefined) {
        this.selectedQueueTask = queueTask;
        if (queueTask) {
            this.selectedFlowState = queueTask.flowState;
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

    ////////////////////////////////////////
    // BREAKPOINTS

    @observable breakpoints = new Map<Component, boolean>();

    isBreakpointAddedForComponent(component: Component) {
        return this.breakpoints.has(component);
    }

    isBreakpointEnabledForComponent(component: Component) {
        return this.breakpoints.get(component) == true;
    }

    @action
    addBreakpoint(component: Component) {
        this.breakpoints.set(component, true);
    }

    @action
    removeBreakpoint(component: Component) {
        this.breakpoints.delete(component);
    }

    @action
    enableBreakpoint(component: Component) {
        this.breakpoints.set(component, true);
    }

    @action
    disableBreakpoint(component: Component) {
        this.breakpoints.set(component, false);
    }
}

export class FlowState {
    id = guid();

    componentStates = new Map<Component, ComponentState>();

    @observable flowStates: FlowState[] = [];

    dataContext: IDataContext;

    @observable hasError = false;

    constructor(
        public runtimeStore: RuntimeStoreClass,
        public flow: Flow,
        public parentFlowState?: FlowState,
        public component?: Component
    ) {
        this.dataContext =
            this.runtimeStore.DocumentStore.dataContext.createWithLocalVariables(
                flow.localVariables
            );
    }

    get DocumentStore() {
        return this.runtimeStore.DocumentStore;
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
                        this.runtimeStore.pushTask({
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

        this.runtimeStore.logsState.addLogItem(new ActionEndLogItem(this));
    }

    executeStartAction() {
        this.runtimeStore.logsState.addLogItem(new ActionStartLogItem(this));

        const startActionComponent = this.flow.components.find(
            component => component instanceof StartActionComponent
        ) as StartActionComponent;

        if (startActionComponent) {
            runInAction(() =>
                this.runtimeStore.pushTask({
                    flowState: this,
                    component: startActionComponent
                })
            );
        } else {
            this.runtimeStore.logsState.addLogItem(
                new NoStartActionComponentLogItem(this)
            );

            this.flowState.runtimeStore.stop();
        }
    }

    @action
    executeAction(component: Component, action: Action) {
        const flowState = new FlowState(
            this.runtimeStore,
            action,
            this,
            component
        );
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

                this.runtimeStore.logsState.addLogItem(
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
            this.runtimeStore.pushTask({
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

    logScpi(message: string, component: Component) {
        this.runtimeStore.logsState.addLogItem(
            new LogItem("scpi", message, this, component)
        );
    }

    logInfo(value: any, component: Component) {
        this.runtimeStore.logsState.addLogItem(
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
        if (this.component instanceof CommentActionComponent) {
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

        this.flowState.runtimeStore.logsState.addLogItem(
            new ExecuteComponentLogItem(this.flowState, this.component)
        );

        runInAction(() => {
            this.isRunning = true;
        });

        try {
            this.dispose = await this.component.execute(
                this.flowState,
                this.dispose
            );
        } catch (err) {
            runInAction(() => {
                this.flowState.runtimeStore.hasError = true;
                this.flowState.hasError = true;
            });
            this.flowState.runtimeStore.logsState.addLogItem(
                new ExecutionErrorLogItem(this.flowState, this.component, err)
            );

            const catchErrorOutput = this.findCatchErrorOutput();
            if (catchErrorOutput) {
                catchErrorOutput.connectionLines.forEach(connectionLine => {
                    this.flowState.runtimeStore.logsState.addLogItem(
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
                    this.flowState.runtimeStore.stop();
                }
            }
        } finally {
            runInAction(() => {
                this.isRunning = false;
            });
        }

        if (
            !(this.component instanceof LayoutViewWidget) &&
            !(this.component instanceof CallActionActionComponent)
        ) {
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
