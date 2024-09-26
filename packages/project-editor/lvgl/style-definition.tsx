import { makeObservable, observable, toJS } from "mobx";

import {
    ClassInfo,
    EezObject,
    IMessage,
    MessageType,
    PropertyType,
    registerClass,
    setKey
} from "project-editor/core/object";

import { humanize } from "eez-studio-shared/string";

import { ProjectEditor } from "project-editor/project-editor-interface";
import { EezValueObject, Message } from "project-editor/store";
import { findBitmap, findFont } from "project-editor/project/project";

import type { Page } from "project-editor/features/page/page";

import type { LVGLWidget } from "project-editor/lvgl/widgets";
import type { LVGLPageRuntime } from "project-editor/lvgl/page-runtime";
import type { LVGLBuild } from "project-editor/lvgl/build";
import { LVGL_STYLE_PROP_CODES } from "project-editor/lvgl/lvgl-constants";
import {
    BUILT_IN_FONTS,
    lvglPropertiesMap,
    LVGLPropertyInfo,
    text_font_property_info
} from "project-editor/lvgl/style-catalog";
import {
    colorRgbToHexNumStr,
    colorRgbToNum,
    getSelectorBuildCode,
    getSelectorCode
} from "project-editor/lvgl/style-helper";

////////////////////////////////////////////////////////////////////////////////

type Definition = {
    [part: string]: {
        [state: string]: {
            [prop: string]: any;
        };
    };
};

export class LVGLStylesDefinition extends EezObject {
    definition: Definition;

    static classInfo: ClassInfo = {
        properties: [
            {
                name: "definition",
                type: PropertyType.Any,
                visitProperty: (style: LVGLStylesDefinition) => {
                    const valueObjects: EezValueObject[] = [];

                    Object.keys(style.definition).forEach(part => {
                        Object.keys(style.definition[part]).forEach(state => {
                            Object.keys(style.definition[part][state]).forEach(
                                propertyName => {
                                    const propertyInfo =
                                        lvglPropertiesMap.get(propertyName);
                                    if (!propertyInfo) {
                                        return;
                                    }

                                    const valueObject = EezValueObject.create(
                                        style,
                                        propertyInfo,
                                        style.definition[part][state][
                                            propertyName
                                        ]
                                    );

                                    setKey(
                                        valueObject,
                                        `definition.${part}.${state}.${propertyName}`
                                    );

                                    valueObjects.push(valueObject);
                                }
                            );
                        });
                    });

                    return valueObjects;
                }
            }
        ],
        defaultValue: {}
    };

    override makeEditable() {
        super.makeEditable();

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

    static combineDefinitions(
        definition1: Definition,
        definition2: Definition
    ) {
        let result = toJS(definition1);

        Object.keys(definition2).forEach(part => {
            Object.keys(definition2[part]).forEach(state => {
                Object.keys(definition2[part][state]).forEach(propertyName => {
                    result = {
                        ...(result || {}),
                        [part]: {
                            ...(result || {})[part],
                            [state]: {
                                ...((result || {})[part] || {})[state],
                                [propertyName]:
                                    definition2[part][state][propertyName]
                            }
                        }
                    };
                });
            });
        });

        return result;
    }

    static removePropertyFromDefinitionByName(
        definition: Definition | undefined,
        propertyName: string,
        part: string,
        state: string
    ) {
        let def = definition;
        let copy = {
            ...(def || {}),
            [part]: {
                ...(def || {})[part],
                [state]: {
                    ...((def || {})[part] || {})[state]
                }
            }
        };

        delete copy[part][state][propertyName];

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

    removePropertyFromDefinition(
        propertyInfo: LVGLPropertyInfo,
        part: string,
        state: string
    ) {
        return LVGLStylesDefinition.removePropertyFromDefinitionByName(
            this.definition,
            propertyInfo.name,
            part,
            state
        );
    }

    removeModifications(
        modifications: {
            part: string;
            state: string;
            propertyName: string;
        }[]
    ) {
        let newDefinition: Definition | undefined = this.definition;
        for (const modification of modifications) {
            newDefinition =
                LVGLStylesDefinition.removePropertyFromDefinitionByName(
                    newDefinition,
                    modification.propertyName,
                    modification.part,
                    modification.state
                );
        }
        return newDefinition;
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
                                    const valueObject = EezValueObject.create(
                                        this,
                                        propertyInfo,
                                        value
                                    );

                                    setKey(
                                        valueObject,
                                        `definition.${part}.${state}.${propertyName}`
                                    );

                                    messages.push(
                                        new Message(
                                            MessageType.ERROR,
                                            `Bitmap not found for style property ${part} - ${state} - ${
                                                propertyInfo.displayName ||
                                                humanize(propertyInfo.name)
                                            }`,
                                            valueObject
                                        )
                                    );
                                }
                            } else if (
                                propertyInfo.lvglStyleProp.code ==
                                LVGL_STYLE_PROP_CODES.LV_STYLE_TEXT_FONT
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
                                    const valueObject = EezValueObject.create(
                                        this,
                                        propertyInfo,
                                        value
                                    );

                                    setKey(
                                        valueObject,
                                        `definition.${part}.${state}.${propertyName}`
                                    );

                                    messages.push(
                                        new Message(
                                            MessageType.ERROR,
                                            `Font not found for style property ${part} - ${state} - ${
                                                propertyInfo.displayName ||
                                                humanize(propertyInfo.name)
                                            }`,
                                            valueObject
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

        const lvglVersion =
            ProjectEditor.getProject(widget).settings.general.lvglVersion;

        Object.keys(this.definition).forEach(part => {
            Object.keys(this.definition[part]).forEach(state => {
                const selectorCode = getSelectorCode(this, part, state);
                Object.keys(this.definition[part][state]).forEach(
                    propertyName => {
                        const propertyInfo =
                            lvglPropertiesMap.get(propertyName);
                        if (
                            !propertyInfo ||
                            propertyInfo.lvglStyleProp.code[lvglVersion] ==
                                undefined
                        ) {
                            return;
                        }

                        const value =
                            this.definition[part][state][propertyName];

                        if (propertyInfo.type == PropertyType.ThemedColor) {
                            const colorValue = colorRgbToNum(value);

                            runtime.wasm._lvglObjSetLocalStylePropColor(
                                obj,
                                runtime.getLvglStylePropCode(
                                    propertyInfo.lvglStyleProp.code
                                ),
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
                                        runtime.getLvglStylePropCode(
                                            propertyInfo.lvglStyleProp.code
                                        ),
                                        index,
                                        selectorCode
                                    );
                                } else {
                                    const font = findFont(
                                        ProjectEditor.getProject(this),
                                        value
                                    );

                                    if (font) {
                                        const fontPtr =
                                            runtime.getFontPtr(font);
                                        if (fontPtr) {
                                            runtime.wasm._lvglObjSetLocalStylePropPtr(
                                                obj,
                                                runtime.getLvglStylePropCode(
                                                    propertyInfo.lvglStyleProp
                                                        .code
                                                ),
                                                fontPtr,
                                                selectorCode
                                            );
                                        }
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
                                    runtime.getLvglStylePropCode(
                                        propertyInfo.lvglStyleProp.code
                                    ),
                                    numValue,
                                    selectorCode
                                );
                            }
                        } else if (propertyInfo.type == PropertyType.Boolean) {
                            const numValue = value ? 1 : 0;

                            runtime.wasm._lvglObjSetLocalStylePropNum(
                                obj,
                                runtime.getLvglStylePropCode(
                                    propertyInfo.lvglStyleProp.code
                                ),
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
                                const bitmapPtr = runtime.getBitmapPtr(bitmap);
                                if (bitmapPtr) {
                                    runtime.wasm._lvglObjSetLocalStylePropPtr(
                                        obj,
                                        runtime.getLvglStylePropCode(
                                            propertyInfo.lvglStyleProp.code
                                        ),
                                        bitmapPtr,
                                        selectorCode
                                    );
                                }
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
                                `lv_obj_set_style_${build.getStylePropName(
                                    propertyInfo.name
                                )}(obj, lv_color_hex(${colorRgbToHexNumStr(
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
                                        `lv_obj_set_style_${build.getStylePropName(
                                            propertyInfo.name
                                        )}(obj, &lv_font_${(
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
                                            `lv_obj_set_style_${build.getStylePropName(
                                                propertyInfo.name
                                            )}(obj, &${build.getFontVariableName(
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
                                    `lv_obj_set_style_${build.getStylePropName(
                                        propertyInfo.name
                                    )}(obj, ${numValue}, ${selectorCode});`
                                );
                            }
                        } else if (propertyInfo.type == PropertyType.Boolean) {
                            const numValue = value ? "true" : "false";

                            build.line(
                                `lv_obj_set_style_${build.getStylePropName(
                                    propertyInfo.name
                                )}(obj, ${numValue}, ${selectorCode});`
                            );
                        } else if (
                            propertyInfo.type == PropertyType.ObjectReference &&
                            propertyInfo.referencedObjectCollectionPath ==
                                "bitmaps"
                        ) {
                            build.line(
                                `lv_obj_set_style_${build.getStylePropName(
                                    propertyInfo.name
                                )}(obj, &${build.getImageVariableName(
                                    value
                                )}, ${selectorCode});`
                            );
                        }
                    }
                );
            });
        });
    }

    lvglBuildStyle(build: LVGLBuild, part: string, state: string) {
        Object.keys(this.definition?.[part]?.[state] ?? {}).forEach(
            propertyName => {
                const propertyInfo = lvglPropertiesMap.get(propertyName);
                if (!propertyInfo) {
                    return;
                }

                const value = this.definition[part][state][propertyName];

                if (propertyInfo.type == PropertyType.ThemedColor) {
                    build.line(
                        `lv_style_set_${build.getStylePropName(
                            propertyInfo.name
                        )}(style, lv_color_hex(${colorRgbToHexNumStr(
                            this.definition[part][state][propertyName]
                        )}));`
                    );
                } else if (
                    propertyInfo.type == PropertyType.Number ||
                    propertyInfo.type == PropertyType.Enum
                ) {
                    if (propertyInfo == text_font_property_info) {
                        const index = BUILT_IN_FONTS.indexOf(value);
                        if (index != -1) {
                            build.line(
                                `lv_style_set_${build.getStylePropName(
                                    propertyInfo.name
                                )}(style, &lv_font_${(
                                    value as string
                                ).toLowerCase()});`
                            );
                        } else {
                            const font = findFont(
                                ProjectEditor.getProject(this),
                                value
                            );
                            if (font) {
                                build.line(
                                    `lv_style_set_${build.getStylePropName(
                                        propertyInfo.name
                                    )}(style, &${build.getFontVariableName(
                                        font
                                    )});`
                                );
                            }
                        }
                    } else {
                        const numValue = propertyInfo.lvglStyleProp.valueBuild
                            ? propertyInfo.lvglStyleProp.valueBuild(value)
                            : value;

                        build.line(
                            `lv_style_set_${build.getStylePropName(
                                propertyInfo.name
                            )}(style, ${numValue});`
                        );
                    }
                } else if (propertyInfo.type == PropertyType.Boolean) {
                    const numValue = value ? "true" : "false";

                    build.line(
                        `lv_style_set_${build.getStylePropName(
                            propertyInfo.name
                        )}(style, ${numValue});`
                    );
                } else if (
                    propertyInfo.type == PropertyType.ObjectReference &&
                    propertyInfo.referencedObjectCollectionPath == "bitmaps"
                ) {
                    build.line(
                        `lv_style_set_${build.getStylePropName(
                            propertyInfo.name
                        )}(style, &${build.getImageVariableName(value)});`
                    );
                }
            }
        );
    }

    get hasModifications() {
        return this.definition && Object.keys(this.definition).length > 0;
    }

    resetAllModifications() {
        ProjectEditor.getProjectStore(this).updateObject(this, {
            definition: undefined
        });
    }
}

registerClass("LVGLStylesDefinition", LVGLStylesDefinition);

////////////////////////////////////////////////////////////////////////////////
