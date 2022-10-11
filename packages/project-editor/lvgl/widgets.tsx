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
    LVGL_STATE_CODES
} from "project-editor/core/object";
import {
    getAncestorOfType,
    getClassInfo,
    Message,
    propertyNotFoundMessage,
    propertyNotSetMessage
} from "project-editor/store";

import { ProjectType } from "project-editor/project/project";

import type { IFlowContext } from "project-editor/flow/flow-interfaces";

import { AutoSize, Widget } from "project-editor/flow/component";

import {
    generalGroup,
    geometryGroup,
    specificGroup,
    styleGroup
} from "project-editor/ui-components/PropertyGrid/groups";
import { escapeCString, indent, TAB } from "project-editor/build/helper";
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

export const flagsGroup: IPropertyGridGroupDefinition = {
    id: "flags",
    title: "Flags",
    position: 4
};

export const statesGroup: IPropertyGridGroupDefinition = {
    id: "states",
    title: "States",
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

export class LVGLWidget extends Widget {
    identifier: string;

    leftUnit: "px" | "%";
    topUnit: "px" | "%";
    widthUnit: "px" | "%" | "content";
    heightUnit: "px" | "%" | "content";

    children: Widget[];
    flags: string;
    scrollbarMode: string;
    scrollDirection: string;
    states: string;
    localStyles: LVGLStylesDefinition;

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
                name: "leftUnit",
                type: PropertyType.Enum,
                enumItems: [
                    { id: "px", label: "px" },
                    { id: "%", label: "%" }
                ],
                propertyGridGroup: geometryGroup
            },
            {
                name: "topUnit",
                type: PropertyType.Enum,
                enumItems: [
                    { id: "px", label: "px" },
                    { id: "%", label: "%" }
                ],
                propertyGridGroup: geometryGroup
            },
            {
                name: "widthUnit",
                type: PropertyType.Enum,
                enumItems: [
                    { id: "px", label: "px" },
                    { id: "%", label: "%" },
                    { id: "content", label: "content" }
                ],
                propertyGridGroup: geometryGroup
            },
            {
                name: "heightUnit",
                type: PropertyType.Enum,
                enumItems: [
                    { id: "px", label: "px" },
                    { id: "%", label: "%" },
                    { id: "content", label: "content" }
                ],
                propertyGridGroup: geometryGroup
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
                name: "part",
                type: PropertyType.Enum,
                enumItems: (widget: LVGLWidget) => {
                    const classInfo = getClassInfo(widget);
                    return classInfo.lvgl!.parts.map(lvglPart => ({
                        id: lvglPart,
                        label: lvglPart
                    }));
                },
                enumDisallowUndefined: true,
                propertyGridGroup: styleGroup,
                computed: true,
                modifiable: true
            },
            {
                name: "state",
                type: PropertyType.Enum,
                enumItems: [
                    { id: "DEFAULT", label: "DEFAULT" },
                    { id: "CHECKED", label: "CHECKED" },
                    { id: "PRESSED", label: "PRESSED" },
                    { id: "CHECKED|PRESSED", label: "CHECKED | PRESSED" },
                    { id: "DISABLED", label: "DISABLED" },
                    { id: "FOCUSED", label: "FOCUSED" }
                ],
                enumDisallowUndefined: true,
                propertyGridGroup: styleGroup,
                computed: true,
                modifiable: true
            },
            {
                name: "localStyles",
                type: PropertyType.Object,
                typeClass: LVGLStylesDefinition,
                propertyGridGroup: styleGroup,
                propertyGridRowComponent: LVGLStylesDefinitionProperty,
                enumerable: false
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

    override lvglCreate(
        runtime: LVGLPageRuntime,
        parentObj: number
    ): LVGLCreateResultType {
        const obj = this.lvglCreateObj(runtime, parentObj);

        if (runtime.isEditor) {
            runInAction(() => (this._lvglObj = obj));
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

    override lvglBuild(): string {
        const classInfo = getClassInfo(this);

        // add/clear flags
        let flags = "";
        {
            const { added, cleared } = changes(
                (classInfo.lvgl!.defaultFlags ?? "").split("|"),
                (this.flags || "").split(
                    "|"
                ) as (keyof typeof LVGL_FLAG_CODES)[]
            );

            if (added.length > 0) {
                flags += `lv_obj_add_flag(obj, ${added
                    .map(flag => "LV_OBJ_FLAG_" + flag)
                    .join("|")});\n`;
            }

            if (cleared.length > 0) {
                flags += `lv_obj_clear_flag(obj, ${cleared
                    .map(flag => "LV_OBJ_FLAG_" + flag)
                    .join("|")});\n`;
            }
        }

        // add/clear states
        let states = "";
        {
            const { added, cleared } = changes(
                (classInfo.lvgl!.defaultStates ?? "").split("|"),
                (this.states || "").split(
                    "|"
                ) as (keyof typeof LVGL_STATE_CODES)[]
            );

            if (added.length > 0) {
                states += `lv_obj_add_state(obj, ${added
                    .map(state => "LV_STATE_" + state)
                    .join("|")});\n`;
            }

            if (cleared.length > 0) {
                states += `lv_obj_clear_state(obj, ${cleared
                    .map(state => "LV_STATE_" + state)
                    .join("|")});\n`;
            }
        }

        let result = "";

        if (this.identifier) {
            result = `// ${this.identifier}\n`;
        }

        result += this.lvglBuildObj();

        if (flags) {
            result += "\n" + flags;
        }

        if (states) {
            if (!flags) {
                result += "\n";
            }
            result += states;
        }

        if (result.endsWith("\n")) {
            result = result.substring(0, result.length - 1);
        }

        result += this.localStyles.lvglBuild();

        if (this.children.length == 0) {
            return result;
        }

        const widgets = this.children
            .map(
                (widget: LVGLWidget) =>
                    `{\n${indent(TAB, widget.lvglBuild())}\n}`
            )
            .join("\n");

        return `${result}
{
    lv_obj_t *parent_obj = obj;
${indent(TAB, widgets)}
}`;
    }

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

    get lvglBuildPosAndSize() {
        return `lv_obj_set_pos(obj, ${this.lvglBuildLeft}, ${this.lvglBuildTop});
lv_obj_set_size(obj, ${this.lvglBuildWidth}, ${this.lvglBuildHeight});`;
    }

    lvglBuildObj(): string {
        console.error("UNEXPECTED!");
        return "";
    }

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

export class LVGLLabelWidget extends LVGLWidget {
    text: string;
    longMode: keyof typeof LONG_MODE_CODES;
    recolor: boolean;

    static classInfo = makeDerivedClassInfo(LVGLWidget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType === ProjectType.LVGL,

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
            {
                name: "text",
                type: PropertyType.String,
                propertyGridGroup: specificGroup
            },
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
                propertyGridGroup: specificGroup
            },
            {
                name: "recolor",
                type: PropertyType.Boolean,
                propertyGridGroup: specificGroup
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
            longMode: observable,
            recolor: observable
        });
    }

    override lvglCreateObj(runtime: LVGLPageRuntime, parentObj: number) {
        return runtime.wasm._lvglCreateLabel(
            parentObj,
            this.lvglCreateLeft,
            this.lvglCreateTop,
            this.lvglCreateWidth,
            this.lvglCreateHeight,
            runtime.wasm.allocateUTF8(this.text),
            LONG_MODE_CODES[this.longMode],
            this.recolor ? 1 : 0
        );
    }

    override lvglBuildObj() {
        const longMode =
            this.longMode != "WRAP"
                ? `\nlv_label_set_long_mode(obj, LV_LABEL_LONG_${this.longMode});`
                : "";
        const recolor = this.recolor
            ? `\nlv_label_set_recolor(obj, true);`
            : "";

        return `lv_obj_t *obj = lv_label_create(parent_obj);
${this.lvglBuildPosAndSize}${longMode}
lv_label_set_text(obj, ${escapeCString(this.text)});${recolor}`;
    }
}

////////////////////////////////////////////////////////////////////////////////

export class LVGLButtonWidget extends LVGLWidget {
    static classInfo = makeDerivedClassInfo(LVGLWidget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType === ProjectType.LVGL,

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

    override lvglBuildObj() {
        return `lv_obj_t *obj = lv_btn_create(parent_obj);
${this.lvglBuildPosAndSize}`;
    }
}

////////////////////////////////////////////////////////////////////////////////

export class LVGLPanelWidget extends LVGLWidget {
    static classInfo = makeDerivedClassInfo(LVGLWidget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType === ProjectType.LVGL,

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

    override lvglBuildObj() {
        return `lv_obj_t *obj = lv_obj_create(parent_obj);
${this.lvglBuildPosAndSize}`;
    }
}

////////////////////////////////////////////////////////////////////////////////

export class LVGLImageWidget extends LVGLWidget {
    image: string;
    pivotX: number;
    pivotY: number;
    zoom: number;
    angle: number;

    static classInfo = makeDerivedClassInfo(LVGLWidget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType === ProjectType.LVGL,

        properties: [
            {
                name: "image",
                type: PropertyType.ObjectReference,
                referencedObjectCollectionPath: "bitmaps",
                propertyGridGroup: specificGroup
            },
            {
                name: "pivotX",
                displayName: "Pivot X",
                type: PropertyType.Number,
                propertyGridGroup: specificGroup
            },
            {
                name: "pivotY",
                displayName: "Pivot Y",
                type: PropertyType.Number,
                propertyGridGroup: specificGroup
            },
            {
                name: "zoom",
                displayName: "Scale",
                type: PropertyType.Number,
                propertyGridGroup: specificGroup
            },
            {
                name: "angle",
                displayName: "Rotation",
                type: PropertyType.Number,
                propertyGridGroup: specificGroup
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

    override lvglBuildObj() {
        return `lv_obj_t *obj = lv_img_create(parent_obj);
${this.lvglBuildPosAndSize}${
            this.image ? `\nlv_img_set_src(obj, &img_${this.image});` : ""
        }${
            this.pivotX != 0 || this.pivotY != 0
                ? `\nlv_img_set_pivot(obj, ${this.pivotX}, ${this.pivotY});`
                : ""
        }${this.zoom != 256 ? `\nlv_img_set_zoom(obj, ${this.zoom});` : ""}${
            this.angle != 0 ? `\nlv_img_set_angle(obj, ${this.angle});` : ""
        }`;
    }
}

////////////////////////////////////////////////////////////////////////////////

const SLIDER_MODES = {
    NORMAL: 0,
    SYMMETRICAL: 1,
    RANGE: 2
};

export class LVGLSliderWidget extends LVGLWidget {
    min: number;
    max: number;
    mode: keyof typeof SLIDER_MODES;
    value: number;
    valueLeft: number;

    static classInfo = makeDerivedClassInfo(LVGLWidget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType === ProjectType.LVGL,

        properties: [
            {
                name: "min",
                type: PropertyType.Number,
                propertyGridGroup: specificGroup
            },
            {
                name: "max",
                type: PropertyType.Number,
                propertyGridGroup: specificGroup
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
                propertyGridGroup: specificGroup
            },
            {
                name: "value",
                type: PropertyType.Number,
                propertyGridGroup: specificGroup
            },
            {
                name: "valueLeft",
                type: PropertyType.Number,
                propertyGridGroup: specificGroup
            }
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
            valueLeft: 0
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
            valueLeft: observable
        });
    }

    override lvglCreateObj(runtime: LVGLPageRuntime, parentObj: number) {
        return runtime.wasm._lvglCreateSlider(
            parentObj,
            this.lvglCreateLeft,
            this.lvglCreateTop,
            this.lvglCreateWidth,
            this.lvglCreateHeight,
            this.min,
            this.max,
            SLIDER_MODES[this.mode],
            this.value,
            this.valueLeft
        );
    }

    override lvglBuildObj() {
        const range =
            this.min != 0 || this.max != 100
                ? `\nlv_slider_set_range(obj, ${this.min}, ${this.max});`
                : "";

        const mode =
            this.mode != "NORMAL"
                ? `\nlv_slider_set_mode(obj, LV_SLIDER_MODE_${this.mode});`
                : "";

        const value =
            this.value != 0
                ? `\nlv_slider_set_value(obj, ${this.value}, LV_ANIM_OFF);`
                : "";

        const valueLeft =
            this.valueLeft != 0
                ? `\nif(lv_slider_get_mode(obj) == LV_SLIDER_MODE_RANGE) lv_slider_set_left_value(obj, ${this.valueLeft}, LV_ANIM_OFF);`
                : "";

        return `lv_obj_t *obj = lv_slider_create(parent_obj);${range}${mode}${value}${valueLeft}
${this.lvglBuildPosAndSize}`;
    }
}

////////////////////////////////////////////////////////////////////////////////

const ROLLER_MODES = {
    NORMAL: 0,
    INFINITE: 1
};

export class LVGLRollerWidget extends LVGLWidget {
    options: string;
    mode: keyof typeof ROLLER_MODES;

    static classInfo = makeDerivedClassInfo(LVGLWidget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType === ProjectType.LVGL,

        properties: [
            {
                name: "options",
                type: PropertyType.MultilineText,
                propertyGridGroup: specificGroup
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
                propertyGridGroup: specificGroup
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

    override lvglBuildObj() {
        return `lv_obj_t *obj = lv_roller_create(parent_obj);
${this.lvglBuildPosAndSize}
lv_roller_set_options(obj, ${escapeCString(this.options)}, LV_ROLLER_MODE_${
            this.mode
        });`;
    }
}

////////////////////////////////////////////////////////////////////////////////

export class LVGLSwitchWidget extends LVGLWidget {
    static classInfo = makeDerivedClassInfo(LVGLWidget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType === ProjectType.LVGL,

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

    override lvglBuildObj() {
        return `lv_obj_t *obj = lv_switch_create(parent_obj);
${this.lvglBuildPosAndSize}`;
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
