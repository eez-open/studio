import React from "react";
import { makeObservable, observable } from "mobx";

import {
    ClassInfo,
    EezObject,
    IMessage,
    makeDerivedClassInfo,
    PropertyType
} from "project-editor/core/object";

import { IWasmFlowRuntime } from "eez-studio-types";

import { findBitmap, ProjectType } from "project-editor/project/project";

import { LVGLWidget } from "./internal";
import { specificGroup } from "project-editor/ui-components/PropertyGrid/groups";
import { ProjectEditor } from "project-editor/project-editor-interface";
import {
    propertyNotFoundMessage,
    propertyNotSetMessage
} from "project-editor/store";
import type { LVGLCode } from "project-editor/lvgl/to-lvgl-code";

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

    override toLVGLCode(code: LVGLCode) {
        code.createObject("lv_animimg_create");

        const images = this.images
            .map(animationImage => code.image(animationImage.image))
            .filter(image => image);

        if (images.length > 0) {
            let imagesArg;
            if (code.lvglBuild) {
                const build = code.lvglBuild;

                build.blockStart(
                    `static const ${
                        build.isV9 ? "lv_image_dsc_t" : "lv_img_dsc_t"
                    } *images[${images.length}] = {`
                );
                images.forEach(image => {
                    build.line(`${image},`);
                });
                build.blockEnd("};");

                imagesArg = "(const void **)images";
            } else {
                const runtime = code.pageRuntime!;

                const bitmapPtrArray = new Uint32Array(images.length);
                for (let i = 0; i < images.length; i++) {
                    bitmapPtrArray[i] = images[i];
                }

                const bitmapPtrBuffer = runtime.wasm._malloc(
                    bitmapPtrArray.length * bitmapPtrArray.BYTES_PER_ELEMENT
                );

                runtime.wasm.HEAPU32.set(bitmapPtrArray, bitmapPtrBuffer >> 2);

                imagesArg = bitmapPtrBuffer;
            }

            code.callObjectFunction(
                "lv_animimg_set_src",
                imagesArg,
                images.length
            );

            if (code.pageRuntime) {
                const runtime = code.pageRuntime!;

                if (
                    this._bitmapPtrBuffer &&
                    this._bitmapPtrBufferWasm == runtime.wasm
                ) {
                    runtime.wasm._free(this._bitmapPtrBuffer);
                }
                this._bitmapPtrBuffer = imagesArg as number;
                this._bitmapPtrBufferWasm = runtime.wasm;
            }

            code.callObjectFunction("lv_animimg_set_duration", this.duration);

            code.callObjectFunction(
                "lv_animimg_set_repeat_count",
                this.repeatInfinite
                    ? code.constant("LV_ANIM_REPEAT_INFINITE")
                    : this.repeat
            );

            code.callObjectFunction("lv_animimg_start");
        }
    }
}
