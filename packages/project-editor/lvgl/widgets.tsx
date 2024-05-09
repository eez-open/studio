import React from "react";
import { observable, makeObservable, runInAction, computed, toJS } from "mobx";
import { observer } from "mobx-react";
import { MenuItem } from "@electron/remote";

import { Rect } from "eez-studio-shared/geometry";

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
    getClassInfoLvglProperties,
    EezObject,
    ClassInfo,
    setParent,
    IMessage
} from "project-editor/core/object";

import {
    createObject,
    getAncestorOfType,
    getChildOfObject,
    getClassInfo,
    getObjectPathAsString,
    getProjectStore,
    Message,
    propertyNotFoundMessage,
    propertyNotSetMessage,
    objectToClipboardData,
    clipboardDataToObject,
    ProjectStore
} from "project-editor/store";

import {
    getProject,
    ProjectType,
    findBitmap,
    findAction,
    findPage,
    findLvglStyle
} from "project-editor/project/project";

import type {
    IFlowContext,
    IResizeHandler
} from "project-editor/flow/flow-interfaces";

import {
    AutoSize,
    Component,
    ComponentInput,
    ComponentOutput,
    isFlowProperty,
    makeExpressionProperty,
    Widget
} from "project-editor/flow/component";
import { isTimelineEditorActive } from "project-editor/flow/timeline";

import { escapeCString } from "project-editor/build/helper";
import { getComponentName } from "project-editor/flow/components/components-registry";
import { ProjectContext } from "project-editor/project/context";
import { ProjectEditor } from "project-editor/project-editor-interface";
import type { Page } from "project-editor/features/page/page";
import { ComponentsContainerEnclosure } from "project-editor/flow/editor/render";
import {
    geometryGroup,
    specificGroup
} from "project-editor/ui-components/PropertyGrid/groups";
import { Property } from "project-editor/ui-components/PropertyGrid/Property";

import { LVGLStylesDefinition } from "project-editor/lvgl/style-definition";
import { LVGLStylesDefinitionProperty } from "project-editor/lvgl/LVGLStylesDefinitionProperty";
import {
    LVGLNonActivePageViewerRuntime,
    LVGLPageRuntime,
    LVGLPageViewerRuntime
} from "project-editor/lvgl/page-runtime";
import type { LVGLBuild } from "project-editor/lvgl/build";
import {
    LVGLWidgetFlagsProperty,
    LVGLWidgetStatesProperty,
    LV_EVENT_ARC_VALUE_CHANGED,
    LV_EVENT_CHECKED_STATE_CHANGED,
    LV_EVENT_SLIDER_VALUE_CHANGED,
    LV_EVENT_SLIDER_VALUE_LEFT_CHANGED,
    LV_EVENT_TEXTAREA_TEXT_CHANGED,
    LV_EVENT_DROPDOWN_SELECTED_CHANGED,
    LV_EVENT_ROLLER_SELECTED_CHANGED,
    getCode,
    getExpressionPropertyData,
    LV_EVENT_METER_TICK_LABEL_EVENT,
    LVGL_EVENTS,
    getExpressionPropertyInitalValue,
    unescapeText,
    checkProperty
} from "project-editor/lvgl/widget-common";
import {
    expressionPropertyBuildEventHandlerSpecific,
    expressionPropertyBuildTickSpecific,
    LVGLPropertyType,
    makeLvglExpressionProperty
} from "project-editor/lvgl/expression-property";
import { LVGLStyle } from "project-editor/lvgl/style";
import {
    colorRgbToHexNumStr,
    colorRgbToNum
} from "project-editor/lvgl/style-helper";
import { showGenericDialog } from "eez-studio-ui/generic-dialog";
import { humanize } from "eez-studio-shared/string";
import { checkExpression } from "project-editor/flow/expression";
import { Button } from "eez-studio-ui/button";
import {
    SWITCH_WIDGET_ICON,
    USER_WIDGET_ICON
} from "project-editor/ui-components/icons";
import {
    EndActionComponent,
    InputActionComponent,
    OutputActionComponent,
    StartActionComponent
} from "project-editor/flow/components/actions";
import { Assets, DataBuffer } from "project-editor/build/assets";
import { COMPONENT_TYPE_LVGL_USER_WIDGET } from "project-editor/flow/components/component-types";
import { visitObjects } from "project-editor/core/search";
import { validators } from "eez-studio-shared/validation";
import {
    getLvglCoordTypeShift,
    getLvglFlagCodes,
    lvglHasLabelRecolorSupport
} from "project-editor/lvgl/lvgl-versions";

4; ////////////////////////////////////////////////////////////////////////////////

const generalGroup: IPropertyGridGroupDefinition = {
    id: "lvgl-general",
    title: "General",
    position: 0
};

export const flagsGroup: IPropertyGridGroupDefinition = {
    id: "lvgl-flags",
    title: "Flags",
    position: 4
};

const styleGroup: IPropertyGridGroupDefinition = {
    id: "lvgl-style",
    title: "Style",
    position: 3
};

export const statesGroup: IPropertyGridGroupDefinition = {
    id: "lvgl-states",
    title: "States",
    position: 4
};

////////////////////////////////////////////////////////////////////////////////

function changes<T extends string>(defaults: T[], arr: T[]) {
    const added: T[] = [];
    const cleared: T[] = [];

    defaults = defaults.filter(x => x.trim() != "");
    arr = arr.filter(x => x.trim() != "");

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

function getFlowStateAddressIndex(runtime: LVGLPageRuntime) {
    return runtime.lvglCreateContext.flowState;
}

function lvglAddObjectFlowCallback(
    runtime: LVGLPageRuntime,
    obj: number,
    filter: number,
    component_index: number,
    output_or_property_index: number
) {
    runtime.wasm._lvglAddObjectFlowCallback(
        obj,
        filter,
        getFlowStateAddressIndex(runtime),
        component_index,
        output_or_property_index
    );
}

////////////////////////////////////////////////////////////////////////////////

function checkWidgetTypeLvglVersion(
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
                    widget: IEezObject,
                    parent: IEezObject,
                    propertyInfo?: PropertyInfo
                ) => {
                    const oldIdentifier = propertyInfo
                        ? getProperty(widget, propertyInfo.name)
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
                            ProjectEditor.getProjectStore(
                                parent
                            ).lvglIdentifiers.getIdentifierByName(
                                ProjectEditor.getFlow(widget),
                                newIdentifer
                            ) == undefined
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
                propertyGridGroup: geometryGroup
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
                propertyGridGroup: geometryGroup
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
                enumDisallowUndefined: true,
                propertyGridGroup: geometryGroup,
                hideInPropertyGrid: true
            },
            {
                name: "height",
                type: PropertyType.Number,
                propertyGridColumnComponent: GeometryProperty,
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
            ...makeLvglExpressionProperty(
                "hiddenFlag",
                "boolean",
                "input",
                ["literal", "expression"],
                {
                    displayName: "Hidden",
                    propertyGridGroup: flagsGroup,
                    disabled: (widget: LVGLWidget) =>
                        !flagEnabledInWidget(widget, "HIDDEN")
                }
            ),
            ...makeLvglExpressionProperty(
                "clickableFlag",
                "boolean",
                "input",
                ["literal", "expression"],
                {
                    displayName: "Clickable",
                    propertyGridGroup: flagsGroup,
                    disabled: (widget: LVGLWidget) =>
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
                propertyGridGroup: flagsGroup,
                hideInPropertyGrid: true
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
                propertyGridGroup: flagsGroup,
                hideInPropertyGrid: true
            },
            ...makeLvglExpressionProperty(
                "checkedState",
                "boolean",
                "assignable",
                ["literal", "expression"],
                {
                    displayName: "Checked",
                    propertyGridGroup: statesGroup,
                    disabled: (widget: LVGLWidget) =>
                        !stateEnabledInWidget(widget, "CHECKED")
                }
            ),
            ...makeLvglExpressionProperty(
                "disabledState",
                "boolean",
                "input",
                ["literal", "expression"],
                {
                    displayName: "Disabled",
                    propertyGridGroup: statesGroup,
                    disabled: (widget: LVGLWidget) =>
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
                referencedObjectCollectionPath: "lvglStyles/allStyles",
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
                },
                propertyMenu: (props: PropertyProps): Electron.MenuItem[] => {
                    let menuItems: Electron.MenuItem[] = [];

                    if (props.objects.length === 1) {
                        const widget = props.objects[0] as LVGLWidget;

                        if (widget.localStyles.hasModifications) {
                            menuItems.push(
                                new MenuItem({
                                    label: "Reset All Modifications",
                                    click: () => {
                                        widget.localStyles.resetAllModifications();
                                    }
                                })
                            );

                            menuItems.push(
                                new MenuItem({
                                    label: "Create New Style",
                                    click: async () => {
                                        const projectStore =
                                            getProjectStore(widget);

                                        const result = await showGenericDialog({
                                            dialogDefinition: {
                                                title: "New Style",
                                                fields: [
                                                    {
                                                        name: "name",
                                                        type: "string",
                                                        validators: [
                                                            validators.required,
                                                            validators.unique(
                                                                {},
                                                                projectStore
                                                                    .project
                                                                    .lvglStyles
                                                                    .allStyles
                                                            )
                                                        ]
                                                    }
                                                ]
                                            },
                                            values: {}
                                        });

                                        projectStore.undoManager.setCombineCommands(
                                            true
                                        );

                                        let styleParent =
                                            projectStore.project.lvglStyles
                                                .styles;

                                        if (widget.useStyle) {
                                            const lvglStyle = findLvglStyle(
                                                projectStore.project,
                                                widget.useStyle
                                            );

                                            if (
                                                lvglStyle &&
                                                lvglStyle.forWidgetType ==
                                                    widget.type
                                            ) {
                                                styleParent =
                                                    lvglStyle.childStyles;
                                            }
                                        }

                                        projectStore.addObject(
                                            styleParent,
                                            createObject<LVGLStyle>(
                                                projectStore,
                                                {
                                                    name: result.values.name,
                                                    forWidgetType: widget.type,
                                                    definition:
                                                        createObject<LVGLStylesDefinition>(
                                                            projectStore,
                                                            {
                                                                definition:
                                                                    toJS(
                                                                        widget
                                                                            .localStyles
                                                                            .definition
                                                                    )
                                                            },
                                                            LVGLStylesDefinition
                                                        )
                                                },
                                                LVGLStyle
                                            )
                                        );

                                        projectStore.updateObject(widget, {
                                            useStyle: result.values.name
                                        });

                                        projectStore.updateObject(
                                            widget.localStyles,
                                            {
                                                definition: undefined
                                            }
                                        );

                                        projectStore.undoManager.setCombineCommands(
                                            false
                                        );
                                    }
                                })
                            );

                            if (widget.useStyle) {
                                menuItems.push(
                                    new MenuItem({
                                        label: "Update Style",
                                        click: async () => {
                                            const projectStore =
                                                getProjectStore(widget);

                                            const lvglStyle = findLvglStyle(
                                                projectStore.project,
                                                widget.useStyle
                                            );

                                            if (lvglStyle) {
                                                projectStore.undoManager.setCombineCommands(
                                                    true
                                                );

                                                projectStore.updateObject(
                                                    lvglStyle.definition,
                                                    {
                                                        definition:
                                                            LVGLStylesDefinition.combineDefinitions(
                                                                lvglStyle
                                                                    .definition
                                                                    .definition,
                                                                widget
                                                                    .localStyles
                                                                    .definition
                                                            )
                                                    }
                                                );

                                                projectStore.updateObject(
                                                    widget.localStyles,
                                                    {
                                                        definition: undefined
                                                    }
                                                );

                                                projectStore.undoManager.setCombineCommands(
                                                    false
                                                );
                                            }
                                        }
                                    })
                                );
                            }
                        }
                    }

                    return menuItems;
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
            }
        ],

        beforeLoadHook: (widget: LVGLWidget, jsWidget: Partial<LVGLWidget>) => {
            // MIGRATION TO LOW RES
            if ((window as any).__eezProjectMigration) {
                jsWidget.left = Math.floor(
                    (jsWidget.left! *
                        __eezProjectMigration.displayTargetWidth) /
                        __eezProjectMigration.displaySourceWidth
                );
                jsWidget.top = Math.floor(
                    (jsWidget.top! *
                        __eezProjectMigration.displayTargetHeight) /
                        __eezProjectMigration.displaySourceHeight
                );
                jsWidget.width = Math.floor(
                    (jsWidget.width! *
                        __eezProjectMigration.displayTargetWidth) /
                        __eezProjectMigration.displaySourceWidth
                );
                jsWidget.height = Math.floor(
                    (jsWidget.height! *
                        __eezProjectMigration.displayTargetHeight) /
                        __eezProjectMigration.displaySourceHeight
                );
            }

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
            const projectStore = getProjectStore(widget);

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

            projectStore.updateObject(widget, props);
        },

        check: (widget: LVGLWidget, messages: IMessage[]) => {
            const projectStore = getProjectStore(widget);

            if (widget.identifier) {
                const lvglIdentifier =
                    projectStore.lvglIdentifiers.getIdentifier(widget);

                if (lvglIdentifier.duplicate) {
                    messages.push(
                        new Message(
                            MessageType.ERROR,
                            `Duplicate identifier`,
                            getChildOfObject(widget, "identifier")
                        )
                    );
                }
            }

            if (widget.useStyle) {
                const lvglStyle = findLvglStyle(
                    projectStore.project,
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

            widget.localStyles.check(messages);
        },

        showTreeCollapseIcon: "has-children",

        widgetEvents: LVGL_EVENTS
    });

    constructor() {
        super();

        makeObservable(this, {
            allStates: computed,
            relativePosition: computed,
            componentWidth: computed,
            componentHeight: computed,
            isAccessibleFromSourceCode: computed
        });
    }

    override makeEditable() {
        super.makeEditable();

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
            useStyle: observable,
            localStyles: observable,
            _lvglObj: observable,
            _refreshCounter: observable
        });
    }

    get rect(): Rect {
        return {
            left: this.relativePosition.left,
            top: this.relativePosition.top,
            width: this.componentWidth,
            height: this.componentHeight
        };
    }

    override get relativePosition() {
        // update when _refreshCounter changes
        this._refreshCounter;

        if (this._lvglObj) {
            const page = getAncestorOfType(
                this,
                ProjectEditor.PageClass.classInfo
            ) as Page;
            if (page._lvglRuntime && page._lvglRuntime.isMounted) {
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
            if (page._lvglRuntime && page._lvglRuntime.isMounted) {
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
            if (page._lvglRuntime && page._lvglRuntime.isMounted) {
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
            if (page._lvglRuntime && page._lvglRuntime.isMounted) {
                return page._lvglRuntime.wasm._lvglGetObjHeight(this._lvglObj);
            }
        }
        return this.height ?? 0;
    }

    override getResizeHandlers(): IResizeHandler[] | undefined | false {
        if (isTimelineEditorActive(this)) {
            return [];
        }

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
        const flags =
            this.flags.trim() != ""
                ? (this.flags.split("|") as (keyof typeof LVGL_FLAG_CODES)[])
                : [];

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

    override lvglCreate(runtime: LVGLPageRuntime, parentObj: number) {
        const obj = this.lvglCreateObj(runtime, parentObj);

        runInAction(() => (this._lvglObj = obj));

        const project = ProjectEditor.getProject(this);

        if (runtime.wasm.assetsMap) {
            const page = getAncestorOfType(
                this,
                ProjectEditor.PageClass.classInfo
            ) as Page;
            const pagePath = getObjectPathAsString(page);

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
                                component.outputIndexes[eventHandler.eventName];
                            if (outputIndex != undefined) {
                                lvglAddObjectFlowCallback(
                                    runtime,
                                    obj,
                                    eventHandler.eventCode,
                                    componentIndex,
                                    outputIndex
                                );
                            }
                        }
                    } else if (eventHandler.action) {
                        const action = findAction(project, eventHandler.action);
                        if (action) {
                            const actionPath = getObjectPathAsString(action);
                            const actionFlowIndex =
                                runtime.wasm.assetsMap.flowIndexes[actionPath];
                            lvglAddObjectFlowCallback(
                                runtime,
                                obj,
                                eventHandler.eventCode,
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
                lvglClassInfoProperties.defaultFlags.trim() != ""
                    ? lvglClassInfoProperties.defaultFlags.split("|")
                    : [],
                this.allFlags.trim() != ""
                    ? (this.allFlags.split(
                          "|"
                      ) as (keyof typeof LVGL_FLAG_CODES)[])
                    : []
            );

            if (added.length > 0) {
                runtime.wasm._lvglObjAddFlag(
                    obj,
                    getCode(added, getLvglFlagCodes(this))
                );
            }
            if (cleared.length > 0) {
                runtime.wasm._lvglObjClearFlag(
                    obj,
                    getCode(cleared, getLvglFlagCodes(this))
                );
            }

            const hiddenFlagExpr = getExpressionPropertyData(
                runtime,
                this,
                "hiddenFlag"
            );
            if (hiddenFlagExpr) {
                runtime.wasm._lvglUpdateHiddenFlag(
                    obj,
                    getFlowStateAddressIndex(runtime),
                    hiddenFlagExpr.componentIndex,
                    hiddenFlagExpr.propertyIndex
                );
            }

            const clickableFlagExpr = getExpressionPropertyData(
                runtime,
                this,
                "clickableFlag"
            );
            if (clickableFlagExpr) {
                runtime.wasm._lvglUpdateClickableFlag(
                    obj,
                    getFlowStateAddressIndex(runtime),
                    clickableFlagExpr.componentIndex,
                    clickableFlagExpr.propertyIndex
                );
            }

            if (this.hiddenInEditor && runtime.isEditor) {
                runtime.wasm._lvglObjAddFlag(
                    obj,
                    getCode(["HIDDEN"], getLvglFlagCodes(this))
                );
            }
        }

        // add/clear states
        {
            const { added, cleared } = changes(
                lvglClassInfoProperties.defaultStates &&
                    lvglClassInfoProperties.defaultStates.trim() != ""
                    ? lvglClassInfoProperties.defaultStates.split("|")
                    : [],
                this.allStates.trim() != ""
                    ? (this.allStates.split(
                          "|"
                      ) as (keyof typeof LVGL_STATE_CODES)[])
                    : []
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

            const checkedStateExpr = getExpressionPropertyData(
                runtime,
                this,
                "checkedState"
            );
            if (checkedStateExpr) {
                runtime.wasm._lvglUpdateCheckedState(
                    obj,
                    getFlowStateAddressIndex(runtime),
                    checkedStateExpr.componentIndex,
                    checkedStateExpr.propertyIndex
                );
            }

            const disabledStateExpr = getExpressionPropertyData(
                runtime,
                this,
                "disabledState"
            );
            if (disabledStateExpr) {
                runtime.wasm._lvglUpdateDisabledState(
                    obj,
                    getFlowStateAddressIndex(runtime),
                    disabledStateExpr.componentIndex,
                    disabledStateExpr.propertyIndex
                );
            }
        }

        for (const keyframe of this.timeline) {
            keyframe.lvglCreate(
                runtime,
                obj,
                runtime.lvglCreateContext.flowState
            );
        }

        if (obj) {
            const useStyle = this.styleTemplate;
            if (useStyle) {
                const lvglStyle = findLvglStyle(project, useStyle);
                if (lvglStyle) {
                    lvglStyle.lvglCreate(runtime, this, obj);
                }
            }
            this.localStyles.lvglCreate(runtime, this, obj);

            this.children.map((widget: LVGLWidget) =>
                widget.lvglCreate(runtime, obj)
            );
        }

        return obj;
    }

    lvglCreateObj(runtime: LVGLPageRuntime, parentObj: number): number {
        console.error("UNEXPECTED!");
        return 0;
    }

    createEventHandler(runtime: LVGLPageRuntime, obj: number) {
        const checkedStateExpr = getExpressionPropertyData(
            runtime,
            this,
            "checkedState"
        );
        if (checkedStateExpr) {
            lvglAddObjectFlowCallback(
                runtime,
                obj,
                LV_EVENT_CHECKED_STATE_CHANGED,
                checkedStateExpr.componentIndex,
                checkedStateExpr.propertyIndex
            );
        }

        this.createEventHandlerSpecific(runtime, obj);
    }

    createEventHandlerSpecific(runtime: LVGLPageRuntime, obj: number) {}

    get isAccessibleFromSourceCode() {
        if (this.identifier) {
            return true;
        }

        if (this.timeline.length > 0) {
            return true;
        }

        if (this.eventHandlers.length > 0 || this.hasEventHandler) {
            return true;
        }

        if (
            this.checkedStateType == "expression" ||
            this.disabledStateType == "expression" ||
            this.hiddenFlagType == "expression" ||
            this.clickableFlagType == "expression"
        ) {
            return true;
        }

        return this.getIsAccessibleFromSourceCode();
    }

    getIsAccessibleFromSourceCode() {
        return false;
    }

    lvglBuild(build: LVGLBuild): void {
        if (this.identifier) {
            build.line(`// ${this.identifier}`);
        }

        this.lvglBuildObj(build);

        if (this.isAccessibleFromSourceCode) {
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
                )}, LV_EVENT_ALL, ${
                    build.assets.projectStore.projectTypeTraits.hasFlowSupport
                        ? "flowState"
                        : 0
                });`
            );
        }

        const lvglClassInfoProperties = getClassInfoLvglProperties(this);

        // add/clear flags
        {
            const { added, cleared } = changes(
                lvglClassInfoProperties.defaultFlags.trim() != ""
                    ? lvglClassInfoProperties.defaultFlags.split("|")
                    : [],
                this.allFlags.trim() != ""
                    ? (this.allFlags.split(
                          "|"
                      ) as (keyof typeof LVGL_FLAG_CODES)[])
                    : []
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
                lvglClassInfoProperties.defaultStates &&
                    lvglClassInfoProperties.defaultStates.trim() != ""
                    ? lvglClassInfoProperties.defaultStates.split("|")
                    : [],
                this.allStates.trim() != ""
                    ? (this.allStates.split(
                          "|"
                      ) as (keyof typeof LVGL_STATE_CODES)[])
                    : []
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
            const style = findLvglStyle(
                ProjectEditor.getProject(this),
                useStyle
            );
            if (style) {
                build.line(`${build.getStyleFunctionName(style)}(obj);`);
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

    lvglPostBuild(build: LVGLBuild): void {}

    lvglBuildTick(build: LVGLBuild): void {
        if (this.checkedStateType == "expression") {
            build.line(`{`);
            build.indent();

            if (build.assets.projectStore.projectTypeTraits.hasFlowSupport) {
                let componentIndex = build.assets.getComponentIndex(this);
                const propertyIndex = build.assets.getComponentPropertyIndex(
                    this,
                    "checkedState"
                );

                build.line(
                    `bool new_val = evalBooleanProperty(flowState, ${componentIndex}, ${propertyIndex}, "Failed to evaluate Checked state");`
                );
            } else {
                build.line(
                    `bool new_val = ${build.getVariableGetterFunctionName(
                        this.checkedState as string
                    )}();`
                );
            }

            const objectAccessor = build.getLvglObjectAccessor(this);

            build.line(
                `bool cur_val = lv_obj_has_state(${objectAccessor}, LV_STATE_CHECKED);`
            );

            build.line(`if (new_val != cur_val) {`);
            build.indent();
            build.line(`tick_value_change_obj = ${objectAccessor};`);
            build.line(
                `if (new_val) lv_obj_add_state(${objectAccessor}, LV_STATE_CHECKED);`
            );
            build.line(
                `else lv_obj_clear_state(${objectAccessor}, LV_STATE_CHECKED);`
            );
            build.line(`tick_value_change_obj = NULL;`);
            build.unindent();
            build.line(`}`);

            build.unindent();
            build.line(`}`);
        }

        if (this.disabledStateType == "expression") {
            build.line(`{`);
            build.indent();

            if (build.assets.projectStore.projectTypeTraits.hasFlowSupport) {
                let componentIndex = build.assets.getComponentIndex(this);
                const propertyIndex = build.assets.getComponentPropertyIndex(
                    this,
                    "disabledState"
                );

                build.line(
                    `bool new_val = evalBooleanProperty(flowState, ${componentIndex}, ${propertyIndex}, "Failed to evaluate Disabled state");`
                );
            } else {
                build.line(
                    `bool new_val = ${build.getVariableGetterFunctionName(
                        this.disabledState as string
                    )}();`
                );
            }
            const objectAccessor = build.getLvglObjectAccessor(this);

            build.line(
                `bool cur_val = lv_obj_has_state(${objectAccessor}, LV_STATE_DISABLED);`
            );

            build.line(`if (new_val != cur_val) {`);
            build.indent();
            build.line(`tick_value_change_obj = ${objectAccessor};`);
            build.line(
                `if (new_val) lv_obj_add_state(${objectAccessor}, LV_STATE_DISABLED);`
            );
            build.line(
                `else lv_obj_clear_state(${objectAccessor}, LV_STATE_DISABLED);`
            );
            build.line(`tick_value_change_obj = NULL;`);
            build.unindent();
            build.line(`}`);

            build.unindent();
            build.line(`}`);
        }

        if (this.hiddenFlagType == "expression") {
            build.line(`{`);
            build.indent();

            if (build.assets.projectStore.projectTypeTraits.hasFlowSupport) {
                let componentIndex = build.assets.getComponentIndex(this);
                const propertyIndex = build.assets.getComponentPropertyIndex(
                    this,
                    "hiddenFlag"
                );

                build.line(
                    `bool new_val = evalBooleanProperty(flowState, ${componentIndex}, ${propertyIndex}, "Failed to evaluate Hidden flag");`
                );
            } else {
                build.line(
                    `bool new_val = ${build.getVariableGetterFunctionName(
                        this.hiddenFlag as string
                    )}();`
                );
            }

            const objectAccessor = build.getLvglObjectAccessor(this);

            build.line(
                `bool cur_val = lv_obj_has_flag(${objectAccessor}, LV_OBJ_FLAG_HIDDEN);`
            );

            build.line(`if (new_val != cur_val) {`);
            build.indent();
            build.line(`tick_value_change_obj = ${objectAccessor};`);
            build.line(
                `if (new_val) lv_obj_add_flag(${objectAccessor}, LV_OBJ_FLAG_HIDDEN);`
            );
            build.line(
                `else lv_obj_clear_flag(${objectAccessor}, LV_OBJ_FLAG_HIDDEN);`
            );
            build.line(`tick_value_change_obj = NULL;`);
            build.unindent();
            build.line(`}`);

            build.unindent();
            build.line(`}`);
        }

        if (this.clickableFlagType == "expression") {
            build.line(`{`);
            build.indent();

            if (build.assets.projectStore.projectTypeTraits.hasFlowSupport) {
                let componentIndex = build.assets.getComponentIndex(this);
                const propertyIndex = build.assets.getComponentPropertyIndex(
                    this,
                    "clickableFlag"
                );

                build.line(
                    `bool new_val = evalBooleanProperty(flowState, ${componentIndex}, ${propertyIndex}, "Failed to evaluate Hidden flag");`
                );
            } else {
                build.line(
                    `bool new_val = ${build.getVariableGetterFunctionName(
                        this.clickableFlag as string
                    )}();`
                );
            }

            const objectAccessor = build.getLvglObjectAccessor(this);

            build.line(
                `bool cur_val = lv_obj_has_flag(${objectAccessor}, LV_OBJ_FLAG_CLICKABLE);`
            );

            build.line(`if (new_val != cur_val) {`);
            build.indent();
            build.line(`tick_value_change_obj = ${objectAccessor};`);
            build.line(
                `if (new_val) lv_obj_add_flag(${objectAccessor}, LV_OBJ_FLAG_CLICKABLE);`
            );
            build.line(
                `else lv_obj_clear_flag(${objectAccessor}, LV_OBJ_FLAG_CLICKABLE);`
            );
            build.line(`tick_value_change_obj = NULL;`);
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

    getLvglCreateRect() {
        const _LV_COORD_TYPE_SHIFT = getLvglCoordTypeShift(this);
        const _LV_COORD_TYPE_SPEC = 1 << _LV_COORD_TYPE_SHIFT;
        function LV_COORD_SET_SPEC(x: number) {
            return x | _LV_COORD_TYPE_SPEC;
        }

        function LV_PCT(x: number) {
            return x < 0 ? LV_COORD_SET_SPEC(1000 - x) : LV_COORD_SET_SPEC(x);
        }

        const LV_SIZE_CONTENT = LV_COORD_SET_SPEC(2001);

        let left;
        if (this.leftUnit == "%") {
            left = LV_PCT(this.left);
        } else {
            left = this.left;
        }

        let top;
        if (this.topUnit == "%") {
            top = LV_PCT(this.top);
        } else {
            top = this.top;
        }

        let width;
        if (this.widthUnit == "content") {
            width = LV_SIZE_CONTENT;
        } else if (this.widthUnit == "%") {
            width = LV_PCT(this.width);
        } else {
            width = this.width;
        }

        let height;
        if (this.heightUnit == "content") {
            height = LV_SIZE_CONTENT;
        } else if (this.heightUnit == "%") {
            height = LV_PCT(this.height);
        } else {
            height = this.height;
        }

        return { left, top, width, height };
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

            if (build.assets.projectStore.projectTypeTraits.hasFlowSupport) {
                let componentIndex = build.assets.getComponentIndex(this);
                const propertyIndex = build.assets.getComponentPropertyIndex(
                    this,
                    "checkedState"
                );

                build.line(`if (tick_value_change_obj != ta) {`);
                build.indent();
                build.line(
                    `assignBooleanProperty(flowState, ${componentIndex}, ${propertyIndex}, value, "Failed to assign Checked state");`
                );
                build.unindent();
                build.line("}");
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

    override render(flowContext: IFlowContext, width: number, height: number) {
        return this._lvglObj ? (
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
        ) : null;
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
    textType: LVGLPropertyType;
    longMode: keyof typeof LONG_MODE_CODES;
    recolor: boolean;

    static classInfo = makeDerivedClassInfo(LVGLWidget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType === ProjectType.LVGL,

        componentPaletteGroupName: "!1Basic",

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
            ...makeLvglExpressionProperty(
                "text",
                "string",
                "input",
                ["literal", "expression"],
                {
                    propertyGridGroup: specificGroup
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
                propertyGridGroup: specificGroup
            },
            {
                name: "recolor",
                type: PropertyType.Boolean,
                propertyGridGroup: specificGroup
            }
        ],

        beforeLoadHook: (
            object: LVGLLabelWidget,
            jsObject: Partial<LVGLLabelWidget>
        ) => {
            if (!jsObject.textType) {
                jsObject.textType = "literal";
            }
        },

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

        check: (widget: LVGLLabelWidget, messages: IMessage[]) => {
            checkProperty(widget, "text", messages);
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
                "SCROLL_ONE",
                "OVERFLOW_VISIBLE"
            ],
            defaultFlags:
                "PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE|SCROLLABLE|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_CHAIN",
            states: ["CHECKED", "DISABLED", "FOCUSED", "PRESSED"]
        }
    });

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            text: observable,
            textType: observable,
            longMode: observable,
            recolor: observable
        });
    }

    override getIsAccessibleFromSourceCode() {
        return this.textType == "expression";
    }

    override lvglCreateObj(
        runtime: LVGLPageRuntime,
        parentObj: number
    ): number {
        const textExpr = getExpressionPropertyData(runtime, this, "text");

        const rect = this.getLvglCreateRect();

        const obj = runtime.wasm._lvglCreateLabel(
            parentObj,
            runtime.getWidgetIndex(this),

            rect.left,
            rect.top,
            rect.width,
            rect.height,

            textExpr
                ? 0
                : runtime.wasm.allocateUTF8(
                      this.textType == "expression"
                          ? getExpressionPropertyInitalValue(
                                runtime,
                                this,
                                "text"
                            )
                          : unescapeText(this.text)
                  ),
            LONG_MODE_CODES[this.longMode],
            this.recolor ? 1 : 0
        );

        if (textExpr) {
            runtime.wasm._lvglUpdateLabelText(
                obj,
                getFlowStateAddressIndex(runtime),
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
            if (lvglHasLabelRecolorSupport(this)) {
                build.line(`lv_label_set_recolor(obj, true);`);
            }
        }

        if (this.textType == "literal") {
            build.line(
                `lv_label_set_text(obj, ${escapeCString(this.text ?? "")});`
            );
        } else {
            build.line(`lv_label_set_text(obj, "");`);
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

        componentPaletteGroupName: "!1Basic",

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
                "SCROLL_ONE",
                "OVERFLOW_VISIBLE"
            ],
            defaultFlags:
                "CLICKABLE|PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE|SCROLLABLE|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_CHAIN",
            states: ["CHECKED", "DISABLED", "FOCUSED", "PRESSED"]
        }
    });

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {});
    }

    override lvglCreateObj(
        runtime: LVGLPageRuntime,
        parentObj: number
    ): number {
        const rect = this.getLvglCreateRect();

        return runtime.wasm._lvglCreateButton(
            parentObj,
            runtime.getWidgetIndex(this),

            rect.left,
            rect.top,
            rect.width,
            rect.height
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

        componentPaletteGroupName: "!1Basic",

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
                "SCROLL_ONE",
                "OVERFLOW_VISIBLE"
            ],
            defaultFlags:
                "CLICKABLE|PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE|SCROLLABLE|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_CHAIN",
            states: ["CHECKED", "DISABLED", "FOCUSED", "PRESSED"]
        }
    });

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {});
    }

    override lvglCreateObj(
        runtime: LVGLPageRuntime,
        parentObj: number
    ): number {
        const rect = this.getLvglCreateRect();

        return runtime.wasm._lvglCreatePanel(
            parentObj,
            runtime.getWidgetIndex(this),

            rect.left,
            rect.top,
            rect.width,
            rect.height
        );
    }

    override lvglBuildObj(build: LVGLBuild) {
        build.line(`lv_obj_t *obj = lv_obj_create(parent_obj);`);
    }
}

////////////////////////////////////////////////////////////////////////////////

const LVGLUserWidgetWidgetPropertyGridUI = observer(
    class LVGLUserWidgetWidgetPropertyGridUI extends React.Component<PropertyProps> {
        showUserWidgetPage = () => {
            (this.props.objects[0] as LVGLUserWidgetWidget).open();
        };

        render() {
            if (this.props.objects.length > 1) {
                return null;
            }
            return (
                <Button
                    color="primary"
                    size="small"
                    onClick={this.showUserWidgetPage}
                >
                    Show User Widget
                </Button>
            );
        }
    }
);

export class LVGLUserWidgetWidget extends LVGLWidget {
    userWidgetPageName: string;

    static classInfo = makeDerivedClassInfo(LVGLWidget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType === ProjectType.LVGL,

        flowComponentId: COMPONENT_TYPE_LVGL_USER_WIDGET,

        componentPaletteGroupName: "!1Basic",

        label: (widget: LVGLUserWidgetWidget) => {
            let name = getComponentName(widget.type);

            if (widget.identifier) {
                name = `${name} [${widget.identifier}]`;
            }

            if (widget.userWidgetPageName) {
                return `${name}: ${widget.userWidgetPageName}`;
            }

            return name;
        },

        properties: [
            {
                name: "userWidgetPageName",
                displayName: "User widget",
                type: PropertyType.ObjectReference,
                propertyGridGroup: specificGroup,
                referencedObjectCollectionPath: "userWidgets"
            },
            {
                name: "customUI",
                type: PropertyType.Any,
                propertyGridGroup: specificGroup,
                computed: true,
                propertyGridRowComponent: LVGLUserWidgetWidgetPropertyGridUI,
                skipSearch: true,
                hideInPropertyGrid: (widget: LVGLUserWidgetWidget) => {
                    if (!widget.userWidgetPageName) {
                        return true;
                    }

                    const project = getProject(widget);

                    const userWidgetPage = findPage(
                        project,
                        widget.userWidgetPageName
                    );
                    if (!userWidgetPage) {
                        return true;
                    }

                    return false;
                }
            }
        ],

        defaultValue: {
            left: 0,
            top: 0,
            width: 100,
            height: 50,
            flags: "PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_CHAIN",
            clickableFlag: true
        },

        icon: USER_WIDGET_ICON,

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
                "SCROLL_ONE",
                "OVERFLOW_VISIBLE"
            ],
            defaultFlags:
                "CLICKABLE|PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE|SCROLLABLE|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_CHAIN",
            states: ["CHECKED", "DISABLED", "FOCUSED", "PRESSED"]
        },

        check: (widget: LVGLUserWidgetWidget, messages: IMessage[]) => {
            if (!widget.userWidgetPageName) {
                messages.push(
                    propertyNotSetMessage(widget, "userWidgetPageName")
                );
            } else {
                let userWidgetPage = findPage(
                    getProject(widget),
                    widget.userWidgetPageName
                );

                if (!userWidgetPage) {
                    messages.push(
                        propertyNotFoundMessage(widget, "userWidgetPageName")
                    );
                } else {
                    if (!userWidgetPage.isUsedAsUserWidget) {
                        messages.push(
                            new Message(
                                MessageType.ERROR,
                                `Page "${userWidgetPage.name}" is not an user widget page`,
                                widget
                            )
                        );
                    }

                    if (widget.isCycleDetected) {
                        messages.push(
                            new Message(
                                MessageType.ERROR,
                                `Cycle detected in user widget page`,
                                getChildOfObject(widget, "userWidgetPageName")
                            )
                        );
                    }
                }
            }
        }
    });

    constructor() {
        super();

        makeObservable(this, {
            userWidgetPage: computed,
            isCycleDetected: computed,
            userWidgetPageCopy: computed
        });
    }

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            userWidgetPageName: observable
        });
    }

    override getIsAccessibleFromSourceCode() {
        return true;
    }

    get userWidgetPage(): Page | undefined {
        if (!this.userWidgetPageName) {
            return undefined;
        }

        return findPage(getProject(this), this.userWidgetPageName);
    }

    get isCycleDetected() {
        const visited = new Set<Page>();

        function testForCycle(page: Page): boolean {
            if (visited.has(page)) {
                return false;
            }

            visited.add(page);

            for (const widget of visitObjects(page)) {
                if (widget instanceof ProjectEditor.LVGLUserWidgetWidgetClass) {
                    if (widget.userWidgetPageName) {
                        const userWidgetPage = findPage(
                            project,
                            widget.userWidgetPageName
                        );
                        if (userWidgetPage) {
                            if (userWidgetPage === origPage) {
                                return true;
                            }
                            if (testForCycle(userWidgetPage)) {
                                return true;
                            }
                        }
                    }
                }
            }

            return false;
        }

        if (!this.userWidgetPageName) {
            return false;
        }

        const project = getProject(this);

        const userWidgetPage = findPage(project, this.userWidgetPageName);
        if (!userWidgetPage) {
            return false;
        }

        const origPage = getAncestorOfType(
            this,
            ProjectEditor.PageClass.classInfo
        ) as Page;

        return testForCycle(userWidgetPage);
    }

    get userWidgetPageCopy(): Page | undefined {
        const page = this.userWidgetPage;

        if (!page) {
            return undefined;
        }

        const project = ProjectEditor.getProject(page);
        const projectStore = project._store;

        let userWidgetPageCopy: Page | undefined = undefined;

        // WORKAROUND: undoManager.commands.length is used to detect if the page was modified
        projectStore.undoManager.commands.length;

        // runInAction is needed to avoid observing copied page
        runInAction(() => {
            userWidgetPageCopy = clipboardDataToObject(
                projectStore,
                objectToClipboardData(projectStore, page)
            ).object as Page;
            setParent(userWidgetPageCopy, project.userWidgets);
        });

        return userWidgetPageCopy;
    }

    open() {
        if (this.userWidgetPage) {
            getProjectStore(this).navigationStore.showObjects(
                [this.userWidgetPage],
                true,
                false,
                false
            );
        }
    }

    getInputs() {
        const page = findPage(getProject(this), this.userWidgetPageName);
        if (!page) {
            return super.getInputs();
        }

        const startComponents: ComponentInput[] = page.components
            .filter(component => component instanceof StartActionComponent)
            .map(() => ({
                name: "@seqin",
                type: "null",
                isSequenceInput: true,
                isOptionalInput: true
            }));

        const inputComponents: ComponentInput[] = page.components
            .filter(component => component instanceof InputActionComponent)
            .sort((a, b) => a.top - b.top)
            .map((inputActionComponent: InputActionComponent) => ({
                name: inputActionComponent.objID,
                displayName: inputActionComponent.name,
                type: inputActionComponent.inputType,
                isSequenceInput: false,
                isOptionalInput: false
            }));

        return [...startComponents, ...inputComponents, ...super.getInputs()];
    }

    getOutputs() {
        const page = findPage(getProject(this), this.userWidgetPageName);
        if (!page) {
            return super.getOutputs();
        }

        const endComponents: ComponentOutput[] = page.components
            .filter(component => component instanceof EndActionComponent)
            .map(() => ({
                name: "@seqout",
                type: "any",
                isSequenceOutput: true,
                isOptionalOutput: true
            }));

        const outputComponents: ComponentOutput[] = page.components
            .filter(component => component instanceof OutputActionComponent)
            .sort((a, b) => a.top - b.top)
            .map((outputActionComponent: OutputActionComponent) => ({
                name: outputActionComponent.objID,
                displayName: outputActionComponent.name,
                type: outputActionComponent.outputType,
                isSequenceOutput: false,
                isOptionalOutput: false
            }));

        return [...endComponents, ...outputComponents, ...super.getOutputs()];
    }

    override lvglCreateObj(
        runtime: LVGLPageRuntime,
        parentObj: number
    ): number {
        const widgetIndex = runtime.getWidgetIndex(this);

        if (!this.userWidgetPageCopy || this.isCycleDetected) {
            const rect = this.getLvglCreateRect();

            return runtime.wasm._lvglCreateUserWidget(
                parentObj,
                widgetIndex,

                rect.left,
                rect.top,
                rect.width,
                rect.height
            );
        }

        const savedUserWidgetContext = runtime.lvglCreateContext;

        if (runtime.wasm.assetsMap) {
            const flow =
                runtime.wasm.assetsMap.flows[savedUserWidgetContext.pageIndex];
            const componentPath = getObjectPathAsString(this);
            const componentIndex = flow.componentIndexes[componentPath];

            runtime.lvglCreateContext = {
                widgetIndex:
                    savedUserWidgetContext.widgetIndex + widgetIndex + 1,
                pageIndex: savedUserWidgetContext.pageIndex,
                flowState: savedUserWidgetContext.flowState
                    ? runtime.wasm._lvglGetFlowState(
                          savedUserWidgetContext.flowState,
                          componentIndex
                      )
                    : 0
            };
        }

        const rect = this.getLvglCreateRect();

        const obj = this.userWidgetPageCopy.lvglCreate(runtime, parentObj, {
            widgetIndex,
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height
        });

        runtime.lvglCreateContext = savedUserWidgetContext;

        return obj;
    }

    override lvglBuildObj(build: LVGLBuild) {
        build.line(`lv_obj_t *obj = lv_obj_create(parent_obj);`);
    }

    override lvglBuildSpecific(build: LVGLBuild) {
        build.line(`lv_style_value_t value;`);
        build.line(`value.num = 0;`);
        build.line(
            `lv_obj_set_local_style_prop(obj, LV_STYLE_PAD_LEFT, value, LV_PART_MAIN);`
        );
        build.line(
            `lv_obj_set_local_style_prop(obj, LV_STYLE_PAD_TOP, value, LV_PART_MAIN);`
        );
        build.line(
            `lv_obj_set_local_style_prop(obj, LV_STYLE_PAD_RIGHT, value, LV_PART_MAIN);`
        );
        build.line(
            `lv_obj_set_local_style_prop(obj, LV_STYLE_PAD_BOTTOM, value, LV_PART_MAIN);`
        );
        build.line(
            `lv_obj_set_local_style_prop(obj, LV_STYLE_BG_OPA, value, LV_PART_MAIN);`
        );
        build.line(
            `lv_obj_set_local_style_prop(obj, LV_STYLE_BORDER_WIDTH, value, LV_PART_MAIN);`
        );

        const userWidgetPage = findPage(
            getProject(this),
            this.userWidgetPageName
        );
        if (userWidgetPage && !this.isCycleDetected) {
            let componentIndex = build.assets.getComponentIndex(this);

            const page = getAncestorOfType(
                this,
                ProjectEditor.PageClass.classInfo
            ) as Page;

            let startWidgetIndex = (
                build.getWidgetObjectIndex(this) + 1
            ).toString();

            if (page.isUsedAsUserWidget) {
                startWidgetIndex = `startWidgetIndex + ${startWidgetIndex}`;
            }

            build.line(
                `${build.getScreenCreateFunctionName(
                    userWidgetPage
                )}(obj, getFlowState(flowState, ${componentIndex}), ${startWidgetIndex});`
            );
        }
    }

    override lvglBuildTickSpecific(build: LVGLBuild) {
        const userWidgetPage = findPage(
            getProject(this),
            this.userWidgetPageName
        );
        if (userWidgetPage && !this.isCycleDetected) {
            let componentIndex = build.assets.getComponentIndex(this);

            const page = getAncestorOfType(
                this,
                ProjectEditor.PageClass.classInfo
            ) as Page;

            let startWidgetIndex = (
                build.getWidgetObjectIndex(this) + 1
            ).toString();

            if (page.isUsedAsUserWidget) {
                startWidgetIndex = `startWidgetIndex + ${startWidgetIndex}`;
            }

            build.line(
                `${build.getScreenTickFunctionName(
                    userWidgetPage
                )}(getFlowState(flowState, ${componentIndex}), ${startWidgetIndex});`
            );
        }
    }

    buildFlowComponentSpecific(assets: Assets, dataBuffer: DataBuffer) {
        const userWidgetPage = this.userWidgetPage;
        if (userWidgetPage) {
            // flowIndex
            const flowIndex = assets.flows.indexOf(userWidgetPage);
            dataBuffer.writeInt16(flowIndex);

            // inputsStartIndex
            if (userWidgetPage.inputComponents.length > 0) {
                dataBuffer.writeUint8(
                    this.buildInputs.findIndex(
                        input =>
                            input.name ==
                            userWidgetPage.inputComponents[0].objID
                    )
                );
            } else {
                dataBuffer.writeUint8(1);
            }

            // outputsStartIndex
            if (userWidgetPage.outputComponents.length > 0) {
                dataBuffer.writeUint8(
                    this.buildOutputs.findIndex(
                        output =>
                            output.name ==
                            userWidgetPage.outputComponents[0].objID
                    )
                );
            } else {
                dataBuffer.writeUint8(0);
            }

            // widgetStartIndex
            const widgetStartIndex =
                ProjectEditor.getProjectStore(
                    this
                ).lvglIdentifiers.getIdentifier(this).index + 1;
            dataBuffer.writeInt32(widgetStartIndex);
        } else {
            // flowIndex
            dataBuffer.writeInt16(-1);
            // inputsStartIndex
            dataBuffer.writeUint8(0);
            // outputsStartIndex
            dataBuffer.writeUint8(0);
            // widgetStartIndex
            dataBuffer.writeInt32(0);
        }
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

        componentPaletteGroupName: "!1Basic",

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

        check: (widget: LVGLImageWidget, messages: IMessage[]) => {
            if (widget.image) {
                const bitmap = findBitmap(
                    ProjectEditor.getProject(widget),
                    widget.image
                );

                if (!bitmap) {
                    messages.push(propertyNotFoundMessage(widget, "image"));
                }
            }
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
                "SCROLL_ONE",
                "OVERFLOW_VISIBLE"
            ],
            defaultFlags:
                "PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE|SCROLLABLE|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_CHAIN",
            states: ["CHECKED", "DISABLED", "FOCUSED", "PRESSED"]
        }
    });

    override makeEditable() {
        super.makeEditable();

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
        const rect = this.getLvglCreateRect();

        const obj = runtime.wasm._lvglCreateImage(
            parentObj,
            runtime.getWidgetIndex(this),

            rect.left,
            rect.top,
            rect.width,
            rect.height,

            0,
            this.pivotX,
            this.pivotY,
            this.zoom,
            this.angle
        );

        const bitmap = findBitmap(ProjectEditor.getProject(this), this.image);

        if (bitmap && bitmap.image) {
            const bitmapPtr = runtime.getBitmapPtr(bitmap);
            if (bitmapPtr) {
                runtime.wasm._lvglSetImageSrc(
                    obj,
                    bitmapPtr,
                    this.pivotX,
                    this.pivotY,
                    this.zoom,
                    this.angle
                );
            }
        }

        return obj;
    }

    override lvglBuildObj(build: LVGLBuild) {
        build.line(`lv_obj_t *obj = lv_img_create(parent_obj);`);
    }

    override lvglBuildSpecific(build: LVGLBuild) {
        if (this.image) {
            const bitmap = findBitmap(
                ProjectEditor.getProject(this),
                this.image
            );

            if (bitmap && bitmap.image) {
                build.line(
                    `lv_img_set_src(obj, &${build.getImageVariableName(
                        bitmap
                    )});`
                );
            }
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

        componentPaletteGroupName: "!1Input",

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
                enumItems: Object.keys(SLIDER_MODES).map(id => ({
                    id,
                    label: id
                })),
                enumDisallowUndefined: true,
                propertyGridGroup: specificGroup
            },
            ...makeLvglExpressionProperty(
                "value",
                "integer",
                "assignable",
                ["literal", "expression"],
                {
                    propertyGridGroup: specificGroup
                }
            ),
            ...makeLvglExpressionProperty(
                "valueLeft",
                "integer",
                "assignable",
                ["literal", "expression"],
                {
                    propertyGridGroup: specificGroup,
                    disabled: (slider: LVGLSliderWidget) =>
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
                "SCROLL_ON_FOCUS",
                "OVERFLOW_VISIBLE"
            ],
            defaultFlags:
                "CLICKABLE|PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE",
            states: ["CHECKED", "DISABLED", "FOCUSED", "PRESSED"]
        }
    });

    override makeEditable() {
        super.makeEditable();

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
        const valueExpr = getExpressionPropertyData(runtime, this, "value");
        const valueLeftExpr =
            this.mode == "RANGE"
                ? getExpressionPropertyData(runtime, this, "valueLeft")
                : undefined;

        const rect = this.getLvglCreateRect();

        const obj = runtime.wasm._lvglCreateSlider(
            parentObj,
            runtime.getWidgetIndex(this),

            rect.left,
            rect.top,
            rect.width,
            rect.height,

            this.min,
            this.max,
            SLIDER_MODES[this.mode],
            valueExpr
                ? !valueLeftExpr
                    ? (this.valueLeft as number)
                    : 0
                : this.valueType == "expression"
                ? 66
                : (this.value as number),
            valueLeftExpr
                ? 0
                : this.valueLeftType == "expression"
                ? 0
                : (this.valueLeft as number)
        );

        if (valueExpr) {
            runtime.wasm._lvglUpdateSliderValue(
                obj,
                getFlowStateAddressIndex(runtime),
                valueExpr.componentIndex,
                valueExpr.propertyIndex
            );
        }

        if (valueLeftExpr) {
            runtime.wasm._lvglUpdateSliderValueLeft(
                obj,
                getFlowStateAddressIndex(runtime),
                valueLeftExpr.componentIndex,
                valueLeftExpr.propertyIndex
            );
        }

        return obj;
    }

    override createEventHandlerSpecific(runtime: LVGLPageRuntime, obj: number) {
        const valueExpr = getExpressionPropertyData(runtime, this, "value");
        if (valueExpr) {
            lvglAddObjectFlowCallback(
                runtime,
                obj,
                LV_EVENT_SLIDER_VALUE_CHANGED,
                valueExpr.componentIndex,
                valueExpr.propertyIndex
            );
        }

        const valueLeftExpr =
            this.mode == "RANGE"
                ? getExpressionPropertyData(runtime, this, "valueLeft")
                : undefined;
        if (valueLeftExpr) {
            lvglAddObjectFlowCallback(
                runtime,
                obj,
                LV_EVENT_SLIDER_VALUE_LEFT_CHANGED,
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

export class LVGLRollerWidget extends LVGLWidget {
    options: string;
    optionsType: LVGLPropertyType;

    selected: number | string;
    selectedType: LVGLPropertyType;

    mode: keyof typeof ROLLER_MODES;

    static classInfo = makeDerivedClassInfo(LVGLWidget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType === ProjectType.LVGL,

        componentPaletteGroupName: "!1Input",

        properties: [
            ...makeLvglExpressionProperty(
                "options",
                "array:string",
                "input",
                ["literal", "expression"],
                {
                    propertyGridGroup: specificGroup
                }
            ),
            ...makeLvglExpressionProperty(
                "selected",
                "integer",
                "assignable",
                ["literal", "expression"],
                {
                    propertyGridGroup: specificGroup
                }
            ),
            {
                name: "mode",
                type: PropertyType.Enum,
                enumItems: Object.keys(ROLLER_MODES).map(id => ({
                    id,
                    label: id
                })),
                enumDisallowUndefined: true,
                propertyGridGroup: specificGroup
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
            selected: 0,
            selectedType: "literal",
            mode: "NORMAL"
        },

        beforeLoadHook: (
            object: LVGLRollerWidget,
            jsObject: Partial<LVGLRollerWidget>
        ) => {
            if (jsObject.optionsType == undefined) {
                jsObject.optionsType = "literal";
            }

            if (jsObject.selected == undefined) {
                jsObject.selected = 0;
                jsObject.selectedType = "literal";
            }
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
                "SNAPPABLE",
                "OVERFLOW_VISIBLE"
            ],
            defaultFlags:
                "CLICKABLE|PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE",
            states: ["CHECKED", "DISABLED", "FOCUSED", "PRESSED"]
        }
    });

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            options: observable,
            optionsType: observable,
            selected: observable,
            selectedType: observable,
            mode: observable
        });
    }

    override getIsAccessibleFromSourceCode() {
        return this.optionsType == "expression";
    }

    override get hasEventHandler() {
        return super.hasEventHandler || this.selectedType == "expression";
    }

    override lvglCreateObj(
        runtime: LVGLPageRuntime,
        parentObj: number
    ): number {
        const optionsExpr = getExpressionPropertyData(runtime, this, "options");

        const selectedExpr = getExpressionPropertyData(
            runtime,
            this,
            "selected"
        );

        const rect = this.getLvglCreateRect();

        const obj = runtime.wasm._lvglCreateRoller(
            parentObj,
            runtime.getWidgetIndex(this),

            rect.left,
            rect.top,
            rect.width,
            rect.height,

            runtime.wasm.allocateUTF8(
                optionsExpr ? "" : unescapeText(this.options)
            ),
            selectedExpr ? 0 : (this.selected as number),
            ROLLER_MODES[this.mode]
        );

        if (optionsExpr) {
            runtime.wasm._lvglUpdateRollerOptions(
                obj,
                getFlowStateAddressIndex(runtime),
                optionsExpr.componentIndex,
                optionsExpr.propertyIndex,
                ROLLER_MODES[this.mode]
            );
        }

        if (selectedExpr) {
            runtime.wasm._lvglUpdateRollerSelected(
                obj,
                getFlowStateAddressIndex(runtime),
                selectedExpr.componentIndex,
                selectedExpr.propertyIndex
            );
        }

        return obj;
    }

    override createEventHandlerSpecific(runtime: LVGLPageRuntime, obj: number) {
        const selectedExpr = getExpressionPropertyData(
            runtime,
            this,
            "selected"
        );
        if (selectedExpr) {
            lvglAddObjectFlowCallback(
                runtime,
                obj,
                LV_EVENT_ROLLER_SELECTED_CHANGED,
                selectedExpr.componentIndex,
                selectedExpr.propertyIndex
            );
        }
    }

    override lvglBuildObj(build: LVGLBuild) {
        build.line(`lv_obj_t *obj = lv_roller_create(parent_obj);`);
    }

    override lvglBuildSpecific(build: LVGLBuild) {
        if (this.optionsType == "literal") {
            build.line(
                `lv_roller_set_options(obj, ${escapeCString(
                    this.options ?? ""
                )}, LV_ROLLER_MODE_${this.mode});`
            );
        } else {
            build.line(
                `lv_roller_set_options(obj, "", LV_ROLLER_MODE_${this.mode});`
            );
        }

        if (this.selectedType == "literal") {
            if (this.selected != 0) {
                build.line(
                    `lv_roller_set_selected(obj, ${this.selected}, LV_ANIM_OFF);`
                );
            }
        }
    }

    override lvglBuildTickSpecific(build: LVGLBuild) {
        expressionPropertyBuildTickSpecific<LVGLRollerWidget>(
            build,
            this,
            "options" as const,
            "lv_roller_get_options",
            "lv_roller_set_options",
            `, LV_ROLLER_MODE_${this.mode}`
        );

        expressionPropertyBuildTickSpecific<LVGLRollerWidget>(
            build,
            this,
            "selected" as const,
            "lv_roller_get_selected",
            "lv_roller_set_selected",
            ", LV_ANIM_OFF"
        );
    }

    override buildEventHandlerSpecific(build: LVGLBuild) {
        expressionPropertyBuildEventHandlerSpecific<LVGLRollerWidget>(
            build,
            this,
            "selected" as const,
            "lv_roller_get_selected"
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

export class LVGLSwitchWidget extends LVGLWidget {
    static classInfo = makeDerivedClassInfo(LVGLWidget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType === ProjectType.LVGL,

        componentPaletteGroupName: "!1Input",

        properties: [],

        defaultValue: {
            left: 0,
            top: 0,
            width: 50,
            height: 25,
            flags: "PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE",
            clickableFlag: true
        },

        icon: SWITCH_WIDGET_ICON,

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
                "SCROLL_ON_FOCUS",
                "OVERFLOW_VISIBLE"
            ],
            defaultFlags:
                "CLICKABLE|PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE",
            states: ["CHECKED", "DISABLED", "FOCUSED", "PRESSED"]
        }
    });

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {});
    }

    override lvglCreateObj(
        runtime: LVGLPageRuntime,
        parentObj: number
    ): number {
        const rect = this.getLvglCreateRect();

        return runtime.wasm._lvglCreateSwitch(
            parentObj,
            runtime.getWidgetIndex(this),

            rect.left,
            rect.top,
            rect.width,
            rect.height
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

        componentPaletteGroupName: "!1Visualiser",

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
                enumItems: Object.keys(BAR_MODES).map(id => ({
                    id,
                    label: id
                })),
                enumDisallowUndefined: true,
                propertyGridGroup: specificGroup
            },
            ...makeLvglExpressionProperty(
                "value",
                "integer",
                "input",
                ["literal", "expression"],
                {
                    propertyGridGroup: specificGroup
                }
            ),
            ...makeLvglExpressionProperty(
                "valueStart",
                "integer",
                "input",
                ["literal", "expression"],
                {
                    propertyGridGroup: specificGroup,
                    disabled: (bar: LVGLBarWidget) => bar.mode != "RANGE"
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
                "SCROLL_ON_FOCUS",
                "OVERFLOW_VISIBLE"
            ],
            defaultFlags: "PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE",
            states: ["CHECKED", "DISABLED", "FOCUSED", "PRESSED"]
        }
    });

    override makeEditable() {
        super.makeEditable();

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
        const valueExpr = getExpressionPropertyData(runtime, this, "value");
        const valueStartExpr =
            this.mode == "RANGE"
                ? getExpressionPropertyData(runtime, this, "valueStart")
                : undefined;

        const rect = this.getLvglCreateRect();

        const obj = runtime.wasm._lvglCreateBar(
            parentObj,
            runtime.getWidgetIndex(this),

            rect.left,
            rect.top,
            rect.width,
            rect.height,

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
                getFlowStateAddressIndex(runtime),
                valueExpr.componentIndex,
                valueExpr.propertyIndex
            );
        }

        if (valueStartExpr) {
            runtime.wasm._lvglUpdateBarValueStart(
                obj,
                getFlowStateAddressIndex(runtime),
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

export class LVGLDropdownWidget extends LVGLWidget {
    options: string;
    optionsType: LVGLPropertyType;

    selected: number | string;
    selectedType: LVGLPropertyType;

    static classInfo = makeDerivedClassInfo(LVGLWidget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType === ProjectType.LVGL,

        componentPaletteGroupName: "!1Input",

        properties: [
            ...makeLvglExpressionProperty(
                "options",
                "array:string",
                "input",
                ["literal", "expression"],
                {
                    propertyGridGroup: specificGroup
                }
            ),
            ...makeLvglExpressionProperty(
                "selected",
                "integer",
                "assignable",
                ["literal", "expression"],
                {
                    propertyGridGroup: specificGroup
                }
            )
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
            selected: 0,
            selectedType: "literal"
        },

        beforeLoadHook: (
            object: LVGLDropdownWidget,
            jsObject: Partial<LVGLDropdownWidget>
        ) => {
            if (jsObject.optionsType == undefined) {
                jsObject.optionsType = "literal";
            }

            if (jsObject.selected == undefined) {
                jsObject.selected = 0;
                jsObject.selectedType = "literal";
            }
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
                "SNAPPABLE",
                "OVERFLOW_VISIBLE"
            ],
            defaultFlags:
                "CLICKABLE|PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE",
            states: ["CHECKED", "DISABLED", "FOCUSED", "PRESSED"]
        }
    });

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            options: observable,
            optionsType: observable,
            selected: observable,
            selectedType: observable
        });
    }

    override getIsAccessibleFromSourceCode() {
        return this.optionsType == "expression";
    }

    override get hasEventHandler() {
        return super.hasEventHandler || this.selectedType == "expression";
    }

    override lvglCreateObj(
        runtime: LVGLPageRuntime,
        parentObj: number
    ): number {
        const optionsExpr = getExpressionPropertyData(runtime, this, "options");

        const selectedExpr = getExpressionPropertyData(
            runtime,
            this,
            "selected"
        );

        const rect = this.getLvglCreateRect();

        const obj = runtime.wasm._lvglCreateDropdown(
            parentObj,
            runtime.getWidgetIndex(this),

            rect.left,
            rect.top,
            rect.width,
            rect.height,

            runtime.wasm.allocateUTF8(
                optionsExpr ? "" : unescapeText(this.options)
            ),
            selectedExpr ? 0 : (this.selected as number)
        );

        if (optionsExpr) {
            runtime.wasm._lvglUpdateDropdownOptions(
                obj,
                getFlowStateAddressIndex(runtime),
                optionsExpr.componentIndex,
                optionsExpr.propertyIndex
            );
        }

        if (selectedExpr) {
            runtime.wasm._lvglUpdateDropdownSelected(
                obj,
                getFlowStateAddressIndex(runtime),
                selectedExpr.componentIndex,
                selectedExpr.propertyIndex
            );
        }

        return obj;
    }

    override createEventHandlerSpecific(runtime: LVGLPageRuntime, obj: number) {
        const selectedExpr = getExpressionPropertyData(
            runtime,
            this,
            "selected"
        );
        if (selectedExpr) {
            lvglAddObjectFlowCallback(
                runtime,
                obj,
                LV_EVENT_DROPDOWN_SELECTED_CHANGED,
                selectedExpr.componentIndex,
                selectedExpr.propertyIndex
            );
        }
    }

    override lvglBuildObj(build: LVGLBuild) {
        build.line(`lv_obj_t *obj = lv_dropdown_create(parent_obj);`);
    }

    override lvglBuildSpecific(build: LVGLBuild) {
        if (this.optionsType == "literal") {
            build.line(
                `lv_dropdown_set_options(obj, ${escapeCString(
                    this.options ?? ""
                )});`
            );
        } else {
            build.line(`lv_dropdown_set_options(obj, "");`);
        }

        if (this.selectedType == "literal") {
            if (this.selected != 0) {
                build.line(`lv_dropdown_set_selected(obj, ${this.selected});`);
            }
        }
    }

    override lvglBuildTickSpecific(build: LVGLBuild) {
        expressionPropertyBuildTickSpecific<LVGLDropdownWidget>(
            build,
            this,
            "options" as const,
            "lv_dropdown_get_options",
            "lv_dropdown_set_options"
        );

        expressionPropertyBuildTickSpecific<LVGLDropdownWidget>(
            build,
            this,
            "selected" as const,
            "lv_dropdown_get_selected",
            "lv_dropdown_set_selected"
        );
    }

    override buildEventHandlerSpecific(build: LVGLBuild) {
        expressionPropertyBuildEventHandlerSpecific<LVGLDropdownWidget>(
            build,
            this,
            "selected" as const,
            "lv_dropdown_get_selected"
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

const ARC_MODES = {
    NORMAL: 0,
    REVERSE: 1,
    SYMMETRICAL: 2
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

        componentPaletteGroupName: "!1Basic",

        properties: [
            {
                name: "rangeMin",
                type: PropertyType.Number,
                propertyGridGroup: specificGroup
            },
            {
                name: "rangeMax",
                type: PropertyType.Number,
                propertyGridGroup: specificGroup
            },
            ...makeLvglExpressionProperty(
                "value",
                "integer",
                "assignable",
                ["literal", "expression"],
                {
                    propertyGridGroup: specificGroup
                }
            ),
            {
                name: "bgStartAngle",
                type: PropertyType.Number,
                propertyGridGroup: specificGroup
            },
            {
                name: "bgEndAngle",
                type: PropertyType.Number,
                propertyGridGroup: specificGroup
            },
            {
                name: "mode",
                type: PropertyType.Enum,
                enumItems: Object.keys(ARC_MODES).map(id => ({
                    id,
                    label: id
                })),
                enumDisallowUndefined: true,
                propertyGridGroup: specificGroup
            },
            {
                name: "rotation",
                type: PropertyType.Number,
                propertyGridGroup: specificGroup
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
                "SCROLL_ONE",
                "OVERFLOW_VISIBLE"
            ],
            defaultFlags:
                "CLICKABLE|PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE",
            states: ["CHECKED", "DISABLED", "FOCUSED", "PRESSED"]
        }
    });

    override makeEditable() {
        super.makeEditable();

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
        const valueExpr = getExpressionPropertyData(runtime, this, "value");

        const rect = this.getLvglCreateRect();

        const obj = runtime.wasm._lvglCreateArc(
            parentObj,
            runtime.getWidgetIndex(this),

            rect.left,
            rect.top,
            rect.width,
            rect.height,

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
                getFlowStateAddressIndex(runtime),
                valueExpr.componentIndex,
                valueExpr.propertyIndex
            );
        }

        return obj;
    }

    override createEventHandlerSpecific(runtime: LVGLPageRuntime, obj: number) {
        const valueExpr = getExpressionPropertyData(runtime, this, "value");
        if (valueExpr) {
            lvglAddObjectFlowCallback(
                runtime,
                obj,
                LV_EVENT_ARC_VALUE_CHANGED,
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

        componentPaletteGroupName: "!1Visualiser",

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
                "SCROLL_CHAIN",
                "OVERFLOW_VISIBLE"
            ],
            defaultFlags: "GESTURE_BUBBLE|SNAPPABLE|SCROLL_CHAIN",
            states: ["CHECKED", "DISABLED", "FOCUSED", "PRESSED"]
        }
    });

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {});
    }

    override lvglCreateObj(
        runtime: LVGLPageRuntime,
        parentObj: number
    ): number {
        const rect = this.getLvglCreateRect();

        return runtime.wasm._lvglCreateSpinner(
            parentObj,
            runtime.getWidgetIndex(this),

            rect.left,
            rect.top,
            rect.width,
            rect.height
        );
    }

    override lvglBuildObj(build: LVGLBuild) {
        const SPIN_TIME = 1000;
        const ARC_LENGTH = 60;
        if (build.project.settings.general.lvglVersion == "9.0") {
            build.line(`lv_obj_t *obj = lv_spinner_create(parent_obj);`);
            build.line(
                `lv_spinner_set_anim_params(obj, ${SPIN_TIME}, ${ARC_LENGTH});`
            );
        } else {
            build.line(
                `lv_obj_t *obj = lv_spinner_create(parent_obj, ${SPIN_TIME}, ${ARC_LENGTH});`
            );
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

export class LVGLCheckboxWidget extends LVGLWidget {
    text: string;

    static classInfo = makeDerivedClassInfo(LVGLWidget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType === ProjectType.LVGL,

        componentPaletteGroupName: "!1Input",

        properties: [
            {
                name: "text",
                type: PropertyType.String,
                propertyGridGroup: specificGroup
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
                "SCROLL_ON_FOCUS",
                "OVERFLOW_VISIBLE"
            ],
            defaultFlags:
                "CLICKABLE|PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE|SCROLL_ON_FOCUS",
            states: ["CHECKED", "DISABLED", "FOCUSED", "PRESSED"]
        }
    });

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, { text: observable });
    }

    override lvglCreateObj(
        runtime: LVGLPageRuntime,
        parentObj: number
    ): number {
        const rect = this.getLvglCreateRect();

        return runtime.wasm._lvglCreateCheckbox(
            parentObj,
            runtime.getWidgetIndex(this),

            rect.left,
            rect.top,
            rect.width,
            rect.height,

            runtime.wasm.allocateUTF8(unescapeText(this.text))
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

        componentPaletteGroupName: "!1Basic",

        properties: [
            ...makeLvglExpressionProperty(
                "text",
                "string",
                "input",
                ["literal", "expression"],
                {
                    propertyGridGroup: specificGroup
                }
            ),
            {
                name: "placeholder",
                type: PropertyType.String,
                propertyGridGroup: specificGroup
            },
            {
                name: "oneLineMode",
                type: PropertyType.Boolean,
                propertyGridGroup: specificGroup
            },
            {
                name: "passwordMode",
                type: PropertyType.Boolean,
                propertyGridGroup: specificGroup
            },
            {
                name: "acceptedCharacters",
                type: PropertyType.String,
                propertyGridGroup: specificGroup
            },
            {
                name: "maxTextLength",
                type: PropertyType.Number,
                propertyGridGroup: specificGroup
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
                "SCROLL_ONE",
                "OVERFLOW_VISIBLE"
            ],
            defaultFlags:
                "CLICKABLE|PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE|SCROLLABLE|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_CHAIN",
            states: ["CHECKED", "DISABLED", "FOCUSED", "PRESSED"]
        }
    });

    override makeEditable() {
        super.makeEditable();

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
        const textExpr = getExpressionPropertyData(runtime, this, "text");

        const rect = this.getLvglCreateRect();

        const obj = runtime.wasm._lvglCreateTextarea(
            parentObj,
            runtime.getWidgetIndex(this),

            rect.left,
            rect.top,
            rect.width,
            rect.height,

            textExpr || !this.text
                ? 0
                : runtime.wasm.allocateUTF8(
                      this.textType == "expression"
                          ? `{${this.text}}`
                          : unescapeText(this.text)
                  ),
            !this.placeholder
                ? 0
                : runtime.wasm.allocateUTF8(unescapeText(this.placeholder)),
            this.oneLineMode,
            this.passwordMode,
            (!runtime.isEditor || this.textType != "expression") &&
                this.acceptedCharacters
                ? runtime.allocateUTF8(this.acceptedCharacters, true)
                : 0,
            this.maxTextLength
        );

        if (textExpr) {
            runtime.wasm._lvglUpdateTextareaText(
                obj,
                getFlowStateAddressIndex(runtime),
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
        const valueExpr = getExpressionPropertyData(runtime, this, "text");
        if (valueExpr) {
            lvglAddObjectFlowCallback(
                runtime,
                obj,
                LV_EVENT_TEXTAREA_TEXT_CHANGED,
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

export class LVGLCalendarWidget extends LVGLWidget {
    todayYear: number;
    todayMonth: number;
    todayDay: number;

    static classInfo = makeDerivedClassInfo(LVGLWidget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType === ProjectType.LVGL,

        componentPaletteGroupName: "!1Input",

        properties: [
            {
                name: "todayYear",
                displayName: "Year",
                type: PropertyType.Number,
                propertyGridGroup: specificGroup
            },
            {
                name: "todayMonth",
                displayName: "Month",
                type: PropertyType.Number,
                propertyGridGroup: specificGroup
            },
            {
                name: "todayDay",
                displayName: "Day",
                type: PropertyType.Number,
                propertyGridGroup: specificGroup
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

        check: (widget: LVGLCalendarWidget, messages: IMessage[]) => {
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
                "SCROLL_ONE",
                "OVERFLOW_VISIBLE"
            ],
            defaultFlags:
                "CLICKABLE|PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE|SCROLLABLE|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_CHAIN",
            states: ["CHECKED", "DISABLED", "FOCUSED", "PRESSED"]
        }
    });

    override makeEditable() {
        super.makeEditable();

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
        const rect = this.getLvglCreateRect();

        const obj = runtime.wasm._lvglCreateCalendar(
            parentObj,
            runtime.getWidgetIndex(this),

            rect.left,
            rect.top,
            rect.width,
            rect.height,

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

export class LVGLColorwheelWidget extends LVGLWidget {
    mode: keyof typeof COLORWHEEL_MODES;
    fixedMode: boolean;

    static classInfo = makeDerivedClassInfo(LVGLWidget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType, projectStore) =>
            projectType === ProjectType.LVGL &&
            (!projectStore ||
                projectStore.project.settings.general.lvglVersion == "8.3"),

        componentPaletteGroupName: "!1Input",

        properties: [
            {
                name: "mode",
                type: PropertyType.Enum,
                enumItems: Object.keys(COLORWHEEL_MODES).map(id => ({
                    id,
                    label: id
                })),
                enumDisallowUndefined: true,
                propertyGridGroup: specificGroup
            },
            {
                name: "fixedMode",
                type: PropertyType.Boolean,
                checkboxStyleSwitch: true,
                propertyGridGroup: specificGroup
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
                "SCROLL_ONE",
                "OVERFLOW_VISIBLE"
            ],
            defaultFlags:
                "CLICKABLE|PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE|SCROLLABLE|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_CHAIN",
            states: ["CHECKED", "DISABLED", "FOCUSED", "PRESSED"]
        },

        check: (widget, messages) =>
            checkWidgetTypeLvglVersion(widget, messages, "8.3")
    });

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            mode: observable,
            fixedMode: observable
        });
    }

    override lvglCreateObj(
        runtime: LVGLPageRuntime,
        parentObj: number
    ): number {
        const rect = this.getLvglCreateRect();

        const obj = runtime.wasm._lvglCreateColorwheel(
            parentObj,
            runtime.getWidgetIndex(this),

            rect.left,
            rect.top,
            rect.width,
            rect.height,

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

export class LVGLImgbuttonWidget extends LVGLWidget {
    imageReleased: string;
    imagePressed: string;
    imageDisabled: string;
    imageCheckedReleased: string;
    imageCheckedPressed: string;
    imageCheckedDisabled: string;

    static classInfo = makeDerivedClassInfo(LVGLWidget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType, projectStore) =>
            projectType === ProjectType.LVGL &&
            (!projectStore ||
                projectStore.project.settings.general.lvglVersion == "8.3"),

        componentPaletteGroupName: "!1Input",

        properties: [
            {
                name: "imageReleased",
                displayName: "Released image",
                type: PropertyType.ObjectReference,
                referencedObjectCollectionPath: "bitmaps",
                propertyGridGroup: specificGroup
            },
            {
                name: "imagePressed",
                displayName: "Pressed image",
                type: PropertyType.ObjectReference,
                referencedObjectCollectionPath: "bitmaps",
                propertyGridGroup: specificGroup
            },
            {
                name: "imageDisabled",
                displayName: "Disabled image",
                type: PropertyType.ObjectReference,
                referencedObjectCollectionPath: "bitmaps",
                propertyGridGroup: specificGroup
            },
            {
                name: "imageCheckedReleased",
                displayName: "Checked released image",
                type: PropertyType.ObjectReference,
                referencedObjectCollectionPath: "bitmaps",
                propertyGridGroup: specificGroup
            },
            {
                name: "imageCheckedPressed",
                displayName: "Checked pressed image",
                type: PropertyType.ObjectReference,
                referencedObjectCollectionPath: "bitmaps",
                propertyGridGroup: specificGroup
            },
            {
                name: "imageCheckedDisabled",
                displayName: "Checked disabled image",
                type: PropertyType.ObjectReference,
                referencedObjectCollectionPath: "bitmaps",
                propertyGridGroup: specificGroup
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

        check: (widget: LVGLImgbuttonWidget, messages: IMessage[]) => {
            checkWidgetTypeLvglVersion(widget, messages, "8.3");

            if (widget.imageReleased) {
                const bitmap = findBitmap(
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
                const bitmap = findBitmap(
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
                const bitmap = findBitmap(
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
                const bitmap = findBitmap(
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
                const bitmap = findBitmap(
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
                const bitmap = findBitmap(
                    ProjectEditor.getProject(widget),
                    widget.imageCheckedDisabled
                );

                if (!bitmap) {
                    messages.push(
                        propertyNotFoundMessage(widget, "imageCheckedDisabled")
                    );
                }
            }
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
                "SCROLL_ONE",
                "OVERFLOW_VISIBLE"
            ],
            defaultFlags:
                "CLICKABLE|PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE|SCROLLABLE|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_CHAIN",
            states: ["CHECKED", "DISABLED", "FOCUSED", "PRESSED"]
        }
    });

    override makeEditable() {
        super.makeEditable();

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
        const rect = this.getLvglCreateRect();

        const obj = runtime.wasm._lvglCreateImgbutton(
            parentObj,
            runtime.getWidgetIndex(this),

            rect.left,
            rect.top,
            rect.width,
            rect.height
        );

        if (this.imageReleased) {
            const bitmap = findBitmap(
                ProjectEditor.getProject(this),
                this.imageReleased
            );

            if (bitmap && bitmap.image) {
                const bitmapPtr = runtime.getBitmapPtr(bitmap);
                if (bitmapPtr) {
                    runtime.wasm._lvglSetImgbuttonImageSrc(
                        obj,
                        ImgbuttonStates.LV_IMGBTN_STATE_RELEASED,
                        bitmapPtr
                    );
                }
            }
        }

        if (this.imagePressed) {
            const bitmap = findBitmap(
                ProjectEditor.getProject(this),
                this.imagePressed
            );

            if (bitmap && bitmap.image) {
                const bitmapPtr = runtime.getBitmapPtr(bitmap);
                if (bitmapPtr) {
                    runtime.wasm._lvglSetImgbuttonImageSrc(
                        obj,
                        ImgbuttonStates.LV_IMGBTN_STATE_PRESSED,
                        bitmapPtr
                    );
                }
            }
        }

        if (this.imageDisabled) {
            const bitmap = findBitmap(
                ProjectEditor.getProject(this),
                this.imageDisabled
            );

            if (bitmap && bitmap.image) {
                const bitmapPtr = runtime.getBitmapPtr(bitmap);
                if (bitmapPtr) {
                    runtime.wasm._lvglSetImgbuttonImageSrc(
                        obj,
                        ImgbuttonStates.LV_IMGBTN_STATE_DISABLED,
                        bitmapPtr
                    );
                }
            }
        }

        if (this.imageCheckedReleased) {
            const bitmap = findBitmap(
                ProjectEditor.getProject(this),
                this.imageCheckedReleased
            );

            if (bitmap && bitmap.image) {
                const bitmapPtr = runtime.getBitmapPtr(bitmap);
                if (bitmapPtr) {
                    runtime.wasm._lvglSetImgbuttonImageSrc(
                        obj,
                        ImgbuttonStates.LV_IMGBTN_STATE_CHECKED_RELEASED,
                        bitmapPtr
                    );
                }
            }
        }

        if (this.imageCheckedPressed) {
            const bitmap = findBitmap(
                ProjectEditor.getProject(this),
                this.imageCheckedPressed
            );

            if (bitmap && bitmap.image) {
                const bitmapPtr = runtime.getBitmapPtr(bitmap);
                if (bitmapPtr) {
                    runtime.wasm._lvglSetImgbuttonImageSrc(
                        obj,
                        ImgbuttonStates.LV_IMGBTN_STATE_CHECKED_PRESSED,
                        bitmapPtr
                    );
                }
            }
        }

        if (this.imageCheckedDisabled) {
            const bitmap = findBitmap(
                ProjectEditor.getProject(this),
                this.imageCheckedDisabled
            );

            if (bitmap && bitmap.image) {
                const bitmapPtr = runtime.getBitmapPtr(bitmap);
                if (bitmapPtr) {
                    runtime.wasm._lvglSetImgbuttonImageSrc(
                        obj,
                        ImgbuttonStates.LV_IMGBTN_STATE_CHECKED_DISABLED,
                        bitmapPtr
                    );
                }
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

export class LVGLKeyboardWidget extends LVGLWidget {
    textarea: string;
    mode: keyof typeof KEYBOARD_MODES;

    static classInfo = makeDerivedClassInfo(LVGLWidget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType === ProjectType.LVGL,

        componentPaletteGroupName: "!1Input",

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
                propertyGridGroup: specificGroup
            },
            {
                name: "mode",
                type: PropertyType.Enum,
                enumItems: Object.keys(KEYBOARD_MODES).map(id => ({
                    id,
                    label: id
                })),
                enumDisallowUndefined: true,
                propertyGridGroup: specificGroup
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

        check: (widget: LVGLKeyboardWidget, messages: IMessage[]) => {
            if (widget.textarea) {
                if (
                    !ProjectEditor.getProjectStore(
                        widget
                    ).lvglIdentifiers.getIdentifierByName(
                        ProjectEditor.getFlow(widget),
                        widget.textarea
                    )
                ) {
                    messages.push(propertyNotFoundMessage(widget, "textarea"));
                }
            }
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
                "SCROLL_ONE",
                "OVERFLOW_VISIBLE"
            ],
            defaultFlags:
                "CLICKABLE|PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE|SCROLLABLE|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_CHAIN",
            states: ["CHECKED", "DISABLED", "FOCUSED", "PRESSED"]
        }
    });

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            textarea: observable,
            mode: observable
        });
    }

    getIsAccessibleFromSourceCode() {
        return true;
    }

    override lvglCreateObj(
        runtime: LVGLPageRuntime,
        parentObj: number
    ): number {
        const rect = this.getLvglCreateRect();

        const obj = runtime.wasm._lvglCreateKeyboard(
            parentObj,
            runtime.getWidgetIndex(this),

            rect.left,
            rect.top,
            rect.width,
            rect.height,

            KEYBOARD_MODES[this.mode]
        );

        return obj;
    }

    override lvglPostCreate(runtime: LVGLPageRuntime) {
        if (this.textarea) {
            const lvglIdentifier = ProjectEditor.getProjectStore(
                this
            ).lvglIdentifiers.getIdentifierByName(
                ProjectEditor.getFlow(this),
                this.textarea
            );

            if (lvglIdentifier) {
                const textareaWidget = lvglIdentifier.object;

                if (
                    runtime instanceof LVGLPageViewerRuntime ||
                    runtime instanceof LVGLNonActivePageViewerRuntime
                ) {
                    setTimeout(() => {
                        if (
                            this._lvglObj &&
                            textareaWidget._lvglObj &&
                            runtime.isMounted
                        ) {
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
            const lvglIdentifier = ProjectEditor.getProjectStore(
                this
            ).lvglIdentifiers.getIdentifierByName(
                ProjectEditor.getFlow(this),
                this.textarea
            );
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

////////////////////////////////////////////////////////////////////////////////

export class LVGLChartWidget extends LVGLWidget {
    static classInfo = makeDerivedClassInfo(LVGLWidget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType === ProjectType.LVGL,

        componentPaletteGroupName: "!1Visualiser",

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
                "SCROLL_ONE",
                "OVERFLOW_VISIBLE"
            ],
            defaultFlags:
                "CLICKABLE|PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE|SCROLLABLE|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_CHAIN",
            states: ["CHECKED", "DISABLED", "FOCUSED", "PRESSED"]
        }
    });

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {});
    }

    override lvglCreateObj(
        runtime: LVGLPageRuntime,
        parentObj: number
    ): number {
        const rect = this.getLvglCreateRect();

        const obj = runtime.wasm._lvglCreateChart(
            parentObj,
            runtime.getWidgetIndex(this),

            rect.left,
            rect.top,
            rect.width,
            rect.height
        );

        return obj;
    }

    override lvglBuildObj(build: LVGLBuild) {
        build.line(`lv_obj_t *obj = lv_chart_create(parent_obj);`);
    }

    override lvglBuildSpecific(build: LVGLBuild) {}
}

////////////////////////////////////////////////////////////////////////////////

const LVGL_METER_INDICATOR_TYPES = {
    NEEDLE_IMG: 0,
    NEEDLE_LINE: 1,
    SCALE_LINES: 2,
    ARC: 3
};

export class LVGLMeterIndicator extends EezObject {
    type: keyof typeof LVGL_METER_INDICATOR_TYPES;

    static classInfo: ClassInfo = {
        getClass: function (
            projectStore: ProjectStore,
            object: LVGLMeterIndicator
        ) {
            if (object.type == "NEEDLE_IMG") return LVGLMeterIndicatorNeedleImg;
            else if (object.type == "NEEDLE_LINE")
                return LVGLMeterIndicatorNeedleLine;
            else if (object.type == "SCALE_LINES")
                return LVGLMeterIndicatorScaleLines;
            return LVGLMeterIndicatorArc;
        },

        properties: [
            {
                name: "type",
                type: PropertyType.Enum,
                enumItems: Object.keys(LVGL_METER_INDICATOR_TYPES).map(id => ({
                    id
                })),
                enumDisallowUndefined: true,
                hideInPropertyGrid: true
            }
        ],

        newItem: async (object: LVGLMeterIndicator[]) => {
            const project = ProjectEditor.getProject(object);

            const result = await showGenericDialog({
                dialogDefinition: {
                    title: "New LVGL Action",
                    fields: [
                        {
                            name: "type",
                            displayName: "Indicator type",
                            type: "enum",
                            enumItems: Object.keys(
                                LVGL_METER_INDICATOR_TYPES
                            ).map(id => ({
                                id,
                                label:
                                    id == "NEEDLE_IMG"
                                        ? "Needle image"
                                        : humanize(id)
                            }))
                        }
                    ]
                },
                values: {
                    action: "CHANGE_SCREEN"
                },
                dialogContext: project
            });

            const indicatorTypeProperties = {
                type: result.values.type
            };

            let indicatorTypeObject;

            if (result.values.type == "NEEDLE_IMG") {
                indicatorTypeObject = createObject<LVGLMeterIndicatorNeedleImg>(
                    project._store,
                    Object.assign(
                        indicatorTypeProperties,
                        LVGLMeterIndicatorNeedleImg.classInfo.defaultValue
                    ),
                    LVGLMeterIndicatorNeedleImg
                );
            } else if (result.values.type == "NEEDLE_LINE") {
                indicatorTypeObject =
                    createObject<LVGLMeterIndicatorNeedleLine>(
                        project._store,
                        Object.assign(
                            indicatorTypeProperties,
                            LVGLMeterIndicatorNeedleLine.classInfo.defaultValue
                        ),
                        LVGLMeterIndicatorNeedleLine
                    );
            } else if (result.values.type == "SCALE_LINES") {
                indicatorTypeObject =
                    createObject<LVGLMeterIndicatorScaleLines>(
                        project._store,
                        Object.assign(
                            indicatorTypeProperties,
                            LVGLMeterIndicatorScaleLines.classInfo.defaultValue
                        ),
                        LVGLMeterIndicatorScaleLines
                    );
            } else {
                indicatorTypeObject = createObject<LVGLMeterIndicatorArc>(
                    project._store,
                    Object.assign(
                        indicatorTypeProperties,
                        LVGLMeterIndicatorArc.classInfo.defaultValue
                    ),
                    LVGLMeterIndicatorArc
                );
            }

            return indicatorTypeObject;
        }
    };

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            type: observable
        });
    }

    getIsAccessibleFromSourceCode() {
        return false;
    }

    lvglCreateObj(
        runtime: LVGLPageRuntime,
        obj: number,
        scale: number,
        scaleIndex: number,
        indicatorIndex: number
    ) {}

    lvglBuild(build: LVGLBuild) {}
    lvglBuildTickSpecific(
        build: LVGLBuild,
        scaleIndex: number,
        indicatorIndex: number
    ) {}

    expressionPropertyBuildTickSpecific(
        build: LVGLBuild,
        propName: string,
        propFullName: string,
        indicatorIndex: number,
        getProp: string,
        setFunc: string
    ) {
        if (getProperty(this, propName + "Type") == "expression") {
            build.line(`{`);
            build.indent();

            const widget = getAncestorOfType<LVGLWidget>(
                this,
                LVGLWidget.classInfo
            )!;

            const objectAccessor = build.getLvglObjectAccessor(widget);

            build.line(`lv_meter_indicator_t *indicator;`);
            build.line("");
            build.line(
                `lv_ll_t *indicators = &((lv_meter_t *)${objectAccessor})->indicator_ll;`
            );
            build.line(`int index = ${indicatorIndex};`);
            build.line(
                `for (indicator = _lv_ll_get_tail(indicators); index > 0 && indicator != NULL; indicator = _lv_ll_get_prev(indicators, indicator), index--);`
            );
            build.line("");
            build.line("if (indicator) {");
            build.indent();
            {
                if (
                    build.assets.projectStore.projectTypeTraits.hasFlowSupport
                ) {
                    let componentIndex = build.assets.getComponentIndex(widget);
                    const propertyIndex =
                        build.assets.getComponentPropertyIndex(
                            widget,
                            propFullName
                        );

                    build.line(
                        `int32_t new_val = evalIntegerProperty(flowState, ${componentIndex}, ${propertyIndex}, "Failed to evaluate ${humanize(
                            propName
                        )} in ${getComponentName(widget.type)} widget");`
                    );
                } else {
                    build.line(
                        `int32_t new_val = ${build.getVariableGetterFunctionName(
                            getProperty(this, propName)
                        )}();`
                    );
                }

                build.line(`int32_t cur_val = indicator->${getProp};`);

                build.line("if (new_val != cur_val) {");
                build.indent();
                build.line(`tick_value_change_obj = ${objectAccessor};`);
                build.line(
                    `${setFunc}(${objectAccessor}, indicator, new_val);`
                );
                build.line(`tick_value_change_obj = NULL;`);
                build.unindent();
                build.line("}");
            }
            build.unindent();
            build.line("}");

            build.unindent();
            build.line(`}`);
        }
    }
}

export class LVGLMeterIndicatorNeedleImg extends LVGLMeterIndicator {
    image: string;
    pivotX: number;
    pivotY: number;
    value: number | string;
    valueType: LVGLPropertyType;

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            image: observable,
            pivotX: observable,
            pivotY: observable,
            value: observable,
            valueType: observable
        });
    }

    static classInfo = makeDerivedClassInfo(LVGLMeterIndicator.classInfo, {
        properties: [
            {
                name: "image",
                type: PropertyType.ObjectReference,
                referencedObjectCollectionPath: "bitmaps",
                propertyGridGroup: specificGroup
            },
            {
                name: "pivotX",
                type: PropertyType.Number
            },
            {
                name: "pivotY",
                type: PropertyType.Number
            },
            ...makeLvglExpressionProperty(
                "value",
                "integer",
                "input",
                ["literal", "expression"],
                {}
            )
        ],

        listLabel: (
            indicator: LVGLMeterIndicatorNeedleImg,
            collapsed: boolean
        ) => {
            return `Needle image at ${
                indicator.valueType == "literal"
                    ? indicator.value
                    : `{${indicator.value}}`
            }`;
        },

        defaultValue: {
            pivotX: 0,
            pivotY: 0,
            value: 30,
            valueType: "literal"
        },

        check: (
            indicator: LVGLMeterIndicatorNeedleImg,
            messages: IMessage[]
        ) => {
            if (indicator.image) {
                const bitmap = findBitmap(
                    ProjectEditor.getProject(indicator),
                    indicator.image
                );

                if (!bitmap) {
                    messages.push(propertyNotFoundMessage(indicator, "image"));
                }
            }

            if (indicator.valueType == "expression") {
                try {
                    const widget = getAncestorOfType<LVGLWidget>(
                        indicator,
                        LVGLWidget.classInfo
                    )!;

                    checkExpression(widget, indicator.value as string);
                } catch (err) {
                    messages.push(
                        new Message(
                            MessageType.ERROR,
                            `Invalid expression: ${err}`,
                            getChildOfObject(indicator, "value")
                        )
                    );
                }
            }
        }
    });

    override getIsAccessibleFromSourceCode() {
        return this.valueType == "expression";
    }

    override lvglCreateObj(
        runtime: LVGLPageRuntime,
        obj: number,
        scale: number,
        scaleIndex: number,
        indicatorIndex: number
    ) {
        const widget = getAncestorOfType<LVGLWidget>(
            this,
            LVGLWidget.classInfo
        )!;

        const valueExpr = getExpressionPropertyData(
            runtime,
            widget,
            `scales[${scaleIndex}].indicators[${indicatorIndex}].value`
        );

        const bitmap = findBitmap(ProjectEditor.getProject(this), this.image);

        const pivotX = this.pivotX;
        const pivotY = this.pivotY;
        const value = this.value;

        if (bitmap && bitmap.image) {
            const bitmapPtr = runtime.getBitmapPtr(bitmap);
            if (bitmapPtr) {
                const indicator = runtime.wasm._lvglMeterAddIndicatorNeedleImg(
                    obj,
                    scale,
                    bitmapPtr,
                    pivotX,
                    pivotY,
                    valueExpr ? 0 : (value as number)
                );

                if (valueExpr) {
                    runtime.wasm._lvglUpdateMeterIndicatorValue(
                        obj,
                        indicator,
                        getFlowStateAddressIndex(runtime),
                        valueExpr.componentIndex,
                        valueExpr.propertyIndex
                    );
                }
            }
        }
    }

    override lvglBuild(build: LVGLBuild) {
        build.line(
            `lv_meter_indicator_t *indicator = lv_meter_add_needle_img(obj, scale, ${
                this.image ? `&img_${this.image}` : 0
            }, ${this.pivotX}, ${this.pivotY});`
        );

        if (this.valueType == "literal") {
            build.line(
                `lv_meter_set_indicator_value(obj, indicator, ${this.value});`
            );
        }
    }

    override lvglBuildTickSpecific(
        build: LVGLBuild,
        scaleIndex: number,
        indicatorIndex: number
    ) {
        this.expressionPropertyBuildTickSpecific(
            build,
            "value",
            `scales[${scaleIndex}].indicators[${indicatorIndex}].value`,
            indicatorIndex,
            "start_value",
            "lv_meter_set_indicator_value"
        );
    }
}

registerClass("LVGLMeterIndicatorNeedleImg", LVGLMeterIndicatorNeedleImg);

export class LVGLMeterIndicatorNeedleLine extends LVGLMeterIndicator {
    width: number;
    color: string;
    radiusModifier: number;
    value: number | string;
    valueType: LVGLPropertyType;

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            width: observable,
            color: observable,
            radiusModifier: observable,
            value: observable,
            valueType: observable
        });
    }

    static classInfo = makeDerivedClassInfo(LVGLMeterIndicator.classInfo, {
        properties: [
            {
                name: "width",
                type: PropertyType.Number
            },
            {
                name: "color",
                type: PropertyType.Color
            },
            {
                name: "radiusModifier",
                type: PropertyType.Number
            },
            ...makeLvglExpressionProperty(
                "value",
                "integer",
                "input",
                ["literal", "expression"],
                {}
            )
        ],

        listLabel: (
            indicator: LVGLMeterIndicatorNeedleLine,
            collapsed: boolean
        ) => {
            return `Needle line at ${
                indicator.valueType == "literal"
                    ? indicator.value
                    : `{${indicator.value}}`
            }`;
        },

        defaultValue: {
            width: 3,
            color: "#0000FF",
            radiusModifier: -28,
            value: 30,
            valueType: "literal"
        },

        check: (
            indicator: LVGLMeterIndicatorNeedleLine,
            messages: IMessage[]
        ) => {
            if (indicator.valueType == "expression") {
                try {
                    const widget = getAncestorOfType<LVGLWidget>(
                        indicator,
                        LVGLWidget.classInfo
                    )!;

                    checkExpression(widget, indicator.value as string);
                } catch (err) {
                    messages.push(
                        new Message(
                            MessageType.ERROR,
                            `Invalid expression: ${err}`,
                            getChildOfObject(indicator, "value")
                        )
                    );
                }
            }
        }
    });

    override getIsAccessibleFromSourceCode() {
        return this.valueType == "expression";
    }

    override lvglCreateObj(
        runtime: LVGLPageRuntime,
        obj: number,
        scale: number,
        scaleIndex: number,
        indicatorIndex: number
    ) {
        const widget = getAncestorOfType<LVGLWidget>(
            this,
            LVGLWidget.classInfo
        )!;

        const valueExpr = getExpressionPropertyData(
            runtime,
            widget,
            `scales[${scaleIndex}].indicators[${indicatorIndex}].value`
        );

        const indicator = runtime.wasm._lvglMeterAddIndicatorNeedleLine(
            obj,
            scale,
            this.width,
            colorRgbToNum(this.color),
            this.radiusModifier,
            valueExpr ? 0 : (this.value as number)
        );

        if (valueExpr) {
            runtime.wasm._lvglUpdateMeterIndicatorValue(
                obj,
                indicator,
                getFlowStateAddressIndex(runtime),
                valueExpr.componentIndex,
                valueExpr.propertyIndex
            );
        }
    }

    override lvglBuild(build: LVGLBuild) {
        build.line(
            `lv_meter_indicator_t *indicator = lv_meter_add_needle_line(obj, scale, ${
                this.width
            }, lv_color_hex(${colorRgbToHexNumStr(this.color)}), ${
                this.radiusModifier
            });`
        );

        if (this.valueType == "literal") {
            build.line(
                `lv_meter_set_indicator_value(obj, indicator, ${this.value});`
            );
        }
    }

    override lvglBuildTickSpecific(
        build: LVGLBuild,
        scaleIndex: number,
        indicatorIndex: number
    ) {
        this.expressionPropertyBuildTickSpecific(
            build,
            "value",
            `scales[${scaleIndex}].indicators[${indicatorIndex}].value`,
            indicatorIndex,
            "start_value",
            "lv_meter_set_indicator_value"
        );
    }
}

registerClass("LVGLMeterIndicatorNeedleLine", LVGLMeterIndicatorNeedleLine);

export class LVGLMeterIndicatorScaleLines extends LVGLMeterIndicator {
    colorStart: string;
    colorEnd: string;
    local: boolean;
    widthModifier: number;

    startValue: number | string;
    startValueType: LVGLPropertyType;

    endValue: number | string;
    endValueType: LVGLPropertyType;

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            colorStart: observable,
            colorEnd: observable,
            local: observable,
            widthModifier: observable,
            startValue: observable,
            startValueType: observable,
            endValue: observable,
            endValueType: observable
        });
    }

    static classInfo = makeDerivedClassInfo(LVGLMeterIndicator.classInfo, {
        properties: [
            {
                name: "colorStart",
                type: PropertyType.Color
            },
            {
                name: "colorEnd",
                type: PropertyType.Color
            },
            {
                name: "local",
                type: PropertyType.Boolean,
                checkboxStyleSwitch: true
            },
            {
                name: "widthModifier",
                type: PropertyType.Number
            },
            ...makeLvglExpressionProperty(
                "startValue",
                "integer",
                "input",
                ["literal", "expression"],
                {}
            ),
            ...makeLvglExpressionProperty(
                "endValue",
                "integer",
                "input",
                ["literal", "expression"],
                {}
            )
        ],

        listLabel: (
            indicator: LVGLMeterIndicatorScaleLines,
            collapsed: boolean
        ) => {
            return `Scale lines from ${
                indicator.startValueType == "literal"
                    ? indicator.startValue
                    : `{${indicator.startValue}}`
            } to ${
                indicator.endValueType == "literal"
                    ? indicator.endValue
                    : `{${indicator.endValue}}`
            } `;
        },

        defaultValue: {
            colorStart: "#000000",
            colorEnd: "#a0a0a0",
            local: false,
            widthModifier: 0,
            startValue: 0,
            startValueType: "literal",
            endValue: 30,
            endValueType: "literal"
        },

        check: (indicator: LVGLMeterIndicatorArc, messages: IMessage[]) => {
            if (indicator.startValueType == "expression") {
                try {
                    const widget = getAncestorOfType<LVGLWidget>(
                        indicator,
                        LVGLWidget.classInfo
                    )!;

                    checkExpression(widget, indicator.startValue as string);
                } catch (err) {
                    messages.push(
                        new Message(
                            MessageType.ERROR,
                            `Invalid expression: ${err}`,
                            getChildOfObject(indicator, "startValue")
                        )
                    );
                }
            }

            if (indicator.endValueType == "expression") {
                try {
                    const widget = getAncestorOfType<LVGLWidget>(
                        indicator,
                        LVGLWidget.classInfo
                    )!;

                    checkExpression(widget, indicator.endValue as string);
                } catch (err) {
                    messages.push(
                        new Message(
                            MessageType.ERROR,
                            `Invalid expression: ${err}`,
                            getChildOfObject(indicator, "endValue")
                        )
                    );
                }
            }
        }
    });

    override getIsAccessibleFromSourceCode() {
        return (
            this.startValueType == "expression" ||
            this.endValueType == "expression"
        );
    }

    override lvglCreateObj(
        runtime: LVGLPageRuntime,
        obj: number,
        scale: number,
        scaleIndex: number,
        indicatorIndex: number
    ) {
        const widget = getAncestorOfType<LVGLWidget>(
            this,
            LVGLWidget.classInfo
        )!;

        const startValueExpr = getExpressionPropertyData(
            runtime,
            widget,
            `scales[${scaleIndex}].indicators[${indicatorIndex}].startValue`
        );

        const endValueExpr = getExpressionPropertyData(
            runtime,
            widget,
            `scales[${scaleIndex}].indicators[${indicatorIndex}].endValue`
        );

        const indicator = runtime.wasm._lvglMeterAddIndicatorScaleLines(
            obj,
            scale,
            colorRgbToNum(this.colorStart),
            colorRgbToNum(this.colorEnd),
            this.local,
            this.widthModifier,
            startValueExpr ? 0 : (this.startValue as number),
            endValueExpr ? 0 : (this.endValue as number)
        );

        if (startValueExpr) {
            runtime.wasm._lvglUpdateMeterIndicatorStartValue(
                obj,
                indicator,
                getFlowStateAddressIndex(runtime),
                startValueExpr.componentIndex,
                startValueExpr.propertyIndex
            );
        }

        if (endValueExpr) {
            runtime.wasm._lvglUpdateMeterIndicatorEndValue(
                obj,
                indicator,
                getFlowStateAddressIndex(runtime),
                endValueExpr.componentIndex,
                endValueExpr.propertyIndex
            );
        }
    }

    override lvglBuild(build: LVGLBuild) {
        build.line(
            `lv_meter_indicator_t *indicator = lv_meter_add_scale_lines(obj, scale, lv_color_hex(${colorRgbToHexNumStr(
                this.colorStart
            )}), lv_color_hex(${colorRgbToHexNumStr(this.colorEnd)}), ${
                this.local
            }, ${this.widthModifier});`
        );

        if (this.startValueType == "literal") {
            build.line(
                `lv_meter_set_indicator_start_value(obj, indicator, ${this.startValue});`
            );
        }

        if (this.endValueType == "literal") {
            build.line(
                `lv_meter_set_indicator_end_value(obj, indicator, ${this.endValue});`
            );
        }
    }

    override lvglBuildTickSpecific(
        build: LVGLBuild,
        scaleIndex: number,
        indicatorIndex: number
    ) {
        this.expressionPropertyBuildTickSpecific(
            build,
            "startValue",
            `scales[${scaleIndex}].indicators[${indicatorIndex}].startValue`,
            indicatorIndex,
            "start_value",
            "lv_meter_set_indicator_start_value"
        );

        this.expressionPropertyBuildTickSpecific(
            build,
            "endValue",
            `scales[${scaleIndex}].indicators[${indicatorIndex}].endValue`,
            indicatorIndex,
            "end_value",
            "lv_meter_set_indicator_end_value"
        );
    }
}

registerClass("LVGLMeterIndicatorScaleLines", LVGLMeterIndicatorScaleLines);

export class LVGLMeterIndicatorArc extends LVGLMeterIndicator {
    width: number;
    color: string;
    radiusModifier: number;

    startValue: number | string;
    startValueType: LVGLPropertyType;

    endValue: number | string;
    endValueType: LVGLPropertyType;

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            width: observable,
            color: observable,
            radiusModifier: observable,
            startValue: observable,
            startValueType: observable,
            endValue: observable,
            endValueType: observable
        });
    }

    static classInfo = makeDerivedClassInfo(LVGLMeterIndicator.classInfo, {
        properties: [
            {
                name: "width",
                type: PropertyType.Number
            },
            {
                name: "color",
                type: PropertyType.Color
            },
            {
                name: "radiusModifier",
                type: PropertyType.Number
            },
            ...makeLvglExpressionProperty(
                "startValue",
                "integer",
                "input",
                ["literal", "expression"],
                {}
            ),
            ...makeLvglExpressionProperty(
                "endValue",
                "integer",
                "input",
                ["literal", "expression"],
                {}
            )
        ],

        listLabel: (indicator: LVGLMeterIndicatorArc, collapsed: boolean) => {
            return `Arc from ${
                indicator.startValueType == "literal"
                    ? indicator.startValue
                    : `{${indicator.startValue}}`
            } to ${
                indicator.endValueType == "literal"
                    ? indicator.endValue
                    : `{${indicator.endValue}}`
            } `;
        },

        defaultValue: {
            width: 2,
            color: "#000000",
            radiusModifier: 0,
            startValue: 0,
            startValueType: "literal",
            endValue: 30,
            endValueType: "literal"
        },

        check: (indicator: LVGLMeterIndicatorArc, messages: IMessage[]) => {
            if (indicator.startValueType == "expression") {
                try {
                    const widget = getAncestorOfType<LVGLWidget>(
                        indicator,
                        LVGLWidget.classInfo
                    )!;

                    checkExpression(widget, indicator.startValue as string);
                } catch (err) {
                    messages.push(
                        new Message(
                            MessageType.ERROR,
                            `Invalid expression: ${err}`,
                            getChildOfObject(indicator, "startValue")
                        )
                    );
                }
            }

            if (indicator.endValueType == "expression") {
                try {
                    const widget = getAncestorOfType<LVGLWidget>(
                        indicator,
                        LVGLWidget.classInfo
                    )!;

                    checkExpression(widget, indicator.endValue as string);
                } catch (err) {
                    messages.push(
                        new Message(
                            MessageType.ERROR,
                            `Invalid expression: ${err}`,
                            getChildOfObject(indicator, "endValue")
                        )
                    );
                }
            }
        }
    });

    override getIsAccessibleFromSourceCode() {
        return (
            this.startValueType == "expression" ||
            this.endValueType == "expression"
        );
    }

    override lvglCreateObj(
        runtime: LVGLPageRuntime,
        obj: number,
        scale: number,
        scaleIndex: number,
        indicatorIndex: number
    ) {
        const widget = getAncestorOfType<LVGLWidget>(
            this,
            LVGLWidget.classInfo
        )!;

        const startValueExpr = getExpressionPropertyData(
            runtime,
            widget,
            `scales[${scaleIndex}].indicators[${indicatorIndex}].startValue`
        );

        const endValueExpr = getExpressionPropertyData(
            runtime,
            widget,
            `scales[${scaleIndex}].indicators[${indicatorIndex}].endValue`
        );

        const indicator = runtime.wasm._lvglMeterAddIndicatorArc(
            obj,
            scale,
            this.width,
            colorRgbToNum(this.color),
            this.radiusModifier,
            startValueExpr ? 0 : (this.startValue as number),
            endValueExpr ? 0 : (this.endValue as number)
        );

        if (startValueExpr) {
            runtime.wasm._lvglUpdateMeterIndicatorStartValue(
                obj,
                indicator,
                getFlowStateAddressIndex(runtime),
                startValueExpr.componentIndex,
                startValueExpr.propertyIndex
            );
        }

        if (endValueExpr) {
            runtime.wasm._lvglUpdateMeterIndicatorEndValue(
                obj,
                indicator,
                getFlowStateAddressIndex(runtime),
                endValueExpr.componentIndex,
                endValueExpr.propertyIndex
            );
        }
    }

    override lvglBuild(build: LVGLBuild) {
        build.line(
            `lv_meter_indicator_t *indicator = lv_meter_add_arc(obj, scale, ${
                this.width
            }, lv_color_hex(${colorRgbToHexNumStr(this.color)}), ${
                this.radiusModifier
            });`
        );

        if (this.startValueType == "literal") {
            build.line(
                `lv_meter_set_indicator_start_value(obj, indicator, ${this.startValue});`
            );
        }

        if (this.endValueType == "literal") {
            build.line(
                `lv_meter_set_indicator_end_value(obj, indicator, ${this.endValue});`
            );
        }
    }

    override lvglBuildTickSpecific(
        build: LVGLBuild,
        scaleIndex: number,
        indicatorIndex: number
    ) {
        this.expressionPropertyBuildTickSpecific(
            build,
            "startValue",
            `scales[${scaleIndex}].indicators[${indicatorIndex}].startValue`,
            indicatorIndex,
            "start_value",
            "lv_meter_set_indicator_start_value"
        );

        this.expressionPropertyBuildTickSpecific(
            build,
            "endValue",
            `scales[${scaleIndex}].indicators[${indicatorIndex}].endValue`,
            indicatorIndex,
            "end_value",
            "lv_meter_set_indicator_end_value"
        );
    }
}

registerClass("LVGLMeterIndicatorArc", LVGLMeterIndicatorArc);

class LVGLMeterScale extends EezObject {
    minorTickCount: number;
    minorTickLineWidth: number;
    minorTickLength: number;
    minorTickColor: string;

    nthMajor: number;
    majorTickWidth: number;
    majorTickLength: number;
    majorTickColor: string;

    label: string;
    labelGap: number;

    scaleMin: number;
    scaleMax: number;
    scaleAngleRange: number;
    scaleRotation: number;

    indicators: LVGLMeterIndicator[];

    static classInfo: ClassInfo = {
        properties: [
            { name: "scaleMin", type: PropertyType.Number },
            { name: "scaleMax", type: PropertyType.Number },
            { name: "scaleAngleRange", type: PropertyType.Number },
            { name: "scaleRotation", type: PropertyType.Number },

            { name: "minorTickCount", type: PropertyType.Number },
            { name: "minorTickLineWidth", type: PropertyType.Number },
            { name: "minorTickLength", type: PropertyType.Number },
            { name: "minorTickColor", type: PropertyType.Color },

            {
                name: "nthMajor",
                displayName: "Major tick distance",
                type: PropertyType.Number
            },
            {
                name: "majorTickWidth",
                displayName: "Major tick line width",
                type: PropertyType.Number
            },
            { name: "majorTickLength", type: PropertyType.Number },
            { name: "majorTickColor", type: PropertyType.Color },

            makeExpressionProperty(
                {
                    name: "label",
                    displayName: "Major tick label",
                    type: PropertyType.MultilineText
                },
                "string"
            ),
            {
                name: "labelGap",
                displayName: "Major Tick label gap",
                type: PropertyType.Number
            },

            {
                name: "indicators",
                type: PropertyType.Array,
                typeClass: LVGLMeterIndicator,
                arrayItemOrientation: "vertical",
                partOfNavigation: false,
                enumerable: false,
                defaultValue: []
            }
        ],

        listLabel: (scale: LVGLMeterScale, collapsed: boolean) => {
            return "Scale";
        },

        defaultValue: {
            minorTickCount: 41,
            minorTickLineWidth: 1,
            minorTickLength: 5,
            minorTickColor: "#a0a0a0",

            nthMajor: 8,
            majorTickWidth: 3,
            majorTickLength: 10,
            majorTickColor: "#000000",

            labelGap: 10,

            scaleMin: 0,
            scaleMax: 100,
            scaleAngleRange: 300,
            scaleRotation: 120,

            indicators: [
                Object.assign(
                    {},
                    { type: "NEEDLE_LINE" },
                    LVGLMeterIndicatorNeedleLine.classInfo.defaultValue
                )
            ]
        },

        check: (scale: LVGLMeterScale, messages: IMessage[]) => {
            if (scale.label) {
                try {
                    const widget = getAncestorOfType<LVGLWidget>(
                        scale,
                        LVGLWidget.classInfo
                    )!;

                    checkExpression(widget, scale.label);
                } catch (err) {
                    messages.push(
                        new Message(
                            MessageType.ERROR,
                            `Invalid expression: ${err}`,
                            getChildOfObject(scale, "label")
                        )
                    );
                }
            }
        }
    };

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            minorTickCount: observable,
            minorTickLineWidth: observable,
            minorTickLength: observable,
            minorTickColor: observable,

            nthMajor: observable,
            majorTickWidth: observable,
            majorTickLength: observable,
            majorTickColor: observable,

            label: observable,
            labelGap: observable,

            scaleMin: observable,
            scaleMax: observable,
            scaleAngleRange: observable,
            scaleRotation: observable
        });
    }

    getIsAccessibleFromSourceCode() {
        return this.indicators.find(indicator =>
            indicator.getIsAccessibleFromSourceCode()
        )
            ? true
            : false;
    }
}

export class LVGLMeterWidget extends LVGLWidget {
    scales: LVGLMeterScale[];

    static classInfo = makeDerivedClassInfo(LVGLWidget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType, projectStore) =>
            projectType === ProjectType.LVGL &&
            (!projectStore ||
                projectStore.project.settings.general.lvglVersion == "8.3"),

        componentPaletteGroupName: "!1Visualiser",

        properties: [
            {
                name: "scales",
                type: PropertyType.Array,
                typeClass: LVGLMeterScale,
                propertyGridGroup: specificGroup,
                arrayItemOrientation: "vertical",
                partOfNavigation: false,
                enumerable: false,
                defaultValue: []
            }
        ],

        defaultValue: {
            left: 0,
            top: 0,
            width: 180,
            height: 180,
            flags: "PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE|SCROLLABLE|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_CHAIN",
            clickableFlag: true,
            scales: [Object.assign({}, LVGLMeterScale.classInfo.defaultValue)]
        },

        icon: (
            <svg viewBox="0 0 32 32" fill="currentColor">
                <path d="M26 16a9.9283 9.9283 0 0 0-1.1392-4.6182l-1.4961 1.4961A7.9483 7.9483 0 0 1 24 16Zm-2.5859-6L22 8.5859l-4.7147 4.7147A2.9659 2.9659 0 0 0 16 13a3 3 0 1 0 3 3 2.9659 2.9659 0 0 0-.3006-1.2853ZM16 17a1 1 0 1 1 1-1 1.0013 1.0013 0 0 1-1 1Zm0-9a7.9515 7.9515 0 0 1 3.1223.6353l1.4961-1.4961A9.9864 9.9864 0 0 0 6 16h2a8.0092 8.0092 0 0 1 8-8Z" />
                <path d="M16 30a14 14 0 1 1 14-14 14.0158 14.0158 0 0 1-14 14Zm0-26a12 12 0 1 0 12 12A12.0137 12.0137 0 0 0 16 4Z" />
                <path
                    data-name="&lt;Transparent Rectangle&gt;"
                    fill="none"
                    d="M0 0h32v32H0z"
                />
            </svg>
        ),

        lvgl: {
            parts: ["MAIN", "TICKS", "INDICATOR", "ITEMS"],
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
                "SCROLL_ONE",
                "OVERFLOW_VISIBLE"
            ],
            defaultFlags:
                "CLICKABLE|PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE|SCROLLABLE|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_CHAIN",
            states: ["CHECKED", "DISABLED", "FOCUSED", "PRESSED"]
        },

        getAdditionalFlowProperties: (widget: LVGLMeterWidget) => {
            const properties: PropertyInfo[] = [];
            for (
                let scaleIndex = 0;
                scaleIndex < widget.scales.length;
                scaleIndex++
            ) {
                const scale = widget.scales[scaleIndex];

                if (scale.label) {
                    properties.push(
                        Object.assign(
                            {},
                            findPropertyByNameInClassInfo(
                                LVGLMeterScale.classInfo,
                                "label"
                            ),
                            {
                                name: `scales[${scaleIndex}].label`
                            }
                        )
                    );
                }

                for (
                    let indicatorIndex = 0;
                    indicatorIndex < scale.indicators.length;
                    indicatorIndex++
                ) {
                    const indicator = scale.indicators[indicatorIndex];
                    const classInfo = getClassInfo(indicator);
                    const flowProperties = classInfo.properties.filter(
                        propertyInfo =>
                            isFlowProperty(indicator, propertyInfo, [
                                "input",
                                "template-literal",
                                "assignable"
                            ])
                    );
                    flowProperties.forEach(flowProperty =>
                        properties.push(
                            Object.assign({}, flowProperty, {
                                name: `scales[${scaleIndex}].indicators[${indicatorIndex}].${flowProperty.name}`
                            })
                        )
                    );
                }
            }
            return properties;
        },

        check: (widget, messages) =>
            checkWidgetTypeLvglVersion(widget, messages, "8.3")
    });

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            scales: observable
        });
    }

    override getIsAccessibleFromSourceCode() {
        if (super.getIsAccessibleFromSourceCode()) {
            return true;
        }

        return this.scales.find(scale => scale.getIsAccessibleFromSourceCode())
            ? true
            : false;
    }

    override lvglCreateObj(
        runtime: LVGLPageRuntime,
        parentObj: number
    ): number {
        const rect = this.getLvglCreateRect();

        const obj = runtime.wasm._lvglCreateMeter(
            parentObj,
            runtime.getWidgetIndex(this),

            rect.left,
            rect.top,
            rect.width,
            rect.height
        );

        for (
            let scaleIndex = 0;
            scaleIndex < this.scales.length;
            scaleIndex++
        ) {
            const scale = this.scales[scaleIndex];

            const scaleObj = runtime.wasm._lvglMeterAddScale(
                obj,

                Math.max(scale.minorTickCount, 2),
                scale.minorTickLineWidth,
                scale.minorTickLength,
                colorRgbToNum(scale.minorTickColor),

                scale.nthMajor,
                scale.majorTickWidth,
                scale.majorTickLength,
                colorRgbToNum(scale.majorTickColor),

                scale.labelGap,

                scale.scaleMin,
                scale.scaleMax,
                scale.scaleAngleRange,
                scale.scaleRotation
            );

            for (
                let indicatorIndex = 0;
                indicatorIndex < scale.indicators.length;
                indicatorIndex++
            ) {
                const indicator = scale.indicators[indicatorIndex];

                indicator.lvglCreateObj(
                    runtime,
                    obj,
                    scaleObj,
                    scaleIndex,
                    indicatorIndex
                );
            }
        }

        return obj;
    }

    override get hasEventHandler() {
        if (super.hasEventHandler) {
            return true;
        }

        for (
            let scaleIndex = 0;
            scaleIndex < this.scales.length;
            scaleIndex++
        ) {
            const scale = this.scales[scaleIndex];
            if (scale.label) {
                return true;
            }
        }

        return false;
    }

    override createEventHandlerSpecific(runtime: LVGLPageRuntime, obj: number) {
        for (
            let scaleIndex = 0;
            scaleIndex < this.scales.length;
            scaleIndex++
        ) {
            const scale = this.scales[scaleIndex];

            if (scale.label) {
                const labelExpr = getExpressionPropertyData(
                    runtime,
                    this,
                    `scales[${scaleIndex}].label`
                );

                if (labelExpr) {
                    lvglAddObjectFlowCallback(
                        runtime,
                        obj,
                        LV_EVENT_METER_TICK_LABEL_EVENT,
                        labelExpr.componentIndex,
                        labelExpr.propertyIndex
                    );
                }
            }
        }
    }

    override lvglBuildObj(build: LVGLBuild) {
        build.line(`lv_obj_t *obj = lv_meter_create(parent_obj);`);
    }

    override lvglBuildSpecific(build: LVGLBuild) {
        for (
            let scaleIndex = 0;
            scaleIndex < this.scales.length;
            scaleIndex++
        ) {
            const scale = this.scales[scaleIndex];

            build.line("{");
            build.indent();

            build.line(`lv_meter_scale_t *scale = lv_meter_add_scale(obj);`);

            build.line(
                `lv_meter_set_scale_ticks(obj, scale, ${Math.max(
                    scale.minorTickCount,
                    2
                )}, ${scale.minorTickLineWidth}, ${
                    scale.minorTickLength
                }, lv_color_hex(${colorRgbToHexNumStr(scale.minorTickColor)}));`
            );

            build.line(
                `lv_meter_set_scale_major_ticks(obj, scale, ${
                    scale.nthMajor
                }, ${scale.majorTickWidth}, ${
                    scale.majorTickLength
                }, lv_color_hex(${colorRgbToHexNumStr(
                    scale.majorTickColor
                )}), ${scale.labelGap});`
            );

            build.line(
                `lv_meter_set_scale_range(obj, scale, ${scale.scaleMin}, ${scale.scaleMax}, ${scale.scaleAngleRange}, ${scale.scaleRotation});`
            );

            for (
                let indicatorIndex = 0;
                indicatorIndex < scale.indicators.length;
                indicatorIndex++
            ) {
                const indicator = scale.indicators[indicatorIndex];

                build.line("{");
                build.indent();

                indicator.lvglBuild(build);

                build.unindent();
                build.line("}");
            }

            build.unindent();
            build.line("}");
        }
    }

    override lvglBuildTickSpecific(build: LVGLBuild) {
        for (
            let scaleIndex = 0;
            scaleIndex < this.scales.length;
            scaleIndex++
        ) {
            const scale = this.scales[scaleIndex];
            for (
                let indicatorIndex = 0;
                indicatorIndex < scale.indicators.length;
                indicatorIndex++
            ) {
                const indicator = scale.indicators[indicatorIndex];
                indicator.lvglBuildTickSpecific(
                    build,
                    scaleIndex,
                    indicatorIndex
                );
            }
        }
    }

    override buildEventHandlerSpecific(build: LVGLBuild) {
        for (
            let scaleIndex = 0;
            scaleIndex < this.scales.length;
            scaleIndex++
        ) {
            const scale = this.scales[scaleIndex];

            if (scale.label) {
                build.line("if (event == LV_EVENT_DRAW_PART_BEGIN) {");
                build.indent();

                build.line(
                    `lv_obj_draw_part_dsc_t *draw_part_dsc = lv_event_get_draw_part_dsc(e);`
                );
                build.line(
                    `if (draw_part_dsc->class_p != &lv_meter_class) return;`
                );
                build.line(
                    `if (draw_part_dsc->type != LV_METER_DRAW_PART_TICK) return;`
                );

                build.line(`const char *temp;`);
                if (
                    build.assets.projectStore.projectTypeTraits.hasFlowSupport
                ) {
                    build.line(
                        `g_eezFlowLvlgMeterTickIndex = draw_part_dsc->id;`
                    );

                    const componentIndex = build.assets.getComponentIndex(this);
                    const propertyIndex =
                        build.assets.getComponentPropertyIndex(
                            this,
                            `scales[${scaleIndex}].label`
                        );

                    build.line(
                        `temp = evalTextProperty(flowState, ${componentIndex}, ${propertyIndex}, "Failed to evalute scale label in Meter widget");`
                    );
                } else {
                    build.line(
                        `temp = ${build.getVariableGetterFunctionName(
                            getProperty(this, `scales[${scaleIndex}].label`)
                        )}();`
                    );
                }
                build.line(`if (temp) {`);
                build.indent();
                build.line(`static char label[32];`);
                build.line(`strncpy(label, temp, sizeof(label));`);
                build.line(`label[sizeof(label) - 1] = 0;`);
                build.line(`draw_part_dsc->text = label;`);
                build.line(`draw_part_dsc->text_length = sizeof(label);`);
                build.unindent();
                build.line("}");

                build.unindent();
                build.line("}");
            }
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

// LV_SCALE_MODE_
const SCALE_MODES = {
    HORIZONTAL_TOP: 0x00,
    HORIZONTAL_BOTTOM: 0x01,
    VERTICAL_LEFT: 0x02,
    VERTICAL_RIGHT: 0x04,
    ROUND_INNER: 0x08,
    ROUND_OUTER: 0x10
};

export class LVGLScaleWidget extends LVGLWidget {
    scaleMode: keyof typeof SCALE_MODES;
    minorRange: number;
    majorRange: number;
    totalTickCount: number;
    majorTickEvery: number;
    showLabels: boolean;

    static classInfo = makeDerivedClassInfo(LVGLWidget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType, projectStore) =>
            projectType === ProjectType.LVGL &&
            (!projectStore ||
                projectStore.project.settings.general.lvglVersion == "9.0"),

        componentPaletteGroupName: "!1Visualiser",

        properties: [
            {
                name: "scaleMode",
                type: PropertyType.Enum,
                enumItems: Object.keys(SCALE_MODES).map(id => ({
                    id,
                    label: id
                })),
                enumDisallowUndefined: true,
                propertyGridGroup: specificGroup
            },
            {
                name: "minorRange",
                type: PropertyType.Number,
                propertyGridGroup: specificGroup
            },
            {
                name: "majorRange",
                type: PropertyType.Number,
                propertyGridGroup: specificGroup
            },
            {
                name: "totalTickCount",
                type: PropertyType.Number,
                propertyGridGroup: specificGroup
            },
            {
                name: "majorTickEvery",
                type: PropertyType.Number,
                propertyGridGroup: specificGroup
            },
            {
                name: "showLabels",
                type: PropertyType.Boolean,
                checkboxStyleSwitch: true,
                propertyGridGroup: specificGroup
            }
        ],

        defaultValue: {
            left: 0,
            top: 0,
            width: 240,
            height: 40,
            flags: "PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE|SCROLLABLE|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_CHAIN",
            clickableFlag: true,
            scaleMode: "HORIZONTAL_BOTTOM",
            localStyles: {
                definition: {
                    ITEMS: {
                        DEFAULT: {
                            length: 5
                        }
                    },
                    INDICATOR: {
                        DEFAULT: {
                            length: 10
                        }
                    }
                }
            },
            minorRange: 10,
            majorRange: 40,
            totalTickCount: 31,
            majorTickEvery: 5,
            showLabels: true
        },

        icon: (
            <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="2 2 20 18"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1"
            >
                <path d="M19.875 8C20.496 8 21 8.512 21 9.143v5.714c0 .631-.504 1.143-1.125 1.143H4a1 1 0 0 1-1-1V9.143C3 8.512 3.504 8 4.125 8h15.75zM9 8v2M6 8v3M12 8v3M18 8v3M15 8v2" />
            </svg>
        ),

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
                "SCROLL_ONE",
                "OVERFLOW_VISIBLE"
            ],
            defaultFlags:
                "CLICKABLE|PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE|SCROLLABLE|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_CHAIN",
            states: ["CHECKED", "DISABLED", "FOCUSED", "PRESSED"]
        },

        check: (widget, messages) =>
            checkWidgetTypeLvglVersion(widget, messages, "9.0")
    });

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            scaleMode: observable,
            minorRange: observable,
            majorRange: observable,
            totalTickCount: observable,
            majorTickEvery: observable,
            showLabels: observable
        });
    }

    override lvglCreateObj(
        runtime: LVGLPageRuntime,
        parentObj: number
    ): number {
        const rect = this.getLvglCreateRect();

        const obj = runtime.wasm._lvglCreateScale(
            parentObj,
            runtime.getWidgetIndex(this),

            rect.left,
            rect.top,
            rect.width,
            rect.height,

            SCALE_MODES[this.scaleMode],

            this.minorRange,
            this.majorRange,
            this.totalTickCount,
            this.majorTickEvery,
            this.showLabels
        );

        return obj;
    }

    override lvglBuildObj(build: LVGLBuild) {
        build.line(`lv_obj_t *obj = lv_scale_create(parent_obj);`);
    }

    override lvglBuildSpecific(build: LVGLBuild) {
        build.line(`lv_scale_set_mode(obj, LV_SCALE_MODE_${this.scaleMode});`);
        build.line(
            `lv_scale_set_range(obj, ${this.minorRange}, ${this.majorRange});`
        );
        build.line(
            `lv_scale_set_total_tick_count(obj, ${this.totalTickCount});`
        );
        build.line(
            `lv_scale_set_major_tick_every(obj, ${this.majorTickEvery});`
        );
        build.line(
            `lv_scale_set_label_show(obj, ${
                this.showLabels ? "true" : "false"
            });`
        );
    }
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
registerClass("LVGLMeterWidget", LVGLMeterWidget);
registerClass("LVGLScaleWidget", LVGLScaleWidget);
registerClass("LVGLPanelWidget", LVGLPanelWidget);
registerClass("LVGLUserWidgetWidget", LVGLUserWidgetWidget);
registerClass("LVGLRollerWidget", LVGLRollerWidget);
registerClass("LVGLSliderWidget", LVGLSliderWidget);
registerClass("LVGLSpinnerWidget", LVGLSpinnerWidget);
registerClass("LVGLSwitchWidget", LVGLSwitchWidget);
registerClass("LVGLTextareaWidget", LVGLTextareaWidget);
