import React from "react";
import { observer } from "mobx-react";

import {
    getParent,
    getProperty,
    IEezObject,
    IMessage,
    MessageType,
    PropertyProps
} from "project-editor/core/object";
import { ProjectEditor } from "project-editor/project-editor-interface";
import {
    getAncestorOfType,
    getObjectPathAsString,
    getProjectStore,
    Message
} from "project-editor/store";
import {
    LVGLTabviewWidget,
    LVGLTabWidget,
    type LVGLWidget
} from "project-editor/lvgl/widgets";
import { ProjectContext } from "project-editor/project/context";
import { humanize } from "eez-studio-shared/string";
import { Checkbox } from "project-editor/ui-components/PropertyGrid/Checkbox";
import {
    LVGLPageEditorRuntime,
    type LVGLPageRuntime
} from "project-editor/lvgl/page-runtime";
import { evalConstantExpression } from "project-editor/flow/expression";
import {
    LVGL_FLAG_CODES,
    LVGL_REACTIVE_FLAGS,
    LVGL_REACTIVE_STATES,
    LVGL_STATE_CODES
} from "project-editor/lvgl/lvgl-constants";
import { getLvglFlagCodes } from "./lvgl-versions";

////////////////////////////////////////////////////////////////////////////////

export const LVGLWidgetFlagsProperty = observer(
    class LVGLWidgetFlagsProperty extends React.Component<PropertyProps> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        render() {
            const flagNames: (keyof typeof LVGL_FLAG_CODES)[] = [];

            this.props.objects.map((widget: LVGLWidget) => {
                const flags = Object.keys(
                    getLvglFlagCodes(widget)
                ) as (keyof typeof LVGL_FLAG_CODES)[];
                for (const flagName of flags) {
                    if (
                        flagNames.indexOf(flagName) == -1 &&
                        LVGL_REACTIVE_FLAGS.indexOf(flagName) == -1
                    ) {
                        flagNames.push(flagName);
                    }
                }
            });

            return (
                <div>
                    {flagNames.map(flagName => {
                        let values = this.props.objects.map(
                            (widget: LVGLWidget) =>
                                (widget.widgetFlags || "")
                                    .split("|")
                                    .indexOf(flagName) != -1
                        );

                        let numEnabled = 0;
                        let numDisabled = 0;
                        values.forEach(value => {
                            if (value) {
                                numEnabled++;
                            } else {
                                numDisabled++;
                            }
                        });

                        let state =
                            numEnabled == 0
                                ? false
                                : numDisabled == 0
                                ? true
                                : undefined;

                        return (
                            <Checkbox
                                key={flagName}
                                state={state}
                                label={humanize(flagName)}
                                onChange={(value: boolean) => {
                                    this.context.undoManager.setCombineCommands(
                                        true
                                    );

                                    if (value) {
                                        this.props.objects.forEach(
                                            (widget: LVGLWidget) => {
                                                const flags = Object.keys(
                                                    getLvglFlagCodes(widget)
                                                ) as (keyof typeof LVGL_FLAG_CODES)[];

                                                if (
                                                    flags.indexOf(flagName) ==
                                                    -1
                                                ) {
                                                    return;
                                                }

                                                const flagsArr =
                                                    widget.widgetFlags.trim() !=
                                                    ""
                                                        ? widget.widgetFlags.split(
                                                              "|"
                                                          )
                                                        : [];
                                                if (
                                                    flagsArr.indexOf(
                                                        flagName
                                                    ) == -1
                                                ) {
                                                    flagsArr.push(flagName);
                                                    this.context.updateObject(
                                                        widget,
                                                        {
                                                            widgetFlags:
                                                                flagsArr.join(
                                                                    "|"
                                                                )
                                                        }
                                                    );
                                                }
                                            }
                                        );
                                    } else {
                                        this.props.objects.forEach(
                                            (widget: LVGLWidget) => {
                                                const flags = Object.keys(
                                                    getLvglFlagCodes(widget)
                                                ) as (keyof typeof LVGL_FLAG_CODES)[];

                                                if (
                                                    flags.indexOf(flagName) ==
                                                    -1
                                                ) {
                                                    return;
                                                }

                                                const flagsArr = (
                                                    widget.widgetFlags || ""
                                                ).split("|");
                                                const i =
                                                    flagsArr.indexOf(flagName);
                                                if (i != -1) {
                                                    flagsArr.splice(i, 1);
                                                    this.context.updateObject(
                                                        widget,
                                                        {
                                                            widgetFlags:
                                                                flagsArr.join(
                                                                    "|"
                                                                )
                                                        }
                                                    );
                                                }
                                            }
                                        );
                                    }

                                    this.context.undoManager.setCombineCommands(
                                        false
                                    );
                                }}
                                readOnly={this.props.readOnly}
                            />
                        );
                    })}
                </div>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

export const LVGLWidgetStatesProperty = observer(
    class LVGLWidgetStatesProperty extends React.Component<PropertyProps> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        render() {
            const stateNames: (keyof typeof LVGL_STATE_CODES)[] = [];

            this.props.objects.map((widget: LVGLWidget) => {
                for (const stateName of Object.keys(
                    LVGL_STATE_CODES
                ) as (keyof typeof LVGL_STATE_CODES)[]) {
                    if (
                        stateNames.indexOf(stateName) == -1 &&
                        LVGL_REACTIVE_STATES.indexOf(stateName) == -1
                    ) {
                        stateNames.push(stateName);
                    }
                }
            });

            return (
                <div>
                    {stateNames.map(stateName => {
                        let values = this.props.objects.map(
                            (widget: LVGLWidget) =>
                                (widget.states || "")
                                    .split("|")
                                    .indexOf(stateName) != -1
                        );

                        let numEnabled = 0;
                        let numDisabled = 0;
                        values.forEach(value => {
                            if (value) {
                                numEnabled++;
                            } else {
                                numDisabled++;
                            }
                        });

                        let state =
                            numEnabled == 0
                                ? false
                                : numDisabled == 0
                                ? true
                                : undefined;

                        return (
                            <Checkbox
                                key={stateName}
                                state={state}
                                label={humanize(stateName)}
                                onChange={(value: boolean) => {
                                    this.context.undoManager.setCombineCommands(
                                        true
                                    );

                                    if (value) {
                                        this.props.objects.forEach(
                                            (widget: LVGLWidget) => {
                                                const statesArr =
                                                    widget.states.trim() != ""
                                                        ? widget.states.split(
                                                              "|"
                                                          )
                                                        : [];
                                                if (
                                                    statesArr.indexOf(
                                                        stateName
                                                    ) == -1
                                                ) {
                                                    statesArr.push(stateName);
                                                    this.context.updateObject(
                                                        widget,
                                                        {
                                                            states: statesArr.join(
                                                                "|"
                                                            )
                                                        }
                                                    );
                                                }
                                            }
                                        );
                                    } else {
                                        this.props.objects.forEach(
                                            (widget: LVGLWidget) => {
                                                const statesArr = (
                                                    widget.states || ""
                                                ).split("|");
                                                const i =
                                                    statesArr.indexOf(
                                                        stateName
                                                    );
                                                if (i != -1) {
                                                    statesArr.splice(i, 1);
                                                    this.context.updateObject(
                                                        widget,
                                                        {
                                                            states: statesArr.join(
                                                                "|"
                                                            )
                                                        }
                                                    );
                                                }
                                            }
                                        );
                                    }

                                    this.context.undoManager.setCombineCommands(
                                        false
                                    );
                                }}
                                readOnly={this.props.readOnly}
                            />
                        );
                    })}
                </div>
            );
        }
    }
);

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
    propertyName: string
) {
    if (runtime instanceof LVGLPageEditorRuntime) {
        const expr = getProperty(widget, propertyName);
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
    if (parentWidget instanceof LVGLTabviewWidget) {
        return parentWidget;
    }
    return undefined;
}

export function isGeometryControlledByTabview(widget: LVGLWidget) {
    if (getTabview(widget) || widget instanceof LVGLTabWidget) {
        return true;
    }
    return false;
}
