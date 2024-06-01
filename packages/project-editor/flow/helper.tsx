import React from "react";
import type { IFlowContext } from "project-editor/flow/flow-interfaces";
import type {
    Component,
    ComponentInput,
    ComponentOutput,
    Widget
} from "project-editor/flow/component";
import type { Assets, DataBuffer } from "project-editor/build/assets";
import { evalConstantExpression } from "project-editor/flow/expression";
import { ProjectEditor } from "project-editor/project-editor-interface";
import { getProperty } from "project-editor/core/object";

////////////////////////////////////////////////////////////////////////////////

export function evalProperty(
    flowContext: IFlowContext,
    widget: Widget,
    propertyName: string
) {
    let expr = getProperty(widget, propertyName);
    if (!expr) {
        return undefined;
    }

    if (flowContext.flowState) {
        if (flowContext.projectStore.runtime) {
            return flowContext.projectStore.runtime.evalProperty(
                flowContext,
                widget,
                propertyName
            );
        } else {
            return undefined;
        }
    } else {
        try {
            return evalConstantExpression(
                flowContext.projectStore.project,
                expr
            ).value;
        } catch (err) {
            return undefined;
        }
    }
}

export function evalPropertyWithType(
    flowContext: IFlowContext,
    widget: Widget,
    propertyName: string
) {
    let expr = getProperty(widget, propertyName);
    if (!expr) {
        return undefined;
    }

    if (flowContext.flowState) {
        if (flowContext.projectStore.runtime) {
            return flowContext.projectStore.runtime.evalPropertyWithType(
                flowContext,
                widget,
                propertyName
            );
        } else {
            return undefined;
        }
    } else {
        try {
            return evalConstantExpression(
                flowContext.projectStore.project,
                expr
            );
        } catch (err) {
            return undefined;
        }
    }
}

export function getBooleanValue(
    flowContext: IFlowContext,
    widget: Widget,
    propertyName: string,
    defaultValue: boolean
) {
    let expr = (widget as any)[propertyName];

    if (!expr) {
        return defaultValue;
    }

    let value;
    try {
        value = evalProperty(flowContext, widget, propertyName);
    } catch (err) {
        // console.error(err);
    }

    return !!value;
}

export function getNumberValue(
    flowContext: IFlowContext,
    widget: Widget,
    propertyName: string,
    defaultValue: number
) {
    let expr = (widget as any)[propertyName];

    if (!expr) {
        return defaultValue;
    }

    let value;
    try {
        value = evalProperty(flowContext, widget, propertyName);
    } catch (err) {
        // console.error(err);
    }

    if (typeof value === "number") {
        return value;
    }

    return defaultValue;
}

export function getStringValue(
    flowContext: IFlowContext,
    widget: Widget,
    propertyName: string,
    defaultValue: string
) {
    let expr = (widget as any)[propertyName];

    if (!expr) {
        return defaultValue;
    }

    let value;
    try {
        value = evalProperty(flowContext, widget, propertyName);
    } catch (err) {
        // console.error(err);
    }

    if (typeof value === "string") {
        return value;
    }

    return defaultValue;
}

export function getAnyValue(
    flowContext: IFlowContext,
    widget: Widget,
    propertyName: string,
    defaultValue: any
) {
    let expr = (widget as any)[propertyName];
    if (!expr) {
        return defaultValue;
    }

    let value;
    try {
        value = evalProperty(flowContext, widget, propertyName);
    } catch (err) {
        // console.error(err);
    }

    return value != undefined ? value : defaultValue;
}

export function getTextValue(
    flowContext: IFlowContext,
    widget: Widget,
    propertyName: string,
    name: string | undefined,
    text: string | undefined
): { text: string; node: React.ReactNode } | string {
    let data = (widget as any)[propertyName];

    if (flowContext.projectStore.projectTypeTraits.hasFlowSupport) {
        if (data) {
            if (flowContext.flowState) {
                try {
                    const value = evalProperty(
                        flowContext,
                        widget,
                        propertyName
                    );

                    if (typeof value == "string" || typeof value == "number") {
                        return value.toString();
                    }
                    return "";
                } catch (err) {
                    //console.error(err);
                    return "";
                }
            }

            if (flowContext.projectStore.runtime) {
                return "";
            }

            if (name) {
                return name;
            }

            try {
                const result = evalConstantExpression(
                    ProjectEditor.getProject(widget),
                    data
                );
                if (typeof result.value === "string") {
                    return result.value;
                }
            } catch (err) {}

            const text = `{${data}}`;

            return {
                text,
                node: <span className="expression">{text}</span>
            };
        }

        if (flowContext.flowState) {
            return "";
        }

        if (name) {
            return name;
        }

        return "<no text>";
    }

    if (text) {
        return text;
    }

    if (name) {
        return name;
    }

    if (data) {
        const result = flowContext.dataContext.get(data);
        if (result != undefined) {
            return result;
        }
        return data;
    }

    return "<no text>";
}

////////////////////////////////////////////////////////////////////////////////

export function buildWidgetText(
    assets: Assets,
    dataBuffer: DataBuffer,
    text: string | undefined,
    defaultValue?: string
) {
    if (text == undefined) {
        text = defaultValue;
    }

    if (text != undefined) {
        try {
            text = JSON.parse('"' + text + '"');
        } catch (e) {}
    }

    if (text != undefined) {
        const writeText = text;
        dataBuffer.writeObjectOffset(() => dataBuffer.writeString(writeText));
    } else {
        dataBuffer.writeUint32(0);
    }
}

////////////////////////////////////////////////////////////////////////////////

export function getInputDisplayName(
    component: Component | undefined,
    componentInput: ComponentInput | string,
    appendType: boolean = false
): string {
    if (typeof componentInput == "string") {
        if (componentInput == "@seqin") {
            return "seqin";
        }
        if (component) {
            const input = component.inputs.find(
                input => input.name == componentInput
            );
            if (input) {
                return getInputDisplayName(component, input, appendType);
            }
        }
        return componentInput;
    } else if (componentInput.displayName) {
        if (typeof componentInput.displayName === "string") {
            return (
                componentInput.displayName +
                (appendType ? ` (${componentInput.type})` : "")
            );
        }
        if (component) {
            return (
                componentInput.displayName(component, componentInput) +
                (appendType ? ` (${componentInput.type})` : "")
            );
        }
    }
    if (componentInput.name == "@seqin") {
        return "seqin";
    }
    return (
        componentInput.name + (appendType ? ` (${componentInput.type})` : "")
    );
}

////////////////////////////////////////////////////////////////////////////////

export function getOutputDisplayName(
    component: Component | undefined,
    componentOutput: ComponentOutput | string,
    appendType: boolean = false
): string {
    if (typeof componentOutput == "string") {
        if (componentOutput == "@seqout") {
            return "seqout";
        }
        if (component) {
            const output = component.outputs.find(
                output => output.name == componentOutput
            );
            if (output) {
                return getOutputDisplayName(component, output, appendType);
            }
        }
        return componentOutput;
    } else if (componentOutput.displayName) {
        if (typeof componentOutput.displayName === "string") {
            return (
                componentOutput.displayName +
                (appendType ? ` (${componentOutput.type})` : "")
            );
        }
        if (component) {
            return (
                componentOutput.displayName(component, componentOutput) +
                (appendType ? ` (${componentOutput.type})` : "")
            );
        }
    }
    if (componentOutput.name == "@seqout") {
        return "seqout";
    }
    return (
        componentOutput.name + (appendType ? ` (${componentOutput.type})` : "")
    );
}
