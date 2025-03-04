import {
    getParent,
    getProperty,
    IEezObject,
    IMessage,
    MessageType
} from "project-editor/core/object";
import { ProjectEditor } from "project-editor/project-editor-interface";
import {
    getAncestorOfType,
    getObjectPathAsString,
    getProjectStore,
    Message
} from "project-editor/store";
import type { LVGLWidget } from "project-editor/lvgl/widgets";
import type { LVGLPageRuntime } from "project-editor/lvgl/page-runtime";
import { evalConstantExpression } from "project-editor/flow/expression";

export function getCode<T extends string>(
    arr: T[],
    keyToCode: { [key in T]: number }
) {
    return arr.reduce((code, el) => code | keyToCode[el], 0) >>> 0;
}

export function getExpressionPropertyData(
    runtime: LVGLPageRuntime,
    widget: LVGLWidget,
    propertyName: string
) {
    if (!runtime.wasm.assetsMap) {
        return undefined;
    }

    const propertyType = getProperty(widget, propertyName + "Type");

    const isExpr =
        propertyType !== "literal" && propertyType !== "translated-literal";

    if (!isExpr) {
        return undefined;
    }

    const page = getAncestorOfType(widget, ProjectEditor.PageClass.classInfo)!;
    const pagePath = getObjectPathAsString(page);
    const flowIndex = runtime.wasm.assetsMap.flowIndexes[pagePath];
    if (flowIndex == undefined) {
        return undefined;
    }
    const flow = runtime.wasm.assetsMap.flows[flowIndex];
    const componentPath = getObjectPathAsString(widget);
    const componentIndex = flow.componentIndexes[componentPath];
    if (componentIndex == undefined) {
        return undefined;
    }

    const component = flow.components[componentIndex];
    const propertyIndex = component.propertyIndexes[propertyName];
    if (propertyIndex == undefined) {
        return undefined;
    }

    return { componentIndex, propertyIndex };
}

export function getExpressionPropertyInitalValue(
    runtime: LVGLPageRuntime,
    widget: LVGLWidget,
    expr: string
) {
    if (runtime instanceof ProjectEditor.LVGLPageEditorRuntimeClass) {
        try {
            const result = evalConstantExpression(
                ProjectEditor.getProject(widget),
                expr
            );
            if (result) {
                return result.value.toString();
            }
        } catch (e) {}
        return `{${expr}}`;
    } else {
        return "";
    }
}

export function escapeCString(unescaped: string) {
    let result = '"';

    for (let i = 0; i < unescaped.length; i++) {
        const ch = unescaped[i];
        if (ch == '"') {
            result += '\\"';
        } else if (ch == "\n") {
            result += "\\n";
        } else if (ch == "\r") {
            result += "\\r";
        } else if (ch == "\t") {
            result += "\\t";
        } else if (
            ch == "\\" &&
            (i == unescaped.length - 1 ||
                (unescaped[i + 1] != "n" &&
                    unescaped[i + 1] != "r" &&
                    unescaped[i + 1] != "t" &&
                    unescaped[i + 1] != "u"))
        ) {
            result += "\\\\";
        } else {
            result += ch;
        }
    }

    result += '"';

    return result;
}

export function unescapeCString(escaped: string) {
    let result = "";

    for (let i = 0; i < escaped.length; i++) {
        if (escaped[i] == "\\") {
            if (i + 1 < escaped.length) {
                if (escaped[i + 1] == "n") {
                    result += "\n";
                    i += 1;
                    continue;
                }

                if (escaped[i + 1] == "r") {
                    result += "\r";
                    i += 1;
                    continue;
                }

                if (escaped[i + 1] == "t") {
                    result += "\t";
                    i += 1;
                    continue;
                }

                if (escaped[i + 1] == "u" && i + 5 < escaped.length) {
                    result += String.fromCharCode(
                        parseInt(escaped.substring(i + 2, i + 6), 16)
                    );
                    i += 5;
                    continue;
                }
            }
        }

        result += escaped[i];
    }

    return result;
}

export function getFlowStateAddressIndex(runtime: LVGLPageRuntime) {
    return runtime.lvglCreateContext.flowState;
}

export function lvglAddObjectFlowCallback(
    runtime: LVGLPageRuntime,
    obj: number,
    filter: number,
    component_index: number,
    output_or_property_index: number,
    userDataValuePtr: number
) {
    runtime.wasm._lvglAddObjectFlowCallback(
        obj,
        filter,
        getFlowStateAddressIndex(runtime),
        component_index,
        output_or_property_index,
        userDataValuePtr
    );
}

export function checkWidgetTypeLvglVersion(
    widget: IEezObject,
    messages: IMessage[],
    lvglVersion: string
) {
    const projectStore = getProjectStore(widget);
    if (projectStore.project.settings.general.lvglVersion != lvglVersion) {
        messages.push(
            new Message(
                MessageType.ERROR,
                `This widget type is not supported in LVGL ${projectStore.project.settings.general.lvglVersion}`,
                widget
            )
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

export function getTabview(widget: LVGLWidget) {
    const parentChildren = getParent(widget) as LVGLWidget[];
    const parentWidget = getParent(parentChildren);
    if (parentWidget instanceof ProjectEditor.LVGLTabviewWidgetClass) {
        return parentWidget;
    }
    return undefined;
}

export function getDropdown(widget: LVGLWidget) {
    const parentChildren = getParent(widget) as LVGLWidget[];
    const parentWidget = getParent(parentChildren);
    if (parentWidget instanceof ProjectEditor.LVGLDropdownWidgetClass) {
        return parentWidget;
    }
    return undefined;
}

export function isGeometryControlledByParent(widget: LVGLWidget) {
    if (
        getDropdown(widget) ||
        getTabview(widget) ||
        widget instanceof ProjectEditor.LVGLTabWidgetClass
    ) {
        return true;
    }
    return false;
}
