import React from "react";
import { makeObservable, observable } from "mobx";

import {
    ClassInfo,
    EezObject,
    IMessage,
    makeDerivedClassInfo,
    PropertyType
} from "project-editor/core/object";

import { findBitmap, ProjectType } from "project-editor/project/project";

import { LVGLPageRuntime } from "project-editor/lvgl/page-runtime";
import type { LVGLBuild } from "project-editor/lvgl/build";

import { LVGLWidget } from "./internal";
import { specificGroup } from "project-editor/ui-components/PropertyGrid/groups";
import { ProjectEditor } from "project-editor/project-editor-interface";
import {
    propertyNotFoundMessage,
    propertyNotSetMessage
} from "project-editor/store";
import { IWasmFlowRuntime } from "eez-studio-types";

////////////////////////////////////////////////////////////////////////////////

class LVGLAnimationImage extends EezObject {
    image: string;

    static classInfo: ClassInfo = {
        properties: [
            {
                name: "image",
                type: PropertyType.ObjectReference,
                referencedObjectCollectionPath: "bitmaps"
            }
        ],

        listLabel: (animationImage: LVGLAnimationImage, collapsed: boolean) =>
            collapsed
                ? animationImage.image
                    ? animationImage.image
                    : "Image not set"
                : "",

        defaultValue: {},

        check: (animationImage: LVGLAnimationImage, messages: IMessage[]) => {
            if (animationImage.image) {
                const bitmap = findBitmap(
                    ProjectEditor.getProject(animationImage),
                    animationImage.image
                );

                if (!bitmap) {
                    messages.push(
                        propertyNotFoundMessage(animationImage, "image")
                    );
                }
            } else {
                messages.push(propertyNotSetMessage(animationImage, "image"));
            }
        }
    };

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            image: observable
        });
    }
}

////////////////////////////////////////////////////////////////////////////////

export class LVGLAnimationImageWidget extends LVGLWidget {
    static classInfo = makeDerivedClassInfo(LVGLWidget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType === ProjectType.LVGL,

        componentPaletteGroupName: "!1Visualiser",

        properties: [
            {
                name: "images",
                type: PropertyType.Array,
                typeClass: LVGLAnimationImage,
                propertyGridGroup: specificGroup,
                partOfNavigation: false,
                enumerable: false,
                defaultValue: []
            },
            {
                name: "duration",
                type: PropertyType.Number,
                propertyGridGroup: specificGroup
            },
            {
                name: "repeatInfinite",
                type: PropertyType.Boolean,
                propertyGridGroup: specificGroup,
                checkboxStyleSwitch: true
            },
            {
                name: "repeat",
                displayName: "Repeat count",
                type: PropertyType.Number,
                propertyGridGroup: specificGroup,
                hideInPropertyGrid: (widget: LVGLAnimationImageWidget) =>
                    widget.repeatInfinite
            }
        ],

        defaultValue: {
            left: 0,
            top: 0,
            width: 180,
            height: 100,
            duration: 1000,
            repeatInfinite: true,
            repeat: 1
        },

        icon: (
            <svg viewBox="0 0 24 24">
                <path
                    d="M22 11H12a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V12a1 1 0 0 0-1-1m-1 10h-8v-8h8ZM2 13a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h10a1 1 0 0 1 0 2H3v9a1 1 0 0 1-1 1m15-7a1 1 0 0 1 0 2H8v9a1 1 0 0 1-2 0V7a1 1 0 0 1 1-1Z"
                    fill="currentcolor"
                />
            </svg>
        ),

        lvgl: {
            parts: ["MAIN"],
            defaultFlags:
                "ADV_HITTEST|CLICK_FOCUSABLE|GESTURE_BUBBLE|PRESS_LOCK|SCROLLABLE|SCROLL_CHAIN_HOR|SCROLL_CHAIN_VER|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_WITH_ARROW|SNAPPABLE"
        }
    });

    images: LVGLAnimationImage[];
    duration: number;
    repeatInfinite: boolean;
    repeat: number;

    _bitmapPtrBuffer: number;
    _bitmapPtrBufferWasm: IWasmFlowRuntime;

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            images: observable,
            duration: observable,
            repeatInfinite: observable,
            repeat: observable
        });
    }

    override lvglCreateObj(
        runtime: LVGLPageRuntime,
        parentObj: number
    ): number {
        const rect = this.getLvglCreateRect();

        let obj;

        let duration = this.duration;
        let repeat = this.repeatInfinite ? 0xffff : this.repeat;

        const bitmapPtrs = this.images
            .map(animationImage => {
                const bitmap = findBitmap(
                    ProjectEditor.getProject(this),
                    animationImage.image
                );
                if (bitmap && bitmap.image) {
                    return runtime.getBitmapPtr(bitmap);
                }
                return 0;
            })
            .filter(bitmapPtr => bitmapPtr != 0);

        if (bitmapPtrs.length > 0) {
            const bitmapPtrArray = new Uint32Array(bitmapPtrs.length);
            for (let i = 0; i < bitmapPtrs.length; i++) {
                bitmapPtrArray[i] = bitmapPtrs[i];
            }

            const bitmapPtrBuffer = runtime.wasm._malloc(
                bitmapPtrArray.length * bitmapPtrArray.BYTES_PER_ELEMENT
            );

            runtime.wasm.HEAPU32.set(bitmapPtrArray, bitmapPtrBuffer >> 2);

            obj = runtime.wasm._lvglCreateAnimationImage(
                parentObj,
                runtime.getWidgetIndex(this),

                rect.left,
                rect.top,
                rect.width,
                rect.height,

                bitmapPtrBuffer,
                bitmapPtrs.length,

                duration,
                repeat
            );

            if (
                this._bitmapPtrBuffer &&
                this._bitmapPtrBufferWasm == runtime.wasm
            ) {
                runtime.wasm._free(this._bitmapPtrBuffer);
            }
            this._bitmapPtrBuffer = bitmapPtrBuffer;
            this._bitmapPtrBufferWasm = runtime.wasm;
        } else {
            obj = runtime.wasm._lvglCreateAnimationImage(
                parentObj,
                runtime.getWidgetIndex(this),

                rect.left,
                rect.top,
                rect.width,
                rect.height,

                0,
                0,

                duration,
                repeat
            );
        }

        return obj;
    }

    override lvglBuildObj(build: LVGLBuild) {
        build.line(`lv_obj_t *obj = lv_animimg_create(parent_obj);`);
    }

    override lvglBuildSpecific(build: LVGLBuild) {
        const imageVariableNames = this.images
            .map(animationImage => {
                const bitmap = findBitmap(
                    ProjectEditor.getProject(this),
                    animationImage.image
                );

                if (bitmap && bitmap.image) {
                    return build.getImageVariableName(bitmap);
                }
                return "";
            })
            .filter(imageVariableName => imageVariableName != "");

        if (imageVariableNames.length > 0) {
            build.line(
                `static const ${
                    build.isV9 ? "lv_image_dsc_t" : "lv_img_dsc_t"
                } *images[${imageVariableNames.length}] = {`
            );
            build.indent();
            imageVariableNames.forEach(imageVariableName => {
                build.line(`&${imageVariableName},`);
            });
            build.unindent();
            build.line(`};`);

            build.line(
                `lv_animimg_set_src(obj, (const void **)images, ${imageVariableNames.length});`
            );
            build.line(`lv_animimg_set_duration(obj, ${this.duration});`);
            build.line(
                `lv_animimg_set_repeat_count(obj, ${
                    this.repeatInfinite
                        ? "LV_ANIM_REPEAT_INFINITE"
                        : this.repeat
                });`
            );
            build.line(`lv_animimg_start(obj);`);
        }
    }
}
