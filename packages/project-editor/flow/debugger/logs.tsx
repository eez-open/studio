import { observable, action, makeObservable } from "mobx";

import { guid } from "eez-studio-shared/guid";

import {
    getLabel,
    getObjectFromStringPath,
    getObjectPathAsString
} from "project-editor/store";
import type { ConnectionLine } from "project-editor/flow/flow";
import type { FlowState, RuntimeBase } from "project-editor/flow/runtime";
import {
    Component,
    getInputDisplayName,
    getOutputDisplayName,
    Widget
} from "project-editor/flow/component";
import type { LogItemType } from "project-editor/flow/flow-interfaces";

////////////////////////////////////////////////////////////////////////////////

export const MAX_LOGS_ITEMS = 1000;

////////////////////////////////////////////////////////////////////////////////

export class LogItem {
    date: Date = new Date();
    id = guid();

    constructor(
        public type: LogItemType,
        private _label: string | undefined,
        public flowState: FlowState | undefined,
        public component?: Component,
        public connectionLine?: ConnectionLine
    ) {}

    get label() {
        return this._label;
    }
}

////////////////////////////////////////////////////////////////////////////////

export class ActionStartLogItem extends LogItem {
    constructor(flowState: FlowState) {
        super("debug", undefined, flowState);
    }

    get label() {
        return `Action start: ${getLabel(this.flowState!.flow)}`;
    }
}

export class ActionEndLogItem extends LogItem {
    constructor(flowState: FlowState) {
        super("debug", undefined, flowState);
    }

    get label() {
        return `Action end: ${getLabel(this.flowState!.flow)}`;
    }
}

export class ExecuteComponentLogItem extends LogItem {
    constructor(flowState: FlowState | undefined, sourceComponent: Component) {
        super("debug", undefined, flowState, sourceComponent);
    }

    get label() {
        return `Execute component: ${getLabel(this.component!)}`;
    }
}

export class ExecuteWidgetActionLogItem extends LogItem {
    constructor(flowState: FlowState | undefined, component: Component) {
        super("debug", undefined, flowState, component);
    }

    get label() {
        return `Execute widget action: ${getLabel(this.component!)}`;
    }
}

export class WidgetActionNotDefinedLogItem extends LogItem {
    constructor(flowState: FlowState | undefined, component: Component) {
        super("error", undefined, flowState, component);
    }

    get label() {
        return `Widget action not defined: ${getLabel(this.component!)}`;
    }
}

export class WidgetActionNotFoundLogItem extends LogItem {
    constructor(flowState: FlowState | undefined, component: Component) {
        super("error", undefined, flowState, component);
    }

    get label() {
        return `Widget action not found: ${(this.component as Widget).action}`;
    }
}

export class NoConnectionLogItem extends LogItem {
    constructor(
        public flowState: FlowState | undefined,
        component: Component,
        public output?: string
    ) {
        super("error", undefined, flowState, component);
    }

    get label() {
        return `Action ${getLabel(
            this.component!
        )} has no connection from output ${this.output}`;
    }
}

export class OutputValueLogItem extends LogItem {
    constructor(
        public flowState: FlowState,
        public connectionLine: ConnectionLine,
        public output?: string,
        public value?: any
    ) {
        super("debug", undefined, flowState, undefined, connectionLine);
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

        return `Output value from [${
            this.output ||
            getOutputDisplayName(
                this.connectionLine.sourceComponent,
                this.connectionLine.output
            )
        }] to [${getLabel(
            this.connectionLine.targetComponent!
        )}/${getInputDisplayName(
            this.connectionLine.targetComponent,
            this.connectionLine.input
        )}]: ${value}`;
    }
}

export class ExecutionErrorLogItem extends LogItem {
    constructor(flowState: FlowState, component: Component, public error: any) {
        super("error", undefined, flowState, component);
    }

    get label() {
        return `Execution error in ${getLabel(
            this.component!
        )}: ${this.error.toString()}`;
    }
}

export class NoStartActionComponentLogItem extends LogItem {
    constructor(public flowState: FlowState | undefined) {
        super("error", undefined, flowState);
    }

    get label() {
        return `There is no StartActionComponent`;
    }
}

////////////////////////////////////////////////////////////////////////////////

export class RuntimeLogs {
    logs: LogItem[] = [];
    selectedLogItem: LogItem | undefined;

    constructor() {
        makeObservable(this, {
            logs: observable,
            selectedLogItem: observable,
            addLogItem: action,
            clear: action.bound,
            loadDebugInfo: action
        });
    }

    addLogItem(logItem: LogItem) {
        this.logs.push(logItem);
        if (this.logs.length > MAX_LOGS_ITEMS) {
            // remove oldest non error log item
            for (let i = 0; i < this.logs.length; i++) {
                if (this.logs[i].type != "error") {
                    this.logs.splice(i, 1);
                    return;
                }
            }

            // remove oldest error item
            this.logs.shift();
        }
    }

    clear() {
        this.logs = [];
    }

    get debugInfo() {
        return this.logs.map(logItem => ({
            id: logItem.id,
            date: logItem.date.getTime(),
            type: logItem.type,
            label: logItem.label,
            flowState: logItem.flowState?.id,
            component: logItem.component
                ? getObjectPathAsString(logItem.component)
                : undefined,
            connectionLine: logItem.connectionLine
                ? getObjectPathAsString(logItem.connectionLine)
                : undefined
        }));
    }

    loadDebugInfo(runtime: RuntimeBase, debugInfo: any) {
        this.logs = debugInfo.map((logItemDebugInfo: any) => {
            const logItem = new LogItem(
                logItemDebugInfo.type,
                logItemDebugInfo.label,
                runtime.findFlowStateById(logItemDebugInfo.flowState),
                logItemDebugInfo.component
                    ? (getObjectFromStringPath(
                          runtime.projectEditorStore.project,
                          logItemDebugInfo.component
                      ) as Component)
                    : undefined,
                logItemDebugInfo.connectionLine
                    ? (getObjectFromStringPath(
                          runtime.projectEditorStore.project,
                          logItemDebugInfo.connectionLine
                      ) as ConnectionLine)
                    : undefined
            );

            logItem.id = logItemDebugInfo.id;
            logItem.date = new Date(logItemDebugInfo.date);

            return logItem;
        });
    }
}
