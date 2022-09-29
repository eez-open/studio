import React from "react";
import type { IFlowContext } from "project-editor/flow/flow-interfaces";
import type { Widget } from "project-editor/flow/component";
import type { Assets, DataBuffer } from "project-editor/build/assets";
import { evalConstantExpression } from "project-editor/flow/expression";
import { ProjectEditor } from "project-editor/project-editor-interface";

////////////////////////////////////////////////////////////////////////////////

export function evalProperty(
    flowContext: IFlowContext,
    widget: Widget,
    propertyName: string
) {
    let expr = (widget as any)[propertyName];
    if (!expr) {
        return undefined;
    }

    if (flowContext.flowState) {
        return flowContext.projectEditorStore.runtime!.evalProperty(
            flowContext,
            widget,
            propertyName
        );
    } else {
        try {
            return evalConstantExpression(
                flowContext.projectEditorStore.project,
                expr
            ).value;
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

    return value || defaultValue;
}

export function getTextValue(
    flowContext: IFlowContext,
    widget: Widget,
    propertyName: string,
    name: string | undefined,
    text: string | undefined
): { text: string; node: React.ReactNode } | string {
    let data = (widget as any)[propertyName];

    if (flowContext.projectEditorStore.projectTypeTraits.hasFlowSupport) {
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

            if (flowContext.projectEditorStore.runtime) {
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

            return {
                text: data,
                node: <span className="expression">{data}</span>
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
