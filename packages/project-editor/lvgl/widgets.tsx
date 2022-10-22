import React from "react";
import { observable, makeObservable, runInAction, computed } from "mobx";
import { observer } from "mobx-react";

import { _find, _range } from "eez-studio-shared/algorithm";

import {
    registerClass,
    PropertyType,
    makeDerivedClassInfo,
    IPropertyGridGroupDefinition,
    PropertyProps,
    LVGL_FLAG_CODES,
    LVGL_STATE_CODES,
    findPropertyByNameInClassInfo,
    EezObject,
    ClassInfo,
    getParent,
    FlowPropertyType,
    IEezObject,
    PropertyInfo,
    IOnSelectParams
} from "project-editor/core/object";
import {
    createObject,
    getAncestorOfType,
    getClassInfo,
    getObjectPathAsString,
    Message,
    propertyNotFoundMessage,
    propertyNotSetMessage
} from "project-editor/store";

import { ProjectType } from "project-editor/project/project";

import type { IFlowContext } from "project-editor/flow/flow-interfaces";

import {
    AutoSize,
    ComponentOutput,
    isTimelineEditorActive,
    isTimelineEditorActiveOrActionComponent,
    Widget
} from "project-editor/flow/component";

import { escapeCString } from "project-editor/build/helper";
import { LVGLParts, LVGLStylesDefinition } from "project-editor/lvgl/style";
import {
    LVGLStylesDefinitionProperty,
    Checkbox
} from "project-editor/lvgl/LVGLStylesDefinitionProperty";
import type { LVGLCreateResultType } from "project-editor/lvgl/LVGLStylesDefinitionProperty";
import { LVGLPageRuntime } from "project-editor/lvgl/page-runtime";
import { getComponentName } from "project-editor/flow/editor/ComponentsPalette";
import { ProjectEditor } from "project-editor/project-editor-interface";
import { ProjectContext } from "project-editor/project/context";
import { humanize } from "eez-studio-shared/string";
import type { Page } from "project-editor/features/page/page";
import { ComponentsContainerEnclosure } from "project-editor/flow/editor/render";
import { geometryGroup } from "project-editor/ui-components/PropertyGrid/groups";
import { Property } from "project-editor/ui-components/PropertyGrid/Property";
import type { LVGLBuild } from "project-editor/lvgl/build";
import { showGenericDialog } from "eez-studio-ui/generic-dialog";
import { ValueType } from "project-editor/features/variable/value-type";
import { expressionBuilder } from "project-editor/flow/expression/ExpressionBuilder";

////////////////////////////////////////////////////////////////////////////////

const _LV_COORD_TYPE_SHIFT = 13;
const _LV_COORD_TYPE_SPEC = 1 << _LV_COORD_TYPE_SHIFT;
function LV_COORD_SET_SPEC(x: number) {
    return x | _LV_COORD_TYPE_SPEC;
}

function LV_PCT(x: number) {
    return x < 0 ? LV_COORD_SET_SPEC(1000 - x) : LV_COORD_SET_SPEC(x);
}

const LV_SIZE_CONTENT = LV_COORD_SET_SPEC(2001);

////////////////////////////////////////////////////////////////////////////////

const generalGroup: IPropertyGridGroupDefinition = {
    id: "lvgl-general",
    title: "General",
    position: 0
};

const SPECIFIC_GROUP_POSITION = 1;

const flagsGroup: IPropertyGridGroupDefinition = {
    id: "lvgl-flags",
    title: "Flags",
    position: 4
};

const styleGroup: IPropertyGridGroupDefinition = {
    id: "lvgl-style",
    title: "Style",
    position: 3
};

const statesGroup: IPropertyGridGroupDefinition = {
    id: "lvgl-states",
    title: "States",
    position: 4
};

const eventsGroup: IPropertyGridGroupDefinition = {
    id: "lvgl-events",
    title: "Events",
    position: 4
};

////////////////////////////////////////////////////////////////////////////////

export const LVGLWidgetFlagsProperty = observer(
    class LVGLWidgetFlagsProperty extends React.Component<PropertyProps> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        render() {
            const flagNames: (keyof typeof LVGL_FLAG_CODES)[] = [];

            this.props.objects.map((widget: LVGLWidget) => {
                const classInfo = getClassInfo(widget);
                for (const flagName of classInfo.lvgl!.flags) {
                    if (flagNames.indexOf(flagName) == -1) {
                        flagNames.push(flagName);
                    }
                }
            });

            return (
                <div>
                    {flagNames.map(flagName => {
                        let values = this.props.objects.map(
                            (widget: LVGLWidget) =>
                                (widget.flags || "")
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
                                                const classInfo =
                                                    getClassInfo(widget);
                                                if (
                                                    classInfo.lvgl!.flags.indexOf(
                                                        flagName
                                                    ) == -1
                                                ) {
                                                    return;
                                                }

                                                const flagsArr = (
                                                    widget.flags || ""
                                                ).split("|");
                                                if (
                                                    flagsArr.indexOf(
                                                        flagName
                                                    ) == -1
                                                ) {
                                                    flagsArr.push(flagName);
                                                    this.context.updateObject(
                                                        widget,
                                                        {
                                                            flags: flagsArr.join(
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
                                                const classInfo =
                                                    getClassInfo(widget);
                                                if (
                                                    classInfo.lvgl!.flags.indexOf(
                                                        flagName
                                                    ) == -1
                                                ) {
                                                    return;
                                                }

                                                const flagsArr = (
                                                    widget.flags || ""
                                                ).split("|");
                                                const i =
                                                    flagsArr.indexOf(flagName);
                                                if (i != -1) {
                                                    flagsArr.splice(i, 1);
                                                    this.context.updateObject(
                                                        widget,
                                                        {
                                                            flags: flagsArr.join(
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
                const classInfo = getClassInfo(widget);
                for (const stateName of classInfo.lvgl!.states) {
                    if (stateNames.indexOf(stateName) == -1) {
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
                                                const classInfo =
                                                    getClassInfo(widget);
                                                if (
                                                    classInfo.lvgl!.states.indexOf(
                                                        stateName
                                                    ) == -1
                                                ) {
                                                    return;
                                                }

                                                const statesArr = (
                                                    widget.states || ""
                                                ).split("|");
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
                                                const classInfo =
                                                    getClassInfo(widget);
                                                if (
                                                    classInfo.lvgl!.states.indexOf(
                                                        stateName
                                                    ) == -1
                                                ) {
                                                    return;
                                                }

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

////////////////////////////////////////////////////////////////////////////////

function changes<T>(defaults: T[], arr: T[]) {
    const added: T[] = [];
    const cleared: T[] = [];

    for (const x of arr) {
        if (defaults.indexOf(x) == -1) {
            added.push(x);
        }
    }

    for (const x of defaults) {
        if (arr.indexOf(x) == -1) {
            cleared.push(x);
        }
    }

    return {
        added,
        cleared
    };
}

function getCode<T extends string>(
    arr: T[],
    keyToCode: { [key in T]: number }
) {
    return arr.reduce((code, el) => code | keyToCode[el], 0) >>> 0;
}

////////////////////////////////////////////////////////////////////////////////

export const GeometryProperty = observer(
    class GeometryProperty extends React.Component<PropertyProps> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        render() {
            const classInfo = getClassInfo(this.props.objects[0]);
            const unitPropertyInfo = findPropertyByNameInClassInfo(
                classInfo,
                this.props.propertyInfo.name + "Unit"
            );

            return (
                <div className="EezStudio_LVGLGeometryProperty">
                    <Property
                        propertyInfo={Object.assign(
                            {},
                            this.props.propertyInfo,
                            {
                                propertyGridColumnComponent: undefined
                            }
                        )}
                        objects={this.props.objects}
                        readOnly={this.props.readOnly}
                        updateObject={this.props.updateObject}
                    />

                    {unitPropertyInfo && (
                        <Property
                            propertyInfo={unitPropertyInfo}
                            objects={this.props.objects}
                            readOnly={this.props.readOnly}
                            updateObject={this.props.updateObject}
                        />
                    )}
                </div>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

const LV_EVENT_SLIDER_VALUE_CHANGED = 0x7c;
const LV_EVENT_SLIDER_VALUE_LEFT_CHANGED = 0x7d;
const LV_EVENT_CHECKED = 0x7e;
const LV_EVENT_UNCHECKED = 0x7f;

const LVGL_EVENTS = {
    PRESSED: 1,
    PRESS_LOST: 3,
    RELEASED: 8,
    CLICKED: 7,
    LONG_PRESSED: 5,
    LONG_PRESSED_REPEAT: 6,
    FOCUSED: 14,
    DEFOCUSED: 15,
    VALUE_CHANGED: 28,
    READY: 31,
    CANCEL: 32,
    SCREEN_LOADED: 39,
    SCREEN_UNLOADED: 40,
    SCREEN_LOAD_START: 38,
    SCREEN_UNLOAD_START: 37,
    CHECKED: LV_EVENT_CHECKED,
    UNCHECKED: LV_EVENT_UNCHECKED
};

export type ValuesOf<T extends any[]> = T[number];

function getTriggerEnumItems(
    eventHandlers: EventHandler[],
    eventHandler: EventHandler | undefined
) {
    const eventNames: string[] = eventHandlers
        .filter(eh => eh != eventHandler)
        .map(eventHandler => eventHandler.trigger);
    return Object.keys(LVGL_EVENTS)
        .filter(eventName => eventNames.indexOf(eventName) == -1)
        .map(eventName => ({
            id: eventName,
            label: eventName
        }));
}

export class EventHandler extends EezObject {
    trigger: keyof typeof LVGL_EVENTS;
    handlerType: "flow" | "action";
    action: string;

    constructor() {
        super();

        makeObservable(this, {
            trigger: observable,
            handlerType: observable,
            action: observable
        });
    }

    static classInfo: ClassInfo = {
        properties: [
            {
                name: "trigger",
                type: PropertyType.Enum,
                enumItems: (eventHandler: EventHandler) => {
                    const eventHandlers = getParent(
                        eventHandler
                    ) as EventHandler[];
                    return getTriggerEnumItems(eventHandlers, eventHandler);
                },
                enumDisallowUndefined: true
            },
            {
                name: "handlerType",
                type: PropertyType.Enum,
                enumItems: [
                    { id: "flow", label: "Flow" },
                    { id: "action", label: "Action" }
                ],
                enumDisallowUndefined: true
            },
            {
                name: "action",
                type: PropertyType.ObjectReference,
                referencedObjectCollectionPath: "actions",
                hideInPropertyGrid: (eventHandler: EventHandler) => {
                    return eventHandler.handlerType != "action";
                }
            }
        ],

        updateObjectValueHook: (eventHandler: EventHandler, values: any) => {
            if (
                values.trigger != undefined &&
                eventHandler.trigger != values.trigger
            ) {
                const widget = getAncestorOfType<LVGLWidget>(
                    eventHandler,
                    LVGLWidget.classInfo
                );
                if (widget) {
                    ProjectEditor.getFlow(widget).rerouteConnectionLinesOutput(
                        widget,
                        eventHandler.trigger,
                        values.trigger
                    );
                }
            }
        },

        deleteObjectRefHook: (eventHandler: EventHandler) => {
            const widget = getAncestorOfType<LVGLWidget>(
                eventHandler,
                LVGLWidget.classInfo
            )!;

            ProjectEditor.getFlow(widget).deleteConnectionLinesFromOutput(
                widget,
                eventHandler.trigger
            );
        },

        defaultValue: {
            handlerType: "action"
        },

        newItem: async (eventHandlers: EventHandler[]) => {
            const project = ProjectEditor.getProject(eventHandlers);

            const result = await showGenericDialog({
                dialogDefinition: {
                    title: "New Event Handler",
                    fields: [
                        {
                            name: "trigger",
                            type: "enum",
                            enumItems: getTriggerEnumItems(
                                eventHandlers,
                                undefined
                            )
                        },
                        {
                            name: "handlerType",
                            type: "enum",
                            enumItems: [
                                { id: "flow", label: "Flow" },
                                { id: "action", label: "Action" }
                            ]
                        },
                        {
                            name: "action",
                            type: "enum",
                            enumItems: project.actions
                                .filter(
                                    action =>
                                        action.implementationType == "native"
                                )
                                .map(action => ({
                                    id: `action:${action.name}`,
                                    label: action.name
                                })),
                            visible: (values: any) => {
                                return values.handlerType == "action";
                            }
                        }
                    ]
                },
                values: {
                    handlerType: "action"
                },
                dialogContext: project
            });

            const properties: Partial<EventHandler> = {
                trigger: result.values.trigger,
                handlerType: result.values.handlerType,
                action: result.values.action
            };

            const customInput = createObject<EventHandler>(
                project._DocumentStore,
                properties,
                EventHandler
            );

            return customInput;
        }
    };

    get triggerCode() {
        return LVGL_EVENTS[this.trigger];
    }
}

////////////////////////////////////////////////////////////////////////////////

export class LVGLWidget extends Widget {
    identifier: string;

    leftUnit: "px" | "%";
    topUnit: "px" | "%";
    widthUnit: "px" | "%" | "content";
    heightUnit: "px" | "%" | "content";

    children: LVGLWidget[];
    flags: string;
    scrollbarMode: string;
    scrollDirection: string;
    states: string;
    localStyles: LVGLStylesDefinition;

    eventHandlers: EventHandler[];

    _lvglObj: number | undefined;
    _refreshCounter: number = 0;

    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType === ProjectType.LVGL,

        label: (widget: LVGLWidget) => {
            let name = getComponentName(widget.type);

            if (widget.identifier) {
                return `${name} [${widget.identifier}]`;
            }

            return name;
        },

        properties: [
            {
                name: "identifier",
                displayName: "Name",
                type: PropertyType.String,
                unique: true,
                isOptional: true,
                propertyGridGroup: generalGroup
            },
            {
                name: "left",
                type: PropertyType.Number,
                propertyGridColumnComponent: GeometryProperty,
                propertyGridGroup: geometryGroup,
                hideInPropertyGrid: isTimelineEditorActive
            },
            {
                name: "leftUnit",
                type: PropertyType.Enum,
                enumItems: [
                    { id: "px", label: "px" },
                    { id: "%", label: "%" }
                ],
                enumDisallowUndefined: true,
                propertyGridGroup: geometryGroup,
                hideInPropertyGrid: true
            },
            {
                name: "top",
                type: PropertyType.Number,
                propertyGridColumnComponent: GeometryProperty,
                propertyGridGroup: geometryGroup,
                hideInPropertyGrid: isTimelineEditorActive
            },
            {
                name: "topUnit",
                type: PropertyType.Enum,
                enumItems: [
                    { id: "px", label: "px" },
                    { id: "%", label: "%" }
                ],
                enumDisallowUndefined: true,
                propertyGridGroup: geometryGroup,
                hideInPropertyGrid: true
            },
            {
                name: "width",
                type: PropertyType.Number,
                propertyGridColumnComponent: GeometryProperty,
                propertyGridGroup: geometryGroup,
                hideInPropertyGrid: isTimelineEditorActiveOrActionComponent
            },
            {
                name: "widthUnit",
                type: PropertyType.Enum,
                enumItems: [
                    { id: "px", label: "px" },
                    { id: "%", label: "%" },
                    { id: "content", label: "content" }
                ],
                enumDisallowUndefined: true,
                propertyGridGroup: geometryGroup,
                hideInPropertyGrid: true
            },
            {
                name: "height",
                type: PropertyType.Number,
                propertyGridColumnComponent: GeometryProperty,
                propertyGridGroup: geometryGroup,
                hideInPropertyGrid: isTimelineEditorActiveOrActionComponent
            },
            {
                name: "heightUnit",
                type: PropertyType.Enum,
                enumItems: [
                    { id: "px", label: "px" },
                    { id: "%", label: "%" },
                    { id: "content", label: "content" }
                ],
                enumDisallowUndefined: true,
                propertyGridGroup: geometryGroup,
                hideInPropertyGrid: true
            },
            {
                name: "absolutePosition",
                type: PropertyType.String,
                propertyGridGroup: geometryGroup,
                computed: true,
                hideInPropertyGrid: true
            },
            {
                name: "children",
                type: PropertyType.Array,
                typeClass: LVGLWidget,
                hideInPropertyGrid: true
            },
            {
                name: "flags",
                type: PropertyType.String,
                propertyGridGroup: flagsGroup,
                propertyGridRowComponent: LVGLWidgetFlagsProperty,
                enumerable: false
            },
            {
                name: "scrollbarMode",
                type: PropertyType.Enum,
                enumItems: [
                    {
                        id: "off",
                        label: "OFF"
                    },
                    {
                        id: "on",
                        label: "ON"
                    },
                    {
                        id: "active",
                        label: "ACTIVE"
                    },
                    {
                        id: "auto",
                        label: "AUTO"
                    }
                ],
                enumDisallowUndefined: true,
                propertyGridGroup: flagsGroup
            },
            {
                name: "scrollDirection",
                type: PropertyType.Enum,
                enumItems: [
                    {
                        id: "top",
                        label: "TOP"
                    },
                    {
                        id: "left",
                        label: "LEFT"
                    },
                    {
                        id: "bottom",
                        label: "BOTTOM"
                    },
                    {
                        id: "right",
                        label: "RIGHT"
                    },
                    {
                        id: "hor",
                        label: "HOR"
                    },
                    {
                        id: "ver",
                        label: "VER"
                    },
                    {
                        id: "all",
                        label: "ALL"
                    }
                ],
                enumDisallowUndefined: true,
                propertyGridGroup: flagsGroup
            },
            {
                name: "states",
                type: PropertyType.String,
                propertyGridGroup: statesGroup,
                propertyGridRowComponent: LVGLWidgetStatesProperty,
                enumerable: false
            },
            {
                name: "localStyles",
                type: PropertyType.Object,
                typeClass: LVGLStylesDefinition,
                propertyGridGroup: styleGroup,
                propertyGridCollapsable: true,
                propertyGridRowComponent: LVGLStylesDefinitionProperty,
                enumerable: false
            },
            {
                name: "eventHandlers",
                type: PropertyType.Array,
                typeClass: EventHandler,
                propertyGridGroup: eventsGroup,
                partOfNavigation: false,
                enumerable: false,
                defaultValue: []
            }
        ],

        beforeLoadHook: (widget: LVGLWidget, jsWidget: Partial<LVGLWidget>) => {
            if (jsWidget.leftUnit == undefined) {
                jsWidget.leftUnit = "px";
            }
            if (jsWidget.topUnit == undefined) {
                jsWidget.topUnit = "px";
            }
            if (jsWidget.widthUnit == undefined) {
                jsWidget.widthUnit = "px";
            }
            if (jsWidget.heightUnit == undefined) {
                jsWidget.heightUnit = "px";
            }
        },

        defaultValue: {
            leftUnit: "px",
            topUnit: "px",
            widthUnit: "px",
            heightUnit: "px",
            scrollbarMode: "auto",
            scrollDirection: "all"
        },

        check: (widget: LVGLWidget) => {
            let messages: Message[] = [];

            messages.push(...widget.localStyles.check());

            return messages;
        }
    });

    constructor() {
        super();

        makeObservable(this, {
            identifier: observable,
            leftUnit: observable,
            topUnit: observable,
            widthUnit: observable,
            heightUnit: observable,
            children: observable,
            flags: observable,
            scrollbarMode: observable,
            scrollDirection: observable,
            states: observable,
            localStyles: observable,
            eventHandlers: observable,
            state: computed,
            part: computed,
            _lvglObj: observable,
            _refreshCounter: observable
        });
    }

    override get relativePosition() {
        if (this._lvglObj) {
            const page = getAncestorOfType(
                this,
                ProjectEditor.PageClass.classInfo
            ) as Page;
            if (page._lvglRuntime) {
                return {
                    left: page._lvglRuntime.wasm._lvglGetObjRelX(this._lvglObj),
                    top: page._lvglRuntime.wasm._lvglGetObjRelY(this._lvglObj)
                };
            }
        }
        return super.relativePosition;
    }

    override fromRelativePosition(left: number, top: number) {
        if (this._lvglObj) {
            const page = getAncestorOfType(
                this,
                ProjectEditor.PageClass.classInfo
            ) as Page;
            if (page._lvglRuntime) {
                return {
                    left: left - this.relativePosition.left + this.left,
                    top: top - this.relativePosition.top + this.top
                };
            }
        }

        return { left, top };
    }

    override get autoSize(): AutoSize {
        if (this.widthUnit == "content" && this.heightUnit == "content") {
            return "both";
        }
        if (this.widthUnit == "content") {
            return "width";
        }
        if (this.heightUnit == "content") {
            return "height";
        }
        return "none";
    }

    override get componentWidth() {
        this._refreshCounter;
        if (this._lvglObj) {
            const page = getAncestorOfType(
                this,
                ProjectEditor.PageClass.classInfo
            ) as Page;
            if (page._lvglRuntime) {
                return page._lvglRuntime.wasm._lvglGetObjWidth(this._lvglObj);
            }
        }
        return this.width ?? 0;
    }

    override get componentHeight() {
        this._refreshCounter;
        if (this._lvglObj) {
            const page = getAncestorOfType(
                this,
                ProjectEditor.PageClass.classInfo
            ) as Page;
            if (page._lvglRuntime) {
                return page._lvglRuntime.wasm._lvglGetObjHeight(this._lvglObj);
            }
        }
        return this.height ?? 0;
    }

    getOutputs(): ComponentOutput[] {
        return [
            ...super.getOutputs(),
            ...this.eventHandlers
                .filter(eventHandler => eventHandler.handlerType == "flow")
                .map(eventHandler => ({
                    name: eventHandler.trigger,
                    type: "any" as ValueType,
                    isOptionalOutput: false,
                    isSequenceOutput: false
                }))
        ];
    }

    getExpressionPropertyData(runtime: LVGLPageRuntime, propertyName: string) {
        if (!runtime.wasm.assetsMap) {
            return undefined;
        }

        const isExpr = (this as any)[propertyName + "Type"] == "expression";

        if (!isExpr) {
            return undefined;
        }

        const pagePath = getObjectPathAsString(runtime.page);
        const flowIndex = runtime.wasm.assetsMap.flowIndexes[pagePath];
        if (flowIndex == undefined) {
            return undefined;
        }
        const flow = runtime.wasm.assetsMap.flows[flowIndex];
        const componentPath = getObjectPathAsString(this);
        const componentIndex = flow.componentIndexes[componentPath];
        if (componentIndex == undefined) {
            return undefined;
        }

        const component = flow.components[componentIndex];
        const propertyIndex = component.propertyIndexes[propertyName];
        if (propertyIndex == undefined) {
            return undefined;
        }

        return { flowIndex, componentIndex, propertyIndex };
    }

    override lvglCreate(
        runtime: LVGLPageRuntime,
        parentObj: number
    ): LVGLCreateResultType {
        const obj = this.lvglCreateObj(runtime, parentObj);

        if (runtime.isEditor) {
            runInAction(() => (this._lvglObj = obj));
        }

        if (runtime.wasm.assetsMap) {
            const pagePath = getObjectPathAsString(runtime.page);
            const flowIndex = runtime.wasm.assetsMap.flowIndexes[pagePath];
            if (flowIndex != undefined) {
                const flow = runtime.wasm.assetsMap.flows[flowIndex];

                for (const eventHandler of this.eventHandlers) {
                    if (eventHandler.handlerType == "flow") {
                        const componentPath = getObjectPathAsString(this);
                        const componentIndex =
                            flow.componentIndexes[componentPath];
                        if (componentIndex != undefined) {
                            const component = flow.components[componentIndex];
                            const outputIndex =
                                component.outputIndexes[eventHandler.trigger];
                            if (outputIndex != undefined) {
                                runtime.wasm._lvglAddObjectFlowCallback(
                                    obj,
                                    eventHandler.triggerCode,
                                    flowIndex,
                                    componentIndex,
                                    outputIndex
                                );
                            }
                        }
                    }
                }

                if (this.hasEventHandler) {
                    this.createEventHandlerSpecific(runtime, obj);
                }
            }
        }

        const classInfo = getClassInfo(this);

        // add/clear flags
        {
            const { added, cleared } = changes(
                (classInfo.lvgl!.defaultFlags ?? "").split("|"),
                (this.flags || "").split(
                    "|"
                ) as (keyof typeof LVGL_FLAG_CODES)[]
            );

            if (added.length > 0) {
                runtime.wasm._lvglObjAddFlag(
                    obj,
                    getCode(added, LVGL_FLAG_CODES)
                );
            }
            if (cleared.length > 0) {
                runtime.wasm._lvglObjClearFlag(
                    obj,
                    getCode(cleared, LVGL_FLAG_CODES)
                );
            }
        }

        // add/clear states
        {
            const { added, cleared } = changes(
                (classInfo.lvgl!.defaultStates ?? "").split("|"),
                (this.states || "").split(
                    "|"
                ) as (keyof typeof LVGL_STATE_CODES)[]
            );

            if (added.length > 0) {
                runtime.wasm._lvglObjAddState(
                    obj,
                    getCode(added, LVGL_STATE_CODES)
                );
            }
            if (cleared.length > 0) {
                runtime.wasm._lvglObjClearState(
                    obj,
                    getCode(cleared, LVGL_STATE_CODES)
                );
            }
        }

        let children: LVGLCreateResultType[];

        if (obj) {
            this.localStyles.lvglCreate(runtime, obj);

            children = this.children.map((widget: LVGLWidget) =>
                widget.lvglCreate(runtime, obj)
            );
        } else {
            children = [];
        }

        return {
            obj,
            children
        };
    }

    lvglCreateObj(runtime: LVGLPageRuntime, parentObj: number): number {
        console.error("UNEXPECTED!");
        return 0;
    }

    createEventHandlerSpecific(runtime: LVGLPageRuntime, obj: number) {}

    lvglBuild(build: LVGLBuild): void {
        if (this.identifier) {
            build.line(`// ${this.identifier}`);
        }

        this.lvglBuildObj(build);

        if (this.identifier) {
            build.line(
                `screen->${build.getWidgetStructFieldName(this)} = obj;`
            );
        }

        build.line(
            `lv_obj_set_pos(obj, ${this.lvglBuildLeft}, ${this.lvglBuildTop});`
        );
        build.line(
            `lv_obj_set_size(obj, ${this.lvglBuildWidth}, ${this.lvglBuildHeight});`
        );

        this.lvglBuildSpecific(build);

        if (this.eventHandlers.length > 0 || this.hasEventHandler) {
            build.line(
                `lv_obj_add_event_cb(obj, ${build.getEventHandlerCallbackName(
                    this
                )}, LV_EVENT_ALL, screen);`
            );
        }

        const classInfo = getClassInfo(this);

        // add/clear flags
        {
            const { added, cleared } = changes(
                (classInfo.lvgl!.defaultFlags ?? "").split("|"),
                (this.flags || "").split(
                    "|"
                ) as (keyof typeof LVGL_FLAG_CODES)[]
            );

            if (added.length > 0) {
                build.line(
                    `lv_obj_add_flag(obj, ${added
                        .map(flag => "LV_OBJ_FLAG_" + flag)
                        .join("|")});`
                );
            }

            if (cleared.length > 0) {
                build.line(
                    `lv_obj_clear_flag(obj, ${cleared
                        .map(flag => "LV_OBJ_FLAG_" + flag)
                        .join("|")});`
                );
            }
        }

        // add/clear states
        {
            const { added, cleared } = changes(
                (classInfo.lvgl!.defaultStates ?? "").split("|"),
                (this.states || "").split(
                    "|"
                ) as (keyof typeof LVGL_STATE_CODES)[]
            );

            if (added.length > 0) {
                build.line(
                    `lv_obj_add_state(obj, ${added
                        .map(state => "LV_STATE_" + state)
                        .join("|")});`
                );
            }

            if (cleared.length > 0) {
                build.line(
                    `lv_obj_clear_state(obj, ${cleared
                        .map(state => "LV_STATE_" + state)
                        .join("|")});`
                );
            }
        }

        this.localStyles.lvglBuild(build);

        if (this.children.length > 0) {
            build.line("{");
            build.indent();
            build.line("lv_obj_t *parent_obj = obj;");

            for (const widget of this.children) {
                build.line("{");
                build.indent();
                widget.lvglBuild(build);
                build.unindent();
                build.line("}");
            }

            build.unindent();
            build.line("}");
        }
    }

    lvglBuildTick(build: LVGLBuild): void {
        this.lvglBuildTickSpecific(build);
        for (const widget of this.children) {
            widget.lvglBuildTick(build);
        }
    }

    lvglBuildTickSpecific(build: LVGLBuild): void {}

    get lvglCreateLeft() {
        if (this.leftUnit == "%") {
            return LV_PCT(this.left);
        }
        return this.left;
    }

    get lvglCreateTop() {
        if (this.topUnit == "%") {
            return LV_PCT(this.top);
        }
        return this.top;
    }

    get lvglCreateWidth() {
        if (this.widthUnit == "content") {
            return LV_SIZE_CONTENT;
        } else if (this.widthUnit == "%") {
            return LV_PCT(this.width);
        }
        return this.width;
    }

    get lvglCreateHeight() {
        if (this.heightUnit == "content") {
            return LV_SIZE_CONTENT;
        } else if (this.heightUnit == "%") {
            return LV_PCT(this.height);
        }
        return this.height;
    }

    get lvglBuildLeft() {
        if (this.leftUnit == "%") {
            return `LV_PCT(${this.left})`;
        }
        return this.left;
    }

    get lvglBuildTop() {
        if (this.topUnit == "%") {
            return `LV_PCT(${this.top})`;
        }
        return this.top;
    }

    get lvglBuildWidth() {
        if (this.widthUnit == "content") {
            return "LV_SIZE_CONTENT";
        } else if (this.widthUnit == "%") {
            return `LV_PCT(${this.width})`;
        }
        return this.width;
    }

    get lvglBuildHeight() {
        if (this.heightUnit == "content") {
            return "LV_SIZE_CONTENT";
        } else if (this.heightUnit == "%") {
            return `LV_PCT(${this.height})`;
        }
        return this.height;
    }

    lvglBuildObj(build: LVGLBuild): void {
        console.error("UNEXPECTED!");
    }

    lvglBuildSpecific(build: LVGLBuild): void {}

    get part() {
        const project = ProjectEditor.getProject(this);
        const classInfo = getClassInfo(this);
        if (
            classInfo.lvgl!.parts.indexOf(
                project._DocumentStore.uiStateStore.lvglPart
            ) != -1
        ) {
            return project._DocumentStore.uiStateStore.lvglPart;
        }
        return "MAIN";
    }
    set part(part: LVGLParts) {
        const project = ProjectEditor.getProject(this);
        runInAction(
            () => (project._DocumentStore.uiStateStore.lvglPart = part)
        );
    }

    get state() {
        const project = ProjectEditor.getProject(this);
        return project._DocumentStore.uiStateStore.lvglState;
    }
    set state(state: string) {
        const project = ProjectEditor.getProject(this);
        runInAction(
            () => (project._DocumentStore.uiStateStore.lvglState = state)
        );
    }

    get hasEventHandler() {
        return false;
    }

    buildEventHandlerSpecific(build: LVGLBuild) {}

    render(flowContext: IFlowContext, width: number, height: number) {
        return (
            <>
                <ComponentsContainerEnclosure
                    parent={this}
                    components={this.children}
                    flowContext={flowContext}
                    width={width}
                    height={height}
                />
                {super.render(flowContext, width, height)}
            </>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

type LVGLPropertyType = "literal" | "expression" | "variable" | "text-resource";

export const LVGLProperty = observer(
    class GeometryProperty extends React.Component<PropertyProps> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        render() {
            const classInfo = getClassInfo(this.props.objects[0]);
            const typePropertyInfo = findPropertyByNameInClassInfo(
                classInfo,
                this.props.propertyInfo.name + "Type"
            );

            const type: LVGLPropertyType = (this.props.objects[0] as any)[
                typePropertyInfo!.name
            ];

            return (
                <div className="EezStudio_LVGProperty">
                    <Property
                        propertyInfo={Object.assign(
                            {},
                            this.props.propertyInfo,
                            {
                                type:
                                    type == "expression"
                                        ? PropertyType.MultilineText
                                        : this.props.propertyInfo.type,

                                propertyGridColumnComponent: undefined,

                                onSelect:
                                    type == "expression"
                                        ? (
                                              object: IEezObject,
                                              propertyInfo: PropertyInfo,
                                              params: IOnSelectParams
                                          ) =>
                                              expressionBuilder(
                                                  object,
                                                  propertyInfo,
                                                  {
                                                      assignableExpression:
                                                          false,
                                                      title: "Expression Builder"
                                                  },
                                                  params
                                              )
                                        : undefined
                            }
                        )}
                        objects={this.props.objects}
                        readOnly={this.props.readOnly}
                        updateObject={this.props.updateObject}
                    />

                    {typePropertyInfo && (
                        <Property
                            propertyInfo={typePropertyInfo}
                            objects={this.props.objects}
                            readOnly={this.props.readOnly}
                            updateObject={this.props.updateObject}
                        />
                    )}
                </div>
            );
        }
    }
);

function makeExpressionProperty(
    name: string,
    propertyGridGroup: IPropertyGridGroupDefinition,
    flowProperty: FlowPropertyType,
    types: LVGLPropertyType[],
    hideInPropertyGrid?:
        | boolean
        | ((object: IEezObject, propertyInfo: PropertyInfo) => boolean)
) {
    return [
        {
            name,
            type: PropertyType.String,
            propertyGridColumnComponent: LVGLProperty,
            propertyGridGroup,
            flowProperty: (widget: LVGLLabelWidget | undefined) => {
                if (widget == undefined) {
                    return flowProperty;
                }
                return (widget as any)[name + "Type"] == "expression"
                    ? flowProperty
                    : undefined;
            },
            hideInPropertyGrid
        },
        {
            name: name + "Type",
            type: PropertyType.Enum,
            enumItems: types.map(id => ({ id })),
            enumDisallowUndefined: true,
            propertyGridGroup,
            hideInPropertyGrid: true
        }
    ];
}

////////////////////////////////////////////////////////////////////////////////

const LONG_MODE_CODES = {
    WRAP: 0,
    DOT: 1,
    SCROLL: 2,
    SCROLL_CIRCULAR: 3,
    CLIP: 4
};

const labelGroup: IPropertyGridGroupDefinition = {
    id: "lvgl-label",
    title: "Label",
    position: SPECIFIC_GROUP_POSITION
};

export class LVGLLabelWidget extends LVGLWidget {
    text: string;
    textType: LVGLPropertyType;
    longMode: keyof typeof LONG_MODE_CODES;
    recolor: boolean;

    static classInfo = makeDerivedClassInfo(LVGLWidget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType === ProjectType.LVGL,

        componentPaletteGroupName: "!1Basic Widgets",

        label: (widget: LVGLLabelWidget) => {
            let name = getComponentName(widget.type);

            if (widget.identifier) {
                name = `${name} [${widget.identifier}]`;
            }

            if (widget.text) {
                return `${name}: ${widget.text}`;
            }

            return name;
        },

        properties: [
            ...makeExpressionProperty("text", labelGroup, "input", [
                "literal",
                "expression"
            ]),
            {
                name: "longMode",
                type: PropertyType.Enum,
                enumItems: [
                    {
                        id: "WRAP",
                        label: "WRAP"
                    },
                    {
                        id: "DOT",
                        label: "DOT"
                    },
                    {
                        id: "SCROLL",
                        label: "SCROLL"
                    },
                    {
                        id: "SCROLL_CIRCULAR",
                        label: "SCROLL CIRCULAR"
                    },
                    {
                        id: "CLIP",
                        label: "CLIP"
                    }
                ],
                enumDisallowUndefined: true,
                propertyGridGroup: labelGroup
            },
            {
                name: "recolor",
                type: PropertyType.Boolean,
                propertyGridGroup: labelGroup
            }
        ],

        defaultValue: {
            left: 0,
            top: 0,
            width: 0,
            height: 0,
            widthUnit: "content",
            heightUnit: "content",
            text: "Text",
            textType: "literal",
            longMode: "WRAP",
            recolor: false,
            localStyles: {},
            flags: "PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE|SCROLLABLE|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_CHAIN"
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

        check: (widget: LVGLLabelWidget) => {
            let messages: Message[] = [];

            if (!widget.text) {
                messages.push(propertyNotSetMessage(widget, "text"));
            }

            return messages;
        },

        lvgl: {
            parts: ["MAIN", "SCROLLBAR", "SELECTED"],
            flags: [
                "HIDDEN",
                "CLICKABLE",
                "CHECKABLE",
                "PRESS_LOCK",
                "CLICK_FOCUSABLE",
                "ADV_HITTEST",
                "IGNORE_LAYOUT",
                "FLOATING",
                "EVENT_BUBBLE",
                "GESTURE_BUBBLE",
                "SNAPPABLE",
                "SCROLLABLE",
                "SCROLL_ELASTIC",
                "SCROLL_MOMENTUM",
                "SCROLL_ON_FOCUS",
                "SCROLL_CHAIN",
                "SCROLL_ONE"
            ],
            defaultFlags:
                "PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE|SCROLLABLE|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_CHAIN",
            states: ["CHECKED", "DISABLED", "FOCUSED", "PRESSED"]
        }
    });

    constructor() {
        super();

        makeObservable(this, {
            text: observable,
            textType: observable,
            longMode: observable,
            recolor: observable
        });
    }

    override lvglCreateObj(runtime: LVGLPageRuntime, parentObj: number) {
        const textExpr = this.getExpressionPropertyData(runtime, "text");

        const obj = runtime.wasm._lvglCreateLabel(
            parentObj,
            this.lvglCreateLeft,
            this.lvglCreateTop,
            this.lvglCreateWidth,
            this.lvglCreateHeight,
            textExpr ? 0 : runtime.wasm.allocateUTF8(this.text),
            LONG_MODE_CODES[this.longMode],
            this.recolor ? 1 : 0
        );

        if (textExpr) {
            runtime.wasm._lvglUpdateLabelText(
                obj,
                textExpr.flowIndex,
                textExpr.componentIndex,
                textExpr.propertyIndex
            );
        }

        return obj;
    }

    override lvglBuildObj(build: LVGLBuild) {
        build.line(`lv_obj_t *obj = lv_label_create(parent_obj);`);
    }

    override lvglBuildSpecific(build: LVGLBuild) {
        if (this.longMode != "WRAP") {
            build.line(
                `lv_label_set_long_mode(obj, LV_LABEL_LONG_${this.longMode});`
            );
        }

        if (this.recolor) {
            build.line(`lv_label_set_recolor(obj, true);`);
        }

        if (this.textType == "literal") {
            build.line(`lv_label_set_text(obj, ${escapeCString(this.text)});`);
        }
    }

    override lvglBuildTickSpecific(build: LVGLBuild) {
        if (this.textType == "expression") {
            build.line(`{`);
            build.indent();

            const page = getAncestorOfType(
                this,
                ProjectEditor.PageClass.classInfo
            ) as Page;

            let flowIndex = build.assets.getFlowIndex(page);
            let componentIndex = build.assets.getComponentIndex(this);
            const propertyIndex = build.assets.getComponentPropertyIndex(
                this,
                "text"
            );

            build.line(
                `const char *text_new = evalTextProperty(${flowIndex}, ${componentIndex}, ${propertyIndex}, "Failed to evaluate Text in Label widget");`
            );

            build.line(
                `const char *text_cur = lv_label_get_text(screen->${build.getWidgetObjFieldName(
                    this
                )});`
            );

            build.line(
                `if (strcmp(text_new, text_cur) != 0) lv_label_set_text(screen->${build.getWidgetObjFieldName(
                    this
                )}, text_new);`
            );

            build.unindent();
            build.line(`}`);
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

export class LVGLButtonWidget extends LVGLWidget {
    static classInfo = makeDerivedClassInfo(LVGLWidget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType === ProjectType.LVGL,

        componentPaletteGroupName: "!1Basic Widgets",

        properties: [],

        defaultValue: {
            left: 0,
            top: 0,
            width: 100,
            height: 50,
            flags: "CLICKABLE|PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE|SCROLL_ELASTIC|SCROLL_ON_FOCUS|SCROLL_MOMENTUM|SCROLL_CHAIN"
        },

        icon: (
            <svg viewBox="0 0 16 16">
                <path
                    fill="currentColor"
                    d="m15.7 5.3-1-1c-.2-.2-.4-.3-.7-.3H1c-.6 0-1 .4-1 1v5c0 .3.1.6.3.7l1 1c.2.2.4.3.7.3h13c.6 0 1-.4 1-1V6c0-.3-.1-.5-.3-.7zM14 10H1V5h13v5z"
                />
            </svg>
        ),

        lvgl: {
            parts: ["MAIN"],
            flags: [
                "HIDDEN",
                "CLICKABLE",
                "CHECKABLE",
                "PRESS_LOCK",
                "CLICK_FOCUSABLE",
                "ADV_HITTEST",
                "IGNORE_LAYOUT",
                "FLOATING",
                "EVENT_BUBBLE",
                "GESTURE_BUBBLE",
                "SNAPPABLE",
                "SCROLLABLE",
                "SCROLL_ELASTIC",
                "SCROLL_MOMENTUM",
                "SCROLL_ON_FOCUS",
                "SCROLL_CHAIN",
                "SCROLL_ONE"
            ],
            defaultFlags:
                "CLICKABLE|PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE|SCROLLABLE|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_CHAIN",
            states: ["CHECKED", "DISABLED", "FOCUSED", "PRESSED"]
        }
    });

    constructor() {
        super();

        makeObservable(this, {});
    }

    override lvglCreateObj(runtime: LVGLPageRuntime, parentObj: number) {
        return runtime.wasm._lvglCreateButton(
            parentObj,
            this.lvglCreateLeft,
            this.lvglCreateTop,
            this.lvglCreateWidth,
            this.lvglCreateHeight
        );
    }

    override lvglBuildObj(build: LVGLBuild) {
        build.line(`lv_obj_t *obj = lv_btn_create(parent_obj);`);
    }
}

////////////////////////////////////////////////////////////////////////////////

export class LVGLPanelWidget extends LVGLWidget {
    static classInfo = makeDerivedClassInfo(LVGLWidget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType === ProjectType.LVGL,

        componentPaletteGroupName: "!1Basic Widgets",

        properties: [],

        defaultValue: {
            left: 0,
            top: 0,
            width: 100,
            height: 50,
            flags: "CLICKABLE|PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_CHAIN"
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
                <rect x="3" y="5" width="18" height="14" rx="2" />
            </svg>
        ),

        lvgl: {
            parts: ["MAIN", "SCROLLBAR"],
            flags: [
                "HIDDEN",
                "CLICKABLE",
                "CHECKABLE",
                "PRESS_LOCK",
                "CLICK_FOCUSABLE",
                "ADV_HITTEST",
                "IGNORE_LAYOUT",
                "FLOATING",
                "EVENT_BUBBLE",
                "GESTURE_BUBBLE",
                "SNAPPABLE",
                "SCROLLABLE",
                "SCROLL_ELASTIC",
                "SCROLL_MOMENTUM",
                "SCROLL_ON_FOCUS",
                "SCROLL_CHAIN",
                "SCROLL_ONE"
            ],
            defaultFlags:
                "CLICKABLE|PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE|SCROLLABLE|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_CHAIN",
            states: ["CHECKED", "DISABLED", "FOCUSED", "PRESSED"]
        }
    });

    constructor() {
        super();

        makeObservable(this, {});
    }

    override lvglCreateObj(runtime: LVGLPageRuntime, parentObj: number) {
        return runtime.wasm._lvglCreatePanel(
            parentObj,
            this.lvglCreateLeft,
            this.lvglCreateTop,
            this.lvglCreateWidth,
            this.lvglCreateHeight
        );
    }

    override lvglBuildObj(build: LVGLBuild) {
        build.line(`lv_obj_t *obj = lv_obj_create(parent_obj);`);
    }
}

////////////////////////////////////////////////////////////////////////////////

export const imageGroup: IPropertyGridGroupDefinition = {
    id: "lvgl-image",
    title: "Image",
    position: SPECIFIC_GROUP_POSITION
};

export class LVGLImageWidget extends LVGLWidget {
    image: string;
    pivotX: number;
    pivotY: number;
    zoom: number;
    angle: number;

    static classInfo = makeDerivedClassInfo(LVGLWidget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType === ProjectType.LVGL,

        componentPaletteGroupName: "!1Basic Widgets",

        properties: [
            {
                name: "image",
                type: PropertyType.ObjectReference,
                referencedObjectCollectionPath: "bitmaps",
                propertyGridGroup: imageGroup
            },
            {
                name: "pivotX",
                displayName: "Pivot X",
                type: PropertyType.Number,
                propertyGridGroup: imageGroup
            },
            {
                name: "pivotY",
                displayName: "Pivot Y",
                type: PropertyType.Number,
                propertyGridGroup: imageGroup
            },
            {
                name: "zoom",
                displayName: "Scale",
                type: PropertyType.Number,
                propertyGridGroup: imageGroup
            },
            {
                name: "angle",
                displayName: "Rotation",
                type: PropertyType.Number,
                propertyGridGroup: imageGroup
            }
        ],

        defaultValue: {
            left: 0,
            top: 0,
            width: 0,
            height: 0,
            widthUnit: "content",
            heightUnit: "content",
            pivotX: 0,
            pivotY: 0,
            zoom: 256,
            angle: 0,
            flags: "PRESS_LOCK|ADV_HITTEST|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_CHAIN"
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
                <path d="M15 8h.01" />
                <rect x="4" y="4" width="16" height="16" rx="3" />
                <path d="m4 15 4-4a3 5 0 0 1 3 0l5 5" />
                <path d="m14 14 1-1a3 5 0 0 1 3 0l2 2" />
            </svg>
        ),

        check: (widget: LVGLImageWidget) => {
            let messages: Message[] = [];

            if (widget.image) {
                const bitmap = ProjectEditor.findBitmap(
                    ProjectEditor.getProject(widget),
                    widget.image
                );

                if (!bitmap) {
                    messages.push(propertyNotFoundMessage(widget, "image"));
                }
            }

            return messages;
        },

        lvgl: {
            parts: ["MAIN"],
            flags: [
                "HIDDEN",
                "CLICKABLE",
                "CHECKABLE",
                "PRESS_LOCK",
                "CLICK_FOCUSABLE",
                "ADV_HITTEST",
                "IGNORE_LAYOUT",
                "FLOATING",
                "EVENT_BUBBLE",
                "GESTURE_BUBBLE",
                "SNAPPABLE",
                "SCROLLABLE",
                "SCROLL_ELASTIC",
                "SCROLL_MOMENTUM",
                "SCROLL_ON_FOCUS",
                "SCROLL_CHAIN",
                "SCROLL_ONE"
            ],
            defaultFlags:
                "PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE|SCROLLABLE|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_CHAIN",
            states: ["CHECKED", "DISABLED", "FOCUSED", "PRESSED"]
        }
    });

    constructor() {
        super();

        makeObservable(this, {
            image: observable,
            pivotX: observable,
            pivotY: observable,
            zoom: observable,
            angle: observable
        });
    }

    override lvglCreateObj(runtime: LVGLPageRuntime, parentObj: number) {
        const obj = runtime.wasm._lvglCreateImage(
            parentObj,
            this.lvglCreateLeft,
            this.lvglCreateTop,
            this.lvglCreateWidth,
            this.lvglCreateHeight,
            0,
            this.pivotX,
            this.pivotY,
            this.zoom,
            this.angle
        );

        (async () => {
            runtime.wasm._lvglSetImageSrc(
                obj,
                await runtime.loadBitmap(this.image)
            );
            runInAction(() => this._refreshCounter++);
        })();

        return obj;
    }

    override lvglBuildObj(build: LVGLBuild) {
        build.line(`lv_obj_t *obj = lv_img_create(parent_obj);`);
    }

    override lvglBuildSpecific(build: LVGLBuild) {
        if (this.image) {
            build.line(`lv_img_set_src(obj, &img_${this.image});`);
        }

        if (this.pivotX != 0 || this.pivotY != 0) {
            build.line(
                `lv_img_set_pivot(obj, ${this.pivotX}, ${this.pivotY});`
            );
        }

        if (this.zoom != 256) {
            build.line(`lv_img_set_zoom(obj, ${this.zoom});`);
        }

        if (this.angle != 0) {
            build.line(`lv_img_set_angle(obj, ${this.angle});`);
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

const SLIDER_MODES = {
    NORMAL: 0,
    SYMMETRICAL: 1,
    RANGE: 2
};

export const sliderGroup: IPropertyGridGroupDefinition = {
    id: "lvgl-slider",
    title: "Slider",
    position: SPECIFIC_GROUP_POSITION
};

export class LVGLSliderWidget extends LVGLWidget {
    min: number;
    max: number;
    mode: keyof typeof SLIDER_MODES;
    value: number;
    valueType: LVGLPropertyType;
    valueLeft: number;
    valueLeftType: LVGLPropertyType;

    static classInfo = makeDerivedClassInfo(LVGLWidget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType === ProjectType.LVGL,

        componentPaletteGroupName: "!1Input Widgets",

        properties: [
            {
                name: "min",
                type: PropertyType.Number,
                propertyGridGroup: sliderGroup
            },
            {
                name: "max",
                type: PropertyType.Number,
                propertyGridGroup: sliderGroup
            },
            {
                name: "mode",
                type: PropertyType.Enum,
                enumItems: [
                    {
                        id: "NORMAL",
                        label: "NORMAL"
                    },
                    {
                        id: "SYMMETRICAL",
                        label: "SYMMETRICAL"
                    },
                    {
                        id: "RANGE",
                        label: "RANGE"
                    }
                ],
                enumDisallowUndefined: true,
                propertyGridGroup: sliderGroup
            },
            ...makeExpressionProperty("value", sliderGroup, "assignable", [
                "literal",
                "expression"
            ]),
            ...makeExpressionProperty(
                "valueLeft",
                sliderGroup,
                "assignable",
                ["literal", "expression"],
                (slider: LVGLSliderWidget) => slider.mode != "RANGE"
            )
        ],

        defaultValue: {
            left: 0,
            top: 0,
            width: 150,
            height: 10,
            flags: "CLICKABLE|PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE",
            min: 0,
            max: 100,
            mode: "NORMAL",
            value: 0,
            valueType: "literal",
            valueLeft: 0,
            valueLeftType: "literal"
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
                <circle cx="14" cy="6" r="2"></circle>
                <line x1="4" y1="6" x2="12" y2="6"></line>
                <line x1="16" y1="6" x2="20" y2="6"></line>
                <circle cx="8" cy="12" r="2"></circle>
                <line x1="4" y1="12" x2="6" y2="12"></line>
                <line x1="10" y1="12" x2="20" y2="12"></line>
                <circle cx="17" cy="18" r="2"></circle>
                <line x1="4" y1="18" x2="15" y2="18"></line>
                <line x1="19" y1="18" x2="20" y2="18"></line>
            </svg>
        ),

        lvgl: {
            parts: ["MAIN", "INDICATOR", "KNOB"],
            flags: [
                "HIDDEN",
                "CLICKABLE",
                "CHECKABLE",
                "PRESS_LOCK",
                "CLICK_FOCUSABLE",
                "ADV_HITTEST",
                "IGNORE_LAYOUT",
                "FLOATING",
                "EVENT_BUBBLE",
                "GESTURE_BUBBLE",
                "SNAPPABLE",
                "SCROLL_ON_FOCUS"
            ],
            defaultFlags:
                "CLICKABLE|PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE",
            states: ["CHECKED", "DISABLED", "FOCUSED", "PRESSED"]
        }
    });

    constructor() {
        super();

        makeObservable(this, {
            min: observable,
            max: observable,
            mode: observable,
            value: observable,
            valueType: observable,
            valueLeft: observable,
            valueLeftType: observable
        });
    }

    override get hasEventHandler() {
        return (
            this.valueType == "expression" ||
            (this.mode == "RANGE" && this.valueLeftType == "expression")
        );
    }

    override lvglCreateObj(runtime: LVGLPageRuntime, parentObj: number) {
        const valueExpr = this.getExpressionPropertyData(runtime, "value");
        const valueLeftExpr =
            this.mode == "RANGE"
                ? this.getExpressionPropertyData(runtime, "valueLeft")
                : undefined;

        const obj = runtime.wasm._lvglCreateSlider(
            parentObj,
            this.lvglCreateLeft,
            this.lvglCreateTop,
            this.lvglCreateWidth,
            this.lvglCreateHeight,
            this.min,
            this.max,
            SLIDER_MODES[this.mode],
            valueExpr ? 0 : this.value,
            valueLeftExpr ? 0 : this.valueLeft
        );

        if (valueExpr) {
            runtime.wasm._lvglUpdateSliderValue(
                obj,
                valueExpr.flowIndex,
                valueExpr.componentIndex,
                valueExpr.propertyIndex
            );
        }

        if (valueLeftExpr) {
            runtime.wasm._lvglUpdateSliderValueLeft(
                obj,
                valueLeftExpr.flowIndex,
                valueLeftExpr.componentIndex,
                valueLeftExpr.propertyIndex
            );
        }

        return obj;
    }

    override createEventHandlerSpecific(runtime: LVGLPageRuntime, obj: number) {
        const valueExpr = this.getExpressionPropertyData(runtime, "value");
        if (valueExpr) {
            runtime.wasm._lvglAddObjectFlowCallback(
                obj,
                LV_EVENT_SLIDER_VALUE_CHANGED,
                valueExpr.flowIndex,
                valueExpr.componentIndex,
                valueExpr.propertyIndex
            );
        }

        const valueLeftExpr =
            this.mode == "RANGE"
                ? this.getExpressionPropertyData(runtime, "valueLeft")
                : undefined;
        if (valueLeftExpr) {
            runtime.wasm._lvglAddObjectFlowCallback(
                obj,
                LV_EVENT_SLIDER_VALUE_LEFT_CHANGED,
                valueLeftExpr.flowIndex,
                valueLeftExpr.componentIndex,
                valueLeftExpr.propertyIndex
            );
        }
    }

    override lvglBuildObj(build: LVGLBuild) {
        build.line(`lv_obj_t *obj = lv_slider_create(parent_obj);`);
    }

    override lvglBuildSpecific(build: LVGLBuild) {
        if (this.min != 0 || this.max != 100) {
            build.line(`lv_slider_set_range(obj, ${this.min}, ${this.max});`);
        }

        if (this.mode != "NORMAL") {
            build.line(`lv_slider_set_mode(obj, LV_SLIDER_MODE_${this.mode});`);
        }

        if (this.valueType == "literal") {
            if (this.value != 0) {
                build.line(
                    `lv_slider_set_value(obj, ${this.value}, LV_ANIM_OFF);`
                );
            }
        }

        if (this.mode == "RANGE" && this.valueType == "literal") {
            build.line(
                `lv_slider_set_left_value(obj, ${this.valueLeft}, LV_ANIM_OFF);`
            );
        }
    }

    override lvglBuildTickSpecific(build: LVGLBuild) {
        if (this.valueType == "expression") {
            build.line(`{`);
            build.indent();

            const page = getAncestorOfType(
                this,
                ProjectEditor.PageClass.classInfo
            ) as Page;

            let flowIndex = build.assets.getFlowIndex(page);
            let componentIndex = build.assets.getComponentIndex(this);
            const propertyIndex = build.assets.getComponentPropertyIndex(
                this,
                "value"
            );

            build.line(
                `int32_t value_new = evalIntegerProperty(${flowIndex}, ${componentIndex}, ${propertyIndex}, "Failed to evaluate Value in Slider widget");`
            );

            build.line(
                `int32_t value_cur = lv_slider_get_value(screen->${build.getWidgetObjFieldName(
                    this
                )});`
            );

            build.line(
                `if (value_new != value_cur) lv_slider_set_value(screen->${build.getWidgetObjFieldName(
                    this
                )}, value_new, LV_ANIM_OFF);`
            );

            build.unindent();
            build.line(`}`);
        }

        if (this.mode == "RANGE" && this.valueLeftType == "expression") {
            build.line(`{`);
            build.indent();

            const page = getAncestorOfType(
                this,
                ProjectEditor.PageClass.classInfo
            ) as Page;

            let flowIndex = build.assets.getFlowIndex(page);
            let componentIndex = build.assets.getComponentIndex(this);
            const propertyIndex = build.assets.getComponentPropertyIndex(
                this,
                "valueLeft"
            );

            build.line(
                `int32_t value_new = evalIntegerProperty(${flowIndex}, ${componentIndex}, ${propertyIndex}, "Failed to evaluate Value Left in Slider widget");`
            );

            build.line(
                `int32_t value_cur = lv_slider_get_left_value(screen->${build.getWidgetObjFieldName(
                    this
                )});`
            );

            build.line(
                `if (value_new != value_cur) lv_slider_set_left_value(screen->${build.getWidgetObjFieldName(
                    this
                )}, value_new, LV_ANIM_OFF);`
            );

            build.unindent();
            build.line(`}`);
        }
    }

    override buildEventHandlerSpecific(build: LVGLBuild) {
        if (this.valueType == "expression") {
            build.line("if (event == LV_EVENT_VALUE_CHANGED) {");
            build.indent();

            build.line(`lv_obj_t *ta = lv_event_get_target(e);`);
            build.line(`int32_t value = lv_slider_get_value(ta);`);

            const page = getAncestorOfType(
                this,
                ProjectEditor.PageClass.classInfo
            ) as Page;
            let flowIndex = build.assets.getFlowIndex(page);
            let componentIndex = build.assets.getComponentIndex(this);
            const propertyIndex = build.assets.getComponentPropertyIndex(
                this,
                "value"
            );

            build.line(
                `assignIntegerProperty(${flowIndex}, ${componentIndex}, ${propertyIndex}, value, "Failed to assign Value in Slider widget");`
            );

            build.unindent();
            build.line("}");
        }

        if (this.mode == "RANGE" && this.valueLeftType == "expression") {
            build.line("if (event == LV_EVENT_VALUE_CHANGED) {");
            build.indent();

            build.line(`lv_obj_t *ta = lv_event_get_target(e);`);
            build.line(`int32_t value = lv_slider_get_left_value(ta);`);

            const page = getAncestorOfType(
                this,
                ProjectEditor.PageClass.classInfo
            ) as Page;
            let flowIndex = build.assets.getFlowIndex(page);
            let componentIndex = build.assets.getComponentIndex(this);
            const propertyIndex = build.assets.getComponentPropertyIndex(
                this,
                "valueLeft"
            );

            build.line(
                `assignIntegerProperty(${flowIndex}, ${componentIndex}, ${propertyIndex}, value, "Failed to assign Value Left in Slider widget");`
            );

            build.unindent();
            build.line("}");
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

const ROLLER_MODES = {
    NORMAL: 0,
    INFINITE: 1
};

export const rollerGroup: IPropertyGridGroupDefinition = {
    id: "lvgl-roller",
    title: "Roller",
    position: SPECIFIC_GROUP_POSITION
};

export class LVGLRollerWidget extends LVGLWidget {
    options: string;
    mode: keyof typeof ROLLER_MODES;

    static classInfo = makeDerivedClassInfo(LVGLWidget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType === ProjectType.LVGL,

        componentPaletteGroupName: "!1Input Widgets",

        properties: [
            {
                name: "options",
                type: PropertyType.MultilineText,
                propertyGridGroup: rollerGroup
            },
            {
                name: "mode",
                type: PropertyType.Enum,
                enumItems: [
                    {
                        id: "NORMAL",
                        label: "NORMAL"
                    },
                    {
                        id: "INFINITE",
                        label: "INFINITE"
                    }
                ],
                enumDisallowUndefined: true,
                propertyGridGroup: rollerGroup
            }
        ],

        defaultValue: {
            left: 0,
            top: 0,
            width: 80,
            height: 100,
            flags: "CLICKABLE|PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE",
            options: "Option 1\nOption 2\nOption 3",
            mode: "NORMAL"
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
                <path d="M11 6h9"></path>
                <path d="M11 12h9"></path>
                <path d="M12 18h8"></path>
                <path d="M4 16a2 2 0 1 1 4 0c0 .591 -.5 1 -1 1.5l-3 2.5h4"></path>
                <path d="M6 10v-6l-2 2"></path>
            </svg>
        ),

        lvgl: {
            parts: ["MAIN"],
            flags: [
                "HIDDEN",
                "CLICKABLE",
                "CHECKABLE",
                "PRESS_LOCK",
                "CLICK_FOCUSABLE",
                "ADV_HITTEST",
                "IGNORE_LAYOUT",
                "FLOATING",
                "EVENT_BUBBLE",
                "GESTURE_BUBBLE",
                "SNAPPABLE"
            ],
            defaultFlags:
                "CLICKABLE|PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE",
            states: ["CHECKED", "DISABLED", "FOCUSED", "PRESSED"]
        }
    });

    constructor() {
        super();

        makeObservable(this, {
            options: observable,
            mode: observable
        });
    }

    override lvglCreateObj(runtime: LVGLPageRuntime, parentObj: number) {
        return runtime.wasm._lvglCreateRoller(
            parentObj,
            this.lvglCreateLeft,
            this.lvglCreateTop,
            this.lvglCreateWidth,
            this.lvglCreateHeight,
            runtime.wasm.allocateUTF8(this.options),
            ROLLER_MODES[this.mode]
        );
    }

    override lvglBuildObj(build: LVGLBuild) {
        build.line(`lv_obj_t *obj = lv_roller_create(parent_obj);`);
    }

    override lvglBuildSpecific(build: LVGLBuild) {
        build.line(
            `lv_roller_set_options(obj, ${escapeCString(
                this.options
            )}, LV_ROLLER_MODE_${this.mode});`
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

export class LVGLSwitchWidget extends LVGLWidget {
    static classInfo = makeDerivedClassInfo(LVGLWidget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType === ProjectType.LVGL,

        componentPaletteGroupName: "!1Input Widgets",

        properties: [],

        defaultValue: {
            left: 0,
            top: 0,
            width: 50,
            height: 25,
            flags: "CLICKABLE|PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE"
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
                <path d="M0 0h24v24H0z" stroke="none" />
                <circle cx="8" cy="12" r="2" />
                <rect x="2" y="6" width="20" height="12" rx="6" />
            </svg>
        ),

        lvgl: {
            parts: ["MAIN"],
            flags: [
                "HIDDEN",
                "CLICKABLE",
                "CHECKABLE",
                "PRESS_LOCK",
                "CLICK_FOCUSABLE",
                "ADV_HITTEST",
                "IGNORE_LAYOUT",
                "FLOATING",
                "EVENT_BUBBLE",
                "GESTURE_BUBBLE",
                "SNAPPABLE",
                "SCROLL_ON_FOCUS"
            ],
            defaultFlags:
                "CLICKABLE|PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE",
            states: ["CHECKED", "DISABLED", "FOCUSED", "PRESSED"]
        }
    });

    constructor() {
        super();

        makeObservable(this, {});
    }

    override lvglCreateObj(runtime: LVGLPageRuntime, parentObj: number) {
        return runtime.wasm._lvglCreateSwitch(
            parentObj,
            this.lvglCreateLeft,
            this.lvglCreateTop,
            this.lvglCreateWidth,
            this.lvglCreateHeight
        );
    }

    override lvglBuildObj(build: LVGLBuild) {
        build.line(`lv_obj_t *obj = lv_switch_create(parent_obj);`);
    }
}

////////////////////////////////////////////////////////////////////////////////

registerClass("LVGLButtonWidget", LVGLButtonWidget);
registerClass("LVGLImageWidget", LVGLImageWidget);
registerClass("LVGLLabelWidget", LVGLLabelWidget);
registerClass("LVGLPanelWidget", LVGLPanelWidget);
registerClass("LVGLRollerWidget", LVGLRollerWidget);
registerClass("LVGLSliderWidget", LVGLSliderWidget);
registerClass("LVGLSwitchWidget", LVGLSwitchWidget);
