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
    IEezObject,
    PropertyInfo,
    getProperty,
    LVGL_REACTIVE_STATES,
    LVGL_REACTIVE_FLAGS,
    MessageType,
    getClassInfoLvglProperties
} from "project-editor/core/object";
import {
    getAncestorOfType,
    getChildOfObject,
    getClassInfo,
    getObjectPathAsString,
    getProjectEditorStore,
    Message,
    propertyNotFoundMessage,
    propertyNotSetMessage
} from "project-editor/store";

import { ProjectType } from "project-editor/project/project";

import type {
    IFlowContext,
    IResizeHandler
} from "project-editor/flow/flow-interfaces";

import {
    AutoSize,
    Component,
    ComponentOutput,
    isTimelineEditorActive,
    isTimelineEditorActiveOrActionComponent,
    Widget
} from "project-editor/flow/component";

import { escapeCString } from "project-editor/build/helper";
import {
    LVGLParts,
    LVGLStylesDefinition
} from "project-editor/lvgl/style-definition";
import { LVGLStylesDefinitionProperty } from "project-editor/lvgl/LVGLStylesDefinitionProperty";
import type { LVGLCreateResultType } from "project-editor/lvgl/LVGLStylesDefinitionProperty";
import { LVGLPageRuntime } from "project-editor/lvgl/page-runtime";
import { getComponentName } from "project-editor/flow/editor/ComponentsPalette";
import { ProjectEditor } from "project-editor/project-editor-interface";
import { ProjectContext } from "project-editor/project/context";
import type { Page } from "project-editor/features/page/page";
import { ComponentsContainerEnclosure } from "project-editor/flow/editor/render";
import { geometryGroup } from "project-editor/ui-components/PropertyGrid/groups";
import { Property } from "project-editor/ui-components/PropertyGrid/Property";
import type { LVGLBuild } from "project-editor/lvgl/build";
import { ValueType } from "project-editor/features/variable/value-type";
import {
    EventHandler,
    eventHandlersProperty,
    LVGLWidgetFlagsProperty,
    LVGLWidgetStatesProperty,
    LV_EVENT_ARC_VALUE_CHANGED,
    LV_EVENT_CHECKED_STATE_CHANGED,
    LV_EVENT_SLIDER_VALUE_CHANGED,
    LV_EVENT_SLIDER_VALUE_LEFT_CHANGED,
    LV_EVENT_TEXTAREA_TEXT_CHANGED,
    getCode
} from "project-editor/lvgl/widget-common";
import {
    expressionPropertyBuildEventHandlerSpecific,
    expressionPropertyBuildTickSpecific,
    LVGLPropertyType,
    makeExpressionProperty
} from "project-editor/lvgl/expression-property";
import { Rect } from "eez-studio-shared/geometry";
import { findLvglStyle, LVGLStyle } from "project-editor/lvgl/style";

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
            ) as PropertyInfo;

            const readOnly =
                this.props.objects.find(
                    object =>
                        (object as any)[unitPropertyInfo.name] == "content"
                ) != undefined;

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
                        readOnly={this.props.readOnly || readOnly}
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

function flagEnabledInWidget(
    component: Component,
    flag: keyof typeof LVGL_FLAG_CODES
) {
    const lvglClassInfoProperties = getClassInfoLvglProperties(component);
    return (
        component instanceof LVGLWidget &&
        lvglClassInfoProperties.flags.indexOf(flag) != -1
    );
}

function stateEnabledInWidget(
    component: Component,
    state: keyof typeof LVGL_STATE_CODES
) {
    const lvglvglClassInfoProperties = getClassInfoLvglProperties(component);
    return (
        component instanceof LVGLWidget &&
        lvglvglClassInfoProperties.states.indexOf(state) != -1
    );
}

////////////////////////////////////////////////////////////////////////////////

export class LVGLWidget extends Widget {
    identifier: string;

    leftUnit: "px" | "%";
    topUnit: "px" | "%";
    widthUnit: "px" | "%" | "content";
    heightUnit: "px" | "%" | "content";

    children: LVGLWidget[];

    hiddenFlag: string | boolean;
    hiddenFlagType: LVGLPropertyType;
    clickableFlag: string | boolean;
    clickableFlagType: LVGLPropertyType;
    flags: string;
    scrollbarMode: string;
    scrollDirection: string;

    checkedState: string | boolean;
    checkedStateType: LVGLPropertyType;
    disabledState: string | boolean;
    disabledStateType: LVGLPropertyType;
    states: string;

    useStyle: string;
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
                unique: (
                    object: IEezObject,
                    parent: IEezObject,
                    propertyInfo?: PropertyInfo
                ) => {
                    const oldIdentifier = propertyInfo
                        ? getProperty(object, propertyInfo.name)
                        : undefined;

                    return (object: any, ruleName: string) => {
                        const newIdentifer = object[ruleName];
                        if (
                            oldIdentifier != undefined &&
                            newIdentifer == oldIdentifier
                        ) {
                            return null;
                        }

                        if (
                            ProjectEditor.getProject(
                                parent
                            )._lvglIdentifiers.get(newIdentifer) == undefined
                        ) {
                            return null;
                        }

                        return "Not an unique name";
                    };
                },
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
            ...makeExpressionProperty(
                "hiddenFlag",
                "boolean",
                "input",
                ["literal", "expression"],
                {
                    displayName: "Hidden",
                    propertyGridGroup: flagsGroup,
                    hideInPropertyGrid: (widget: LVGLWidget) =>
                        !flagEnabledInWidget(widget, "HIDDEN")
                }
            ),
            ...makeExpressionProperty(
                "clickableFlag",
                "boolean",
                "input",
                ["literal", "expression"],
                {
                    displayName: "Clickable",
                    propertyGridGroup: flagsGroup,
                    hideInPropertyGrid: (widget: LVGLWidget) =>
                        !flagEnabledInWidget(widget, "CLICKABLE")
                }
            ),
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
            ...makeExpressionProperty(
                "checkedState",
                "boolean",
                "assignable",
                ["literal", "expression"],
                {
                    displayName: "Checked",
                    propertyGridGroup: statesGroup,
                    hideInPropertyGrid: (widget: LVGLWidget) =>
                        !stateEnabledInWidget(widget, "CHECKED")
                }
            ),
            ...makeExpressionProperty(
                "disabledState",
                "boolean",
                "input",
                ["literal", "expression"],
                {
                    displayName: "Disabled",
                    propertyGridGroup: statesGroup,
                    hideInPropertyGrid: (widget: LVGLWidget) =>
                        !stateEnabledInWidget(widget, "DISABLED")
                }
            ),
            {
                name: "states",
                type: PropertyType.String,
                propertyGridGroup: statesGroup,
                propertyGridRowComponent: LVGLWidgetStatesProperty,
                enumerable: false
            },
            {
                name: "useStyle",
                type: PropertyType.ObjectReference,
                referencedObjectCollectionPath: "lvglStyles/styles",
                filterReferencedObjectCollection: (
                    objects: IEezObject[],
                    lvglStyle: LVGLStyle
                ) =>
                    objects.length == 1 &&
                    objects[0] instanceof LVGLWidget &&
                    lvglStyle.forWidgetType == objects[0].type &&
                    ProjectEditor.getProject(lvglStyle).lvglStyles
                        .defaultStyles[lvglStyle.forWidgetType] !=
                        lvglStyle.name,
                propertyGridGroup: styleGroup,
                inputPlaceholder: (widget: LVGLWidget) => {
                    return (
                        ProjectEditor.getProject(widget).lvglStyles
                            .defaultStyles[widget.type] ?? undefined
                    );
                }
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
            eventHandlersProperty
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

            // migrate states
            if ((jsWidget as any).states != undefined) {
                const states = (jsWidget as any).states.split(
                    "|"
                ) as (keyof typeof LVGL_STATE_CODES)[];

                states.forEach(state => {
                    if (LVGL_REACTIVE_STATES.indexOf(state) != -1) {
                        const propName = state.toLowerCase() + "State";
                        (jsWidget as any)[propName] = true;
                        (jsWidget as any)[propName + "Type"] = "literal";
                    }
                });

                (jsWidget as any).states = states
                    .filter(state => LVGL_REACTIVE_STATES.indexOf(state) == -1)
                    .join("|");
            } else {
                (jsWidget as any).states = "";
            }

            LVGL_REACTIVE_STATES.forEach(state => {
                const propName = state.toLowerCase() + "State";
                if ((jsWidget as any)[propName + "Type"] == undefined) {
                    (jsWidget as any)[propName + "Type"] = "literal";
                }
            });

            // migrate flags
            if ((jsWidget as any).flags != undefined) {
                const flags = (jsWidget as any).flags.split(
                    "|"
                ) as (keyof typeof LVGL_FLAG_CODES)[];

                flags.forEach(flag => {
                    if (LVGL_REACTIVE_FLAGS.indexOf(flag) != -1) {
                        const propName = flag.toLowerCase() + "Flag";
                        (jsWidget as any)[propName] = true;
                        (jsWidget as any)[propName + "Type"] = "literal";
                    }
                });

                (jsWidget as any).flags = flags
                    .filter(flag => LVGL_REACTIVE_FLAGS.indexOf(flag) == -1)
                    .join("|");
            } else {
                (jsWidget as any).flags = "";
            }

            LVGL_REACTIVE_FLAGS.forEach(flag => {
                const propName = flag.toLowerCase() + "Flag";
                if ((jsWidget as any)[propName + "Type"] == undefined) {
                    (jsWidget as any)[propName + "Type"] = "literal";
                }
            });
        },

        defaultValue: {
            left: 0,
            top: 0,
            width: 100,
            height: 32,
            leftUnit: "px",
            topUnit: "px",
            widthUnit: "px",
            heightUnit: "px",
            scrollbarMode: "auto",
            scrollDirection: "all",
            hiddenFlagType: "literal",
            clickableFlagType: "literal",
            checkedStateType: "literal",
            disabledStateType: "literal"
        },

        setRect: (widget: LVGLWidget, value: Partial<Rect>) => {
            const projectEditorStore = getProjectEditorStore(widget);

            const props: Partial<Rect> = {};

            const { left, top } = widget.fromRelativePosition(
                value.left ?? widget.rect.left,
                value.top ?? widget.rect.top
            );

            if (widget.leftUnit == "px" && left !== widget.left) {
                props.left = left;
            }

            if (widget.topUnit == "px" && top !== widget.top) {
                props.top = top;
            }

            const width = value.width ?? widget.rect.width;
            const height = value.height ?? widget.rect.height;

            if (
                widget.widthUnit == "px" &&
                !(widget.autoSize == "width" || widget.autoSize == "both")
            ) {
                if (width !== widget.width) {
                    props.width = width;
                }
            }

            if (
                widget.heightUnit == "px" &&
                !(widget.autoSize == "height" || widget.autoSize == "both")
            ) {
                if (height !== widget.height) {
                    props.height = height;
                }
            }

            projectEditorStore.updateObject(widget, props);
        },

        check: (widget: LVGLWidget) => {
            let messages: Message[] = [];

            const projectEditorStore = getProjectEditorStore(widget);

            if (widget.useStyle) {
                const lvglStyle = findLvglStyle(
                    projectEditorStore.project,
                    widget.useStyle
                );
                if (!lvglStyle) {
                    messages.push(propertyNotFoundMessage(widget, "useStyle"));
                } else if (widget.type != lvglStyle.forWidgetType) {
                    messages.push(
                        new Message(
                            MessageType.ERROR,
                            `Style "${widget.useStyle}" is not for this widget type`,
                            getChildOfObject(widget, "useStyle")
                        )
                    );
                }
            }

            messages.push(...widget.localStyles.check());

            return messages;
        },

        showTreeCollapseIcon: "has-children"
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
            hiddenFlag: observable,
            hiddenFlagType: observable,
            clickableFlag: observable,
            clickableFlagType: observable,
            scrollbarMode: observable,
            scrollDirection: observable,
            checkedState: observable,
            checkedStateType: observable,
            disabledState: observable,
            disabledStateType: observable,
            states: observable,
            allStates: computed,
            useStyle: observable,
            localStyles: observable,
            eventHandlers: observable,
            state: computed,
            part: computed,
            _lvglObj: observable,
            _refreshCounter: observable,
            relativePosition: computed,
            componentWidth: computed,
            componentHeight: computed
        });
    }

    override get relativePosition() {
        this._refreshCounter;
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
                    left: Math.round(
                        left - this.relativePosition.left + this.left
                    ),
                    top: Math.round(top - this.relativePosition.top + this.top)
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

    override getResizeHandlers(): IResizeHandler[] | undefined | false {
        if (this.widthUnit != "px" && this.heightUnit != "px") {
            return [];
        }

        if (this.widthUnit != "px") {
            return [
                {
                    x: 50,
                    y: 0,
                    type: "n-resize"
                },
                {
                    x: 50,
                    y: 100,
                    type: "s-resize"
                }
            ];
        }

        if (this.heightUnit != "px") {
            return [
                {
                    x: 0,
                    y: 50,
                    type: "w-resize"
                },
                {
                    x: 100,
                    y: 50,
                    type: "e-resize"
                }
            ];
        }

        return super.getResizeHandlers();
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

    get allStates() {
        const states = this.states.split(
            "|"
        ) as (keyof typeof LVGL_STATE_CODES)[];

        LVGL_REACTIVE_STATES.forEach(state => {
            const propName = state.toLowerCase() + "State";

            if ((this as any)[propName + "Type"] == "literal") {
                if ((this as any)[propName]) {
                    if (states.indexOf(state) == -1) {
                        states.push(state);
                    }
                }
            } else {
                const lvglClassInfoProperties =
                    getClassInfoLvglProperties(this);
                if (
                    state in
                    (lvglClassInfoProperties.defaultStates ?? "").split("|")
                ) {
                    if (states.indexOf(state) == -1) {
                        states.push(state);
                    }
                }
            }
        });

        return states.join("|");
    }

    get allFlags() {
        const flags = this.flags.split("|") as (keyof typeof LVGL_FLAG_CODES)[];

        LVGL_REACTIVE_FLAGS.forEach(flag => {
            const propName = flag.toLowerCase() + "Flag";

            if ((this as any)[propName + "Type"] == "literal") {
                if ((this as any)[propName]) {
                    if (flags.indexOf(flag) == -1) {
                        flags.push(flag);
                    }
                }
            } else {
                const lvglClassInfoProperties =
                    getClassInfoLvglProperties(this);
                if (
                    flag in
                    (lvglClassInfoProperties.defaultFlags ?? "").split("|")
                ) {
                    if (flags.indexOf(flag) == -1) {
                        flags.push(flag);
                    }
                }
            }
        });

        return flags.join("|");
    }

    get styleTemplate() {
        if (this.useStyle) {
            return this.useStyle;
        }
        return ProjectEditor.getProject(this).lvglStyles.defaultStyles[
            this.type
        ];
    }

    override lvglCreate(
        runtime: LVGLPageRuntime,
        parentObj: number
    ): LVGLCreateResultType {
        const obj = this.lvglCreateObj(runtime, parentObj);

        runInAction(() => (this._lvglObj = obj));

        const project = ProjectEditor.getProject(this);

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
                    } else if (eventHandler.action) {
                        const action = ProjectEditor.findAction(
                            project,
                            eventHandler.action
                        );
                        if (action) {
                            const actionPath = getObjectPathAsString(action);
                            const actionFlowIndex =
                                runtime.wasm.assetsMap.flowIndexes[actionPath];
                            runtime.wasm._lvglAddObjectFlowCallback(
                                obj,
                                eventHandler.triggerCode,
                                flowIndex,
                                -1,
                                actionFlowIndex
                            );
                        }
                    }
                }

                if (this.hasEventHandler) {
                    this.createEventHandler(runtime, obj);
                }
            }
        }

        const lvglClassInfoProperties = getClassInfoLvglProperties(this);

        // add/clear flags
        {
            const { added, cleared } = changes(
                (lvglClassInfoProperties.defaultFlags ?? "").split("|"),
                this.allFlags.split("|") as (keyof typeof LVGL_FLAG_CODES)[]
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

            const hiddenFlagExpr = this.getExpressionPropertyData(
                runtime,
                "hiddenFlag"
            );
            if (hiddenFlagExpr) {
                runtime.wasm._lvglUpdateHiddenFlag(
                    obj,
                    hiddenFlagExpr.flowIndex,
                    hiddenFlagExpr.componentIndex,
                    hiddenFlagExpr.propertyIndex
                );
            }

            const clickableFlagExpr = this.getExpressionPropertyData(
                runtime,
                "clickableFlag"
            );
            if (clickableFlagExpr) {
                runtime.wasm._lvglUpdateClickableFlag(
                    obj,
                    clickableFlagExpr.flowIndex,
                    clickableFlagExpr.componentIndex,
                    clickableFlagExpr.propertyIndex
                );
            }

            if (this.hiddenInEditor && runtime.isEditor) {
                runtime.wasm._lvglObjAddFlag(
                    obj,
                    getCode(["HIDDEN"], LVGL_FLAG_CODES)
                );
            }
        }

        // add/clear states
        {
            const { added, cleared } = changes(
                (lvglClassInfoProperties.defaultStates ?? "").split("|"),
                this.allStates.split("|") as (keyof typeof LVGL_STATE_CODES)[]
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

            const checkedStateExpr = this.getExpressionPropertyData(
                runtime,
                "checkedState"
            );
            if (checkedStateExpr) {
                runtime.wasm._lvglUpdateCheckedState(
                    obj,
                    checkedStateExpr.flowIndex,
                    checkedStateExpr.componentIndex,
                    checkedStateExpr.propertyIndex
                );
            }

            const disabledStateExpr = this.getExpressionPropertyData(
                runtime,
                "disabledState"
            );
            if (disabledStateExpr) {
                runtime.wasm._lvglUpdateDisabledState(
                    obj,
                    disabledStateExpr.flowIndex,
                    disabledStateExpr.componentIndex,
                    disabledStateExpr.propertyIndex
                );
            }
        }

        let children: LVGLCreateResultType[];

        if (obj) {
            const useStyle = this.styleTemplate;
            if (useStyle) {
                const lvglStyle = findLvglStyle(project, useStyle);
                if (lvglStyle) {
                    lvglStyle.definition.lvglCreate(runtime, this, obj);
                }
            }
            this.localStyles.lvglCreate(runtime, this, obj);

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

    createEventHandler(runtime: LVGLPageRuntime, obj: number) {
        const checkedStateExpr = this.getExpressionPropertyData(
            runtime,
            "checkedState"
        );
        if (checkedStateExpr) {
            runtime.wasm._lvglAddObjectFlowCallback(
                obj,
                LV_EVENT_CHECKED_STATE_CHANGED,
                checkedStateExpr.flowIndex,
                checkedStateExpr.componentIndex,
                checkedStateExpr.propertyIndex
            );
        }

        this.createEventHandlerSpecific(runtime, obj);
    }

    createEventHandlerSpecific(runtime: LVGLPageRuntime, obj: number) {}

    lvglBuild(build: LVGLBuild): void {
        if (this.identifier) {
            build.line(`// ${this.identifier}`);
        }

        this.lvglBuildObj(build);

        if (build.isLvglObjectAccessible(this)) {
            build.line(`${build.getLvglObjectAccessor(this)} = obj;`);
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
                )}, LV_EVENT_ALL, 0);`
            );
        }

        const lvglClassInfoProperties = getClassInfoLvglProperties(this);

        // add/clear flags
        {
            const { added, cleared } = changes(
                (lvglClassInfoProperties.defaultFlags ?? "").split("|"),
                this.allFlags.split("|") as (keyof typeof LVGL_FLAG_CODES)[]
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
                (lvglClassInfoProperties.defaultStates ?? "").split("|"),
                this.allStates.split("|") as (keyof typeof LVGL_STATE_CODES)[]
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

        const useStyle = this.styleTemplate;
        if (useStyle) {
            build.line(`${build.getStyleFunctionName(useStyle)}(obj);`);
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

    lvglPostBuild(build: LVGLBuild): void {}

    lvglBuildTick(build: LVGLBuild): void {
        if (this.checkedStateType == "expression") {
            build.line(`{`);
            build.indent();

            if (
                build.assets.projectEditorStore.projectTypeTraits.hasFlowSupport
            ) {
                const page = getAncestorOfType(
                    this,
                    ProjectEditor.PageClass.classInfo
                ) as Page;

                let flowIndex = build.assets.getFlowIndex(page);
                let componentIndex = build.assets.getComponentIndex(this);
                const propertyIndex = build.assets.getComponentPropertyIndex(
                    this,
                    "checkedState"
                );

                build.line(
                    `bool new_val = evalBooleanProperty(${flowIndex}, ${componentIndex}, ${propertyIndex}, "Failed to evaluate Checked state");`
                );
            } else {
                build.line(
                    `bool new_val = ${build.getVariableGetterFunctionName(
                        this.checkedState as string
                    )}();`
                );
            }

            build.line(
                `bool cur_val = lv_obj_has_state(${build.getLvglObjectAccessor(
                    this
                )}, LV_STATE_CHECKED);`
            );

            build.line(`if (new_val != cur_val) {`);
            build.indent();
            build.line(
                `if (new_val) lv_obj_add_state(${build.getLvglObjectAccessor(
                    this
                )}, LV_STATE_CHECKED);`
            );
            build.line(
                `else lv_obj_clear_state(${build.getLvglObjectAccessor(
                    this
                )}, LV_STATE_CHECKED);`
            );
            build.unindent();
            build.line(`}`);

            build.unindent();
            build.line(`}`);
        }

        if (this.disabledStateType == "expression") {
            build.line(`{`);
            build.indent();

            if (
                build.assets.projectEditorStore.projectTypeTraits.hasFlowSupport
            ) {
                const page = getAncestorOfType(
                    this,
                    ProjectEditor.PageClass.classInfo
                ) as Page;

                let flowIndex = build.assets.getFlowIndex(page);
                let componentIndex = build.assets.getComponentIndex(this);
                const propertyIndex = build.assets.getComponentPropertyIndex(
                    this,
                    "disabledState"
                );

                build.line(
                    `bool new_val = evalBooleanProperty(${flowIndex}, ${componentIndex}, ${propertyIndex}, "Failed to evaluate Disabled state");`
                );
            } else {
                build.line(
                    `bool new_val = ${build.getVariableGetterFunctionName(
                        this.disabledState as string
                    )}();`
                );
            }

            build.line(
                `bool cur_val = lv_obj_has_state(${build.getLvglObjectAccessor(
                    this
                )}, LV_STATE_DISABLED);`
            );

            build.line(`if (new_val != cur_val) {`);
            build.indent();
            build.line(
                `if (new_val) lv_obj_add_state(${build.getLvglObjectAccessor(
                    this
                )}, LV_STATE_DISABLED);`
            );
            build.line(
                `else lv_obj_clear_state(${build.getLvglObjectAccessor(
                    this
                )}, LV_STATE_DISABLED);`
            );
            build.unindent();
            build.line(`}`);

            build.unindent();
            build.line(`}`);
        }

        if (this.hiddenFlagType == "expression") {
            build.line(`{`);
            build.indent();

            if (
                build.assets.projectEditorStore.projectTypeTraits.hasFlowSupport
            ) {
                const page = getAncestorOfType(
                    this,
                    ProjectEditor.PageClass.classInfo
                ) as Page;

                let flowIndex = build.assets.getFlowIndex(page);
                let componentIndex = build.assets.getComponentIndex(this);
                const propertyIndex = build.assets.getComponentPropertyIndex(
                    this,
                    "hiddenFlag"
                );

                build.line(
                    `bool new_val = evalBooleanProperty(${flowIndex}, ${componentIndex}, ${propertyIndex}, "Failed to evaluate Hidden flag");`
                );
            } else {
                build.line(
                    `bool cur_val = ${build.getVariableGetterFunctionName(
                        this.hiddenFlag as string
                    )}();`
                );
            }

            build.line(
                `bool cur_val = lv_obj_has_flag(${build.getLvglObjectAccessor(
                    this
                )}, LV_OBJ_FLAG_HIDDEN);`
            );

            build.line(`if (new_val != cur_val) {`);
            build.indent();
            build.line(
                `if (new_val) lv_obj_add_flag(${build.getLvglObjectAccessor(
                    this
                )}, LV_OBJ_FLAG_HIDDEN);`
            );
            build.line(
                `else lv_obj_clear_flag(${build.getLvglObjectAccessor(
                    this
                )}, LV_OBJ_FLAG_HIDDEN);`
            );
            build.unindent();
            build.line(`}`);

            build.unindent();
            build.line(`}`);
        }

        if (this.clickableFlagType == "expression") {
            build.line(`{`);
            build.indent();

            if (
                build.assets.projectEditorStore.projectTypeTraits.hasFlowSupport
            ) {
                const page = getAncestorOfType(
                    this,
                    ProjectEditor.PageClass.classInfo
                ) as Page;

                let flowIndex = build.assets.getFlowIndex(page);
                let componentIndex = build.assets.getComponentIndex(this);
                const propertyIndex = build.assets.getComponentPropertyIndex(
                    this,
                    "clickableFlag"
                );

                build.line(
                    `bool new_val = evalBooleanProperty(${flowIndex}, ${componentIndex}, ${propertyIndex}, "Failed to evaluate Hidden flag");`
                );
            } else {
                build.line(
                    `bool cur_val = ${build.getVariableGetterFunctionName(
                        this.clickableFlag as string
                    )}();`
                );
            }

            build.line(
                `bool cur_val = lv_obj_has_flag(${build.getLvglObjectAccessor(
                    this
                )}, LV_OBJ_FLAG_CLICKABLE);`
            );

            build.line(`if (new_val != cur_val) {`);
            build.indent();
            build.line(
                `if (new_val) lv_obj_add_flag(${build.getLvglObjectAccessor(
                    this
                )}, LV_OBJ_FLAG_CLICKABLE);`
            );
            build.line(
                `else lv_obj_clear_flag(${build.getLvglObjectAccessor(
                    this
                )}, LV_OBJ_FLAG_CLICKABLE);`
            );
            build.unindent();
            build.line(`}`);

            build.unindent();
            build.line(`}`);
        }

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
        const lvglClassInfoProperties = getClassInfoLvglProperties(this);
        if (
            lvglClassInfoProperties.parts.indexOf(
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
        return (
            this.checkedStateType == "expression" ||
            this.disabledStateType == "expression"
        );
    }

    buildEventHandler(build: LVGLBuild) {
        if (this.checkedStateType == "expression") {
            build.line("if (event == LV_EVENT_VALUE_CHANGED) {");
            build.indent();

            build.line(`lv_obj_t *ta = lv_event_get_target(e);`);
            build.line(`bool value = lv_obj_has_state(ta, LV_STATE_CHECKED);`);

            if (
                build.assets.projectEditorStore.projectTypeTraits.hasFlowSupport
            ) {
                const page = getAncestorOfType(
                    this,
                    ProjectEditor.PageClass.classInfo
                ) as Page;
                let flowIndex = build.assets.getFlowIndex(page);
                let componentIndex = build.assets.getComponentIndex(this);
                const propertyIndex = build.assets.getComponentPropertyIndex(
                    this,
                    "checkedState"
                );

                build.line(
                    `assignBooleanProperty(${flowIndex}, ${componentIndex}, ${propertyIndex}, value, "Failed to assign Checked state");`
                );
            } else {
                build.line(
                    `${build.getVariableSetterFunctionName(
                        this.checkedState as string
                    )}(value);`
                );
            }

            build.unindent();
            build.line("}");
        }

        this.buildEventHandlerSpecific(build);
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
            ...makeExpressionProperty(
                "text",
                "string",
                "input",
                ["literal", "expression"],
                {
                    propertyGridGroup: labelGroup
                }
            ),
            {
                name: "longMode",
                type: PropertyType.Enum,
                enumItems: Object.keys(LONG_MODE_CODES).map(id => ({
                    id,
                    label: id
                })),
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
            width: 80,
            height: 32,
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
            text: observable,
            textType: observable,
            longMode: observable,
            recolor: observable
        });
    }

    override lvglCreateObj(
        runtime: LVGLPageRuntime,
        parentObj: number
    ): number {
        const textExpr = this.getExpressionPropertyData(runtime, "text");

        const obj = runtime.wasm._lvglCreateLabel(
            parentObj,
            runtime.getWidgetIndex(this),
            this.lvglCreateLeft,
            this.lvglCreateTop,
            this.lvglCreateWidth,
            this.lvglCreateHeight,
            textExpr
                ? 0
                : runtime.wasm.allocateUTF8(
                      this.textType == "expression"
                          ? `{${this.text}}`
                          : this.text
                  ),
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
            build.line(
                `lv_label_set_text(obj, ${escapeCString(this.text ?? "")});`
            );
        }
    }

    override lvglBuildTickSpecific(build: LVGLBuild) {
        expressionPropertyBuildTickSpecific<LVGLLabelWidget>(
            build,
            this,
            "text" as const,
            "lv_label_get_text",
            "lv_label_set_text"
        );
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
            flags: "PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE|SCROLL_ELASTIC|SCROLL_ON_FOCUS|SCROLL_MOMENTUM|SCROLL_CHAIN",
            clickableFlag: true
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

    override lvglCreateObj(
        runtime: LVGLPageRuntime,
        parentObj: number
    ): number {
        return runtime.wasm._lvglCreateButton(
            parentObj,
            runtime.getWidgetIndex(this),
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
            flags: "PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_CHAIN",
            clickableFlag: true
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

    override lvglCreateObj(
        runtime: LVGLPageRuntime,
        parentObj: number
    ): number {
        return runtime.wasm._lvglCreatePanel(
            parentObj,
            runtime.getWidgetIndex(this),
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
            width: 100,
            height: 100,
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

    override lvglCreateObj(
        runtime: LVGLPageRuntime,
        parentObj: number
    ): number {
        const obj = runtime.wasm._lvglCreateImage(
            parentObj,
            runtime.getWidgetIndex(this),
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

        const bitmap = ProjectEditor.findBitmap(
            ProjectEditor.getProject(this),
            this.image
        );

        if (bitmap && bitmap.image) {
            (async () => {
                const image = await runtime.loadBitmap(bitmap);
                if (!runtime.isEditor || obj == this._lvglObj) {
                    runtime.wasm._lvglSetImageSrc(obj, image);
                    runInAction(() => this._refreshCounter++);
                }
            })();
        }

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
    value: number | string;
    valueType: LVGLPropertyType;
    valueLeft: number | string;
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
                enumItems: Object.keys(SLIDER_MODES).map(id => ({
                    id,
                    label: id
                })),
                enumDisallowUndefined: true,
                propertyGridGroup: sliderGroup
            },
            ...makeExpressionProperty(
                "value",
                "integer",
                "assignable",
                ["literal", "expression"],
                {
                    propertyGridGroup: sliderGroup
                }
            ),
            ...makeExpressionProperty(
                "valueLeft",
                "integer",
                "assignable",
                ["literal", "expression"],
                {
                    propertyGridGroup: sliderGroup,
                    hideInPropertyGrid: (slider: LVGLSliderWidget) =>
                        slider.mode != "RANGE"
                }
            )
        ],

        defaultValue: {
            left: 0,
            top: 0,
            width: 150,
            height: 10,
            flags: "PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE",
            clickableFlag: true,
            min: 0,
            max: 100,
            mode: "NORMAL",
            value: 25,
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
            super.hasEventHandler ||
            this.valueType == "expression" ||
            (this.mode == "RANGE" && this.valueLeftType == "expression")
        );
    }

    override lvglCreateObj(
        runtime: LVGLPageRuntime,
        parentObj: number
    ): number {
        const valueExpr = this.getExpressionPropertyData(runtime, "value");
        const valueLeftExpr =
            this.mode == "RANGE"
                ? this.getExpressionPropertyData(runtime, "valueLeft")
                : undefined;

        const obj = runtime.wasm._lvglCreateSlider(
            parentObj,
            runtime.getWidgetIndex(this),
            this.lvglCreateLeft,
            this.lvglCreateTop,
            this.lvglCreateWidth,
            this.lvglCreateHeight,
            this.min,
            this.max,
            SLIDER_MODES[this.mode],
            valueExpr
                ? !valueLeftExpr
                    ? (this.valueLeft as number)
                    : 0
                : (this.value as number),
            valueLeftExpr ? 0 : (this.valueLeft as number)
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

        if (this.mode == "RANGE" && this.valueLeftType == "literal") {
            if (this.valueType == "expression") {
                build.line(
                    `lv_slider_set_value(obj, ${this.valueLeft}, LV_ANIM_OFF);`
                );
            }

            build.line(
                `lv_slider_set_left_value(obj, ${this.valueLeft}, LV_ANIM_OFF);`
            );
        }
    }

    override lvglBuildTickSpecific(build: LVGLBuild) {
        expressionPropertyBuildTickSpecific<LVGLSliderWidget>(
            build,
            this,
            "value" as const,
            "lv_slider_get_value",
            "lv_slider_set_value",
            ", LV_ANIM_OFF"
        );

        if (this.mode == "RANGE") {
            expressionPropertyBuildTickSpecific<LVGLSliderWidget>(
                build,
                this,
                "valueLeft" as const,
                "lv_slider_get_left_value",
                "lv_slider_set_left_value",
                ", LV_ANIM_OFF"
            );
        }
    }

    override buildEventHandlerSpecific(build: LVGLBuild) {
        expressionPropertyBuildEventHandlerSpecific<LVGLSliderWidget>(
            build,
            this,
            "value" as const,
            "lv_slider_get_value"
        );

        if (this.mode == "RANGE") {
            expressionPropertyBuildEventHandlerSpecific<LVGLSliderWidget>(
                build,
                this,
                "valueLeft" as const,
                "lv_slider_get_left_value"
            );
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
                enumItems: Object.keys(ROLLER_MODES).map(id => ({
                    id,
                    label: id
                })),
                enumDisallowUndefined: true,
                propertyGridGroup: rollerGroup
            }
        ],

        defaultValue: {
            left: 0,
            top: 0,
            width: 80,
            height: 100,
            flags: "PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE",
            clickableFlag: true,
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

    override lvglCreateObj(
        runtime: LVGLPageRuntime,
        parentObj: number
    ): number {
        return runtime.wasm._lvglCreateRoller(
            parentObj,
            runtime.getWidgetIndex(this),
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
                this.options ?? ""
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
            flags: "PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE",
            clickableFlag: true
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

        makeObservable(this, {});
    }

    override lvglCreateObj(
        runtime: LVGLPageRuntime,
        parentObj: number
    ): number {
        return runtime.wasm._lvglCreateSwitch(
            parentObj,
            runtime.getWidgetIndex(this),
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

const BAR_MODES = {
    NORMAL: 0,
    SYMMETRICAL: 1,
    RANGE: 2
};

export const barGroup: IPropertyGridGroupDefinition = {
    id: "lvgl-bar",
    title: "Bar",
    position: SPECIFIC_GROUP_POSITION
};

export class LVGLBarWidget extends LVGLWidget {
    min: number;
    max: number;
    mode: keyof typeof BAR_MODES;
    value: number | string;
    valueType: LVGLPropertyType;
    valueStart: number | string;
    valueStartType: LVGLPropertyType;

    static classInfo = makeDerivedClassInfo(LVGLWidget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType === ProjectType.LVGL,

        componentPaletteGroupName: "!1Visualiser Widgets",

        properties: [
            {
                name: "min",
                type: PropertyType.Number,
                propertyGridGroup: barGroup
            },
            {
                name: "max",
                type: PropertyType.Number,
                propertyGridGroup: barGroup
            },
            {
                name: "mode",
                type: PropertyType.Enum,
                enumItems: Object.keys(BAR_MODES).map(id => ({
                    id,
                    label: id
                })),
                enumDisallowUndefined: true,
                propertyGridGroup: barGroup
            },
            ...makeExpressionProperty(
                "value",
                "integer",
                "input",
                ["literal", "expression"],
                {
                    propertyGridGroup: barGroup
                }
            ),
            ...makeExpressionProperty(
                "valueStart",
                "integer",
                "input",
                ["literal", "expression"],
                {
                    propertyGridGroup: barGroup,
                    hideInPropertyGrid: (bar: LVGLBarWidget) =>
                        bar.mode != "RANGE"
                }
            )
        ],

        defaultValue: {
            left: 0,
            top: 0,
            width: 150,
            height: 10,
            flags: "PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE",
            clickableFlag: true,
            min: 0,
            max: 100,
            mode: "NORMAL",
            value: 25,
            valueType: "literal",
            valueStart: 0,
            valueStartType: "literal"
        },

        icon: (
            <svg viewBox="0 0 32 32" fill="currentColor">
                <path d="M28 21H4a2.0021 2.0021 0 0 1-2-2v-6a2.0021 2.0021 0 0 1 2-2h24a2.0021 2.0021 0 0 1 2 2v6a2.0021 2.0021 0 0 1-2 2ZM4 13v6h24v-6Z" />
                <path d="M6 15h14v2H6z" />
                <path fill="none" d="M0 0h32v32H0z" />
            </svg>
        ),

        lvgl: {
            parts: ["MAIN", "INDICATOR"],
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
            defaultFlags: "PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE",
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
            valueStart: observable,
            valueStartType: observable
        });
    }

    override get hasEventHandler() {
        return (
            super.hasEventHandler ||
            this.valueType == "expression" ||
            (this.mode == "RANGE" && this.valueStartType == "expression")
        );
    }

    override lvglCreateObj(
        runtime: LVGLPageRuntime,
        parentObj: number
    ): number {
        const valueExpr = this.getExpressionPropertyData(runtime, "value");
        const valueStartExpr =
            this.mode == "RANGE"
                ? this.getExpressionPropertyData(runtime, "valueStart")
                : undefined;

        const obj = runtime.wasm._lvglCreateBar(
            parentObj,
            runtime.getWidgetIndex(this),
            this.lvglCreateLeft,
            this.lvglCreateTop,
            this.lvglCreateWidth,
            this.lvglCreateHeight,
            this.min,
            this.max,
            BAR_MODES[this.mode],
            valueExpr
                ? !valueStartExpr
                    ? (this.valueStart as number)
                    : 0
                : (this.value as number),
            valueStartExpr ? 0 : (this.valueStart as number)
        );

        if (valueExpr) {
            runtime.wasm._lvglUpdateBarValue(
                obj,
                valueExpr.flowIndex,
                valueExpr.componentIndex,
                valueExpr.propertyIndex
            );
        }

        if (valueStartExpr) {
            runtime.wasm._lvglUpdateBarValueStart(
                obj,
                valueStartExpr.flowIndex,
                valueStartExpr.componentIndex,
                valueStartExpr.propertyIndex
            );
        }

        return obj;
    }

    override lvglBuildObj(build: LVGLBuild) {
        build.line(`lv_obj_t *obj = lv_bar_create(parent_obj);`);
    }

    override lvglBuildSpecific(build: LVGLBuild) {
        if (this.min != 0 || this.max != 100) {
            build.line(`lv_bar_set_range(obj, ${this.min}, ${this.max});`);
        }

        if (this.mode != "NORMAL") {
            build.line(`lv_bar_set_mode(obj, LV_BAR_MODE_${this.mode});`);
        }

        if (this.valueType == "literal") {
            if (this.value != 0) {
                build.line(
                    `lv_bar_set_value(obj, ${this.value}, LV_ANIM_OFF);`
                );
            }
        }

        if (this.mode == "RANGE" && this.valueStartType == "literal") {
            if (this.valueType == "expression") {
                build.line(
                    `lv_bar_set_value(obj, ${this.valueStart}, LV_ANIM_OFF);`
                );
            }

            build.line(
                `lv_bar_set_start_value(obj, ${this.valueStart}, LV_ANIM_OFF);`
            );
        }
    }

    override lvglBuildTickSpecific(build: LVGLBuild) {
        expressionPropertyBuildTickSpecific<LVGLBarWidget>(
            build,
            this,
            "value" as const,
            "lv_bar_get_value",
            "lv_bar_set_value",
            ", LV_ANIM_OFF"
        );

        if (this.mode == "RANGE") {
            expressionPropertyBuildTickSpecific<LVGLBarWidget>(
                build,
                this,
                "valueStart" as const,
                "lv_bar_get_start_value",
                "lv_bar_set_start_value",
                ", LV_ANIM_OFF"
            );
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

export const dropdownGroup: IPropertyGridGroupDefinition = {
    id: "lvgl-dropdown",
    title: "Dropdown",
    position: SPECIFIC_GROUP_POSITION
};

export class LVGLDropdownWidget extends LVGLWidget {
    options: string;

    static classInfo = makeDerivedClassInfo(LVGLWidget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType === ProjectType.LVGL,

        componentPaletteGroupName: "!1Input Widgets",

        properties: [
            {
                name: "options",
                type: PropertyType.MultilineText,
                propertyGridGroup: dropdownGroup
            }
        ],

        defaultValue: {
            left: 0,
            top: 0,
            width: 150,
            height: 32,
            heightUnit: "content",
            flags: "PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE",
            clickableFlag: true,
            options: "Option 1\nOption 2\nOption 3",
            mode: "NORMAL"
        },

        icon: (
            <svg viewBox="0 0 1000 1000" fill="currentColor">
                <path d="M258.8 402.9v157.4H990V402.9H258.8zm685.5 111.7H304.5v-66h639.8v66zM258.8 743.1H990V585.7H258.8v157.4zm45.7-111.7h639.8v66H304.5v-66zm-45.7 293.2H990V767.2H258.8v157.4zm45.7-111.7h639.8v66H304.5v-66zm436.7-463.3h198V75.4H10v274.2h731.2zm0-228.5h152.3v182.8H741.2V121.1zM55.7 303.9V121.1h639.8v182.8H55.7zm714.7-113.5h100.1l-50 63.6-50.1-63.6z" />
            </svg>
        ),

        lvgl: {
            parts: ["MAIN", "SELECTED"],
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
            options: observable
        });
    }

    override lvglCreateObj(
        runtime: LVGLPageRuntime,
        parentObj: number
    ): number {
        return runtime.wasm._lvglCreateDropdown(
            parentObj,
            runtime.getWidgetIndex(this),
            this.lvglCreateLeft,
            this.lvglCreateTop,
            this.lvglCreateWidth,
            this.lvglCreateHeight,
            runtime.wasm.allocateUTF8(this.options)
        );
    }

    override lvglBuildObj(build: LVGLBuild) {
        build.line(`lv_obj_t *obj = lv_dropdown_create(parent_obj);`);
    }

    override lvglBuildSpecific(build: LVGLBuild) {
        build.line(
            `lv_dropdown_set_options(obj, ${escapeCString(
                this.options ?? ""
            )});`
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

const ARC_MODES = {
    NORMAL: 0,
    REVERSE: 1,
    SYMMETRICAL: 2
};

export const arcGroup: IPropertyGridGroupDefinition = {
    id: "lvgl-arc",
    title: "Arc",
    position: SPECIFIC_GROUP_POSITION
};

export class LVGLArcWidget extends LVGLWidget {
    rangeMin: number;
    rangeMax: number;
    value: number | string;
    valueType: LVGLPropertyType;
    bgStartAngle: number;
    bgEndAngle: number;
    mode: keyof typeof ARC_MODES;
    rotation: number;

    static classInfo = makeDerivedClassInfo(LVGLWidget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType === ProjectType.LVGL,

        componentPaletteGroupName: "!1Basic Widgets",

        properties: [
            {
                name: "rangeMin",
                type: PropertyType.Number,
                propertyGridGroup: arcGroup
            },
            {
                name: "rangeMax",
                type: PropertyType.Number,
                propertyGridGroup: arcGroup
            },
            ...makeExpressionProperty(
                "value",
                "integer",
                "assignable",
                ["literal", "expression"],
                {
                    propertyGridGroup: arcGroup
                }
            ),
            {
                name: "bgStartAngle",
                type: PropertyType.Number,
                propertyGridGroup: arcGroup
            },
            {
                name: "bgEndAngle",
                type: PropertyType.Number,
                propertyGridGroup: arcGroup
            },
            {
                name: "mode",
                type: PropertyType.Enum,
                enumItems: Object.keys(ARC_MODES).map(id => ({
                    id,
                    label: id
                })),
                enumDisallowUndefined: true,
                propertyGridGroup: arcGroup
            },
            {
                name: "rotation",
                type: PropertyType.Number,
                propertyGridGroup: arcGroup
            }
        ],

        defaultValue: {
            left: 0,
            top: 0,
            width: 150,
            height: 150,
            flags: "PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE",
            clickableFlag: true,
            rangeMin: 0,
            rangeMax: 100,
            value: 25,
            valueType: "literal",
            bgStartAngle: 120,
            bgEndAngle: 60,
            mode: "NORMAL",
            rotation: 0
        },

        icon: (
            <svg
                viewBox="0 0 100 100"
                stroke="currentColor"
                fill="currentColor"
            >
                <path
                    transform="matrix(0.284019, 0.365203, -0.365202, 0.284019, 52.485165, -170.485977)"
                    d="M 428.885 388.909 A 98.905 98.905 0 1 1 449.648 246.739 L 429.979 262.257 A 73.851 73.851 0 1 0 414.475 368.413 Z"
                ></path>
                <path
                    d="M 65.922 86.406 C 58.202 78.686 58.202 66.17 65.922 58.449 C 73.642 50.73 86.158 50.73 93.878 58.449 C 101.598 66.17 101.598 78.686 93.878 86.406 C 86.158 94.125 73.642 94.125 65.922 86.406 Z M 86.957 79.485 C 90.855 75.585 90.855 69.268 86.957 65.37 C 83.06 61.471 76.74 61.471 72.843 65.37 C 68.945 69.268 68.945 75.585 72.843 79.485 C 76.74 83.382 83.06 83.382 86.957 79.485 Z"
                    style={{ strokeWidth: 1.98 }}
                    transform="matrix(0.613904, 0.789381, -0.789381, 0.613904, 88.021956, -35.107547)"
                ></path>
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
                "SCROLLABLE",
                "SCROLL_ON_FOCUS",
                "SCROLL_ELASTIC",
                "SCROLL_MOMENTUM",
                "SCROLL_ON_FOCUS",
                "SCROLL_CHAIN",
                "SCROLL_ONE"
            ],
            defaultFlags:
                "CLICKABLE|PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE",
            states: ["CHECKED", "DISABLED", "FOCUSED", "PRESSED"]
        }
    });

    constructor() {
        super();

        makeObservable(this, {
            rangeMin: observable,
            rangeMax: observable,
            value: observable,
            valueType: observable,
            bgStartAngle: observable,
            bgEndAngle: observable,
            mode: observable,
            rotation: observable
        });
    }

    override get hasEventHandler() {
        return super.hasEventHandler || this.valueType == "expression";
    }

    override lvglCreateObj(
        runtime: LVGLPageRuntime,
        parentObj: number
    ): number {
        const valueExpr = this.getExpressionPropertyData(runtime, "value");

        const obj = runtime.wasm._lvglCreateArc(
            parentObj,
            runtime.getWidgetIndex(this),
            this.lvglCreateLeft,
            this.lvglCreateTop,
            this.lvglCreateWidth,
            this.lvglCreateHeight,
            this.rangeMin,
            this.rangeMax,
            valueExpr ? 0 : (this.value as number),
            this.bgStartAngle,
            this.bgEndAngle,
            ARC_MODES[this.mode],
            this.rotation
        );

        if (valueExpr) {
            runtime.wasm._lvglUpdateArcValue(
                obj,
                valueExpr.flowIndex,
                valueExpr.componentIndex,
                valueExpr.propertyIndex
            );
        }

        return obj;
    }

    override createEventHandlerSpecific(runtime: LVGLPageRuntime, obj: number) {
        const valueExpr = this.getExpressionPropertyData(runtime, "value");
        if (valueExpr) {
            runtime.wasm._lvglAddObjectFlowCallback(
                obj,
                LV_EVENT_ARC_VALUE_CHANGED,
                valueExpr.flowIndex,
                valueExpr.componentIndex,
                valueExpr.propertyIndex
            );
        }
    }

    override lvglBuildObj(build: LVGLBuild) {
        build.line(`lv_obj_t *obj = lv_arc_create(parent_obj);`);
    }

    override lvglBuildSpecific(build: LVGLBuild) {
        if (this.rangeMin != 0 || this.rangeMax != 100) {
            build.line(
                `lv_arc_set_range(obj, ${this.rangeMin}, ${this.rangeMax});`
            );
        }

        if (this.valueType == "literal") {
            if (this.value != 0) {
                build.line(`lv_arc_set_value(obj, ${this.value});`);
            }
        }

        if (this.bgStartAngle != 120) {
            build.line(`lv_arc_set_bg_start_angle(obj, ${this.bgStartAngle});`);
        }

        if (this.bgEndAngle != 0) {
            build.line(`lv_arc_set_bg_end_angle(obj, ${this.bgEndAngle});`);
        }

        if (this.mode != "NORMAL") {
            build.line(`lv_arc_set_mode(obj, LV_ARC_MODE_${this.mode});`);
        }

        if (this.rotation != 0) {
            build.line(`lv_arc_set_rotation(obj, ${this.rotation});`);
        }
    }

    override lvglBuildTickSpecific(build: LVGLBuild) {
        expressionPropertyBuildTickSpecific<LVGLArcWidget>(
            build,
            this,
            "value" as const,
            "lv_arc_get_value",
            "lv_arc_set_value"
        );
    }

    override buildEventHandlerSpecific(build: LVGLBuild) {
        expressionPropertyBuildEventHandlerSpecific<LVGLArcWidget>(
            build,
            this,
            "value" as const,
            "lv_arc_get_value"
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

export class LVGLSpinnerWidget extends LVGLWidget {
    static classInfo = makeDerivedClassInfo(LVGLWidget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType === ProjectType.LVGL,

        componentPaletteGroupName: "!1Visualiser Widgets",

        properties: [],

        defaultValue: {
            left: 0,
            top: 0,
            width: 80,
            height: 80,
            flags: "GESTURE_BUBBLE|SNAPPABLE|SCROLL_CHAIN"
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
                <path d="M12 3a9 9 0 1 0 9 9" />
            </svg>
        ),

        lvgl: {
            parts: ["MAIN", "INDICATOR"],
            flags: [
                "HIDDEN",
                "CLICKABLE",
                "IGNORE_LAYOUT",
                "FLOATING",
                "EVENT_BUBBLE",
                "GESTURE_BUBBLE",
                "SNAPPABLE",
                "SCROLL_CHAIN"
            ],
            defaultFlags: "GESTURE_BUBBLE|SNAPPABLE|SCROLL_CHAIN",
            states: ["CHECKED", "DISABLED", "FOCUSED", "PRESSED"]
        }
    });

    constructor() {
        super();

        makeObservable(this, {});
    }

    override lvglCreateObj(
        runtime: LVGLPageRuntime,
        parentObj: number
    ): number {
        return runtime.wasm._lvglCreateSpinner(
            parentObj,
            runtime.getWidgetIndex(this),
            this.lvglCreateLeft,
            this.lvglCreateTop,
            this.lvglCreateWidth,
            this.lvglCreateHeight
        );
    }

    override lvglBuildObj(build: LVGLBuild) {
        build.line(`lv_obj_t *obj = lv_spinner_create(parent_obj, 1000, 60);`);
    }
}

////////////////////////////////////////////////////////////////////////////////

export const checkboxGroup: IPropertyGridGroupDefinition = {
    id: "lvgl-checkbox",
    title: "Checkbox",
    position: SPECIFIC_GROUP_POSITION
};

export class LVGLCheckboxWidget extends LVGLWidget {
    text: string;

    static classInfo = makeDerivedClassInfo(LVGLWidget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType === ProjectType.LVGL,

        componentPaletteGroupName: "!1Input Widgets",

        properties: [
            {
                name: "text",
                type: PropertyType.String,
                propertyGridGroup: checkboxGroup
            }
        ],

        defaultValue: {
            left: 0,
            top: 0,
            width: 105,
            widthUnit: "content",
            height: 20,
            heightUnit: "content",
            flags: "PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE|SCROLL_ON_FOCUS",
            clickableFlag: true,
            text: "Checkbox"
        },

        icon: (
            <svg
                viewBox="0 0 1280 1279"
                stroke="currentColor"
                fill="currentColor"
            >
                <path d="M1052 225.7c-13 8-54 35.2-66.2 43.9l-11.8 8.5-11.8-7.8c-28.8-19.1-64.8-34-98.6-40.8-31.8-6.4-10.6-6-307.1-6-280.2 0-275.2-.1-300 4.1-45.9 7.7-92.8 28.7-129.5 58-10.9 8.7-29.7 27.5-38.4 38.4-28.3 35.6-44.7 72.7-52.4 119.4-1.5 9.2-1.7 34.4-2 291.6-.2 183.6.1 286 .7 294.5 2.5 32.4 10.1 60 24.2 88.5 14.2 28.7 31 51.2 54.9 73.5 34.1 32 79.1 55.4 127 66.3 31.7 7.2 6.3 6.7 314.5 6.7h277l14-2.2c92.9-14.9 166.7-67 205-144.8 11-22.4 17.7-43.4 22.2-70.2 1.7-10.3 1.8-24.8 1.8-302.3 0-309.6.2-295.9-4.6-318.5-7.7-36.4-25-72.3-49.7-103.2-7.9-10-9-11.6-7.4-11.1.8.3 35.3-35.7 44.9-46.9 9.4-10.9 11.5-16.3 6.3-16.3-4.1 0-33.1 16.4-40.5 22.9-9.6 8.5-5.3 3.7 17.1-18.7l25.1-25.1-2.9-3.6c-1.6-1.9-3.3-3.5-3.6-3.4-.4 0-4.1 2.1-8.2 4.6zM836.5 334.8c6.1 1.2 14.9 3.3 19.6 4.6 9.6 2.9 25.9 9.4 25.9 10.5 0 .4-8.2 7.8-18.2 16.6-131.9 115.4-266.2 268.4-386.9 441-9.7 13.7-20.7 29.6-24.5 35.3-3.8 5.6-7.4 10-8 9.8-.9-.3-137.4-81.8-218.1-130.2l-7.2-4.3-3 3.8-3.1 3.8 11.2 13.9c49.6 61.6 263.1 323.4 263.7 323.4.4 0 1.3-1 2-2.2.6-1.3.9-1.5.7-.6-.5 1.9 5 7.3 9.1 8.9 3.9 1.5 8.5-1.1 12-6.7 1.6-2.7 7.4-14.4 12.8-25.9 27.4-58.3 76.5-153.1 111-214 84.9-150.1 186.4-294.2 291.8-414.3 6.4-7.4 10.5-12.8 10.1-13.5-.4-.7.3-.3 1.5.8 5.9 5.2 17.2 25.8 22.1 40.3 6.5 19.5 6.1-1.4 5.8 312.7l-.3 285-2.7 10c-1.6 5.5-3.8 12.5-5 15.5-14.9 37.8-46.5 68.6-86.6 84.5-19.1 7.5-34.9 11-56.7 12.5-19 1.3-502.3 1.3-521.3 0-24.3-1.7-44.3-6.7-64.9-16.5-44.7-21.2-74.4-57.1-84-101.8-1.7-7.7-1.8-24.4-1.8-293.2 0-270.2.1-285.4 1.8-293.5 3.8-18 10-32.8 20.3-48.2 25.4-38.2 70.8-64.4 120.9-69.7 4.4-.5 127.5-.8 273.5-.7l265.5.2 11 2.2z" />
            </svg>
        ),

        lvgl: {
            parts: ["MAIN", "INDICATOR"],
            flags: [
                "HIDDEN",
                "CLICKABLE",
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
                "CLICKABLE|PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE|SCROLL_ON_FOCUS",
            states: ["CHECKED", "DISABLED", "FOCUSED", "PRESSED"]
        }
    });

    constructor() {
        super();

        makeObservable(this, { text: observable });
    }

    override lvglCreateObj(
        runtime: LVGLPageRuntime,
        parentObj: number
    ): number {
        return runtime.wasm._lvglCreateCheckbox(
            parentObj,
            runtime.getWidgetIndex(this),
            this.lvglCreateLeft,
            this.lvglCreateTop,
            this.lvglCreateWidth,
            this.lvglCreateHeight,
            runtime.wasm.allocateUTF8(this.text)
        );
    }

    override lvglBuildObj(build: LVGLBuild) {
        build.line(`lv_obj_t *obj = lv_checkbox_create(parent_obj);`);
    }

    override lvglBuildSpecific(build: LVGLBuild) {
        build.line(
            `lv_checkbox_set_text(obj, ${escapeCString(this.text ?? "")});`
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

const textareaGroup: IPropertyGridGroupDefinition = {
    id: "lvgl-textarea",
    title: "Textarea",
    position: SPECIFIC_GROUP_POSITION
};

export class LVGLTextareaWidget extends LVGLWidget {
    text: string;
    textType: LVGLPropertyType;
    placeholder: string;
    oneLineMode: boolean;
    passwordMode: boolean;
    acceptedCharacters: string;
    maxTextLength: number;

    static classInfo = makeDerivedClassInfo(LVGLWidget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType === ProjectType.LVGL,

        componentPaletteGroupName: "!1Basic Widgets",

        properties: [
            ...makeExpressionProperty(
                "text",
                "string",
                "input",
                ["literal", "expression"],
                {
                    propertyGridGroup: textareaGroup
                }
            ),
            {
                name: "placeholder",
                type: PropertyType.String,
                propertyGridGroup: textareaGroup
            },
            {
                name: "oneLineMode",
                type: PropertyType.Boolean,
                propertyGridGroup: textareaGroup
            },
            {
                name: "passwordMode",
                type: PropertyType.Boolean,
                propertyGridGroup: textareaGroup
            },
            {
                name: "acceptedCharacters",
                type: PropertyType.String,
                propertyGridGroup: textareaGroup
            },
            {
                name: "maxTextLength",
                type: PropertyType.Number,
                propertyGridGroup: textareaGroup
            }
        ],

        defaultValue: {
            left: 0,
            top: 0,
            width: 150,
            height: 70,
            flags: "PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE|SCROLLABLE|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_CHAIN",
            clickableFlag: true,
            text: "",
            textType: "literal",
            placeholder: "",
            oneLineMode: false,
            passwordMode: false,
            acceptedCharacters: "",
            maxTextLength: 128
        },

        icon: (
            <svg
                viewBox="0 0 509.337 509.338"
                stroke="currentColor"
                fill="currentColor"
            >
                <path d="M396.283 310.907c-3.809-1.52-7.143-.853-9.996 1.998l-18.274 18.274c-1.711 1.708-2.573 3.806-2.573 6.276v35.978c0 12.565-4.463 23.314-13.408 32.264-8.952 8.945-19.701 13.418-32.264 13.418H82.224c-12.562 0-23.317-4.473-32.264-13.418-8.947-8.949-13.418-19.698-13.418-32.264V135.895c0-12.563 4.471-23.317 13.418-32.265 8.947-8.945 19.702-13.418 32.264-13.418H319.77c4.186 0 8.47.571 12.847 1.714 3.433 1.141 6.472.381 9.134-2.284l13.986-13.99c2.286-2.281 3.138-5.043 2.57-8.278-.571-3.044-2.286-5.234-5.141-6.565-10.28-4.752-21.412-7.139-33.403-7.139H82.224c-22.648 0-42.017 8.042-58.102 24.126C8.042 93.882 0 113.246 0 135.897V373.44c0 22.647 8.042 42.014 24.123 58.098 16.084 16.088 35.454 24.13 58.102 24.13h237.539c22.647 0 42.014-8.042 58.098-24.13 16.088-16.084 24.13-35.45 24.13-58.098v-54.245c-.001-4.004-1.908-6.761-5.709-8.288z" />
                <path d="M182.721 300.354v82.221h82.229l191.86-191.859-82.228-82.225-191.861 191.863zm70.803 54.815-15.99-.007v-27.401h-27.406v-15.984l33.12-33.12 43.396 43.4-33.12 33.112zm125.337-196.146-99.931 99.928c-3.234 3.241-6.376 3.334-9.421.288-3.043-3.046-2.95-6.186.287-9.419l99.931-99.929c3.233-3.239 6.368-3.333 9.421-.287s2.943 6.185-.287 9.419zm122.485-51.675L457.95 63.952c-5.328-5.33-11.796-7.995-19.413-7.995-7.615 0-14.086 2.665-19.411 7.995l-26.269 26.263 82.228 82.229 26.262-26.268c5.328-5.327 7.991-11.8 7.991-19.414s-2.664-14.084-7.992-19.414z" />
            </svg>
        ),

        check: (widget: LVGLLabelWidget) => {
            let messages: Message[] = [];

            return messages;
        },

        lvgl: {
            parts: ["MAIN", "SELECTED", "CURSOR"],
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

        makeObservable(this, {
            text: observable,
            textType: observable,
            placeholder: observable,
            oneLineMode: observable,
            passwordMode: observable,
            acceptedCharacters: observable,
            maxTextLength: observable
        });
    }

    override lvglCreateObj(
        runtime: LVGLPageRuntime,
        parentObj: number
    ): number {
        const textExpr = this.getExpressionPropertyData(runtime, "text");

        const obj = runtime.wasm._lvglCreateTextarea(
            parentObj,
            runtime.getWidgetIndex(this),
            this.lvglCreateLeft,
            this.lvglCreateTop,
            this.lvglCreateWidth,
            this.lvglCreateHeight,
            textExpr || !this.text
                ? 0
                : runtime.wasm.allocateUTF8(
                      this.textType == "expression"
                          ? `{${this.text}}`
                          : this.text
                  ),
            !this.placeholder ? 0 : runtime.wasm.allocateUTF8(this.placeholder),
            this.oneLineMode,
            this.passwordMode,
            !this.acceptedCharacters
                ? 0
                : runtime.wasm.allocateUTF8(this.acceptedCharacters),
            this.maxTextLength
        );

        if (textExpr) {
            runtime.wasm._lvglUpdateTextareaText(
                obj,
                textExpr.flowIndex,
                textExpr.componentIndex,
                textExpr.propertyIndex
            );
        }

        return obj;
    }

    override get hasEventHandler() {
        return super.hasEventHandler || this.textType == "expression";
    }

    override createEventHandlerSpecific(runtime: LVGLPageRuntime, obj: number) {
        const valueExpr = this.getExpressionPropertyData(runtime, "text");
        if (valueExpr) {
            runtime.wasm._lvglAddObjectFlowCallback(
                obj,
                LV_EVENT_TEXTAREA_TEXT_CHANGED,
                valueExpr.flowIndex,
                valueExpr.componentIndex,
                valueExpr.propertyIndex
            );
        }
    }

    override lvglBuildObj(build: LVGLBuild) {
        build.line(`lv_obj_t *obj = lv_textarea_create(parent_obj);`);
    }

    override lvglBuildSpecific(build: LVGLBuild) {
        if (this.acceptedCharacters) {
            build.line(
                `lv_textarea_set_accepted_chars(obj, ${escapeCString(
                    this.acceptedCharacters
                )});`
            );
        }

        build.line(
            `lv_textarea_set_max_length(obj, ${this.maxTextLength ?? 128});`
        );

        if (this.textType == "literal" && this.text) {
            build.line(
                `lv_textarea_set_text(obj, ${escapeCString(this.text)});`
            );
        }

        if (this.placeholder) {
            build.line(
                `lv_textarea_set_placeholder_text(obj, ${escapeCString(
                    this.placeholder
                )});`
            );
        }

        build.line(
            `lv_textarea_set_one_line(obj, ${
                this.oneLineMode ? "true" : "false"
            });`
        );

        build.line(
            `lv_textarea_set_password_mode(obj, ${
                this.passwordMode ? "true" : "false"
            });`
        );
    }

    override lvglBuildTickSpecific(build: LVGLBuild) {
        expressionPropertyBuildTickSpecific<LVGLTextareaWidget>(
            build,
            this,
            "text" as const,
            "lv_textarea_get_text",
            "lv_textarea_set_text"
        );
    }

    override buildEventHandlerSpecific(build: LVGLBuild) {
        expressionPropertyBuildEventHandlerSpecific<LVGLTextareaWidget>(
            build,
            this,
            "text" as const,
            "lv_textarea_get_text"
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

const calendarGroup: IPropertyGridGroupDefinition = {
    id: "lvgl-calendar",
    title: "Calendar",
    position: SPECIFIC_GROUP_POSITION
};

export class LVGLCalendarWidget extends LVGLWidget {
    todayYear: number;
    todayMonth: number;
    todayDay: number;

    static classInfo = makeDerivedClassInfo(LVGLWidget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType === ProjectType.LVGL,

        componentPaletteGroupName: "!1Input Widgets",

        properties: [
            {
                name: "todayYear",
                displayName: "Year",
                type: PropertyType.Number,
                propertyGridGroup: calendarGroup
            },
            {
                name: "todayMonth",
                displayName: "Month",
                type: PropertyType.Number,
                propertyGridGroup: calendarGroup
            },
            {
                name: "todayDay",
                displayName: "Day",
                type: PropertyType.Number,
                propertyGridGroup: calendarGroup
            }
        ],

        defaultValue: {
            left: 0,
            top: 0,
            width: 230,
            height: 240,
            flags: "PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE|SCROLLABLE|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_CHAIN",
            clickableFlag: true,
            todayYear: 2022,
            todayMonth: 11,
            todayDay: 1
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
                <rect x="4" y="5" width="16" height="16" rx="2" />
                <path d="M16 3v4M8 3v4m-4 4h16m-9 4h1m0 0v3" />
            </svg>
        ),

        check: (widget: LVGLCalendarWidget) => {
            let messages: Message[] = [];

            function dateIsValid(date: any) {
                return date instanceof Date && !isNaN(date as any);
            }

            if (!dateIsValid(new Date(`${widget.todayYear}-1-1`))) {
                messages.push(
                    new Message(
                        MessageType.ERROR,
                        `Invalid year`,
                        getChildOfObject(widget, "todayYear")
                    )
                );
            } else {
                if (
                    !dateIsValid(
                        new Date(`${widget.todayYear}-${widget.todayMonth}-1`)
                    )
                ) {
                    messages.push(
                        new Message(
                            MessageType.ERROR,
                            `Invalid month`,
                            getChildOfObject(widget, "todayMonth")
                        )
                    );
                } else {
                    if (
                        !dateIsValid(
                            new Date(
                                `${widget.todayYear}-${widget.todayMonth}-${widget.todayDay}`
                            )
                        )
                    ) {
                        messages.push(
                            new Message(
                                MessageType.ERROR,
                                `Invalid day`,
                                getChildOfObject(widget, "todayDay")
                            )
                        );
                    }
                }
            }

            return messages;
        },

        lvgl: {
            parts: ["MAIN", "ITEMS"],
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

        makeObservable(this, {
            todayYear: observable,
            todayMonth: observable,
            todayDay: observable
        });
    }

    override lvglCreateObj(
        runtime: LVGLPageRuntime,
        parentObj: number
    ): number {
        const obj = runtime.wasm._lvglCreateCalendar(
            parentObj,
            runtime.getWidgetIndex(this),
            this.lvglCreateLeft,
            this.lvglCreateTop,
            this.lvglCreateWidth,
            this.lvglCreateHeight,
            this.todayYear,
            this.todayMonth,
            this.todayDay,
            this.todayYear,
            this.todayMonth
        );

        return obj;
    }

    override lvglBuildObj(build: LVGLBuild) {
        build.line(`lv_obj_t *obj = lv_calendar_create(parent_obj);`);
    }

    override lvglBuildSpecific(build: LVGLBuild) {
        build.line("lv_calendar_header_arrow_create(obj);");
        build.line(
            `lv_calendar_set_today_date(obj, ${this.todayYear}, ${this.todayMonth}, ${this.todayDay});`
        );
        build.line(
            `lv_calendar_set_showed_date(obj, ${this.todayYear}, ${this.todayMonth});`
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

const COLORWHEEL_MODES = {
    HUE: 0,
    SATURATION: 1,
    VALUE: 2
};

const colorwheelGroup: IPropertyGridGroupDefinition = {
    id: "lvgl-colorwheel",
    title: "Colorwheel",
    position: SPECIFIC_GROUP_POSITION
};

export class LVGLColorwheelWidget extends LVGLWidget {
    mode: keyof typeof COLORWHEEL_MODES;
    fixedMode: boolean;

    static classInfo = makeDerivedClassInfo(LVGLWidget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType === ProjectType.LVGL,

        componentPaletteGroupName: "!1Input Widgets",

        properties: [
            {
                name: "mode",
                type: PropertyType.Enum,
                enumItems: Object.keys(COLORWHEEL_MODES).map(id => ({
                    id,
                    label: id
                })),
                enumDisallowUndefined: true,
                propertyGridGroup: colorwheelGroup
            },
            {
                name: "fixedMode",
                type: PropertyType.Boolean,
                checkboxStyleSwitch: true,
                propertyGridGroup: colorwheelGroup
            }
        ],

        defaultValue: {
            left: 0,
            top: 0,
            width: 150,
            height: 150,
            flags: "PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE|SCROLLABLE|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_CHAIN",
            clickableFlag: true,
            mode: "HUE",
            fixedMode: false
        },

        icon: (
            <svg
                xmlns="http://www.w3.org/2000/svg"
                strokeWidth="2"
                stroke="currentColor"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                viewBox="0 0 24 24"
            >
                <path d="M0 0h24v24H0z" stroke="none" />
                <path d="M12 21a9 9 0 1 1 0-18 9 8 0 0 1 9 8 4.5 4 0 0 1-4.5 4H14a2 2 0 0 0-1 3.75A1.3 1.3 0 0 1 12 21" />
                <circle cx="7.5" cy="10.5" r=".5" fill="currentColor" />
                <circle cx="12" cy="7.5" r=".5" fill="currentColor" />
                <circle cx="16.5" cy="10.5" r=".5" fill="currentColor" />
            </svg>
        ),

        check: (widget: LVGLLabelWidget) => {
            let messages: Message[] = [];
            return messages;
        },

        lvgl: {
            parts: ["MAIN", "KNOB"],
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

        makeObservable(this, {
            mode: observable,
            fixedMode: observable
        });
    }

    override lvglCreateObj(
        runtime: LVGLPageRuntime,
        parentObj: number
    ): number {
        const obj = runtime.wasm._lvglCreateColorwheel(
            parentObj,
            runtime.getWidgetIndex(this),
            this.lvglCreateLeft,
            this.lvglCreateTop,
            this.lvglCreateWidth,
            this.lvglCreateHeight,
            COLORWHEEL_MODES[this.mode],
            this.fixedMode
        );

        return obj;
    }

    override lvglBuildObj(build: LVGLBuild) {
        build.line(`lv_obj_t *obj = lv_colorwheel_create(parent_obj, false);`);
    }

    override lvglBuildSpecific(build: LVGLBuild) {
        if (this.mode != "HUE") {
            build.line(
                `lv_colorwheel_set_mode(obj, LV_COLORWHEEL_MODE_${this.mode});`
            );
        }
        if (this.fixedMode) {
            build.line(`lv_colorwheel_set_mode_fixed(obj, true);`);
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

const enum ImgbuttonStates {
    LV_IMGBTN_STATE_RELEASED,
    LV_IMGBTN_STATE_PRESSED,
    LV_IMGBTN_STATE_DISABLED,
    LV_IMGBTN_STATE_CHECKED_RELEASED,
    LV_IMGBTN_STATE_CHECKED_PRESSED,
    LV_IMGBTN_STATE_CHECKED_DISABLED
}

const imgbuttonGroup: IPropertyGridGroupDefinition = {
    id: "lvgl-imgbutton",
    title: "Imgbutton",
    position: SPECIFIC_GROUP_POSITION
};

export class LVGLImgbuttonWidget extends LVGLWidget {
    imageReleased: string;
    imagePressed: string;
    imageDisabled: string;
    imageCheckedReleased: string;
    imageCheckedPressed: string;
    imageCheckedDisabled: string;

    static classInfo = makeDerivedClassInfo(LVGLWidget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType === ProjectType.LVGL,

        componentPaletteGroupName: "!1Input Widgets",

        properties: [
            {
                name: "imageReleased",
                displayName: "Released",
                type: PropertyType.ObjectReference,
                referencedObjectCollectionPath: "bitmaps",
                propertyGridGroup: imgbuttonGroup
            },
            {
                name: "imagePressed",
                displayName: "Pressed",
                type: PropertyType.ObjectReference,
                referencedObjectCollectionPath: "bitmaps",
                propertyGridGroup: imgbuttonGroup
            },
            {
                name: "imageDisabled",
                displayName: "Disabled",
                type: PropertyType.ObjectReference,
                referencedObjectCollectionPath: "bitmaps",
                propertyGridGroup: imgbuttonGroup
            },
            {
                name: "imageCheckedReleased",
                displayName: "Checked released",
                type: PropertyType.ObjectReference,
                referencedObjectCollectionPath: "bitmaps",
                propertyGridGroup: imgbuttonGroup
            },
            {
                name: "imageCheckedPressed",
                displayName: "Checked pressed",
                type: PropertyType.ObjectReference,
                referencedObjectCollectionPath: "bitmaps",
                propertyGridGroup: imgbuttonGroup
            },
            {
                name: "imageCheckedDisabled",
                displayName: "Checked disabled",
                type: PropertyType.ObjectReference,
                referencedObjectCollectionPath: "bitmaps",
                propertyGridGroup: imgbuttonGroup
            }
        ],

        defaultValue: {
            left: 0,
            top: 0,
            width: 64,
            widthUnit: "content",
            height: 64,
            flags: "PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE|SCROLLABLE|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_CHAIN",
            clickableFlag: true
        },

        icon: (
            <svg
                xmlns="http://www.w3.org/2000/svg"
                strokeWidth="2"
                stroke="currentColor"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                viewBox="0 0 24 24"
            >
                <path d="M0 0h24v24H0z" stroke="none" />
                <path d="M15 8h.01M12 20H7a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v5" />
                <path d="m4 15 4-4c.928-.893 2.072-.893 3 0l4 4" />
                <path d="m14 14 1-1c.617-.593 1.328-.793 2.009-.598M16 19h6m-3-3v6" />
            </svg>
        ),

        check: (widget: LVGLImgbuttonWidget) => {
            let messages: Message[] = [];

            if (widget.imageReleased) {
                const bitmap = ProjectEditor.findBitmap(
                    ProjectEditor.getProject(widget),
                    widget.imageReleased
                );

                if (!bitmap) {
                    messages.push(
                        propertyNotFoundMessage(widget, "imageReleased")
                    );
                }
            }

            if (widget.imagePressed) {
                const bitmap = ProjectEditor.findBitmap(
                    ProjectEditor.getProject(widget),
                    widget.imagePressed
                );

                if (!bitmap) {
                    messages.push(
                        propertyNotFoundMessage(widget, "imagePressed")
                    );
                }
            }

            if (widget.imageDisabled) {
                const bitmap = ProjectEditor.findBitmap(
                    ProjectEditor.getProject(widget),
                    widget.imageDisabled
                );

                if (!bitmap) {
                    messages.push(
                        propertyNotFoundMessage(widget, "imageDisabled")
                    );
                }
            }

            if (widget.imageCheckedReleased) {
                const bitmap = ProjectEditor.findBitmap(
                    ProjectEditor.getProject(widget),
                    widget.imageCheckedReleased
                );

                if (!bitmap) {
                    messages.push(
                        propertyNotFoundMessage(widget, "imageCheckedReleased")
                    );
                }
            }

            if (widget.imageCheckedPressed) {
                const bitmap = ProjectEditor.findBitmap(
                    ProjectEditor.getProject(widget),
                    widget.imageCheckedPressed
                );

                if (!bitmap) {
                    messages.push(
                        propertyNotFoundMessage(widget, "imageCheckedPressed")
                    );
                }
            }

            if (widget.imageCheckedDisabled) {
                const bitmap = ProjectEditor.findBitmap(
                    ProjectEditor.getProject(widget),
                    widget.imageCheckedDisabled
                );

                if (!bitmap) {
                    messages.push(
                        propertyNotFoundMessage(widget, "imageCheckedDisabled")
                    );
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
                "CLICKABLE|PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE|SCROLLABLE|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_CHAIN",
            states: ["CHECKED", "DISABLED", "FOCUSED", "PRESSED"]
        }
    });

    constructor() {
        super();

        makeObservable(this, {
            imageReleased: observable,
            imagePressed: observable,
            imageDisabled: observable,
            imageCheckedReleased: observable,
            imageCheckedPressed: observable,
            imageCheckedDisabled: observable
        });
    }

    override lvglCreateObj(
        runtime: LVGLPageRuntime,
        parentObj: number
    ): number {
        const obj = runtime.wasm._lvglCreateImgbutton(
            parentObj,
            runtime.getWidgetIndex(this),
            this.lvglCreateLeft,
            this.lvglCreateTop,
            this.lvglCreateWidth,
            this.lvglCreateHeight
        );

        if (this.imageReleased) {
            const bitmap = ProjectEditor.findBitmap(
                ProjectEditor.getProject(this),
                this.imageReleased
            );

            if (bitmap && bitmap.image) {
                (async () => {
                    const image = await runtime.loadBitmap(bitmap);
                    if (!runtime.isEditor || obj == this._lvglObj) {
                        runtime.wasm._lvglSetImgbuttonImageSrc(
                            obj,
                            ImgbuttonStates.LV_IMGBTN_STATE_RELEASED,
                            image
                        );
                        runInAction(() => this._refreshCounter++);
                    }
                })();
            }
        }

        if (this.imagePressed) {
            const bitmap = ProjectEditor.findBitmap(
                ProjectEditor.getProject(this),
                this.imagePressed
            );

            if (bitmap && bitmap.image) {
                (async () => {
                    const image = await runtime.loadBitmap(bitmap);
                    if (!runtime.isEditor || obj == this._lvglObj) {
                        runtime.wasm._lvglSetImgbuttonImageSrc(
                            obj,
                            ImgbuttonStates.LV_IMGBTN_STATE_PRESSED,
                            image
                        );
                        runInAction(() => this._refreshCounter++);
                    }
                })();
            }
        }

        if (this.imageDisabled) {
            const bitmap = ProjectEditor.findBitmap(
                ProjectEditor.getProject(this),
                this.imageDisabled
            );

            if (bitmap && bitmap.image) {
                (async () => {
                    const image = await runtime.loadBitmap(bitmap);
                    if (!runtime.isEditor || obj == this._lvglObj) {
                        runtime.wasm._lvglSetImgbuttonImageSrc(
                            obj,
                            ImgbuttonStates.LV_IMGBTN_STATE_DISABLED,
                            image
                        );
                        runInAction(() => this._refreshCounter++);
                    }
                })();
            }
        }

        if (this.imageCheckedReleased) {
            const bitmap = ProjectEditor.findBitmap(
                ProjectEditor.getProject(this),
                this.imageCheckedReleased
            );

            if (bitmap && bitmap.image) {
                (async () => {
                    const image = await runtime.loadBitmap(bitmap);
                    if (!runtime.isEditor || obj == this._lvglObj) {
                        runtime.wasm._lvglSetImgbuttonImageSrc(
                            obj,
                            ImgbuttonStates.LV_IMGBTN_STATE_CHECKED_RELEASED,
                            image
                        );
                        runInAction(() => this._refreshCounter++);
                    }
                })();
            }
        }

        if (this.imageCheckedPressed) {
            const bitmap = ProjectEditor.findBitmap(
                ProjectEditor.getProject(this),
                this.imageCheckedPressed
            );

            if (bitmap && bitmap.image) {
                (async () => {
                    const image = await runtime.loadBitmap(bitmap);
                    if (!runtime.isEditor || obj == this._lvglObj) {
                        runtime.wasm._lvglSetImgbuttonImageSrc(
                            obj,
                            ImgbuttonStates.LV_IMGBTN_STATE_CHECKED_PRESSED,
                            image
                        );
                        runInAction(() => this._refreshCounter++);
                    }
                })();
            }
        }

        if (this.imageCheckedDisabled) {
            const bitmap = ProjectEditor.findBitmap(
                ProjectEditor.getProject(this),
                this.imageCheckedDisabled
            );

            if (bitmap && bitmap.image) {
                (async () => {
                    const image = await runtime.loadBitmap(bitmap);
                    if (!runtime.isEditor || obj == this._lvglObj) {
                        runtime.wasm._lvglSetImgbuttonImageSrc(
                            obj,
                            ImgbuttonStates.LV_IMGBTN_STATE_CHECKED_DISABLED,
                            image
                        );
                        runInAction(() => this._refreshCounter++);
                    }
                })();
            }
        }

        return obj;
    }

    override lvglBuildObj(build: LVGLBuild) {
        build.line(`lv_obj_t *obj = lv_imgbtn_create(parent_obj);`);
    }

    override lvglBuildSpecific(build: LVGLBuild) {
        if (this.imageReleased) {
            build.line(
                `lv_imgbtn_set_src(obj, LV_IMGBTN_STATE_RELEASED, NULL, &img_${this.imageReleased}, NULL);`
            );
        }
        if (this.imagePressed) {
            build.line(
                `lv_imgbtn_set_src(obj, LV_IMGBTN_STATE_PRESSED, NULL, &img_${this.imagePressed}, NULL);`
            );
        }
        if (this.imageDisabled) {
            build.line(
                `lv_imgbtn_set_src(obj, LV_IMGBTN_STATE_DISABLED, NULL, &img_${this.imageDisabled}, NULL);`
            );
        }
        if (this.imageCheckedReleased) {
            build.line(
                `lv_imgbtn_set_src(obj, LV_IMGBTN_STATE_CHECKED_PRESSED, NULL, &img_${this.imageCheckedReleased}, NULL);`
            );
        }
        if (this.imageCheckedPressed) {
            build.line(
                `lv_imgbtn_set_src(obj, LV_IMGBTN_STATE_CHECKED_RELEASED, NULL, &img_${this.imageCheckedPressed}, NULL);`
            );
        }
        if (this.imageCheckedDisabled) {
            build.line(
                `lv_imgbtn_set_src(obj, LV_IMGBTN_STATE_CHECKED_DISABLED, NULL, &img_${this.imageCheckedDisabled}, NULL);`
            );
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

const KEYBOARD_MODES = {
    TEXT_LOWER: 0,
    TEXT_UPPER: 1,
    SPECIAL: 2,
    NUMBER: 3,
    USER1: 4,
    USER2: 5,
    USER3: 6,
    USER4: 7
};

const keyboardGroup: IPropertyGridGroupDefinition = {
    id: "lvgl-keyboard",
    title: "Keyboard",
    position: SPECIFIC_GROUP_POSITION
};

export class LVGLKeyboardWidget extends LVGLWidget {
    textarea: string;
    mode: keyof typeof KEYBOARD_MODES;

    static classInfo = makeDerivedClassInfo(LVGLWidget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType === ProjectType.LVGL,

        componentPaletteGroupName: "!1Input Widgets",

        properties: [
            {
                name: "textarea",
                type: PropertyType.Enum,
                enumItems: (widget: LVGLKeyboardWidget) => {
                    const page = getAncestorOfType(
                        widget,
                        ProjectEditor.PageClass.classInfo
                    ) as Page;
                    return page._lvglWidgets
                        .filter(
                            lvglWidget =>
                                lvglWidget instanceof LVGLTextareaWidget &&
                                lvglWidget.identifier
                        )
                        .map(lvglWidget => ({
                            id: lvglWidget.identifier,
                            label: lvglWidget.identifier
                        }));
                },
                propertyGridGroup: keyboardGroup
            },
            {
                name: "mode",
                type: PropertyType.Enum,
                enumItems: Object.keys(KEYBOARD_MODES).map(id => ({
                    id,
                    label: id
                })),
                enumDisallowUndefined: true,
                propertyGridGroup: keyboardGroup
            }
        ],

        defaultValue: {
            left: 0,
            top: 0,
            width: 300,
            height: 120,
            flags: "PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE|SCROLLABLE|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_CHAIN",
            localStyles: {
                // definition: {
                //     MAIN: {
                //         DEFAULT: {
                //             align: "DEFAULT",
                //             pad_top: 0,
                //             pad_bottom: 0,
                //             pad_left: 0,
                //             pad_right: 0,
                //             pad_row: 3,
                //             pad_column: 3
                //         }
                //     },
                //     ITEMS: {
                //         DEFAULT: {
                //             radius: 6
                //         }
                //     }
                // }
            },
            clickableFlag: true,
            mode: "TEXT_LOWER"
        },

        icon: (
            <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                <rect x="2" y="6" width="20" height="12" rx="2"></rect>
                <line x1="6" y1="10" x2="6" y2="10"></line>
                <line x1="10" y1="10" x2="10" y2="10"></line>
                <line x1="14" y1="10" x2="14" y2="10"></line>
                <line x1="18" y1="10" x2="18" y2="10"></line>
                <line x1="6" y1="14" x2="6" y2="14.01"></line>
                <line x1="18" y1="14" x2="18" y2="14.01"></line>
                <line x1="10" y1="14" x2="14" y2="14"></line>
            </svg>
        ),

        check: (widget: LVGLKeyboardWidget) => {
            let messages: Message[] = [];

            if (widget.textarea) {
                if (
                    !ProjectEditor.getProject(widget)._lvglIdentifiers.get(
                        widget.textarea
                    )
                ) {
                    messages.push(propertyNotFoundMessage(widget, "textarea"));
                }
            }

            return messages;
        },

        lvgl: {
            parts: ["MAIN", "ITEMS"],
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

        makeObservable(this, {
            textarea: observable,
            mode: observable
        });
    }

    override lvglCreateObj(
        runtime: LVGLPageRuntime,
        parentObj: number
    ): number {
        const obj = runtime.wasm._lvglCreateKeyboard(
            parentObj,
            runtime.getWidgetIndex(this),
            this.lvglCreateLeft,
            this.lvglCreateTop,
            this.lvglCreateWidth,
            this.lvglCreateHeight,
            KEYBOARD_MODES[this.mode]
        );

        return obj;
    }

    override lvglPostCreate(runtime: LVGLPageRuntime) {
        if (this.textarea) {
            const lvglIdentifier = ProjectEditor.getProject(
                this
            )._lvglIdentifiers.get(this.textarea);
            if (lvglIdentifier) {
                const textareaWidget = lvglIdentifier.object;
                if (textareaWidget) {
                    setTimeout(() => {
                        if (this._lvglObj && textareaWidget._lvglObj) {
                            runtime.wasm._lvglSetKeyboardTextarea(
                                this._lvglObj,
                                textareaWidget._lvglObj
                            );
                        }
                    });
                }
            }
        }
    }

    override lvglBuildObj(build: LVGLBuild) {
        build.line(`lv_obj_t *obj = lv_keyboard_create(parent_obj);`);
    }

    override lvglBuildSpecific(build: LVGLBuild): void {
        if (this.mode != "TEXT_LOWER") {
            build.line(
                `lv_keyboard_set_mode(obj, LV_KEYBOARD_MODE_${this.mode});`
            );
        }
    }

    override lvglPostBuild(build: LVGLBuild) {
        if (this.textarea) {
            if (this.textarea) {
                const lvglIdentifier = ProjectEditor.getProject(
                    this
                )._lvglIdentifiers.get(this.textarea);
                if (lvglIdentifier != undefined) {
                    const textareaWidget = lvglIdentifier.object;
                    build.line(
                        `lv_keyboard_set_textarea(${build.getLvglObjectAccessor(
                            this
                        )}, ${build.getLvglObjectAccessor(textareaWidget)});`
                    );
                }
            }
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

// const chartGroup: IPropertyGridGroupDefinition = {
//     id: "lvgl-chart",
//     title: "Chart",
//     position: SPECIFIC_GROUP_POSITION
// };

export class LVGLChartWidget extends LVGLWidget {
    static classInfo = makeDerivedClassInfo(LVGLWidget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType === ProjectType.LVGL,

        componentPaletteGroupName: "!1Visualiser Widgets",

        properties: [],

        defaultValue: {
            left: 0,
            top: 0,
            width: 180,
            height: 100,
            flags: "PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE|SCROLLABLE|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_CHAIN",
            clickableFlag: true
        },

        icon: (
            <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                <line x1="4" y1="19" x2="20" y2="19"></line>
                <polyline points="4 15 8 9 12 11 16 6 20 10"></polyline>
            </svg>
        ),

        check: (widget: LVGLLabelWidget) => {
            let messages: Message[] = [];
            return messages;
        },

        lvgl: {
            parts: ["MAIN", "ITEMS", "INDICATOR"],
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

    override lvglCreateObj(
        runtime: LVGLPageRuntime,
        parentObj: number
    ): number {
        const obj = runtime.wasm._lvglCreateChart(
            parentObj,
            runtime.getWidgetIndex(this),
            this.lvglCreateLeft,
            this.lvglCreateTop,
            this.lvglCreateWidth,
            this.lvglCreateHeight
        );

        return obj;
    }

    override lvglBuildObj(build: LVGLBuild) {
        build.line(`lv_obj_t *obj = lv_chart_create(parent_obj);`);
    }

    override lvglBuildSpecific(build: LVGLBuild) {}
}

////////////////////////////////////////////////////////////////////////////////

registerClass("LVGLArcWidget", LVGLArcWidget);
registerClass("LVGLBarWidget", LVGLBarWidget);
registerClass("LVGLButtonWidget", LVGLButtonWidget);
registerClass("LVGLCalendarWidget", LVGLCalendarWidget);
registerClass("LVGLChartWidget", LVGLChartWidget);
registerClass("LVGLCheckboxWidget", LVGLCheckboxWidget);
registerClass("LVGLColorwheelWidget", LVGLColorwheelWidget);
registerClass("LVGLDropdownWidget", LVGLDropdownWidget);
registerClass("LVGLImageWidget", LVGLImageWidget);
registerClass("LVGLImgbuttonWidget", LVGLImgbuttonWidget);
registerClass("LVGLLabelWidget", LVGLLabelWidget);
registerClass("LVGLKeyboardWidget", LVGLKeyboardWidget);
registerClass("LVGLPanelWidget", LVGLPanelWidget);
registerClass("LVGLRollerWidget", LVGLRollerWidget);
registerClass("LVGLSliderWidget", LVGLSliderWidget);
registerClass("LVGLSpinnerWidget", LVGLSpinnerWidget);
registerClass("LVGLSwitchWidget", LVGLSwitchWidget);
registerClass("LVGLTextareaWidget", LVGLTextareaWidget);
