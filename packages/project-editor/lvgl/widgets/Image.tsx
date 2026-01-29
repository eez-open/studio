import React from "react";
import { observable, makeObservable } from "mobx";

import {
    IMessage,
    MessageType,
    PropertyType,
    getParent,
    makeDerivedClassInfo
} from "project-editor/core/object";

import { findBitmap, ProjectType } from "project-editor/project/project";

import { specificGroup } from "project-editor/ui-components/PropertyGrid/groups";

import { LVGLWidget, LVGLScaleWidget } from "./internal";
import {
    LVGLPropertyType,
    makeLvglExpressionProperty
} from "../expression-property";
import { checkWidgetTypeLvglVersion } from "../widget-common";
import { ProjectEditor } from "project-editor/project-editor-interface";
import {
    getChildOfObject,
    Message,
    propertyNotFoundMessage
} from "project-editor/store";
import { getComponentName } from "project-editor/flow/components/components-registry";
import { LV_IMAGE_ALIGN } from "../lvgl-constants";
import type { LVGLCode } from "project-editor/lvgl/to-lvgl-code";

////////////////////////////////////////////////////////////////////////////////

export class LVGLImageWidget extends LVGLWidget {
    image: string;
    setPivot: boolean;
    pivotX: number;
    pivotY: number;
    zoom: number;
    angle: number;
    innerAlign: keyof typeof LV_IMAGE_ALIGN;
    value: number | string;
    valueType: LVGLPropertyType;
    previewValue: string;

    static classInfo = makeDerivedClassInfo(LVGLWidget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType === ProjectType.LVGL,

        componentPaletteGroupName: "!1Basic",

        label: (widget: LVGLImageWidget) => {
            let name = getComponentName(widget.type);

            if (widget.identifier) {
                return `${name} [${widget.identifier}]`;
            }

            if (widget.image) {
                return `${name}: ${widget.image}`;
            }

            return name;
        },

        properties: [
            {
                name: "image",
                type: PropertyType.ObjectReference,
                referencedObjectCollectionPath: "bitmaps",
                propertyGridGroup: specificGroup
            },
            {
                name: "setPivot",
                displayName: "Change pivot point (default is center)",
                type: PropertyType.Boolean,
                propertyGridGroup: specificGroup
            },
            {
                name: "pivotX",
                displayName: "Pivot X",
                type: PropertyType.Number,
                propertyGridGroup: specificGroup,
                disabled: (widget: LVGLImageWidget) => !widget.setPivot
            },
            {
                name: "pivotY",
                displayName: "Pivot Y",
                type: PropertyType.Number,
                propertyGridGroup: specificGroup,
                disabled: (widget: LVGLImageWidget) => !widget.setPivot
            },
            {
                name: "zoom",
                displayName: "Scale",
                type: PropertyType.Number,
                propertyGridGroup: specificGroup,
                hideInPropertyGrid: (widget: LVGLImageWidget) =>
                    widget.isScaleNeedle
            },
            {
                name: "angle",
                displayName: "Rotation",
                type: PropertyType.Number,
                propertyGridGroup: specificGroup,
                hideInPropertyGrid: (widget: LVGLImageWidget) =>
                    widget.isScaleNeedle
            },
            {
                name: "innerAlign",
                type: PropertyType.Enum,
                enumItems: Object.keys(LV_IMAGE_ALIGN).map(id => ({
                    id,
                    label: id
                })),
                enumDisallowUndefined: true,
                propertyGridGroup: specificGroup,
                hideInPropertyGrid: (widget: LVGLImageWidget) =>
                    widget.isScaleNeedle ||
                    ProjectEditor.getProject(widget).settings.general
                        .lvglVersion.startsWith("8.")
            },
            ...makeLvglExpressionProperty(
                "value",
                "integer",
                "input",
                ["literal", "expression"],
                {
                    propertyGridGroup: specificGroup,
                    hideInPropertyGrid: (widget: LVGLImageWidget) =>
                        !widget.isScaleNeedle
                }
            ),
            {
                name: "previewValue",
                type: PropertyType.String,
                disabled: (widget: LVGLImageWidget) => {
                    return widget.valueType == "literal";
                },
                propertyGridGroup: specificGroup,
                hideInPropertyGrid: (widget: LVGLImageWidget) =>
                    !widget.isScaleNeedle
            }
        ],

        defaultValue: {
            left: 0,
            top: 0,
            width: 100,
            height: 100,
            widthUnit: "content",
            heightUnit: "content",
            setPivot: false,
            pivotX: 0,
            pivotY: 0,
            zoom: 256,
            angle: 0,
            value: 0,
            valueType: "literal",
            previewValue: 0
        },

        beforeLoadHook: (
            object: LVGLImageWidget,
            jsObject: Partial<LVGLImageWidget>
        ) => {
            if (jsObject.innerAlign == undefined) {
                jsObject.innerAlign = "CENTER";
            }

            if (jsObject.setPivot == undefined) {
                jsObject.setPivot = true;
            }
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

            if (widget.isScaleNeedle) {
                checkWidgetTypeLvglVersion(widget, messages, "9.");

                if (widget.valueType == "literal") {
                    if (
                        widget.value == undefined ||
                        widget.value == null ||
                        !Number.isInteger(Number(widget.value))
                    ) {
                        messages.push(
                            new Message(
                                MessageType.ERROR,
                                `Value must be an integer`,
                                getChildOfObject(widget, "value")
                            )
                        );
                    }
                }
            }
        },

        lvgl: {
            parts: ["MAIN"],
            defaultFlags:
                "ADV_HITTEST|CLICK_FOCUSABLE|GESTURE_BUBBLE|PRESS_LOCK|SCROLLABLE|SCROLL_CHAIN_HOR|SCROLL_CHAIN_VER|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_WITH_ARROW|SNAPPABLE",

            oldInitFlags:
                "PRESS_LOCK|ADV_HITTEST|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_CHAIN",
            oldDefaultFlags:
                "PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE|SCROLLABLE|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_CHAIN"
        }
    });

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            image: observable,
            setPivot: observable,
            pivotX: observable,
            pivotY: observable,
            zoom: observable,
            angle: observable,
            innerAlign: observable,
            value: observable,
            valueType: observable,
            previewValue: observable
        });
    }

    get isScaleNeedle(): boolean {
        const parentChildren = getParent(this);
        const parentWidget = getParent(parentChildren as any);
        return parentWidget instanceof LVGLScaleWidget;
    }

    override toLVGLCode(code: LVGLCode) {
        if (this.isScaleNeedle && !code.isV9) {
            // Scale widget doesn't exist in LVGL version 8.x
            code.createObject("lv_obj_create");
            return;
        }

        if (this.isScaleNeedle) {
            code.createObjectWithoutPosAndSize(
                code.isV9 ? "lv_image_create" : "lv_img_create"
            );
        } else {
            code.createObject(
                code.isV9 ? "lv_image_create" : "lv_img_create"
            );
        }

        const image = code.image(this.image);
        if (image) {
            code.callObjectFunction(
                code.isV9 ? "lv_image_set_src" : "lv_img_set_src",
                image
            );
        }

        if (this.setPivot) {
            code.callObjectFunction(
                code.isV9 ? "lv_image_set_pivot" : "lv_img_set_pivot",
                this.pivotX,
                this.pivotY
            );
        }

        if (this.isScaleNeedle) {
            // scale needle mode
            if (this.valueType == "literal") {
                code.postWidgetExecute(() => {
                    if (code.lvglBuild) {
                        code.callFreeFunction(
                            "lv_scale_set_image_needle_value",
                            "parent_obj",
                            "obj",
                            this.value
                        );
                    } else {
                        const parentObj = code.callFreeFunction(
                            "lv_obj_get_parent",
                            code.objectAccessor
                        );
                        code.callFreeFunction(
                            "lv_scale_set_image_needle_value",
                            parentObj,
                            code.objectAccessor,
                            this.value
                        );
                    }
                });
            }

            if (this.valueType == "expression") {
                if (code.pageRuntime && code.pageRuntime.isEditor) {
                    const previewValue = Number.parseInt(this.previewValue);

                    if (!isNaN(previewValue)) {
                        code.postWidgetExecute(() => {
                            const parentObj = code.callFreeFunction(
                                "lv_obj_get_parent",
                                code.objectAccessor
                            );
                            code.callFreeFunction(
                                "lv_scale_set_image_needle_value",
                                parentObj,
                                code.objectAccessor,
                                previewValue
                            );
                        });
                    }
                }

                code.addToTick("value", () => {
                    const new_val = code.evalIntegerProperty(
                        "int32_t",
                        "new_val",
                        this.value as string,
                        "Failed to evaluate Value in Image widget"
                    );

                    if (code.lvglBuild) {
                        code.callFreeFunction(
                            "lv_scale_set_image_needle_value",
                            `lv_obj_get_parent(${code.objectAccessor})`,
                            code.objectAccessor,
                            new_val
                        );
                    } else {
                        const parentObj = code.callFreeFunction(
                            "lv_obj_get_parent",
                            code.objectAccessor
                        );
                        code.callFreeFunction(
                            "lv_scale_set_image_needle_value",
                            parentObj,
                            code.objectAccessor,
                            new_val
                        );
                    }
                });
            }
        } else {
            if (this.zoom != 256) {
                code.callObjectFunction(
                    code.isV9 ? "lv_image_set_scale" : "lv_img_set_zoom",
                    this.zoom
                );
            }

            if (this.angle != 0) {
                code.callObjectFunction(
                    code.isV9
                        ? "lv_image_set_rotation"
                        : "lv_img_set_angle",
                    this.angle
                );
            }

            if (code.isV9 && this.innerAlign != "CENTER") {
                code.callObjectFunction(
                    "lv_image_set_inner_align",
                    code.constant(`LV_IMAGE_ALIGN_${this.innerAlign}`)
                );
            }
        }
    }
}
