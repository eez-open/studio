import {
    getParent,
    getProperty,
    IEezObject,
    IMessage,
    MessageType
} from "project-editor/core/object";
import { ProjectEditor } from "project-editor/project-editor-interface";
import {
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

    const page = ProjectEditor.getPage(widget);
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
            (i + 1 == unescaped.length ||
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

export function checkWidgetTypeLvglVersion(
    widget: IEezObject,
    messages: IMessage[],
    lvglVersion: string
) {
    const projectStore = getProjectStore(widget);
    if (!projectStore.project.settings.general.lvglVersion.startsWith(lvglVersion)) {
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

// A Button, Label or Dropdown widget placed as a direct child of a Calendar
// widget, at the right position for the calendar's header type, is
// interpreted as a hook into one of the (otherwise inaccessible) objects
// LVGL creates internally for the calendar's header, mirroring how a
// Container placed as a direct child of a Dropdown hooks into its List (see
// getDropdown above). Each widget file (Button.tsx, Label.tsx, Dropdown.tsx)
// checks this together with its own position, since the widget type expected
// at each position is fixed:
//
// Arrow header (lv_calendar_add_header_arrow), children of the header object:
//   0 - Button ("Previous Button"), 1 - Label ("Text", the year/month
//   label), 2 - Button ("Next Button")
// Dropdown header (lv_calendar_add_header_dropdown), children of the header
// object:
//   0 - Dropdown ("Year Dropdown"), 1 - Dropdown ("Month Dropdown")
//
// A mismatched widget type at a valid position (e.g. a Label where a Button
// is expected) is simply not recognized here, and behaves like any other
// ordinary, unhooked child.
export function getCalendarHeaderChild(widget: LVGLWidget) {
    const parentChildren = getParent(widget) as LVGLWidget[];
    const parentWidget = getParent(parentChildren);
    if (!(parentWidget instanceof ProjectEditor.LVGLCalendarWidgetClass)) {
        return undefined;
    }

    const index = parentChildren.indexOf(widget);

    if (
        parentWidget.header == "Arrow" &&
        (index == 0 || index == 1 || index == 2)
    ) {
        return { calendar: parentWidget, index };
    }

    if (
        parentWidget.header == "Dropdown" &&
        (index == 0 || index == 1)
    ) {
        return { calendar: parentWidget, index };
    }

    return undefined;
}

export const CALENDAR_HEADER_CHILD_LABELS: { [header: string]: string[] } = {
    Arrow: ["Previous Button", "Text", "Next Button"],
    Dropdown: ["Year Dropdown", "Month Dropdown"]
};

export function isGeometryControlledByParent(widget: LVGLWidget) {
    if (
        getDropdown(widget) ||
        getTabview(widget) ||
        widget instanceof ProjectEditor.LVGLTabWidgetClass ||
        getCalendarHeaderChild(widget)
    ) {
        return true;
    }
    return false;
}
