import { ProjectStore } from "project-editor/store";
import { Component, Widget } from "project-editor/flow/component";
import {
    FlowState,
    QueueTask,
    RuntimeBase,
    SingleStepMode
} from "project-editor/flow/runtime/runtime";
import { ConnectionLine } from "project-editor/flow/connection-line";
import {
    evalExpression,
    IExpressionContext
} from "project-editor/flow/expression";
import type { IFlowContext } from "project-editor/flow/flow-interfaces";
import type { ValueType } from "eez-studio-types";
import { getProperty } from "project-editor/core/object";

export class DebugInfoRuntime extends RuntimeBase {
    pumpTimeoutId: any;
    _lastBreakpointTaks: QueueTask | undefined;

    constructor(public projectStore: ProjectStore) {
        super(projectStore);
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

    runSingleStep(singleStepMode?: SingleStepMode) {}

    executeWidgetAction(
        flowContext: IFlowContext,
        widget: Widget,
        actionName: string,
        value: any,
        valueType: ValueType
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
        this.projectStore.onRestart();
    }

    evalProperty(
        flowContext: IFlowContext,
        widget: Widget,
        propertyName: string
    ) {
        let expr = getProperty(widget, propertyName);
        return evalExpression(flowContext, widget, expr);
    }

    evalPropertyWithType(
        flowContext: IFlowContext,
        widget: Widget,
        propertyName: string
    ) {
        let expr = getProperty(widget, propertyName);
        return {
            value: evalExpression(flowContext, widget, expr),
            valueType: "any" as const
        };
    }
}
