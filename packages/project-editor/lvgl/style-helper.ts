import {
    IEezObject,
    LVGLParts,
    PropertyType
} from "project-editor/core/object";

import {
    BUILT_IN_FONTS,
    lvglPropertiesMap,
    LVGLPropertyInfo,
    text_font_property_info
} from "project-editor/lvgl/style-catalog";
import type { LVGLPageRuntime } from "project-editor/lvgl/page-runtime";
import { lvglStates, lvglStates_V9_5_0 } from "project-editor/lvgl/lvgl-constants";
import { getLvglParts } from "project-editor/lvgl/lvgl-versions";
import type { Project } from "project-editor/project/project";
import { ProjectEditor } from "project-editor/project-editor-interface";

////////////////////////////////////////////////////////////////////////////////

export function getPartCode(object: IEezObject, part: string) {
    const lvglParts = getLvglParts(object);

    if (part.startsWith("custom")) {
        const partIndex = Number.parseInt(part.substring("custom".length));
        const custom1Code = lvglParts.CUSTOM1;
        return custom1Code + (partIndex - 1);
    } else {
        const partCode = (lvglParts as any)[part];
        if (partCode == undefined) {
            console.error("UNEXPECTED!");
            return 0;
        }
        return partCode;
    }
}

export function getPartBuildCode(part: string) {
    return "LV_PART_" + part;
}

export function getStateCode(project: Project, state: string) {
    let result = 0;

    const lvglStatesVar = project.settings.general.lvglVersion == "9.5.0" ? lvglStates_V9_5_0 : lvglStates;

    state.split("|").forEach(stateStr => {
        const stateCode = (lvglStatesVar as any)[stateStr];
        if (stateCode == undefined) {
            console.error("UNEXPECTED!");
            return;
        }
        result |= stateCode;
    });

    return result;
}

export function getStateBuildCode(state: string) {
    return "LV_STATE_" + state;
}

export function getSelectorCode(
    object: IEezObject,
    partStr: string,
    statesStr: string
) {
    const partCode = getPartCode(object, partStr);

    const statesCode =
        statesStr.trim() != ""
            ? statesStr
                  .split("|")
                  .reduce((previousCode: number, currentStateStr: string) => {
                      return previousCode | getStateCode(ProjectEditor.getProject(object), currentStateStr);
                  }, 0)
            : 0;

    return partCode | statesCode;
}

export function getSelectorBuildCode(partStr: string, statesStr: string) {
    const partCode = getPartBuildCode(partStr);

    const statesCode =
        statesStr.trim() != ""
            ? statesStr
                  .split("|")
                  .map(state => getStateBuildCode(state))
                  .join(" | ")
            : "0";

    return `${partCode} | ${statesCode}`;
}

export function getPropertyInfo(propertyName: string) {
    return lvglPropertiesMap.get(propertyName);
}

export function colorNumToRgb(color: number): string {
    // signed to unsigned
    color = color >>> 0;

    // color is in BGR format
    const b = (color >> 0) & 0xff;
    const g = (color >> 8) & 0xff;
    const r = (color >> 16) & 0xff;

    let result = (r << 16) | (g << 8) | (b << 0);

    // signed to unsigned
    result = result >>> 0;

    return "#" + result.toString(16).padStart(6, "0");
}

export function getStylePropDefaultValue(
    project: Project,
    runtime: LVGLPageRuntime | undefined,
    lvglObj: number | undefined,
    part: LVGLParts,
    state: string,
    propertyInfo: LVGLPropertyInfo
) {
    try {
        if (runtime && lvglObj) {
            if (propertyInfo.type == PropertyType.ThemedColor) {
                let colorNum = runtime.wasm._lvglObjGetStylePropColor(
                    lvglObj,
                    getPartCode(runtime.page, part),
                    getStateCode(project, state),
                    runtime.getLvglStylePropCode(
                        propertyInfo.lvglStyleProp.code
                    )
                );
                return colorNumToRgb(colorNum);
            } else if (
                propertyInfo.type == PropertyType.Number ||
                propertyInfo.type == PropertyType.Enum ||
                propertyInfo.type == PropertyType.NumberArrayAsString
            ) {
                if (propertyInfo == text_font_property_info) {
                    let fontIndex =
                        runtime.wasm._lvglObjGetStylePropBuiltInFont(
                            lvglObj,
                            getPartCode(runtime.page, part),
                            getStateCode(project, state),
                            runtime.getLvglStylePropCode(
                                propertyInfo.lvglStyleProp.code
                            )
                        );

                    if (fontIndex != -1) {
                        return BUILT_IN_FONTS[fontIndex];
                    } else {
                        let fontAddr =
                            runtime.wasm._lvglObjGetStylePropFontAddr(
                                lvglObj,
                                getPartCode(runtime.page, part),
                                getStateCode(project, state),
                                runtime.getLvglStylePropCode(
                                    propertyInfo.lvglStyleProp.code
                                )
                            );
                        const font = runtime.fontAddressToFont.get(fontAddr);
                        if (font) {
                            return font.name;
                        }
                    }
                } else {
                    let num = runtime.wasm._lvglObjGetStylePropNum(
                        lvglObj,
                        getPartCode(runtime.page, part),
                        getStateCode(project, state),
                        runtime.getLvglStylePropCode(
                            propertyInfo.lvglStyleProp.code
                        )
                    );
                    return propertyInfo.lvglStyleProp.valueRead
                        ? propertyInfo.lvglStyleProp.valueRead(num)
                        : num;
                }
            } else if (propertyInfo.type == PropertyType.Boolean) {
                let num = runtime.wasm._lvglObjGetStylePropNum(
                    lvglObj,
                    getPartCode(runtime.page, part),
                    getStateCode(project, state),
                    runtime.getLvglStylePropCode(
                        propertyInfo.lvglStyleProp.code
                    )
                );
                return num ? true : false;
            }
        }
    } catch (e) {
        return undefined;
    }

    return 0;
}
