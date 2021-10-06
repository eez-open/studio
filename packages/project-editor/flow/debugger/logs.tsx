import { observable } from "mobx";

import { action } from "mobx";
import { ConnectionLine } from "project-editor/flow/flow";
import { getLabel } from "project-editor/core/object";
import { guid } from "eez-studio-shared/guid";
import { FlowState } from "project-editor/flow/runtime";
import { Component, Widget } from "project-editor/flow/component";
import { LogItemType } from "project-editor/flow/flow-interfaces";

////////////////////////////////////////////////////////////////////////////////

export const MAX_LOGS_ITEMS = 1000;

////////////////////////////////////////////////////////////////////////////////

export function getInputName(
    component: Component | undefined,
    inputName: string
) {
    if (component) {
        const input = component.inputs.find(input => input.name == inputName);
        if (input) {
            if (input.displayName) {
                if (typeof input.displayName === "string") {
                    return input.displayName;
                }
            }
            return input.name;
        }
    }
    return inputName;
}

export function getOutputName(
    component: Component | undefined,
    outputName: string
) {
    if (component) {
        const output = component.outputs.find(
            output => output.name == outputName
        );
        if (output) {
            if (output.displayName) {
                if (typeof output.displayName === "string") {
                    return output.displayName;
                }
            }
            return output.name;
        }
    }
    return outputName;
}

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
        super("info", undefined, flowState);
    }

    get label() {
        return `Action start: ${getLabel(this.flowState!.flow)}`;
    }
}

export class ActionEndLogItem extends LogItem {
    constructor(flowState: FlowState) {
        super("info", undefined, flowState);
    }

    get label() {
        return `Action end: ${getLabel(this.flowState!.flow)}`;
    }
}

export class ExecuteComponentLogItem extends LogItem {
    constructor(flowState: FlowState | undefined, sourceComponent: Component) {
        super("info", undefined, flowState, sourceComponent);
    }

    get label() {
        return `Execute component: ${getLabel(this.component!)}`;
    }
}

export class ExecuteWidgetActionLogItem extends LogItem {
    constructor(flowState: FlowState | undefined, component: Component) {
        super("info", undefined, flowState, component);
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
        super("info", undefined, flowState, undefined, connectionLine);
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
            getOutputName(
                this.connectionLine.sourceComponent,
                this.connectionLine.output
            )
        }] to [${getLabel(this.connectionLine.targetComponent!)}/${getInputName(
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
    @observable logs: LogItem[] = [];
    @observable selectedLogItem: LogItem | undefined;

    @action
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

    @action.bound
    clear() {
        this.logs = [];
    }
}
