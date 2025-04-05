import { makeObservable, observable } from "mobx";

import { makeDerivedClassInfo, PropertyType } from "project-editor/core/object";

import { ProjectType } from "project-editor/project/project";

import { LVGLWidget } from "./internal";
import type { LVGLCode } from "project-editor/lvgl/to-lvgl-code";
import { QR_CODE_ICON } from "project-editor/ui-components/icons";
import { specificGroup } from "project-editor/ui-components/PropertyGrid/groups";

////////////////////////////////////////////////////////////////////////////////

export class LVGLQRCodeWidget extends LVGLWidget {
    static classInfo = makeDerivedClassInfo(LVGLWidget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType === ProjectType.LVGL,

        componentPaletteGroupName: "!1Basic",

        properties: [
            {
                name: "text",
                type: PropertyType.String,
                propertyGridGroup: specificGroup
            },
            {
                name: "darkColor",
                type: PropertyType.ThemedColor,
                propertyGridGroup: specificGroup
            },
            {
                name: "lightColor",
                type: PropertyType.ThemedColor,
                propertyGridGroup: specificGroup
            }
        ],

        defaultValue: {
            left: 0,
            top: 0,
            width: 160,
            height: 160,
            clickableFlag: true,
            text: "https://envox.eu/",
            darkColor: "#20429F",
            lightColor: "#E2F5FE"
        },

        icon: QR_CODE_ICON,

        lvgl: {
            parts: ["MAIN"],
            defaultFlags:
                "CLICK_FOCUSABLE|SCROLLABLE|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_CHAIN_HOR|SCROLL_CHAIN_VER|SCROLL_CHAIN|SCROLL_WITH_ARROW|SNAPPABLE|PRESS_LOCK|GESTURE_BUBBLE|ADV_HITTEST"
        }
    });

    text: string;
    darkColor: string;
    lightColor: string;

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            text: observable,
            darkColor: observable,
            lightColor: observable
        });
    }

    override toLVGLCode(code: LVGLCode) {
        const size = Math.min(this.width, this.height);
        const text = this.text;

        if (code.isV9) {
            code.createObject("lv_qrcode_create");
            code.callObjectFunction("lv_qrcode_set_size", size);

            code.buildColor(
                this,
                this.darkColor,
                () => code.objectAccessor,
                darkColor => {
                    code.callObjectFunction(
                        "lv_qrcode_set_dark_color",
                        code.color(darkColor)
                    );
                },
                (darkColor, obj) => {
                    if (code.lvglBuild && code.screensLifetimeSupport) {
                        const build = code.lvglBuild;
                        build.line(
                            `if (${obj}) lv_qrcode_set_dark_color(${obj}, ${code.color(
                                darkColor
                            )});`
                        );
                    } else {
                        code.callFreeFunction(
                            "lv_qrcode_set_dark_color",
                            obj,
                            code.color(darkColor)
                        );
                    }
                }
            );

            code.buildColor(
                this,
                this.lightColor,
                () => code.objectAccessor,
                lightColor => {
                    code.callObjectFunction(
                        "lv_qrcode_set_light_color",
                        code.color(lightColor)
                    );
                },
                (lightColor, obj) => {
                    if (code.lvglBuild && code.screensLifetimeSupport) {
                        const build = code.lvglBuild;
                        build.line(
                            `if (${obj}) lv_qrcode_set_light_color(${obj}, ${code.color(
                                lightColor
                            )});`
                        );
                    } else {
                        code.callFreeFunction(
                            "lv_qrcode_set_light_color",
                            obj,
                            code.color(lightColor)
                        );
                    }
                }
            );
        } else {
            code.buildColor2(
                this,
                this.darkColor,
                this.lightColor,
                () => undefined,
                (darkColor, lightColor) => {
                    code.createObject(
                        "lv_qrcode_create",
                        size,
                        code.color(darkColor),
                        code.color(lightColor)
                    );
                },
                () => {
                    // do nothing since QR code widget in version LVGL 8.x doesn't have
                    // lv_qrcode_set_dark_color and lv_qrcode_set_light_color functions
                }
            );
        }

        code.callObjectFunction(
            "lv_qrcode_update",
            code.stringLiteral(text),
            text.length
        );
    }
}
