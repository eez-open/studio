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
import { ImgbuttonStates } from "project-editor/lvgl/lvgl-constants";

import { LVGLWidget } from "./internal";
import { ProjectEditor } from "project-editor/project-editor-interface";
import { propertyNotFoundMessage } from "project-editor/store";

////////////////////////////////////////////////////////////////////////////////

export class LVGLImgbuttonWidget extends LVGLWidget {
    imageReleased: string;
    imagePressed: string;
    imageDisabled: string;
    imageCheckedReleased: string;
    imageCheckedPressed: string;
    imageCheckedDisabled: string;

    static classInfo = makeDerivedClassInfo(LVGLWidget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType, projectStore) =>
            projectType === ProjectType.LVGL,

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
            // checkWidgetTypeLvglVersion(widget, messages, "8.3");

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
            defaultFlags:
                "CLICKABLE|CLICK_FOCUSABLE|GESTURE_BUBBLE|PRESS_LOCK|SCROLLABLE|SCROLL_CHAIN_HOR|SCROLL_CHAIN_VER|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_WITH_ARROW|SNAPPABLE",

            oldInitFlags:
                "PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE|SCROLLABLE|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_CHAIN",
            oldDefaultFlags:
                "CLICKABLE|PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE|SCROLLABLE|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_CHAIN"
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
            runtime.getCreateWidgetIndex(this),

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
        if (build.isV9) {
            build.line(`lv_obj_t *obj = lv_imagebutton_create(parent_obj);`);
        } else {
            build.line(`lv_obj_t *obj = lv_imgbtn_create(parent_obj);`);
        }
    }

    override lvglBuildSpecific(build: LVGLBuild) {
        const prefix = build.isV9
            ? "LV_IMAGEBUTTON_STATE_"
            : "LV_IMGBTN_STATE_";

        const setSrcFuncName = build.isV9
            ? "lv_imagebutton_set_src"
            : "lv_imgbtn_set_src";

        if (this.imageReleased) {
            build.line(
                `${setSrcFuncName}(obj, ${prefix}RELEASED, NULL, &${build.getImageVariableName(
                    this.imageReleased
                )}, NULL);`
            );
        }
        if (this.imagePressed) {
            build.line(
                `${setSrcFuncName}(obj, ${prefix}PRESSED, NULL, &${build.getImageVariableName(
                    this.imagePressed
                )}, NULL);`
            );
        }
        if (this.imageDisabled) {
            build.line(
                `${setSrcFuncName}(obj, ${prefix}DISABLED, NULL, &${build.getImageVariableName(
                    this.imageDisabled
                )}, NULL);`
            );
        }
        if (this.imageCheckedReleased) {
            build.line(
                `${setSrcFuncName}(obj, ${prefix}CHECKED_PRESSED, NULL, &${build.getImageVariableName(
                    this.imageCheckedReleased
                )}, NULL);`
            );
        }
        if (this.imageCheckedPressed) {
            build.line(
                `${setSrcFuncName}(obj, ${prefix}CHECKED_RELEASED, NULL, &${build.getImageVariableName(
                    this.imageCheckedPressed
                )}, NULL);`
            );
        }
        if (this.imageCheckedDisabled) {
            build.line(
                `${setSrcFuncName}(obj, ${prefix}CHECKED_DISABLED, NULL, &${build.getImageVariableName(
                    this.imageCheckedDisabled
                )}, NULL);`
            );
        }
    }
}
