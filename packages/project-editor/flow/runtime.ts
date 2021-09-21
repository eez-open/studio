import { guid } from "eez-studio-shared/guid";

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
    ActionEndHistoryItem,
    ActionStartHistoryItem,
    ExecuteComponentHistoryItem,
    ExecuteWidgetActionHistoryItem,
    ExecutionErrorHistoryItem,
    HistoryState,
    NoConnectionHistoryItem,
    OutputValueHistoryItem,
    WidgetActionNotDefinedHistoryItem,
    WidgetActionNotFoundHistoryItem
} from "./history";

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
    input?: string;
    inputData?: InputData;
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
                this.selectedFlowState = undefined;
                this.historyState.selectedHistoryItem = undefined;
                this.isStopped = false;
                this.hasError = false;
                this.isDebuggerActive = isDebuggerActive;
                this.isPaused = isDebuggerActive;
                this.singleStep = false;
                this.selectedPage = this.DocumentStore.project.pages[0];

                this.DocumentStore.UIStateStore.pageRuntimeFrontFace =
                    this.DocumentStore.isDashboardProject;

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
                    this.historyState.clearHistory();
                    this.hasError = false;
                });

                this.DocumentStore.EditorsStore.editors.forEach(editor => {
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
    }

    @action
    resume() {
        this.isPaused = false;
        this.singleStep = false;
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

    pumpQueue = async () => {
        this.pumpTimeoutId = undefined;

        if (!(this.isDebuggerActive && this.isPaused)) {
            if (this.queue.length > 0) {
                const runningComponents: QueueTask[] = [];

                while (true) {
                    let task: QueueTask | undefined;
                    runInAction(() => (task = this.queue.shift()));
                    if (!task) {
                        break;
                    }

                    const {
                        flowState,
                        component,
                        input,
                        inputData,
                        connectionLine
                    } = task;

                    const componentState =
                        flowState.getComponentState(component);

                    if (componentState.isRunning) {
                        runningComponents.push(task);
                    } else {
                        if (input && inputData) {
                            componentState.setInputData(input, inputData);

                            if (componentState.isReadyToRun()) {
                                componentState.run();
                            }
                        } else {
                            componentState.run();
                        }

                        if (connectionLine) {
                            connectionLine.setActive();
                        }
                    }

                    if (this.singleStep) {
                        runInAction(() => {
                            this.isPaused = true;
                            this.singleStep = false;
                        });
                        break;
                    }
                }

                runInAction(() => this.queue.unshift(...runningComponents));
            }
        }

        this.pumpTimeoutId = setTimeout(this.pumpQueue);
    };

    @action
    executeWidgetAction(flowContext: IFlowContext, widget: Widget) {
        if (this.isStopped) {
            return;
        }

        if (widget.isOutputProperty("action")) {
            (flowContext.flowState as FlowState).startFromWidgetAction(widget);
        } else if (widget.action) {
            const action = findAction(
                this.DocumentStore.project,
                widget.action
            );

            if (action) {
                const parentFlowState = flowContext.flowState! as FlowState;
                const flowState = new FlowState(this, action, parentFlowState);
                this.historyState.addHistoryItem(
                    new ExecuteWidgetActionHistoryItem(flowState, widget)
                );
                parentFlowState.flowStates.push(flowState);
                flowState.startAction();
            } else {
                this.historyState.addHistoryItem(
                    new WidgetActionNotFoundHistoryItem(undefined, widget)
                );
            }
        } else {
            this.historyState.addHistoryItem(
                new WidgetActionNotDefinedHistoryItem(undefined, widget)
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

    historyState = new HistoryState();

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
}

export class FlowState {
    id = guid();

    componentStates = new Map<Component, ComponentState>();

    @observable flowStates: FlowState[] = [];

    dataContext: IDataContext;

    @observable hasError = false;

    constructor(
        public RuntimeStore: RuntimeStoreClass,
        public flow: Flow,
        public parentFlowState?: FlowState,
        public component?: Component
    ) {
        this.dataContext =
            this.RuntimeStore.DocumentStore.dataContext.createWithLocalVariables(
                flow.localVariables
            );
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
                    runInAction(() =>
                        this.RuntimeStore.queue.push({
                            id: ++this.RuntimeStore.queueTaskId,
                            flowState: this,
                            component: visitResult.value
                        })
                    );
                }
            }
        }
    }

    finish() {
        this.flowStates.forEach(flowState => flowState.finish());

        this.componentStates.forEach(componentState => componentState.finish());

        this.RuntimeStore.historyState.addHistoryItem(
            new ActionEndHistoryItem(this, this.flow!)
        );
    }

    startFromWidgetAction(widget: Component) {
        this.executeWire(widget, "action");
    }

    startAction() {
        this.RuntimeStore.historyState.addHistoryItem(
            new ActionStartHistoryItem(this, this.flow!)
        );

        const inputActionComponent = this.flow.components.find(
            component => component instanceof InputActionComponent
        ) as ActionComponent;

        if (inputActionComponent) {
            runInAction(() =>
                this.RuntimeStore.queue.push({
                    id: ++this.RuntimeStore.queueTaskId,
                    flowState: this,
                    component: inputActionComponent,
                    input: "input",
                    inputData: {
                        time: Date.now(),
                        value: null
                    }
                })
            );
        } else {
            // TODO report
        }
    }

    @action
    executeAction(component: Component, action: Action) {
        const flowState = new FlowState(
            this.RuntimeStore,
            action,
            this,
            component
        );
        this.flowStates.push(flowState);
        flowState.start();
        return flowState;
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

                    runInAction(() =>
                        this.RuntimeStore.queue.push({
                            id: ++this.RuntimeStore.queueTaskId,
                            flowState: this,
                            component: actionNode,
                            input: connectionLine.input,
                            inputData: {
                                time: Date.now(),
                                value: null
                            },
                            connectionLine
                        })
                    );
                } else {
                    this.RuntimeStore.historyState.addHistoryItem(
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

                this.RuntimeStore.historyState.addHistoryItem(
                    new OutputValueHistoryItem(
                        this,
                        this.getComponentState(sourceComponent),
                        connectionLine,
                        outputName ?? output,
                        value
                    )
                );

                runInAction(() =>
                    this.RuntimeStore.queue.push({
                        id: ++this.RuntimeStore.queueTaskId,
                        flowState: this,
                        component: targetComponent,
                        input: connectionLine.input,
                        inputData: {
                            time: Date.now(),
                            value
                        },
                        connectionLine
                    })
                );
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

        if (this.parentFlowState) {
            return this.parentFlowState.findCatchErrorActionComponent();
        }

        return undefined;
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

    constructor(public flowState: FlowState, public component: Component) {}

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

        this.flowState.RuntimeStore.historyState.addHistoryItem(
            new ExecuteComponentHistoryItem(
                this.flowState,
                this.component,
                this
            )
        );

        this.isRunning = true;

        try {
            this.dispose = await this.component.execute(
                this.flowState,
                this.dispose
            );
        } catch (err) {
            runInAction(() => {
                this.flowState.RuntimeStore.hasError = true;
                this.flowState.hasError = true;
            });
            this.flowState.RuntimeStore.historyState.addHistoryItem(
                new ExecutionErrorHistoryItem(
                    this.flowState,
                    this.component,
                    err
                )
            );

            const catchErrorOutput = this.findCatchErrorOutput();
            if (catchErrorOutput) {
                catchErrorOutput.connectionLines.forEach(connectionLine => {
                    this.flowState.RuntimeStore.historyState.addHistoryItem(
                        new OutputValueHistoryItem(
                            catchErrorOutput.componentState.flowState,
                            catchErrorOutput.componentState,
                            connectionLine,
                            "@error",
                            err
                        )
                    );

                    runInAction(() =>
                        this.flowState.RuntimeStore.queue.push({
                            id: ++this.flowState.RuntimeStore.queueTaskId,
                            flowState:
                                catchErrorOutput.componentState.flowState,
                            component: connectionLine.targetComponent!,
                            input: connectionLine.input,
                            inputData: {
                                time: Date.now(),
                                value: err
                            },
                            connectionLine
                        })
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
                    runInAction(() =>
                        this.flowState.RuntimeStore.queue.push({
                            id: ++this.flowState.RuntimeStore.queueTaskId,
                            flowState: catchErrorActionComponentState.flowState,
                            component: catchErrorActionComponentState.component,
                            input: "message",
                            inputData: {
                                time: Date.now(),
                                value: err
                            }
                        })
                    );
                } else {
                    this.flowState.RuntimeStore.stop();
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
            this.flowState.flow.connectionLines
                .filter(
                    connectionLine =>
                        connectionLine.sourceComponent == this.component &&
                        connectionLine.output === "@seqout"
                )
                .forEach(connectionLine => {
                    runInAction(() =>
                        this.flowState.RuntimeStore.queue.push({
                            id: ++this.flowState.RuntimeStore.queueTaskId,
                            flowState: this.flowState,
                            component: connectionLine.targetComponent!,
                            input: connectionLine.input,
                            inputData: {
                                time: Date.now(),
                                value: null
                            },
                            connectionLine
                        })
                    );
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
