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
    isPropertyHidden
} from "project-editor/core/object";
import {
    getAncestorOfType,
    getClassInfo,
    getObjectPathAsString,
    getProjectEditorStore,
    Message,
    propertyNotFoundMessage,
    propertyNotSetMessage
} from "project-editor/store";

import { ProjectType } from "project-editor/project/project";

import type { IFlowContext } from "project-editor/flow/flow-interfaces";

import {
    AutoSize,
    ComponentOutput,
    isFlowProperty,
    isTimelineEditorActive,
    isTimelineEditorActiveOrActionComponent,
    Widget
} from "project-editor/flow/component";

import { escapeCString } from "project-editor/build/helper";
import { LVGLParts, LVGLStylesDefinition } from "project-editor/lvgl/style";
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
    LV_EVENT_ARC_VALUE_CHANGED,
    LV_EVENT_BAR_VALUE_CHANGED,
    LV_EVENT_BAR_VALUE_START_CHANGED,
    LV_EVENT_CHECKED_STATE_CHANGED,
    LV_EVENT_SLIDER_VALUE_CHANGED,
    LV_EVENT_SLIDER_VALUE_LEFT_CHANGED
} from "project-editor/lvgl/widget-common";
import {
    LVGLPropertyType,
    makeExpressionProperty
} from "project-editor/lvgl/expression-property";

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

function stateEnabledInWidget(
    widget: LVGLWidget,
    state: keyof typeof LVGL_STATE_CODES
) {
    const classInfo = getClassInfo(widget);
    return classInfo.lvgl!.states.indexOf(state) != -1;
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

    checkedState: string | boolean;
    checkedStateType: LVGLPropertyType;
    disabledState: string | boolean;
    disabledStateType: LVGLPropertyType;
    focusedState: boolean;
    pressedState: boolean;

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

                        const page = getAncestorOfType(
                            parent,
                            ProjectEditor.PageClass.classInfo
                        ) as Page;

                        if (
                            page._lvglWidgetIdentifiers.get(newIdentifer) ==
                            undefined
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
            {
                name: "flags",
                type: PropertyType.String,
                propertyGridGroup: flagsGroup,
                propertyGridRowComponent: LVGLWidgetFlagsProperty,
                enumerable: false
            },
            ...makeExpressionProperty(
                "checkedState",
                "boolean",
                "input",
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
                name: "focusedState",
                displayName: "Focused",
                type: PropertyType.Boolean,
                checkboxStyleSwitch: true,
                propertyGridGroup: statesGroup,
                hideInPropertyGrid: (widget: LVGLWidget) =>
                    !stateEnabledInWidget(widget, "FOCUSED")
            },
            {
                name: "pressedState",
                displayName: "Pressed",
                type: PropertyType.Boolean,
                checkboxStyleSwitch: true,
                propertyGridGroup: statesGroup,
                hideInPropertyGrid: (widget: LVGLWidget) =>
                    !stateEnabledInWidget(widget, "PRESSED")
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

            if (jsWidget.states != undefined) {
                const states = jsWidget.states.split("|");
                delete (jsWidget as any).states;
                if ("CHECKED" in states) {
                    jsWidget.checkedState = true;
                    jsWidget.checkedStateType = "literal";
                }
                if ("DISABLED" in states) {
                    jsWidget.disabledState = true;
                    jsWidget.disabledStateType = "literal";
                }
                if ("FOCUSED" in states) {
                    jsWidget.focusedState = true;
                }
                if ("PRESSED" in states) {
                    jsWidget.pressedState = true;
                }
            }

            if (jsWidget.checkedStateType == undefined) {
                jsWidget.checkedStateType = "literal";
            }

            if (jsWidget.disabledStateType == undefined) {
                jsWidget.disabledStateType = "literal";
            }
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
            checkedStateType: "literal",
            disabledStateType: "literal"
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
            checkedState: observable,
            checkedStateType: observable,
            disabledState: observable,
            disabledStateType: observable,
            focusedState: observable,
            pressedState: observable,
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

    get widgetIndex() {
        const page = getAncestorOfType(
            this,
            ProjectEditor.PageClass.classInfo
        ) as Page;
        const widgetIndex = page._lvglWidgets.indexOf(this);
        if (widgetIndex == -1) {
            return -1;
        }
        return widgetIndex + 1;
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

    get states() {
        const states: (keyof typeof LVGL_STATE_CODES)[] = [];

        if (this.checkedStateType == "literal") {
            if (this.checkedState as boolean) {
                states.push("CHECKED");
            }
        } else {
            const classInfo = getClassInfo(this);
            if ("CHECKED" in (classInfo.lvgl!.defaultStates ?? "").split("|")) {
                states.push("CHECKED");
            }
        }

        if (this.disabledStateType == "literal") {
            if (this.disabledState as boolean) {
                states.push("DISABLED");
            }
        } else {
            const classInfo = getClassInfo(this);
            if (
                "DISABLED" in (classInfo.lvgl!.defaultStates ?? "").split("|")
            ) {
                states.push("DISABLED");
            }
        }

        if (this.focusedState as boolean) {
            states.push("FOCUSED");
        }

        if (this.pressedState as boolean) {
            states.push("PRESSED");
        }

        return states.join("|");
    }

    override lvglCreate(
        runtime: LVGLPageRuntime,
        parentObj: number
    ): LVGLCreateResultType {
        const obj = this.lvglCreateObj(runtime, parentObj);

        runInAction(() => (this._lvglObj = obj));

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
                    this.createEventHandler(runtime, obj);
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

            if (this.hiddenInEditor) {
                runtime.wasm._lvglObjAddFlag(
                    obj,
                    getCode(["HIDDEN"], LVGL_FLAG_CODES)
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
        build.line(`// ${build.getWidgetIdentifier(this)}`);

        this.lvglBuildObj(build);

        build.line(`screen->${build.getWidgetStructFieldName(this)} = obj;`);

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
                    `bool state_new = evalBooleanProperty(${flowIndex}, ${componentIndex}, ${propertyIndex}, "Failed to evaluate Checked state");`
                );
            } else {
                build.line(
                    `bool state_new = ${build.getVariableGetterFunctionName(
                        this.checkedState as string
                    )}();`
                );
            }

            build.line(
                `bool state_cur = lv_obj_has_state(screen->${build.getWidgetStructFieldName(
                    this
                )}, LV_STATE_CHECKED);`
            );

            build.line(`if (state_new != state_cur) {`);
            build.indent();
            build.line(
                `if (state_new) lv_obj_add_state(screen->${build.getWidgetStructFieldName(
                    this
                )}, LV_STATE_CHECKED);`
            );
            build.line(
                `else lv_obj_clear_state(screen->${build.getWidgetStructFieldName(
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
                    `bool state_new = evalBooleanProperty(${flowIndex}, ${componentIndex}, ${propertyIndex}, "Failed to evaluate Disabled state");`
                );
            } else {
                build.line(
                    `bool state_new = ${build.getVariableGetterFunctionName(
                        this.disabledState as string
                    )}();`
                );
            }

            build.line(
                `bool state_cur = lv_obj_has_state(screen->${build.getWidgetStructFieldName(
                    this
                )}, LV_STATE_DISABLED);`
            );

            build.line(`if (state_new != state_cur) {`);
            build.indent();
            build.line(
                `if (state_new) lv_obj_add_state(screen->${build.getWidgetStructFieldName(
                    this
                )}, LV_STATE_DISABLED);`
            );
            build.line(
                `else lv_obj_clear_state(screen->${build.getWidgetStructFieldName(
                    this
                )}, LV_STATE_DISABLED);`
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
        return (
            this.checkedStateType == "expression" ||
            this.disabledStateType == "expression"
        );
    }

    buildEventHandler(build: LVGLBuild) {
        this.buildEventHandlerSpecific(build);
    }

    buildEventHandlerSpecific(build: LVGLBuild) {
        // bool state_new = evalBooleanProperty(updateTask.page_index, updateTask.component_index, updateTask.property_index, "Failed to evaluate Checked state");
        // bool state_cur = lv_obj_has_state(updateTask.obj, LV_STATE_CHECKED);
        // if (state_new != state_cur) {
        //     if (state_new) lv_obj_add_state(updateTask.obj, LV_STATE_CHECKED);
        //     else lv_obj_clear_state(updateTask.obj, LV_STATE_CHECKED);
        // }

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
    }

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

            const projectEditorStore = getProjectEditorStore(widget);
            if (!projectEditorStore.projectTypeTraits.hasFlowSupport) {
                // check properties
                for (const propertyInfo of getClassInfo(widget).properties) {
                    if (isPropertyHidden(widget, propertyInfo)) {
                        continue;
                    }

                    if (
                        isFlowProperty(widget, propertyInfo, [
                            "input",
                            "assignable"
                        ])
                    ) {
                        const value = getProperty(widget, propertyInfo.name);
                        if (!value) {
                            messages.push(
                                propertyNotSetMessage(widget, propertyInfo.name)
                            );
                        } else {
                            ProjectEditor.documentSearch.checkObjectReference(
                                widget,
                                propertyInfo.name,
                                messages
                            );
                        }
                    }
                }
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
            this.widgetIndex,
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
            build.line(`lv_label_set_text(obj, ${escapeCString(this.text)});`);
        }
    }

    override lvglBuildTickSpecific(build: LVGLBuild) {
        if (this.textType == "expression") {
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
                    "text"
                );

                build.line(
                    `const char *text_new = evalTextProperty(${flowIndex}, ${componentIndex}, ${propertyIndex}, "Failed to evaluate Text in Label widget");`
                );
            } else {
                build.line(
                    `const char *text_new = ${build.getVariableGetterFunctionName(
                        this.text
                    )}();`
                );
            }

            build.line(
                `const char *text_cur = lv_label_get_text(screen->${build.getWidgetStructFieldName(
                    this
                )});`
            );

            build.line(
                `if (strcmp(text_new, text_cur) != 0) lv_label_set_text(screen->${build.getWidgetStructFieldName(
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
            this.widgetIndex,
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
            this.widgetIndex,
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

    override lvglCreateObj(runtime: LVGLPageRuntime, parentObj: number) {
        const obj = runtime.wasm._lvglCreateImage(
            parentObj,
            this.widgetIndex,
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
            flags: "CLICKABLE|PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE",
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

    override lvglCreateObj(runtime: LVGLPageRuntime, parentObj: number) {
        const valueExpr = this.getExpressionPropertyData(runtime, "value");
        const valueLeftExpr =
            this.mode == "RANGE"
                ? this.getExpressionPropertyData(runtime, "valueLeft")
                : undefined;

        const obj = runtime.wasm._lvglCreateSlider(
            parentObj,
            this.widgetIndex,
            this.lvglCreateLeft,
            this.lvglCreateTop,
            this.lvglCreateWidth,
            this.lvglCreateHeight,
            this.min,
            this.max,
            SLIDER_MODES[this.mode],
            valueExpr ? 0 : (this.value as number),
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
                    "value"
                );

                build.line(
                    `int32_t value_new = evalIntegerProperty(${flowIndex}, ${componentIndex}, ${propertyIndex}, "Failed to evaluate Value in Slider widget");`
                );
            } else {
                build.line(
                    `int32_t value_new = ${build.getVariableGetterFunctionName(
                        this.value as string
                    )}();`
                );
            }

            build.line(
                `int32_t value_cur = lv_slider_get_value(screen->${build.getWidgetStructFieldName(
                    this
                )});`
            );

            build.line(
                `if (value_new != value_cur) lv_slider_set_value(screen->${build.getWidgetStructFieldName(
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

            if (
                build.assets.projectEditorStore.projectTypeTraits.hasFlowSupport
            ) {
                let flowIndex = build.assets.getFlowIndex(page);
                let componentIndex = build.assets.getComponentIndex(this);
                const propertyIndex = build.assets.getComponentPropertyIndex(
                    this,
                    "valueLeft"
                );

                build.line(
                    `int32_t value_new = evalIntegerProperty(${flowIndex}, ${componentIndex}, ${propertyIndex}, "Failed to evaluate Value Left in Slider widget");`
                );
            } else {
                build.line(
                    `int32_t value_new = ${build.getVariableGetterFunctionName(
                        this.valueLeft as string
                    )}();`
                );
            }

            build.line(
                `int32_t value_cur = lv_slider_get_left_value(screen->${build.getWidgetStructFieldName(
                    this
                )});`
            );

            build.line(
                `if (value_new != value_cur) lv_slider_set_left_value(screen->${build.getWidgetStructFieldName(
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
                    "value"
                );

                build.line(
                    `assignIntegerProperty(${flowIndex}, ${componentIndex}, ${propertyIndex}, value, "Failed to assign Value in Slider widget");`
                );
            } else {
                build.line(
                    `${build.getVariableSetterFunctionName(
                        this.value as string
                    )}(value);`
                );
            }

            build.unindent();
            build.line("}");
        }

        if (this.mode == "RANGE" && this.valueLeftType == "expression") {
            build.line("if (event == LV_EVENT_VALUE_CHANGED) {");
            build.indent();

            build.line(`lv_obj_t *ta = lv_event_get_target(e);`);
            build.line(`int32_t value = lv_slider_get_left_value(ta);`);

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
                    "valueLeft"
                );

                build.line(
                    `assignIntegerProperty(${flowIndex}, ${componentIndex}, ${propertyIndex}, value, "Failed to assign Value Left in Slider widget");`
                );
            } else {
                build.line(
                    `${build.getVariableSetterFunctionName(
                        this.valueLeft as string
                    )}(value);`
                );
            }

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
            this.widgetIndex,
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
            this.widgetIndex,
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
                propertyGridGroup: barGroup
            },
            ...makeExpressionProperty(
                "value",
                "integer",
                "assignable",
                ["literal", "expression"],
                {
                    propertyGridGroup: barGroup
                }
            ),
            ...makeExpressionProperty(
                "valueStart",
                "integer",
                "assignable",
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
            flags: "CLICKABLE|PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE",
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

    override lvglCreateObj(runtime: LVGLPageRuntime, parentObj: number) {
        const valueExpr = this.getExpressionPropertyData(runtime, "value");
        const valueStartExpr =
            this.mode == "RANGE"
                ? this.getExpressionPropertyData(runtime, "valueStart")
                : undefined;

        const obj = runtime.wasm._lvglCreateBar(
            parentObj,
            this.widgetIndex,
            this.lvglCreateLeft,
            this.lvglCreateTop,
            this.lvglCreateWidth,
            this.lvglCreateHeight,
            this.min,
            this.max,
            BAR_MODES[this.mode],
            valueExpr ? 0 : (this.value as number),
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

    override createEventHandlerSpecific(runtime: LVGLPageRuntime, obj: number) {
        const valueExpr = this.getExpressionPropertyData(runtime, "value");
        if (valueExpr) {
            runtime.wasm._lvglAddObjectFlowCallback(
                obj,
                LV_EVENT_BAR_VALUE_CHANGED,
                valueExpr.flowIndex,
                valueExpr.componentIndex,
                valueExpr.propertyIndex
            );
        }

        const valueStartExpr =
            this.mode == "RANGE"
                ? this.getExpressionPropertyData(runtime, "valueStart")
                : undefined;
        if (valueStartExpr) {
            runtime.wasm._lvglAddObjectFlowCallback(
                obj,
                LV_EVENT_BAR_VALUE_START_CHANGED,
                valueStartExpr.flowIndex,
                valueStartExpr.componentIndex,
                valueStartExpr.propertyIndex
            );
        }
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

        if (this.mode == "RANGE" && this.valueType == "literal") {
            build.line(
                `lv_bar_set_start_value(obj, ${this.valueStart}, LV_ANIM_OFF);`
            );
        }
    }

    override lvglBuildTickSpecific(build: LVGLBuild) {
        if (this.valueType == "expression") {
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
                    "value"
                );

                build.line(
                    `int32_t value_new = evalIntegerProperty(${flowIndex}, ${componentIndex}, ${propertyIndex}, "Failed to evaluate Value in Bar widget");`
                );
            } else {
                build.line(
                    `int32_t value_new = ${build.getVariableGetterFunctionName(
                        this.value as string
                    )}();`
                );
            }

            build.line(
                `int32_t value_cur = lv_bar_get_value(screen->${build.getWidgetStructFieldName(
                    this
                )});`
            );

            build.line(
                `if (value_new != value_cur) lv_bar_set_value(screen->${build.getWidgetStructFieldName(
                    this
                )}, value_new, LV_ANIM_OFF);`
            );

            build.unindent();
            build.line(`}`);
        }

        if (this.mode == "RANGE" && this.valueStartType == "expression") {
            build.line(`{`);
            build.indent();

            const page = getAncestorOfType(
                this,
                ProjectEditor.PageClass.classInfo
            ) as Page;

            if (
                build.assets.projectEditorStore.projectTypeTraits.hasFlowSupport
            ) {
                let flowIndex = build.assets.getFlowIndex(page);
                let componentIndex = build.assets.getComponentIndex(this);
                const propertyIndex = build.assets.getComponentPropertyIndex(
                    this,
                    "valueStart"
                );

                build.line(
                    `int32_t value_new = evalIntegerProperty(${flowIndex}, ${componentIndex}, ${propertyIndex}, "Failed to evaluate Value Start in Bar widget");`
                );
            } else {
                build.line(
                    `int32_t value_new = ${build.getVariableGetterFunctionName(
                        this.valueStart as string
                    )}();`
                );
            }

            build.line(
                `int32_t value_cur = lv_bar_get_start_value(screen->${build.getWidgetStructFieldName(
                    this
                )});`
            );

            build.line(
                `if (value_new != value_cur) lv_bar_set_start_value(screen->${build.getWidgetStructFieldName(
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
            build.line(`int32_t value = lv_bar_get_value(ta);`);

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
                    "value"
                );

                build.line(
                    `assignIntegerProperty(${flowIndex}, ${componentIndex}, ${propertyIndex}, value, "Failed to assign Value in Bar widget");`
                );
            } else {
                build.line(
                    `${build.getVariableSetterFunctionName(
                        this.value as string
                    )}(value);`
                );
            }

            build.unindent();
            build.line("}");
        }

        if (this.mode == "RANGE" && this.valueStartType == "expression") {
            build.line("if (event == LV_EVENT_VALUE_CHANGED) {");
            build.indent();

            build.line(`lv_obj_t *ta = lv_event_get_target(e);`);
            build.line(`int32_t value = lv_bar_get_start_value(ta);`);

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
                    "valueStart"
                );

                build.line(
                    `assignIntegerProperty(${flowIndex}, ${componentIndex}, ${propertyIndex}, value, "Failed to assign Value Start in Bar widget");`
                );
            } else {
                build.line(
                    `${build.getVariableSetterFunctionName(
                        this.valueStart as string
                    )}(value);`
                );
            }

            build.unindent();
            build.line("}");
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
            flags: "CLICKABLE|PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE",
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

    override lvglCreateObj(runtime: LVGLPageRuntime, parentObj: number) {
        return runtime.wasm._lvglCreateDropdown(
            parentObj,
            this.widgetIndex,
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
            `lv_dropdown_set_options(obj, ${escapeCString(this.options)});`
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
                enumItems: [
                    {
                        id: "NORMAL",
                        label: "NORMAL"
                    },
                    {
                        id: "REVERSE",
                        label: "REVERSE"
                    },
                    {
                        id: "SYMMETRICAL",
                        label: "SYMMETRICAL"
                    }
                ],
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
            flags: "CLICKABLE|PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE",
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

    override lvglCreateObj(runtime: LVGLPageRuntime, parentObj: number) {
        const valueExpr = this.getExpressionPropertyData(runtime, "value");

        const obj = runtime.wasm._lvglCreateArc(
            parentObj,
            this.widgetIndex,
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
        if (this.valueType == "expression") {
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
                    "value"
                );

                build.line(
                    `int32_t value_new = evalIntegerProperty(${flowIndex}, ${componentIndex}, ${propertyIndex}, "Failed to evaluate Value in Arc widget");`
                );
            } else {
                build.line(
                    `int32_t value_new = ${build.getVariableGetterFunctionName(
                        this.value as string
                    )}();`
                );
            }

            build.line(
                `int32_t value_cur = lv_arc_get_value(screen->${build.getWidgetStructFieldName(
                    this
                )});`
            );

            build.line(
                `if (value_new != value_cur) lv_arc_set_value(screen->${build.getWidgetStructFieldName(
                    this
                )}, value_new);`
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
            build.line(`int32_t value = lv_arc_get_value(ta);`);

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
                    "value"
                );

                build.line(
                    `assignIntegerProperty(${flowIndex}, ${componentIndex}, ${propertyIndex}, value, "Failed to assign Value in Arc widget");`
                );
            } else {
                build.line(
                    `${build.getVariableSetterFunctionName(
                        this.value as string
                    )}(value);`
                );
            }

            build.unindent();
            build.line("}");
        }
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

    override lvglCreateObj(runtime: LVGLPageRuntime, parentObj: number) {
        return runtime.wasm._lvglCreateSpinner(
            parentObj,
            this.widgetIndex,
            this.lvglCreateLeft,
            this.lvglCreateTop,
            this.lvglCreateWidth,
            this.lvglCreateHeight
        );
    }

    override lvglBuildObj(build: LVGLBuild) {
        build.line(`lv_obj_t *obj = lv_spinner_create(parent_obj);`);
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
            flags: "CLICKABLE|PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE|SCROLL_ON_FOCUS",
            text: "Checkbox"
        },

        icon: (
            <svg viewBox="0 0 1280 1279">
                <path d="M1052 225.7c-13 8-54 35.2-66.2 43.9l-11.8 8.5-11.8-7.8c-28.8-19.1-64.8-34-98.6-40.8-31.8-6.4-10.6-6-307.1-6-280.2 0-275.2-.1-300 4.1-45.9 7.7-92.8 28.7-129.5 58-10.9 8.7-29.7 27.5-38.4 38.4-28.3 35.6-44.7 72.7-52.4 119.4-1.5 9.2-1.7 34.4-2 291.6-.2 183.6.1 286 .7 294.5 2.5 32.4 10.1 60 24.2 88.5 14.2 28.7 31 51.2 54.9 73.5 34.1 32 79.1 55.4 127 66.3 31.7 7.2 6.3 6.7 314.5 6.7h277l14-2.2c92.9-14.9 166.7-67 205-144.8 11-22.4 17.7-43.4 22.2-70.2 1.7-10.3 1.8-24.8 1.8-302.3 0-309.6.2-295.9-4.6-318.5-7.7-36.4-25-72.3-49.7-103.2-7.9-10-9-11.6-7.4-11.1.8.3 35.3-35.7 44.9-46.9 9.4-10.9 11.5-16.3 6.3-16.3-4.1 0-33.1 16.4-40.5 22.9-9.6 8.5-5.3 3.7 17.1-18.7l25.1-25.1-2.9-3.6c-1.6-1.9-3.3-3.5-3.6-3.4-.4 0-4.1 2.1-8.2 4.6zM836.5 334.8c6.1 1.2 14.9 3.3 19.6 4.6 9.6 2.9 25.9 9.4 25.9 10.5 0 .4-8.2 7.8-18.2 16.6-131.9 115.4-266.2 268.4-386.9 441-9.7 13.7-20.7 29.6-24.5 35.3-3.8 5.6-7.4 10-8 9.8-.9-.3-137.4-81.8-218.1-130.2l-7.2-4.3-3 3.8-3.1 3.8 11.2 13.9c49.6 61.6 263.1 323.4 263.7 323.4.4 0 1.3-1 2-2.2.6-1.3.9-1.5.7-.6-.5 1.9 5 7.3 9.1 8.9 3.9 1.5 8.5-1.1 12-6.7 1.6-2.7 7.4-14.4 12.8-25.9 27.4-58.3 76.5-153.1 111-214 84.9-150.1 186.4-294.2 291.8-414.3 6.4-7.4 10.5-12.8 10.1-13.5-.4-.7.3-.3 1.5.8 5.9 5.2 17.2 25.8 22.1 40.3 6.5 19.5 6.1-1.4 5.8 312.7l-.3 285-2.7 10c-1.6 5.5-3.8 12.5-5 15.5-14.9 37.8-46.5 68.6-86.6 84.5-19.1 7.5-34.9 11-56.7 12.5-19 1.3-502.3 1.3-521.3 0-24.3-1.7-44.3-6.7-64.9-16.5-44.7-21.2-74.4-57.1-84-101.8-1.7-7.7-1.8-24.4-1.8-293.2 0-270.2.1-285.4 1.8-293.5 3.8-18 10-32.8 20.3-48.2 25.4-38.2 70.8-64.4 120.9-69.7 4.4-.5 127.5-.8 273.5-.7l265.5.2 11 2.2z" />
            </svg>
        ),

        lvgl: {
            parts: ["MAIN"],
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

    override lvglCreateObj(runtime: LVGLPageRuntime, parentObj: number) {
        return runtime.wasm._lvglCreateCheckbox(
            parentObj,
            this.widgetIndex,
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
        build.line(`lv_checkbox_set_text(obj, ${escapeCString(this.text)});`);
    }
}

////////////////////////////////////////////////////////////////////////////////

registerClass("LVGLArcWidget", LVGLArcWidget);
registerClass("LVGLBarWidget", LVGLBarWidget);
registerClass("LVGLButtonWidget", LVGLButtonWidget);
registerClass("LVGLCheckboxWidget", LVGLCheckboxWidget);
registerClass("LVGLDropdownWidget", LVGLDropdownWidget);
registerClass("LVGLImageWidget", LVGLImageWidget);
registerClass("LVGLLabelWidget", LVGLLabelWidget);
registerClass("LVGLPanelWidget", LVGLPanelWidget);
registerClass("LVGLRollerWidget", LVGLRollerWidget);
registerClass("LVGLSliderWidget", LVGLSliderWidget);
registerClass("LVGLSpinnerWidget", LVGLSpinnerWidget);
registerClass("LVGLSwitchWidget", LVGLSwitchWidget);
