import { DocumentStoreClass } from "project-editor/core/store";
import { Component, Widget } from "project-editor/flow/component";
import { FlowState, QueueTask, RuntimeBase } from "project-editor/flow/runtime";
import type { ConnectionLine } from "project-editor/flow/flow";
import { IExpressionContext } from "project-editor/flow/expression";
import { IFlowContext } from "project-editor/flow/flow-interfaces";

export class DebugInfoRuntime extends RuntimeBase {
    pumpTimeoutId: any;
    _lastBreakpointTaks: QueueTask | undefined;

    constructor(public DocumentStore: DocumentStoreClass) {
        super(DocumentStore);
    }

    async loadDebugInfo(filePath: string) {
        const response = await fetch(filePath);

        if (!response.ok) {
            throw new Error("File read error " + response.status);
        }

        const decompress = require("decompress");
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const files = await decompress(buffer);
        this.debugInfo = JSON.parse(files[0].data.toString("utf8"));
    }

    doStartRuntime = async (isDebuggerActive: boolean) => {};

    async doStopRuntime(notifyUser = false) {}

    onBreakpointAdded(component: Component) {}

    onBreakpointRemoved(component: Component) {}

    onBreakpointEnabled(component: Component) {}

    onBreakpointDisabled(component: Component) {}

    resume() {}

    pause() {}

    runSingleStep() {}

    executeWidgetAction(
        flowContext: IFlowContext,
        widget: Widget,
        value?: any
    ) {}

    readSettings(key: string) {}
    writeSettings(key: string, value: any) {}

    async startFlow(flowState: FlowState) {}

    propagateValue(
        flowState: FlowState,
        sourceComponent: Component,
        output: string,
        value: any,
        outputName?: string
    ) {}

    setInputValue(
        flowState: FlowState,
        component: Component,
        input: string,
        value: any,
        connectionLine?: ConnectionLine
    ) {}

    throwError(flowState: FlowState, component: Component, message: string) {}

    assignValue(
        expressionContext: IExpressionContext | FlowState,
        component: Component,
        assignableExpression: string,
        value: any
    ) {}

    destroyObjectLocalVariables(flowState: FlowState) {}

    toggleDebugger() {
        this.DocumentStore.onRestart();
    }
}
