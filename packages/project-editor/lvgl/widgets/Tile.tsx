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

import { LVGLTileViewWidget, LVGLWidget } from "./internal";
import { AutoSize } from "project-editor/flow/component";
import { Message } from "project-editor/store";
import type { LVGLCode } from "project-editor/lvgl/to-lvgl-code";

////////////////////////////////////////////////////////////////////////////////

const TILE_DIRECTIONS = ["ALL", "HOR", "VER", "LEFT", "RIGHT", "TOP", "BOTTOM"];

export class LVGLTileWidget extends LVGLWidget {
    column: number;
    row: number;
    direction: string;

    static classInfo = makeDerivedClassInfo(LVGLWidget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType === ProjectType.LVGL,

        label: (widget: LVGLTileWidget) =>
            `Tile ${widget.column ?? 0},${widget.row ?? 0}`,

        componentPaletteGroupName: "!1Basic",

        properties: [
            {
                name: "column",
                type: PropertyType.Number,
                propertyGridGroup: specificGroup
            },
            {
                name: "row",
                type: PropertyType.Number,
                propertyGridGroup: specificGroup
            },
            {
                name: "direction",
                displayName: "Slide direction",
                type: PropertyType.Enum,
                enumItems: TILE_DIRECTIONS.map(id => ({
                    id,
                    label: id
                })),
                formText:
                    "Directions in which the TileView can be scrolled away from this tile. ALL/HOR/VER are combinations of the single directions (the dir argument of lv_tileview_add_tile is a bitmask).",
                enumDisallowUndefined: true,
                propertyGridGroup: specificGroup
            }
        ],

        defaultValue: {
            left: 0,
            top: 0,
            width: 200,
            height: 200,
            column: 0,
            row: 0,
            direction: "ALL"
        },

        icon: (
            <svg viewBox="0 0 24 24">
                <path
                    d="M4 4h7v7H4V4zm9 0h7v7h-7V4zM4 13h7v7H4v-7zm9 0h7v7h-7v-7z"
                    fill="currentcolor"
                />
            </svg>
        ),

        check: (widget: LVGLTileWidget, messages: IMessage[]) => {
            if (!widget.tileview) {
                messages.push(
                    new Message(
                        MessageType.ERROR,
                        `Invalid position of Tile widget inside Widgets Structure`,
                        widget
                    )
                );
            }
        },

        lvgl: {
            parts: ["MAIN"],
            defaultFlags: "SCROLLABLE|SCROLL_CHAIN_HOR|SCROLL_CHAIN_VER"
        }
    });

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            column: observable,
            row: observable,
            direction: observable
        });
    }

    get parentWidget() {
        return getParent(getParent(this)) as LVGLWidget;
    }

    get tileview() {
        const parent = this.parentWidget;
        if (parent instanceof LVGLTileViewWidget) {
            return parent;
        }
        return undefined;
    }

    override get autoSize(): AutoSize {
        return "both";
    }

    override toLVGLCode(code: LVGLCode) {
        if (this.tileview) {
            code.getObject(
                "lv_tileview_add_tile",
                this.column ?? 0,
                this.row ?? 0,
                code.constant(`LV_DIR_${this.direction ?? "ALL"}`)
            );
        } else {
            code.createObject("lv_obj_create");
        }
    }
}
