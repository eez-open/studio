import React from "react";
import { observable, makeObservable } from "mobx";

import {
    IMessage,
    PropertyType,
    makeDerivedClassInfo
} from "project-editor/core/object";

import { findBitmap, ProjectType } from "project-editor/project/project";

import { specificGroup } from "project-editor/ui-components/PropertyGrid/groups";

import { LVGLPageRuntime } from "project-editor/lvgl/page-runtime";
import type { LVGLBuild } from "project-editor/lvgl/build";

import { LVGLWidget } from "./internal";
import { ProjectEditor } from "project-editor/project-editor-interface";
import { propertyNotFoundMessage } from "project-editor/store";
import { getComponentName } from "project-editor/flow/components/components-registry";
import { LV_IMAGE_ALIGN } from "../lvgl-constants";

////////////////////////////////////////////////////////////////////////////////

export class LVGLImageWidget extends LVGLWidget {
    image: string;
    setPivot: boolean;
    pivotX: number;
    pivotY: number;
    zoom: number;
    angle: number;
    innerAlign: keyof typeof LV_IMAGE_ALIGN;

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
                propertyGridGroup: specificGroup
            },
            {
                name: "angle",
                displayName: "Rotation",
                type: PropertyType.Number,
                propertyGridGroup: specificGroup
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
                    ProjectEditor.getProject(widget).settings.general
                        .lvglVersion != "9.0"
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
            angle: 0
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
            innerAlign: observable
        });
    }

    override lvglCreateObj(
        runtime: LVGLPageRuntime,
        parentObj: number
    ): number {
        const rect = this.getLvglCreateRect();

        const obj = runtime.wasm._lvglCreateImage(
            parentObj,
            runtime.getCreateWidgetIndex(this),

            rect.left,
            rect.top,
            rect.width,
            rect.height,

            0,
            this.setPivot,
            this.pivotX,
            this.pivotY,
            this.zoom,
            this.angle,
            LV_IMAGE_ALIGN[this.innerAlign]
        );

        const bitmap = findBitmap(ProjectEditor.getProject(this), this.image);

        if (bitmap && bitmap.image) {
            const bitmapPtr = runtime.getBitmapPtr(bitmap);
            if (bitmapPtr) {
                runtime.wasm._lvglSetImageSrc(
                    obj,
                    bitmapPtr,
                    this.setPivot,
                    this.pivotX,
                    this.pivotY,
                    this.zoom,
                    this.angle,
                    LV_IMAGE_ALIGN[this.innerAlign]
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

        if (this.setPivot) {
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

        if (build.isV9 && this.innerAlign != "CENTER") {
            build.line(
                `lv_image_set_inner_align(obj, LV_IMAGE_ALIGN_${this.innerAlign});`
            );
        }
    }
}
