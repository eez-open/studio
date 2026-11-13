// The widgets of the eez-gui-lite projects: Text, Button, Rectangle, Switch,
// Container and Select, the widgets eez-gui-lite draws (eez-gui-lite.h). Copies
// of the EEZ-GUI widgets (flow/components/widgets) with only the properties
// eez-gui-lite uses, so the EEZ-GUI widgets can change without changing
// eez-gui-lite. An eez-gui-lite project loads the EEZ-GUI widget types as these
// widgets (see getLiteWidgetType in flow/component.tsx).

import React from "react";
import { makeObservable, observable } from "mobx";
import classNames from "classnames";

import {
    getParent,
    IEezObject,
    IMessage,
    isAncestor,
    makeDerivedClassInfo,
    MessageType,
    PropertyInfo,
    PropertyType,
    registerClass
} from "project-editor/core/object";
import {
    Message,
    propertyNotSetMessage,
    propertySetButNotUsedMessage,
    type ProjectStore
} from "project-editor/store";
import {
    findVariable,
    getProject,
    Project,
    ProjectType
} from "project-editor/project/project";
import { isProjectWithFlowSupport } from "project-editor/project/project-type-traits";
import type { IFlowContext } from "project-editor/flow/flow-interfaces";
import {
    makeDataPropertyInfo,
    makeStylePropertyInfo,
    makeTextPropertyInfo,
    migrateStyleProperty,
    Widget
} from "project-editor/flow/component";
import { ComponentsContainerEnclosure } from "project-editor/flow/editor/render";
import { evalProperty } from "project-editor/flow/helper";
import {
    WIDGET_TYPE_BUTTON,
    WIDGET_TYPE_CONTAINER,
    WIDGET_TYPE_RECTANGLE,
    WIDGET_TYPE_SELECT,
    WIDGET_TYPE_SWITCH,
    WIDGET_TYPE_TEXT
} from "project-editor/flow/components/component-types";
import { getComponentName } from "project-editor/flow/components/components-registry";
import {
    getEnumTypeNameFromVariable,
    isEnumVariable
} from "project-editor/features/variable/value-type";
import { generalGroup } from "project-editor/ui-components/PropertyGrid/groups";
import { SWITCH_WIDGET_ICON } from "project-editor/ui-components/icons";

import { LiteStyle } from "project-editor/eez-gui-lite/style";

////////////////////////////////////////////////////////////////////////////////

function makeLiteStylePropertyInfo(
    name: string,
    displayName?: string
): PropertyInfo {
    return Object.assign(makeStylePropertyInfo(name, displayName), {
        typeClass: LiteStyle,
        // no page layouts in eez-gui-lite projects
        layoutSpecific: false
    });
}

const enabledInComponentPalette = (projectType: ProjectType) =>
    projectType == ProjectType.EEZ_GUI_LITE;

// "data" from "text" (the static text) in the projects with flow support
function migrateTextToData(jsObject: any, project: Project) {
    if (jsObject.text && project.projectTypeTraits.hasFlowSupport) {
        if (!jsObject.data) {
            jsObject.data = `"${jsObject.text}"`;
        }
        delete jsObject.text;
    }
}

// The styles of the eez-gui-lite widgets are no EEZ-GUI styles: no CSS class
// names, conditional styles and dynamic CSS (see Widget.getClassName).
export class LiteWidget extends Widget {
    get liteStyle() {
        return this.style as unknown as LiteStyle;
    }

    getClassName(flowContext: IFlowContext) {
        return classNames("eez-widget", this.type);
    }
}

////////////////////////////////////////////////////////////////////////////////

export class TextLiteWidget extends LiteWidget {
    name: string;
    text?: string;

    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        enabledInComponentPalette,

        flowComponentId: WIDGET_TYPE_TEXT,

        label: (widget: TextLiteWidget) => {
            let name = getComponentName(widget.type);

            const project = getProject(widget);

            if (!project.projectTypeTraits.hasFlowSupport) {
                if (widget.text) {
                    return `${name}: ${widget.text}`;
                }
            }

            if (widget.name) {
                return `${name}: ${widget.name}`;
            }

            if (widget.data) {
                return `${name}: ${widget.data}`;
            }

            return name;
        },

        properties: [
            {
                name: "name",
                type: PropertyType.String,
                propertyGridGroup: generalGroup
            },
            makeDataPropertyInfo("data", {
                displayName: (widget: TextLiteWidget) =>
                    getProject(widget).projectTypeTraits
                        .hasFlowSupport
                        ? "Text"
                        : "Data"
            }),
            makeTextPropertyInfo("text", {
                displayName: "Static text",
                disabled: isProjectWithFlowSupport
            }),
            makeLiteStylePropertyInfo("style", "Default style")
        ],

        beforeLoadHook: (widget: Widget, jsObject: any, project: Project) => {
            migrateTextToData(jsObject, project);
        },

        defaultValue: {
            left: 0,
            top: 0,
            width: 64,
            height: 32
        },

        icon: (
            <svg
                strokeWidth="2"
                stroke="currentColor"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                viewBox="0 0 24 24"
            >
                <path d="M0 0h24v24H0z" stroke="none" />
                <circle cx="17.5" cy="15.5" r="3.5" />
                <path d="M3 19V8.5a3.5 3.5 0 0 1 7 0V19m-7-6h7m11-1v7" />
            </svg>
        ),

        check: (widget: TextLiteWidget, messages: IMessage[]) => {
            const project = getProject(widget);

            if (!project.projectTypeTraits.hasFlowSupport) {
                if (!widget.text && !widget.data) {
                    messages.push(propertyNotSetMessage(widget, "text"));
                }
            } else {
                if (!widget.data) {
                    messages.push(propertyNotSetMessage(widget, "data"));
                }
            }
        }
    });

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            name: observable,
            text: observable
        });
    }
}

registerClass("TextLiteWidget", TextLiteWidget);

////////////////////////////////////////////////////////////////////////////////

export class ButtonLiteWidget extends LiteWidget {
    text?: string;
    enabled?: string;
    disabledStyle: LiteStyle;

    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        enabledInComponentPalette,

        flowComponentId: WIDGET_TYPE_BUTTON,

        properties: [
            makeDataPropertyInfo("data", {
                displayName: (widget: ButtonLiteWidget) =>
                    getProject(widget).projectTypeTraits
                        .hasFlowSupport
                        ? "Label"
                        : "Data"
            }),
            makeTextPropertyInfo("text", {
                disabled: isProjectWithFlowSupport
            }),
            makeDataPropertyInfo("enabled"),
            makeLiteStylePropertyInfo("style", "Default style"),
            makeLiteStylePropertyInfo("disabledStyle")
        ],

        beforeLoadHook: (
            widget: IEezObject,
            jsObject: any,
            project: Project
        ) => {
            migrateTextToData(jsObject, project);
            migrateStyleProperty(jsObject, "disabledStyle");
        },

        defaultValue: {
            left: 0,
            top: 0,
            width: 80,
            height: 40,
            data: `"Button"`,
            eventHandlers: [
                {
                    eventName: "CLICKED",
                    handlerType: "flow"
                }
            ]
        },

        componentDefaultValue: (projectStore: ProjectStore) => ({
            style: {
                useStyle: "button"
            },
            disabledStyle: {
                useStyle: "button_disabled"
            }
        }),

        icon: (
            <svg viewBox="0 0 16 16">
                <path
                    fill="currentColor"
                    d="m15.7 5.3-1-1c-.2-.2-.4-.3-.7-.3H1c-.6 0-1 .4-1 1v5c0 .3.1.6.3.7l1 1c.2.2.4.3.7.3h13c.6 0 1-.4 1-1V6c0-.3-.1-.5-.3-.7zM14 10H1V5h13v5z"
                />
            </svg>
        ),

        check: (widget: ButtonLiteWidget, messages: IMessage[]) => {
            const project = getProject(widget);

            if (!project.projectTypeTraits.hasFlowSupport) {
                if (
                    !widget.text &&
                    !widget.data &&
                    !widget.isInputProperty("data")
                ) {
                    messages.push(propertyNotSetMessage(widget, "text"));
                }
            } else {
                if (!widget.data) {
                    messages.push(propertyNotSetMessage(widget, "text"));
                }
            }
        }
    });

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            text: observable,
            enabled: observable,
            disabledStyle: observable
        });
    }
}

registerClass("ButtonLiteWidget", ButtonLiteWidget);

////////////////////////////////////////////////////////////////////////////////

export class RectangleLiteWidget extends LiteWidget {
    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        enabledInComponentPalette,

        flowComponentId: WIDGET_TYPE_RECTANGLE,

        properties: [makeLiteStylePropertyInfo("style", "Default style")],

        defaultValue: {
            left: 0,
            top: 0,
            width: 64,
            height: 32
        },

        icon: (
            <svg
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                <rect x="3" y="5" width="18" height="14" rx="2"></rect>
            </svg>
        ),

        check: (object: RectangleLiteWidget, messages: IMessage[]) => {
            if (object.data) {
                messages.push(propertySetButNotUsedMessage(object, "data"));
            }
        }
    });
}

registerClass("RectangleLiteWidget", RectangleLiteWidget);

////////////////////////////////////////////////////////////////////////////////

export class SwitchLiteWidget extends LiteWidget {
    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        enabledInComponentPalette,

        componentPaletteGroupName: "!1Input",

        flowComponentId: WIDGET_TYPE_SWITCH,

        properties: [
            makeDataPropertyInfo("data", {}, "boolean"),
            makeLiteStylePropertyInfo("style", "Default style")
        ],

        defaultValue: {
            left: 0,
            top: 0,
            width: 64,
            height: 32
        },

        componentDefaultValue: (projectStore: ProjectStore) => ({
            style: {
                useStyle: "switch"
            }
        }),

        icon: SWITCH_WIDGET_ICON
    });
}

registerClass("SwitchLiteWidget", SwitchLiteWidget);

////////////////////////////////////////////////////////////////////////////////

export class ContainerLiteWidget extends LiteWidget {
    name?: string;
    widgets: Widget[];

    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        enabledInComponentPalette,

        componentPaletteGroupName: "!1Containers",

        flowComponentId: WIDGET_TYPE_CONTAINER,

        label: (widget: ContainerLiteWidget) => {
            if (widget.name) {
                return widget.name;
            }
            return getComponentName(widget.type);
        },

        properties: [
            {
                name: "name",
                type: PropertyType.String,
                propertyGridGroup: generalGroup
            },
            {
                name: "widgets",
                type: PropertyType.Array,
                typeClass: Widget,
                hideInPropertyGrid: true
            },
            makeDataPropertyInfo("data", {
                hideInPropertyGrid: true,
                hideInDocumentation: "all"
            }),
            makeLiteStylePropertyInfo("style", "Default style")
        ],

        defaultValue: {
            style: {
                useStyle: "default"
            },
            widgets: [],
            left: 0,
            top: 0,
            width: 64,
            height: 32
        },

        icon: (
            <svg
                strokeWidth="2"
                stroke="currentColor"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                viewBox="0 0 24 24"
            >
                <path d="M0 0h24v24H0z" stroke="none" />
                <rect x="4" y="4" width="16" height="16" rx="2" />
                <path d="M4 12h8m0 3h8m-8-6h8m-8-5v16" />
            </svg>
        )
    });

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            name: observable,
            widgets: observable
        });
    }

    override render(
        flowContext: IFlowContext,
        containerWidth: number,
        containerHeight: number
    ): React.ReactNode {
        return (
            <>
                <ComponentsContainerEnclosure
                    parent={this}
                    components={this.widgets}
                    flowContext={flowContext}
                    width={containerWidth}
                    height={containerHeight}
                />
                {super.render(flowContext, containerWidth, containerHeight)}
            </>
        );
    }
}

registerClass("ContainerLiteWidget", ContainerLiteWidget);

////////////////////////////////////////////////////////////////////////////////

// the members of the enum variable or "0" and "1" for a boolean variable
function getSelectItems(selectWidget: SelectLiteWidget) {
    if (!selectWidget.data) {
        return undefined;
    }

    const project = getProject(selectWidget);

    const variable = findVariable(project, selectWidget.data);
    if (!variable) {
        return undefined;
    }

    if (isEnumVariable(variable)) {
        const enumName = getEnumTypeNameFromVariable(variable);
        return enumName
            ? project.variables.enumsMap
                  .get(enumName)
                  ?.members.map(member => member.name) ?? []
            : [];
    }

    if (variable.type == "boolean") {
        return ["0", "1"];
    }

    return undefined;
}

function htmlEncode(value: string) {
    const el = document.createElement("div");
    el.innerText = value;
    return el.innerHTML;
}

export class SelectLiteWidget extends LiteWidget {
    widgets: Widget[];

    _lastSelectedIndexInSelectWidget: number | undefined;

    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        enabledInComponentPalette,

        componentPaletteGroupName: "!1Containers",

        flowComponentId: WIDGET_TYPE_SELECT,

        properties: [
            {
                name: "widgets",
                type: PropertyType.Array,
                typeClass: Widget,
                hideInPropertyGrid: true,
                childLabel: (childObject: IEezObject, childLabel: string) => {
                    let label;

                    if (getParent(childObject)) {
                        const selectWidget = getParent(
                            getParent(childObject)
                        ) as SelectLiteWidget;

                        label = selectWidget.getChildLabel(
                            childObject as Widget
                        );
                    }

                    if (!label) {
                        label = (getParent(childObject) as IEezObject[])
                            .indexOf(childObject)
                            .toString();
                    }

                    return `${label} ➔ ${childLabel}`;
                },

                interceptAddObject: (widgets: Widget[], object: Widget) => {
                    object.left = 0;
                    object.top = 0;
                    object.width = (
                        getParent(widgets) as SelectLiteWidget
                    ).width;
                    object.height = (
                        getParent(widgets) as SelectLiteWidget
                    ).height;
                    return object;
                }
            },
            makeLiteStylePropertyInfo("style", "Default style"),
            makeDataPropertyInfo("data", {}, "boolean")
        ],

        defaultValue: {
            widgets: [],
            left: 0,
            top: 0,
            width: 64,
            height: 32
        },

        icon: (
            <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
            >
                <path fill="none" d="M0 0h24v24H0z" />
                <path d="M10 2c.552 0 1 .448 1 1v4c0 .552-.448 1-1 1H8v2h5V9c0-.552.448-1 1-1h6c.552 0 1 .448 1 1v4c0 .552-.448 1-1 1h-6c-.552 0-1-.448-1-1v-1H8v6h5v-1c0-.552.448-1 1-1h6c.552 0 1 .448 1 1v4c0 .552-.448 1-1 1h-6c-.552 0-1-.448-1-1v-1H7c-.552 0-1-.448-1-1V8H4c-.552 0-1-.448-1-1V3c0-.552.448-1 1-1h6zm9 16h-4v2h4v-2zm0-8h-4v2h4v-2zM9 4H5v2h4V4z" />
            </svg>
        ),

        check: (object: SelectLiteWidget, messages: IMessage[]) => {
            if (!object.data) {
                messages.push(propertyNotSetMessage(object, "data"));
            } else {
                const variable = findVariable(getProject(object), object.data);
                if (variable && variable.type != "integer") {
                    const items = getSelectItems(object) ?? [];
                    if (items.length > object.widgets.length) {
                        messages.push(
                            new Message(
                                MessageType.ERROR,
                                "Some select children are missing",
                                object
                            )
                        );
                    } else if (items.length < object.widgets.length) {
                        messages.push(
                            new Message(
                                MessageType.ERROR,
                                "Too many select children defined",
                                object
                            )
                        );
                    }
                }
            }

            object.widgets.forEach(childObject => {
                if (childObject.width != object.width) {
                    messages.push(
                        new Message(
                            MessageType.WARNING,
                            "Child of Select widget has different width",
                            childObject
                        )
                    );
                }

                if (childObject.height != object.height) {
                    messages.push(
                        new Message(
                            MessageType.WARNING,
                            "Child of Select widget has different height",
                            childObject
                        )
                    );
                }
            });
        }
    });

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            widgets: observable
        });
    }

    getChildLabel(childObject: Widget) {
        const index = this.widgets ? this.widgets.indexOf(childObject) : -1;
        if (index == -1) {
            return undefined;
        }

        const items = getSelectItems(this);
        if (items && index < items.length) {
            return htmlEncode(items[index]);
        }

        return undefined;
    }

    // the child shown in the editor: the one with the selected object, or the
    // one shown before, or the one the data selects
    getSelectedIndex(flowContext: IFlowContext) {
        let index: number;

        if (flowContext.flowState) {
            try {
                index = evalProperty(flowContext, this, "data");

                if (typeof index === "number") {
                    // pass
                } else if (typeof index === "boolean") {
                    index = index ? 1 : 0;
                } else {
                    index = -1;
                }

                return index;
            } catch (err) {
                return -1;
            }
        }

        const selectedObjects = flowContext.viewState.selectedObjects;

        for (let i = 0; i < this.widgets.length; ++i) {
            if (
                selectedObjects.find(selectedObject =>
                    isAncestor(selectedObject.object, this.widgets[i])
                )
            ) {
                this._lastSelectedIndexInSelectWidget = i;
                return i;
            }
        }

        if (
            this._lastSelectedIndexInSelectWidget !== undefined &&
            this._lastSelectedIndexInSelectWidget < this.widgets.length
        ) {
            return this._lastSelectedIndexInSelectWidget;
        }

        try {
            index = evalProperty(flowContext, this, "data");

            if (typeof index === "number") {
                // pass
            } else if (typeof index === "boolean") {
                index = index ? 1 : 0;
            } else {
                index = 0;
            }

            return index;
        } catch (err) {}

        if (this.widgets.length > 0) {
            this._lastSelectedIndexInSelectWidget = 0;
            return 0;
        }

        return -1;
    }

    override render(flowContext: IFlowContext, width: number, height: number) {
        const index = this.getSelectedIndex(flowContext);

        const selectedWidget =
            index >= 0 && index < this.widgets.length
                ? this.widgets[index]
                : null;

        return (
            <>
                <ComponentsContainerEnclosure
                    parent={this}
                    components={this.widgets}
                    flowContext={flowContext}
                    visibleComponent={selectedWidget}
                    width={width}
                    height={height}
                />
                {super.render(flowContext, width, height)}
            </>
        );
    }
}

registerClass("SelectLiteWidget", SelectLiteWidget);
