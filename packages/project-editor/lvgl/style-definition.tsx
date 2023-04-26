import { makeObservable, observable, runInAction } from "mobx";

import {
    ClassInfo,
    EezObject,
    IMessage,
    MessageType,
    PropertyType,
    registerClass
} from "project-editor/core/object";

import { humanize } from "eez-studio-shared/string";

import { ProjectEditor } from "project-editor/project-editor-interface";
import { Message } from "project-editor/store";
import { findBitmap, findFont } from "project-editor/project/project";

import type { Page } from "project-editor/features/page/page";

import type { LVGLWidget } from "project-editor/lvgl/widgets";
import { LVGLPageRuntime } from "project-editor/lvgl/page-runtime";
import type { LVGLBuild } from "project-editor/lvgl/build";
import {
    BUILT_IN_FONTS,
    lvglPropertiesMap,
    LVGLPropertyInfo,
    LVGLStylePropCode,
    text_font_property_info
} from "project-editor/lvgl/style-catalog";
import {
    colorRgbToHexNumStr,
    colorRgbToNum,
    getSelectorBuildCode,
    getSelectorCode
} from "project-editor/lvgl/style-helper";

////////////////////////////////////////////////////////////////////////////////

export class LVGLStylesDefinition extends EezObject {
    definition: {
        [part: string]: {
            [state: string]: {
                [prop: string]: any;
            };
        };
    };

    static classInfo: ClassInfo = {
        properties: [
            {
                name: "definition",
                type: PropertyType.Any
            },
            {
                name: "partEnabled",
                type: PropertyType.Any
            }
        ],
        defaultValue: {}
    };

    constructor() {
        super();

        makeObservable(this, {
            definition: observable
        });
    }

    getPropertyValue(
        propertyInfo: LVGLPropertyInfo,
        part: string,
        state: string
    ) {
        if (!this.definition) {
            return undefined;
        }

        const partStyles = this.definition[part];
        if (!partStyles) {
            return undefined;
        }

        const stateStyles = partStyles[state];
        if (!stateStyles) {
            return undefined;
        }

        return stateStyles[propertyInfo.name];
    }

    addPropertyToDefinition(
        propertyInfo: LVGLPropertyInfo,
        part: string,
        state: string,
        value: any
    ) {
        let def = this.definition;
        return {
            ...(def || {}),
            [part]: {
                ...(def || {})[part],
                [state]: {
                    ...((def || {})[part] || {})[state],
                    [propertyInfo.name]: value
                }
            }
        };
    }

    removePropertyFromDefinition(
        propertyInfo: LVGLPropertyInfo,
        part: string,
        state: string
    ) {
        let def = this.definition;
        let copy = {
            ...(def || {}),
            [part]: {
                ...(def || {})[part],
                [state]: {
                    ...((def || {})[part] || {})[state]
                }
            }
        };

        delete copy[part][state][propertyInfo.name];

        if (Object.keys(copy[part][state]).length == 0) {
            delete copy[part][state];
        }

        if (Object.keys(copy[part]).length == 0) {
            delete copy[part];
        }

        if (Object.keys(copy).length == 0) {
            return undefined;
        }

        return copy;
    }

    check(messages: IMessage[]) {
        if (this.definition) {
            Object.keys(this.definition).forEach(part => {
                Object.keys(this.definition[part]).forEach(state => {
                    Object.keys(this.definition[part][state]).forEach(
                        propertyName => {
                            const propertyInfo =
                                lvglPropertiesMap.get(propertyName);
                            if (!propertyInfo) {
                                return;
                            }

                            if (
                                propertyInfo.type ==
                                    PropertyType.ObjectReference &&
                                propertyInfo.referencedObjectCollectionPath ==
                                    "bitmaps"
                            ) {
                                const value =
                                    this.definition[part][state][propertyName];

                                const bitmap = findBitmap(
                                    ProjectEditor.getProject(this),
                                    value
                                );

                                if (!bitmap) {
                                    messages.push(
                                        new Message(
                                            MessageType.ERROR,
                                            `Bitmap not found for style property ${part} - ${state} - ${humanize(
                                                propertyInfo.name
                                            )}`,
                                            this
                                        )
                                    );
                                }
                            } else if (
                                propertyInfo.lvglStyleProp.code ==
                                LVGLStylePropCode.LV_STYLE_TEXT_FONT
                            ) {
                                const value =
                                    this.definition[part][state][propertyName];

                                const font = findFont(
                                    ProjectEditor.getProject(this),
                                    value
                                );

                                if (
                                    !font &&
                                    BUILT_IN_FONTS.indexOf(value) == -1
                                ) {
                                    messages.push(
                                        new Message(
                                            MessageType.ERROR,
                                            `Font not found for style property ${part} - ${state} - ${humanize(
                                                propertyInfo.name
                                            )}`,
                                            this
                                        )
                                    );
                                }
                            }
                        }
                    );
                });
            });
        }
    }

    lvglCreate(
        runtime: LVGLPageRuntime,
        widget: LVGLWidget | Page,
        obj: number
    ) {
        if (!this.definition) {
            return;
        }

        Object.keys(this.definition).forEach(part => {
            Object.keys(this.definition[part]).forEach(state => {
                const selectorCode = getSelectorCode(part, state);
                Object.keys(this.definition[part][state]).forEach(
                    propertyName => {
                        const propertyInfo =
                            lvglPropertiesMap.get(propertyName);
                        if (!propertyInfo) {
                            return;
                        }

                        const value =
                            this.definition[part][state][propertyName];

                        if (propertyInfo.type == PropertyType.ThemedColor) {
                            const colorValue = colorRgbToNum(value);

                            runtime.wasm._lvglObjSetLocalStylePropColor(
                                obj,
                                propertyInfo.lvglStyleProp.code,
                                colorValue,
                                selectorCode
                            );
                        } else if (
                            propertyInfo.type == PropertyType.Number ||
                            propertyInfo.type == PropertyType.Enum
                        ) {
                            if (propertyInfo == text_font_property_info) {
                                const index = BUILT_IN_FONTS.indexOf(value);
                                if (index != -1) {
                                    runtime.wasm._lvglObjSetLocalStylePropBuiltInFont(
                                        obj,
                                        propertyInfo.lvglStyleProp.code,
                                        index,
                                        selectorCode
                                    );
                                } else {
                                    const font = findFont(
                                        ProjectEditor.getProject(this),
                                        value
                                    );

                                    if (font) {
                                        (async () => {
                                            const fontPtr =
                                                await runtime.loadFont(font);
                                            if (fontPtr != 0) {
                                                if (
                                                    runtime.isMounted &&
                                                    (!runtime.isEditor ||
                                                        obj == widget._lvglObj)
                                                ) {
                                                    console.log("font", font);

                                                    runtime.wasm._lvglObjSetLocalStylePropPtr(
                                                        obj,
                                                        propertyInfo
                                                            .lvglStyleProp.code,
                                                        fontPtr,
                                                        selectorCode
                                                    );

                                                    runInAction(
                                                        () =>
                                                            widget._refreshCounter++
                                                    );
                                                }
                                            }
                                        })();
                                    }
                                }
                            } else {
                                const numValue = propertyInfo.lvglStyleProp
                                    .valueToNum
                                    ? propertyInfo.lvglStyleProp.valueToNum(
                                          value
                                      )
                                    : value;

                                runtime.wasm._lvglObjSetLocalStylePropNum(
                                    obj,
                                    propertyInfo.lvglStyleProp.code,
                                    numValue,
                                    selectorCode
                                );
                            }
                        } else if (propertyInfo.type == PropertyType.Boolean) {
                            const numValue = value ? 1 : 0;

                            runtime.wasm._lvglObjSetLocalStylePropNum(
                                obj,
                                propertyInfo.lvglStyleProp.code,
                                numValue,
                                selectorCode
                            );
                        } else if (
                            propertyInfo.type == PropertyType.ObjectReference &&
                            propertyInfo.referencedObjectCollectionPath ==
                                "bitmaps"
                        ) {
                            const bitmap = findBitmap(
                                ProjectEditor.getProject(this),
                                value
                            );
                            if (bitmap && bitmap.image) {
                                (async () => {
                                    const bitmapPtr = await runtime.loadBitmap(
                                        bitmap
                                    );
                                    if (bitmapPtr) {
                                        if (
                                            runtime.isMounted &&
                                            (!runtime.isEditor ||
                                                obj == widget._lvglObj)
                                        ) {
                                            runtime.wasm._lvglObjSetLocalStylePropPtr(
                                                obj,
                                                propertyInfo.lvglStyleProp.code,
                                                bitmapPtr,
                                                selectorCode
                                            );

                                            runInAction(
                                                () => widget._refreshCounter++
                                            );
                                        }
                                    }
                                })();
                            }
                        }
                    }
                );
            });
        });
    }

    lvglBuild(build: LVGLBuild) {
        if (!this.definition) {
            return;
        }

        Object.keys(this.definition).forEach(part => {
            Object.keys(this.definition[part]).forEach(state => {
                const selectorCode = getSelectorBuildCode(part, state);
                Object.keys(this.definition[part][state]).forEach(
                    propertyName => {
                        const propertyInfo =
                            lvglPropertiesMap.get(propertyName);
                        if (!propertyInfo) {
                            return;
                        }

                        const value =
                            this.definition[part][state][propertyName];

                        if (propertyInfo.type == PropertyType.ThemedColor) {
                            build.line(
                                `lv_obj_set_style_${
                                    propertyInfo.name
                                }(obj, lv_color_hex(${colorRgbToHexNumStr(
                                    this.definition[part][state][propertyName]
                                )}), ${selectorCode});`
                            );
                        } else if (
                            propertyInfo.type == PropertyType.Number ||
                            propertyInfo.type == PropertyType.Enum
                        ) {
                            if (propertyInfo == text_font_property_info) {
                                const index = BUILT_IN_FONTS.indexOf(value);
                                if (index != -1) {
                                    build.line(
                                        `lv_obj_set_style_${
                                            propertyInfo.name
                                        }(obj, &lv_font_${(
                                            value as string
                                        ).toLowerCase()}, ${selectorCode});`
                                    );
                                } else {
                                    const font = findFont(
                                        ProjectEditor.getProject(this),
                                        value
                                    );
                                    if (font) {
                                        build.line(
                                            `lv_obj_set_style_${
                                                propertyInfo.name
                                            }(obj, &${build.getFontVariableName(
                                                font
                                            )}, ${selectorCode});`
                                        );
                                    }
                                }
                            } else {
                                const numValue = propertyInfo.lvglStyleProp
                                    .valueBuild
                                    ? propertyInfo.lvglStyleProp.valueBuild(
                                          value
                                      )
                                    : value;

                                build.line(
                                    `lv_obj_set_style_${propertyInfo.name}(obj, ${numValue}, ${selectorCode});`
                                );
                            }
                        } else if (propertyInfo.type == PropertyType.Boolean) {
                            const numValue = value ? "true" : "false";

                            build.line(
                                `lv_obj_set_style_${propertyInfo.name}(obj, ${numValue}, ${selectorCode});`
                            );
                        } else if (
                            propertyInfo.type == PropertyType.ObjectReference &&
                            propertyInfo.referencedObjectCollectionPath ==
                                "bitmaps"
                        ) {
                            build.line(
                                `lv_obj_set_style_${propertyInfo.name}(obj, &img_${value}, ${selectorCode});`
                            );
                        }
                    }
                );
            });
        });
    }
}

registerClass("LVGLStylesDefinition", LVGLStylesDefinition);
