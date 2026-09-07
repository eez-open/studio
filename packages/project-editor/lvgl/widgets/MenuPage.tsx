import React from "react";
import { observable, makeObservable } from "mobx";

import {
    IMessage,
    MessageType,
    PropertyType,
    getParent,
    makeDerivedClassInfo
} from "project-editor/core/object";

import { ProjectType } from "project-editor/project/project";

import { specificGroup } from "project-editor/ui-components/PropertyGrid/groups";

import { LVGLMenuWidget, LVGLWidget } from "./internal";
import { AutoSize } from "project-editor/flow/component";
import { Message } from "project-editor/store";
import type { LVGLCode } from "project-editor/lvgl/to-lvgl-code";

////////////////////////////////////////////////////////////////////////////////

export class LVGLMenuPageWidget extends LVGLWidget {
    title: string;

    static classInfo = makeDerivedClassInfo(LVGLWidget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType === ProjectType.LVGL,

        label: (widget: LVGLMenuPageWidget) =>
            widget.title ? `Page ${widget.title}` : "Page",

        componentPaletteGroupName: "!1Basic",

        properties: [
            {
                name: "title",
                type: PropertyType.String,
                propertyGridGroup: specificGroup,
                isOptional: true
            }
        ],

        defaultValue: {
            left: 0,
            top: 0,
            width: 200,
            height: 200,
            title: ""
        },

        icon: (
            <svg viewBox="0 0 24 24">
                <path
                    d="M3 5h18v2H3V5zm0 6h18v2H3v-2zm0 6h12v2H3v-2z"
                    fill="currentcolor"
                />
            </svg>
        ),

        check: (widget: LVGLMenuPageWidget, messages: IMessage[]) => {
            if (!widget.menu) {
                messages.push(
                    new Message(
                        MessageType.ERROR,
                        `Invalid position of Menu page widget inside Widgets Structure`,
                        widget
                    )
                );
            }
        },

        lvgl: {
            parts: ["MAIN"],
            defaultFlags: "SCROLLABLE|SCROLL_CHAIN_VER"
        }
    });

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            title: observable
        });
    }

    get parentWidget() {
        return getParent(getParent(this)) as LVGLWidget;
    }

    get menu() {
        const parent = this.parentWidget;
        if (parent instanceof LVGLMenuWidget) {
            return parent;
        }
        return undefined;
    }

    override get autoSize(): AutoSize {
        return "both";
    }

    override toLVGLCode(code: LVGLCode) {
        if (this.menu) {
            code.getObject(
                "lv_menu_page_create",
                this.title
                    ? code.stringProperty("literal", this.title)
                    : code.constant("NULL")
            );
        } else {
            code.createObject("lv_obj_create");
        }
    }
}

export class LVGLMenuSectionWidget extends LVGLWidget {
    static classInfo = makeDerivedClassInfo(LVGLWidget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType === ProjectType.LVGL,

        label: () => "Section",

        componentPaletteGroupName: "!1Basic",

        properties: [],

        defaultValue: {
            left: 0,
            top: 0,
            width: 200,
            height: 100
        },

        icon: (
            <svg viewBox="0 0 24 24">
                <path
                    d="M4 4h16v4H4V4zm0 6h16v4H4v-4zm0 6h16v4H4v-4z"
                    fill="currentcolor"
                />
            </svg>
        ),

        check: (widget: LVGLMenuSectionWidget, messages: IMessage[]) => {
            if (!widget.menuPage) {
                messages.push(
                    new Message(
                        MessageType.ERROR,
                        `Invalid position of Menu section widget inside Widgets Structure`,
                        widget
                    )
                );
            }
        },

        lvgl: {
            parts: ["MAIN"],
            defaultFlags: "SCROLLABLE|SCROLL_CHAIN_VER"
        }
    });

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {});
    }

    get parentWidget() {
        return getParent(getParent(this)) as LVGLWidget;
    }

    get menuPage() {
        const parent = this.parentWidget;
        if (parent instanceof LVGLMenuPageWidget) {
            return parent;
        }
        return undefined;
    }

    override toLVGLCode(code: LVGLCode) {
        if (this.menuPage) {
            code.getObject("lv_menu_section_create");
        } else {
            code.createObject("lv_obj_create");
        }
    }
}
