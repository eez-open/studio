import React from "react";
import { observable, makeObservable } from "mobx";

import {
    IMessage,
    PropertyType,
    makeDerivedClassInfo
} from "project-editor/core/object";

import { findBitmap, ProjectType } from "project-editor/project/project";

import { specificGroup } from "project-editor/ui-components/PropertyGrid/groups";

import { LVGLWidget } from "./internal";
import { ProjectEditor } from "project-editor/project-editor-interface";
import { propertyNotFoundMessage } from "project-editor/store";
import type { LVGLCode } from "project-editor/lvgl/to-lvgl-code";

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

    override toLVGLCode(code: LVGLCode) {
        code.createObject(
            code.isV9 ? "lv_imagebutton_create" : "lv_imgbtn_create"
        );

        const prefix = code.isV9 ? "LV_IMAGEBUTTON_STATE_" : "LV_IMGBTN_STATE_";

        const setSrcFuncName = code.isV9
            ? "lv_imagebutton_set_src"
            : "lv_imgbtn_set_src";

        if (this.imageReleased) {
            code.callObjectFunction(
                setSrcFuncName,
                code.constant(prefix + "RELEASED"),
                code.constant("NULL"),
                code.image(this.imageReleased),
                code.constant("NULL")
            );
        }
        if (this.imagePressed) {
            code.callObjectFunction(
                setSrcFuncName,
                code.constant(prefix + "PRESSED"),
                code.constant("NULL"),
                code.image(this.imagePressed),
                code.constant("NULL")
            );
        }
        if (this.imageDisabled) {
            code.callObjectFunction(
                setSrcFuncName,
                code.constant(prefix + "DISABLED"),
                code.constant("NULL"),
                code.image(this.imageDisabled),
                code.constant("NULL")
            );
        }
        if (this.imageCheckedReleased) {
            code.callObjectFunction(
                setSrcFuncName,
                code.constant(prefix + "CHECKED_PRESSED"),
                code.constant("NULL"),
                code.image(this.imageCheckedReleased),
                code.constant("NULL")
            );
        }
        if (this.imageCheckedPressed) {
            code.callObjectFunction(
                setSrcFuncName,
                code.constant(prefix + "CHECKED_RELEASED"),
                code.constant("NULL"),
                code.image(this.imageCheckedPressed),
                code.constant("NULL")
            );
        }
        if (this.imageCheckedDisabled) {
            code.callObjectFunction(
                setSrcFuncName,
                code.constant(prefix + "CHECKED_DISABLED"),
                code.constant("NULL"),
                code.image(this.imageCheckedDisabled),
                code.constant("NULL")
            );
        }
    }
}
