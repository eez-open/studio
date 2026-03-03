import fs from "fs";
import { resolve } from "path";
import tinycolor from "tinycolor2";

import { isDev, writeTextFile } from "eez-studio-shared/util-electron";

import { Assets } from "project-editor/build/assets";
import { Build, NamingConvention, getName } from "project-editor/build/helper";
import {
    ButtonWidget,
    SwitchWidget,
    TextWidget
} from "project-editor/flow/components/widgets/eez-gui";
import { getComponentName } from "project-editor/flow/components/components-registry";
import { Page } from "project-editor/features/page/page";
import {
    Component,
    Widget
} from "project-editor/flow/component";
import {
    getStyleProperty,
    type Style
} from "project-editor/features/style/style";

import type { ConnectionLine } from "project-editor/flow/connection-line/connection-line";
import { escapeCString } from "project-editor/lvgl/widget-common";
import {
    ContainerWidget,
    SelectWidget
} from "project-editor/flow/components/widgets";

import {
    evalConstantExpression
} from "project-editor/eez-flow-lite/expression";
import { BuildEezFlowLite } from "project-editor/eez-flow-lite/build";
import type { Project } from "project-editor/project/project";
import { sourceRootDir } from "eez-studio-shared/util";

interface BuildStyle {
    style: Style;
    isUsed: boolean;
    styleName: string;
}

interface BuildPage {
    page: Page;
    widgets: BuildWidget[];
    buildStyle?: BuildStyle;
}

interface BuildWidget {
    widget: Widget;
    flags: string[];
    varType: string;
    varName: string;
    buildStyle?: BuildStyle;
    widgets?: BuildWidget[]; // for SelectWidget and ContainerWidget
}

interface WidgetProperty {
    type: "boolean" | "string" | "integer";
    name: string;
    value: string;
}

export class BuildEezGuiLite {
    buildStyles: BuildStyle[] = [];
    nonThemeColors: string[] = [];
    buildPages: BuildPage[] = [];
    widgetProperties: WidgetProperty[] = [];

    buildFlow: BuildEezFlowLite;

    constructor(public assets: Assets) {
        this.buildFlow = new BuildEezFlowLite(assets.projectStore.project);

        this.analyseProject();
    }

    //
    //
    //

    get project() {
        return this.assets.projectStore.project;
    }

    getUniqueVarName(prefix: string, varNames: Set<string>) {
        let i = 1;
        let varName = prefix + "_" + i;
        while (varNames.has(varName)) {
            i++;
            varName = prefix + "_" + i;
        }
        varNames.add(varName);
        return varName;
    }

    addWidgetProperty(
        widget: Widget,
        propValue: string,
        type: "boolean" | "string" | "integer"
    ) {
        let value;
        try {
            value = evalConstantExpression(this.project, propValue).value;
            if (type == "string") {
                let str = "";
                for (let i = 0; i < value.length; i++) {
                    // escape no ascii chars
                    if (value.charCodeAt(i) < 32 || value.charCodeAt(i) > 126) {
                        str +=
                            "\\u" +
                            value.charCodeAt(i).toString(16).padStart(4, "0");
                    } else {
                        str += value[i];
                    }
                }
                value = escapeCString(str);
            }
        } catch (err) {
            value = this.buildFlow.buildExpression(widget, propValue, type);
        }

        let widgetProperty = this.widgetProperties.find(
            prop => prop.value === value
        );

        if (!widgetProperty) {
            const name = this.getUniqueVarName(
                type == "boolean"
                    ? "PROP_BOOL"
                    : type == "string"
                      ? "PROP_STR"
                      : "PROP_INT",
                new Set(this.widgetProperties.map(prop => prop.name))
            );
            widgetProperty = { type, name, value };
            this.widgetProperties.push(widgetProperty);
        }

        return widgetProperty.name;
    }

    addColor(style: Style, property: string) {
        let colorValue = getStyleProperty(
            style,
            property,
            false /* do not translate themed colors */
        );

        if (colorValue == undefined) {
            colorValue = "#00000000";
        }

        let color = this.project.colors.find(color => color.name == colorValue);
        if (color) {
            return;
        }

        const rgb = tinycolor(colorValue).toRgb();
        let colorNum =
            (rgb.b << 0) | (rgb.g << 8) | (rgb.r << 16) | (255 << 24);
        colorNum = colorNum >>> 0;
        let colorHex = "0x" + colorNum.toString(16).padStart(8, "0");
        if (!this.nonThemeColors.includes(colorHex)) {
            this.nonThemeColors.push(colorHex);
        }
    }

    getColor(style: Style, property: string) {
        let colorValue = getStyleProperty(
            style,
            property,
            false /* do not translate themed colors */
        );

        if (colorValue == undefined) {
            colorValue = "#00000000";
        }

        let color = this.project.colors.find(color => color.name == colorValue);
        if (color) {
            return `COLOR_${getName("", color.name, NamingConvention.UnderscoreUpperCase)}`;
        }

        const rgb = tinycolor(colorValue).toRgb();
        let colorNum =
            (rgb.b << 0) | (rgb.g << 8) | (rgb.r << 16) | (255 << 24);
        colorNum = colorNum >>> 0;
        let colorHex = "0x" + colorNum.toString(16).padStart(8, "0");

        return `_COLOR_NON_THEME_${this.nonThemeColors.indexOf(colorHex) + 1}`;
    }

    analyseProject() {
        // styles
        let styles = this.assets.styles.filter(style => !!style);
        for (const style of styles) {
            this.analyseStyle(style);
        }
        let buildStyles = styles.map(style => ({
            style,
            styleName: "",
            isUsed: style.alwaysBuild
        }));

        // pages
        for (const page of this.assets.projectStore.project.pages) {
            //
            let buildStyle;
            const styleIndex = this.assets.getStyleIndex(page, "style") - 1;
            if (styleIndex >= 0 && styleIndex < buildStyles.length) {
                buildStyle = buildStyles[styleIndex];
                buildStyles[styleIndex].isUsed = true;
            }

            const buildPage: BuildPage = {
                page,
                widgets: [],
                buildStyle
            };
            this.buildPages.push(buildPage);

            let varNames = new Set<string>();

            const addWidgets = (
                components: Component[],
                buildWidgets: BuildWidget[]
            ) => {
                for (const widget of components) {
                    if (widget instanceof Widget) {
                        const widgetName = getComponentName(
                            widget.type
                        ).toLowerCase();

                        const varType = `eezgui_${widgetName}_t`;

                        const varName = this.getUniqueVarName(
                            widgetName,
                            varNames
                        );

                        const buildWidget: BuildWidget = {
                            widget,
                            varType,
                            varName,
                            flags: []
                        };

                        buildWidgets.push(buildWidget);

                        //
                        const styleIndex =
                            this.assets.getStyleIndex(
                                buildWidget.widget,
                                "style"
                            ) - 1;
                        if (
                            styleIndex >= 0 &&
                            styleIndex < buildStyles.length
                        ) {
                            buildWidget.buildStyle = buildStyles[styleIndex];
                            buildStyles[styleIndex].isUsed = true;
                        }

                        // if there is an event handler with a connection line, mark the widget as clickable
                        let clickable = false;
                        if (widget instanceof SwitchWidget) {
                            clickable = true;
                        } else {
                            for (const eventHandler of buildWidget.widget
                                .eventHandlers) {
                                if (eventHandler.handlerType == "action") {
                                    clickable = true;
                                    break;
                                }

                                const connectionLine =
                                    page.connectionLines.find(
                                        connectionLine =>
                                            connectionLine.sourceComponent ==
                                                buildWidget.widget &&
                                            connectionLine.output ==
                                                eventHandler.eventName
                                    );
                                if (connectionLine) {
                                    clickable = true;
                                    break;
                                }
                            }
                        }
                        if (clickable) {
                            buildWidget.flags.push("CLICKABLE");
                        }

                        // collect widget properties

                        if (widget.visible) {
                            this.addWidgetProperty(
                                widget,
                                widget.visible,
                                "boolean"
                            );
                        }

                        if (widget instanceof TextWidget) {
                            this.addWidgetProperty(
                                widget,
                                widget.text || widget.data || "",
                                "string"
                            );
                        } else if (widget instanceof ButtonWidget) {
                            this.addWidgetProperty(
                                widget,
                                widget.text || widget.data || "",
                                "string"
                            );
                        } else if (widget instanceof SwitchWidget) {
                            this.addWidgetProperty(
                                widget,
                                widget.data || "false",
                                "boolean"
                            );
                        } else if (widget instanceof SelectWidget) {
                            this.addWidgetProperty(
                                widget,
                                widget.data || "0",
                                "integer"
                            );
                            buildWidget.widgets = [];
                            addWidgets(widget.widgets, buildWidget.widgets);
                        } else if (widget instanceof ContainerWidget) {
                            buildWidget.widgets = [];
                            addWidgets(widget.widgets, buildWidget.widgets);
                        }
                    }
                }
            };

            addWidgets(page.components, buildPage.widgets);
        }

        // finish styles

        // filter out unused styles
        buildStyles = buildStyles.filter(buildStyle => buildStyle.isUsed);

        // generate style names
        const styleVarNames = new Set<string>();
        for (const buildStyle of buildStyles) {
            let styleName;

            if (buildStyle.style.name) {
                styleName = getName(
                    "STYLE_",
                    buildStyle.style.name,
                    NamingConvention.UnderscoreUpperCase
                );
            } else {
                styleName = this.getUniqueVarName("_STYLE", styleVarNames);
            }

            styleVarNames.add(styleName);

            buildStyle.styleName = styleName;
        }

        this.buildStyles = [];
        // put styles with names first
        for (const buildStyle of buildStyles) {
            if (buildStyle.style.name) {
                this.buildStyles.push(buildStyle);
            }
        }
        // then put styles without names
        for (const buildStyle of buildStyles) {
            if (!buildStyle.style.name) {
                this.buildStyles.push(buildStyle);
            }
        }
    }

    analyseStyle(style: Style) {
        this.addColor(style, "color");
        this.addColor(style, "backgroundColor");
        this.addColor(style, "borderColor");
        this.addColor(style, "activeColor");
        this.addColor(style, "activeBackgroundColor");

        for (const childStyle of style.childStyles) {
            this.analyseStyle(childStyle);
        }
    }

    //
    // generate source code
    //

    buildDecl() {
        const build = new Build();
        build.startBuild();

        build.line("#pragma once");
        build.line("");

        build.line("#include <inttypes.h>");
        build.line("#include <stdbool.h>");

        build.line("");

        build.line('#include "eez-gui-lite.h"');

        build.line("");

        build.line("#ifdef __cplusplus");
        build.line('extern "C" {');
        build.line("#endif");
        
        build.line("");

        // enum types
        for (const enumType of this.project.variables.enums) {
            build.blockStart(`typedef enum {`);
            for (const member of enumType.members) {
                if (member.specificValue) {
                    build.line(
                        `${enumType.name}_${member.name} = ${member.value},`
                    );
                } else {
                    build.line(`${enumType.name}_${member.name},`);
                }
            }
            build.blockEnd(`} ${enumType.name};`);
            build.line("");
        }

        // global variables
        this.buildFlow.buildGlobalVariablesDecl(build);

        // native user actions
        this.buildFlow.buildUserActionsDecl(build);

        build.line("void ui_init(void);");
        build.line(
            "void ui_tick(int mouse_x, int mouse_y, bool mouse_pressed);"
        );

        build.line("");

        build.line("#ifdef __cplusplus");
        build.line('}');
        build.line("#endif");

        return build.result;
    }

    BuildDef() {
        let build = new Build();
        build.startBuild();

        build.line("#include <stdio.h>");
        build.line("#include <stdarg.h>");
        build.line("#include <string.h>");
        build.line("");
        const EEZ_FLOW_CTX_STATE_BUFFER_SIZE = 1024;
        build.line(
            `static uint8_t eezgui_state_buffer[${EEZ_FLOW_CTX_STATE_BUFFER_SIZE}];`
        );
        build.line(`static eezgui_ctx_t eezgui_ctx;`);
        build.line("static void (*selected_page)(eezgui_ctx_t *ctx);");
        build.line("");

        // global variables
        this.buildFlow.buildGlobalVariablesDef(build);

        // colors
        this.buildColorsDef(build);

        // fonts
        this.buildFontsDef(build);

        // styles
        this.buildStylesDef(build);

        // widget properties
        this.buildWidgetPropertiesDecl(build);

        // pages
        this.buildPagesDecl(build);

        // Flow code
        this.buildFlow.buildUserActionsDef(build);

        let pagesDefCode = this.buildPagesDef();

        const pages = this.buildPages.map(buildPage => buildPage.page);

        let startCode = this.buildFlow.buildStartCode(
            pages
        );

        let delaysCode = this.buildFlow.buildDelaysCode();
        if (delaysCode) {
            build.text(delaysCode);
        }

        let watchesCode = this.buildFlow.buildWatchesCode(pages);
        if (watchesCode) {
            build.text(watchesCode);
        }

        if (pagesDefCode) {
            build.text(pagesDefCode);
        }

        const { getStrProp, getBoolProp, getIntegerProp } =
            this.buildWidgetPropertiesDef(build);

        if (startCode) {
            build.text(startCode);
        }

        // ui_init
        build.blockStart("void ui_init(void) {");

        build.line(
            `eezgui_set_state_buffer(&eezgui_ctx, eezgui_state_buffer, sizeof(eezgui_state_buffer));`
        );
        build.line("");

        build.line(`eezgui_ctx.get_str_prop = ${getStrProp};`);
        build.line(`eezgui_ctx.get_bool_prop = ${getBoolProp};`);
        build.line(`eezgui_ctx.get_int_prop = ${getIntegerProp};`);
        build.line("");

        build.line("eezgui_ctx.long_press_time = 400;");
        build.line("eezgui_ctx.long_press_repeat_time = 100;");
        build.line("");

        const defaultThemeColors = `${getName("", this.project.themes[0].name, NamingConvention.UnderscoreLowerCase)}_colors`;
        build.line(
            `eezgui_set_colors(&eezgui_ctx, ${defaultThemeColors}, sizeof(${defaultThemeColors}) / sizeof(${defaultThemeColors}[0]));`
        );
        build.line(
            `eezgui_set_fonts(&eezgui_ctx, fonts, sizeof(fonts) / sizeof(fonts[0]));`
        );
        build.line(
            `eezgui_set_styles(&eezgui_ctx, styles, sizeof(styles) / sizeof(styles[0]));`
        );

        build.line("");
        build.line(`selected_page = ${this.buildPages[0].page.name}_page;`);

        if (startCode) {
            build.line("");
            build.line("on_start();");
        }
        build.blockEnd("}");

        build.line("");

        // ui_tick
        build.blockStart(
            "void ui_tick(int mouse_x, int mouse_y, bool mouse_pressed) {"
        );

        this.buildFlow.buildDelaysUpdate(build);

        this.buildFlow.buildWatchesUpdate(build);

        build.line(
            "eezgui_pointer_input(&eezgui_ctx, mouse_x, mouse_y, mouse_pressed);"
        );

        build.line("selected_page(&eezgui_ctx);");

        build.blockEnd("}");

        return build.result;
    }

    buildColorsDef(build: Build) {
        build.line("// Colors");
        build.line("");
        build.blockStart("enum {");
        for (const color of this.project.colors) {
            build.line(
                `COLOR_${getName(
                    "",
                    color.name,
                    NamingConvention.UnderscoreUpperCase
                )},`
            );
        }
        for (let i = 0; i < this.nonThemeColors.length; i++) {
            build.line(`_COLOR_NON_THEME_${i + 1},`);
        }
        build.blockEnd("};");

        for (const theme of this.project.themes) {
            build.line("");

            build.blockStart(
                `static const eezgui_color_t ${getName("", theme.name, NamingConvention.UnderscoreLowerCase)}_colors[] = {`
            );

            for (const color of this.project.colors) {
                const colorValue = this.project.getThemeColor(
                    theme.objID,
                    color.objID
                );
                const rgb = tinycolor(colorValue).toRgb();
                const r = rgb.r.toString(16).padStart(2, "0");
                const g = rgb.g.toString(16).padStart(2, "0");
                const b = rgb.b.toString(16).padStart(2, "0");
                build.line(
                    `EEZGUI_MAKE_COLOR(0x${r}, 0x${g}, 0x${b}), // #${r}${g}${b} COLOR_${getName(
                        "",
                        color.name,
                        NamingConvention.UnderscoreUpperCase
                    )}`
                );
            }

            for (let i = 0; i < this.nonThemeColors.length; i++) {
                const colorHex = this.nonThemeColors[i];
                const rgb = tinycolor("#" + colorHex.substring(4)).toRgb();
                build.line(
                    `EEZGUI_MAKE_COLOR(0x${rgb.r.toString(16).padStart(2, "0")}, 0x${rgb.g.toString(16).padStart(2, "0")}, 0x${rgb.b.toString(16).padStart(2, "0")}), // _COLOR_NON_THEME_${i + 1}`
                );
            }

            build.blockEnd("};");
        }
        build.line("");
    }

    buildFontsDef(build: Build) {
        build.line("// Fonts");
        build.line("");
        build.blockStart("enum {");
        for (const font of this.assets.fonts) {
            build.line(
                `${getName(
                    "FONT_",
                    font.name,
                    NamingConvention.UnderscoreUpperCase
                )},`
            );
        }
        build.blockEnd("};");
        build.line("");

        for (const font of this.assets.fonts) {
            build.line("");
            build.line(`// Font: ${font.name}`);

            const glyphs = font.glyphs
                .slice()
                .sort((a, b) => a.encoding - b.encoding);

            const groups: {
                encoding: number;
                glyphIndex: number;
                length: number;
            }[] = [];

            let i = 0;
            while (i < glyphs.length) {
                const start = i++;

                while (
                    i < glyphs.length &&
                    glyphs[i].encoding === glyphs[i - 1].encoding + 1
                ) {
                    i++;
                }

                groups.push({
                    encoding: glyphs[start].encoding,
                    glyphIndex: start,
                    length: i - start
                });
            }

            let startEncoding;
            let endEncoding;
            if (groups.length > 0) {
                startEncoding = groups[0].encoding;
                endEncoding = groups[0].encoding + groups[0].length - 1;
            } else {
                startEncoding = 0;
                endEncoding = 0;
            }

            let fontName = getName(
                "",
                font.name,
                NamingConvention.UnderscoreLowerCase
            );

            // pixels
            const pixels = [
                ...glyphs.map(glyph => glyph.pixelArray || [])
            ].flat();

            build.line(
                `static const uint8_t font_${fontName}_pixels[${pixels.length}] = { ${pixels.join(", ")} };`
            );

            // glyphs
            build.blockStart(
                `static const eezgui_glyph_data_t font_${fontName}_glyphs[${glyphs.length}] = {`
            );
            let pixelsIndex = 0;
            for (const glyph of glyphs) {
                build.line(
                    `{ .dx = ${glyph.dx}, .w = ${glyph.width}, .h = ${glyph.height}, .x = ${glyph.x}, .y = ${glyph.y}, .pixels_index = ${pixelsIndex} }, // "${
                        glyph.encoding < 32 || glyph.encoding > 126
                            ? "\\u" +
                              glyph.encoding.toString(16).padStart(4, "0")
                            : String.fromCharCode(glyph.encoding)
                    }"`
                );
                pixelsIndex += glyph.pixelArray ? glyph.pixelArray.length : 0;
            }
            build.blockEnd("};");

            // glyph groups
            build.blockStart(
                `static const eezgui_glyphs_group_t font_${fontName}_groups[${groups.length + 1}] = {`
            );
            for (const group of groups) {
                build.line(
                    `{ .encoding = ${group.encoding}, .glyphIndex = ${group.glyphIndex}, .length = ${group.length} },`
                );
            }
            build.line(`{ .length = 0 },`);
            build.blockEnd("};");

            // font data
            build.blockStart(`static const eezgui_font_data_t font_${fontName} = {`);
            build.line(`.ascent = ${font.ascent},`);
            build.line(`.descent = ${font.descent},`);
            build.line(`.encodingStart = ${startEncoding},`);
            build.line(`.encodingEnd = ${endEncoding},`);
            build.line(`.groups = font_${fontName}_groups,`);
            build.line(`.glyphs = font_${fontName}_glyphs,`);
            build.line(`.pixels = font_${fontName}_pixels,`);
            build.blockEnd("};");

            build.line("");
        }

        build.blockStart(
            `static const eezgui_font_data_t *fonts[${this.assets.fonts.length}] = {`
        );
        for (const font of this.assets.fonts) {
            let fontName = getName(
                "",
                font.name,
                NamingConvention.UnderscoreLowerCase
            );
            build.line(`&font_${fontName},`);
        }
        build.blockEnd("};");
        build.line("");
    }

    buildStylesDef(build: Build) {
        build.line("// Styles");
        build.line("");
        build.blockStart("enum {");
        for (const buildStyle of this.buildStyles) {
            build.line(`${buildStyle.styleName},`);
        }
        build.blockEnd("};");
        build.line("");
        build.blockStart(
            `static const eezgui_style_t styles[${this.buildStyles.length}] = {`
        );
        for (const buildStyle of this.buildStyles) {
            const style = buildStyle.style;

            build.line(`// ${buildStyle.styleName}`);
            build.blockStart(`{`);

            let flags: string[] = [];

            let styleAlignHorizontal = style.alignHorizontalProperty;
            if (styleAlignHorizontal == "left") {
                flags.push("EEZGUI_STYLE_FLAG_HORZ_ALIGN_LEFT");
            } else if (styleAlignHorizontal == "right") {
                flags.push("EEZGUI_STYLE_FLAG_HORZ_ALIGN_RIGHT");
            } else {
                flags.push("EEZGUI_STYLE_FLAG_HORZ_ALIGN_CENTER");
            }

            let styleAlignVertical = style.alignVerticalProperty;
            if (styleAlignVertical == "top") {
                flags.push("EEZGUI_STYLE_FLAG_VERT_ALIGN_TOP");
            } else if (styleAlignVertical == "bottom") {
                flags.push("EEZGUI_STYLE_FLAG_VERT_ALIGN_BOTTOM");
            } else {
                flags.push("EEZGUI_STYLE_FLAG_VERT_ALIGN_CENTER");
            }

            let styleBlink = style.blinkProperty;
            if (styleBlink) {
                flags.push("EEZGUI_STYLE_FLAG_BLINK");
            }
            build.line(`.flags = ${flags.join(" | ")},`);

            build.line(
                `.background_color = ${this.getColor(style, "backgroundColor")},`
            );
            build.line(`.color = ${this.getColor(style, "color")},`);

            build.line(
                `.active_background_color = ${this.getColor(style, "activeBackgroundColor")},`
            );
            build.line(
                `.active_color = ${this.getColor(style, "activeColor")},`
            );

            const borderSizeRect = style.borderSizeRect;
            build.line(`.border_size_top = ${borderSizeRect.top},`);
            build.line(`.border_size_right = ${borderSizeRect.right},`);
            build.line(`.border_size_bottom = ${borderSizeRect.bottom},`);
            build.line(`.border_size_left = ${borderSizeRect.left},`);

            build.line(
                `.border_color = ${this.getColor(style, "borderColor")},`
            );

            build.line(
                `.font = FONT_${getName(
                    "",
                    getStyleProperty(style, "font"),
                    NamingConvention.UnderscoreUpperCase
                )},`
            );

            const paddingRect = style.paddingRect;
            build.line(`.padding_top = ${paddingRect.top},`);
            build.line(`.padding_right = ${paddingRect.right},`);
            build.line(`.padding_bottom = ${paddingRect.bottom},`);
            build.line(`.padding_left = ${paddingRect.left},`);

            build.blockEnd("},");
        }
        build.blockEnd("};");
        build.line("");
    }

    buildWidgetPropertiesDecl(build: Build) {
        build.line("// Widget properties enum");
        build.line("");
        build.blockStart("enum {");
        build.line("_PROP_NONE,");
        for (const widgetProperty of this.widgetProperties) {
            if (widgetProperty.type == "string") {
                build.line(`${widgetProperty.name},`);
            }
        }
        for (const widgetProperty of this.widgetProperties) {
            if (widgetProperty.type == "boolean") {
                build.line(`${widgetProperty.name},`);
            }
        }
        for (const widgetProperty of this.widgetProperties) {
            if (widgetProperty.type == "integer") {
                build.line(`${widgetProperty.name},`);
            }
        }
        build.blockEnd("};");
        build.line("");
    }

    buildWidgetPropertiesDef(build: Build) {
        build.line("// Widget properties accessors");
        build.line("");

        let getStrProp = "NULL";
        const stringWidgetProperties = this.widgetProperties.filter(
            prop => prop.type == "string"
        );
        if (stringWidgetProperties.length > 0) {
            getStrProp = "get_str_prop";

            build.blockStart(
                "static const char *get_str_prop(uint16_t prop) {"
            );
            build.blockStart("switch (prop) {");
            for (const widgetProperty of stringWidgetProperties) {
                build.line(
                    `case ${widgetProperty.name}: return ${widgetProperty.value};`
                );
            }
            build.line("default: return NULL;");
            build.blockEnd("}");
            build.blockEnd("}");
            build.line("");
        }

        let getBoolProp = "NULL";
        const booleanWidgetProperties = this.widgetProperties.filter(
            prop => prop.type == "boolean"
        );
        if (booleanWidgetProperties.length > 0) {
            getBoolProp = "get_bool_prop";

            build.blockStart("static bool get_bool_prop(uint16_t prop) {");
            build.blockStart("switch (prop) {");
            for (const widgetProperty of booleanWidgetProperties) {
                build.line(
                    `case ${widgetProperty.name}: return ${widgetProperty.value};`
                );
            }
            build.line("default: return false;");
            build.blockEnd("}");
            build.blockEnd("}");
            build.line("");
        }

        let getIntegerProp = "NULL";
        const integerWidgetProperties = this.widgetProperties.filter(
            prop => prop.type == "integer"
        );
        if (integerWidgetProperties.length > 0) {
            getIntegerProp = "get_int_prop";

            build.blockStart("static int get_int_prop(uint16_t prop) {");
            build.blockStart("switch (prop) {");
            for (const widgetProperty of integerWidgetProperties) {
                build.line(
                    `case ${widgetProperty.name}: return ${widgetProperty.value};`
                );
            }
            build.line("default: return 0;");
            build.blockEnd("}");
            build.blockEnd("}");
            build.line("");
        }

        return { getStrProp, getBoolProp, getIntegerProp };
    }

    buildPagesDecl(build: Build) {
        for (const buildPage of this.buildPages) {
            build.line(`// Page ${buildPage.page.name}`);

            build.blockStart(`static struct {`);
            {
                const buildWidgetMembers = (buildWidgets: BuildWidget[]) => {
                    for (const buildWidget of buildWidgets) {
                        build.line(
                            `${buildWidget.varType} ${buildWidget.varName};`
                        );
                        if (
                            buildWidget.widget instanceof SelectWidget ||
                            buildWidget.widget instanceof ContainerWidget
                        ) {
                            buildWidgetMembers(buildWidget.widgets!);
                        }
                    }
                };
                buildWidgetMembers(buildPage.widgets);
            }
            build.unindent();
            build.line(`} ${buildPage.page.name}_widgets = {`);
            build.indent();

            const buildWidgetDefs = (buildWidgets: BuildWidget[]) => {
                for (const buildWidget of buildWidgets) {
                    build.blockStart(`.${buildWidget.varName} = {`);
                    build.blockStart(".base = {");

                    if (buildWidget.flags.length > 0) {
                        build.line(
                            `.flags = ${buildWidget.flags.map(flag => "EEZGUI_WIDGET_FLAG_" + flag).join(" | ")},`
                        );
                    }

                    build.line(
                        `.x = ${buildWidget.widget.left}, .y = ${buildWidget.widget.top}, .w = ${buildWidget.widget.width}, .h = ${buildWidget.widget.height},`
                    );

                    if (buildWidget.buildStyle) {
                        build.line(
                            `.style = ${buildWidget.buildStyle.styleName},`
                        );
                    } else {
                        build.line(
                            `.style = ${this.buildStyles[0].styleName},`
                        );
                    }

                    if (buildWidget.widget.visible) {
                        build.line(
                            `.is_visible = ${this.addWidgetProperty(
                                buildWidget.widget,
                                buildWidget.widget.visible,
                                "boolean"
                            )},`
                        );
                    }

                    build.blockEnd("},");

                    if (buildWidget.widget instanceof TextWidget) {
                        build.line(
                            `.text = ${this.addWidgetProperty(
                                buildWidget.widget,
                                buildWidget.widget.text ||
                                    buildWidget.widget.data ||
                                    "",
                                "string"
                            )},`
                        );
                    } else if (buildWidget.widget instanceof ButtonWidget) {
                        build.line(
                            `.text = ${this.addWidgetProperty(
                                buildWidget.widget,
                                buildWidget.widget.text ||
                                    buildWidget.widget.data ||
                                    "",
                                "string"
                            )},`
                        );
                    } else if (buildWidget.widget instanceof SwitchWidget) {
                        build.line(
                            `.is_checked = ${this.addWidgetProperty(
                                buildWidget.widget,
                                buildWidget.widget.data || "false",
                                "boolean"
                            )},`
                        );
                    }
                    build.blockEnd("},");

                    if (
                        buildWidget.widget instanceof SelectWidget ||
                        buildWidget.widget instanceof ContainerWidget
                    ) {
                        buildWidgetDefs(buildWidget.widgets!);
                    }
                }
            };

            buildWidgetDefs(buildPage.widgets);

            build.blockEnd("};");

            this.buildFlow.buildLocalVariablesDef(build, buildPage.page);

            build.line("");
            build.line(
                `static void ${buildPage.page.name}_page(eezgui_ctx_t *ctx);`
            );
            build.line("");
        }
    }

    buildPagesDef() {
        const build = new Build();
        build.startBuild();

        for (const buildPage of this.buildPages) {
            build.line(`// Page ${buildPage.page.name}`);

            let { onEventName, onEventCode } = this.buildPageOnEvent(buildPage);
            if (onEventCode) {
                build.line("");
                build.text(onEventCode);
            }

            build.line("");

            build.blockStart(
                `static void ${buildPage.page.name}_page(eezgui_ctx_t *ctx) {`
            );

            const styleName = buildPage.buildStyle
                ? buildPage.buildStyle.styleName
                : this.buildStyles[0].styleName;
            build.line(
                `eezgui_start_page(ctx, &${buildPage.page.name}_widgets, ${styleName}, ${onEventName ? onEventName : "NULL"});`
            );

            {
                const renderWidgets = (buildWidgets: BuildWidget[]) => {
                    for (const buildWidget of buildWidgets) {
                        const widgetName = getComponentName(
                            buildWidget.widget.type
                        ).toLowerCase();

                        if (buildWidget.widget instanceof SelectWidget) {
                            build.blockStart("{");

                            build.line(
                                `eezgui_select_begin(ctx, &${buildPage.page.name}_widgets.${buildWidget.varName});`
                            );

                            build.line(
                                `int selected = ctx->get_int_prop(${this.addWidgetProperty(
                                    buildWidget.widget,
                                    buildWidget.widget.data || "0",
                                    "integer"
                                )});`
                            );

                            for (
                                let i = 0;
                                i < buildWidget.widgets!.length;
                                i++
                            ) {
                                if (i == 0) {
                                    build.blockStart(`if (selected == ${i}) {`);
                                } else {
                                    build.unindent();
                                    build.line(
                                        `} else if (selected == ${i}) {`
                                    );
                                    build.indent();
                                }

                                const childWidget = buildWidget.widgets![i];
                                renderWidgets([childWidget]);

                                if (i == buildWidget.widgets!.length - 1) {
                                    build.blockEnd("}");
                                }
                            }

                            build.line(
                                `eezgui_select_end(ctx, &${buildPage.page.name}_widgets.${buildWidget.varName});`
                            );

                            build.blockEnd("}");
                        } else if (
                            buildWidget.widget instanceof ContainerWidget
                        ) {
                            build.line(
                                `eezgui_container_begin(ctx, &${buildPage.page.name}_widgets.${buildWidget.varName});`
                            );

                            build.blockStart("{");
                            renderWidgets(buildWidget.widgets!);
                            build.blockEnd("}");

                            build.line(
                                `eezgui_container_end(ctx, &${buildPage.page.name}_widgets.${buildWidget.varName});`
                            );
                        } else {
                            build.line(
                                `eezgui_${widgetName}(ctx, &${buildPage.page.name}_widgets.${buildWidget.varName});`
                            );
                        }
                    }
                };
                renderWidgets(buildPage.widgets);
            }
            build.line("eezgui_end_page(ctx);");
            build.blockEnd("}");

            build.line("");
        }

        return build.result;
    }

    buildPageOnEvent(buildPage: BuildPage) {
        const build = new Build();
        build.startBuild();

        build.indent();

        const buildEventHandlersForWidgets = (
            buildWidgets: BuildWidget[],
            page: Page
        ) => {
            for (const buildWidget of buildWidgets) {
                if (buildWidget.widget instanceof SwitchWidget) {
                    build.blockStart(
                        `if (event->widget == &${page.name}_widgets.${buildWidget.varName}.base && event->type == EEZGUI_EVENT_CLICKED) {`
                    );

                    let assignable = this.buildFlow.buildExpression(
                        buildWidget.widget,
                        buildWidget.widget.data!
                    );

                    if (
                        assignable.startsWith("get_") &&
                        assignable.endsWith("()")
                    ) {
                        const setterName =
                            "set_" +
                            assignable.substring(4, assignable.length - 2);
                        build.line(`${setterName}(!${assignable});`);
                    } else {
                        build.line(`${assignable} = !${assignable};`);
                    }

                    build.blockEnd("}");
                }

                const buildEventHandlers: {
                    connectionLine: ConnectionLine;
                    eventNames: string[];
                }[] = [];

                for (const eventHandler of buildWidget.widget.eventHandlers) {
                    if (eventHandler.handlerType == "action") {
                        const action = this.project.actions.find(
                            action => action.name == eventHandler.action
                        );

                        if (action) {
                            build.blockStart(
                                `if (event->widget == &${page.name}_widgets.${buildWidget.varName}.base && event->type == EEZGUI_EVENT_${eventHandler.eventName}) {`
                            );

                            this.buildFlow.buildUserActionCall(build, action);

                            build.blockEnd("}");
                        }
                        continue;
                    }

                    const connectionLines = page.connectionLines.filter(
                        connectionLine =>
                            connectionLine.sourceComponent ==
                                buildWidget.widget &&
                            connectionLine.output == eventHandler.eventName
                    );

                    for (const connectionLine of connectionLines) {
                        const buildConnectionLine = buildEventHandlers.find(
                            buildEventHandler =>
                                buildEventHandler.connectionLine
                                    .targetComponent ==
                                connectionLine.targetComponent
                        );

                        if (buildConnectionLine) {
                            buildConnectionLine.eventNames.push(
                                eventHandler.eventName
                            );
                        } else {
                            buildEventHandlers.push({
                                connectionLine,
                                eventNames: [eventHandler.eventName]
                            });
                        }
                    }
                }

                for (const buildEventHandler of buildEventHandlers) {
                    let eventTypeCondition = buildEventHandler.eventNames
                        .map(
                            eventName =>
                                `event->type == EEZGUI_EVENT_${eventName}`
                        )
                        .join(" || ");

                    if (buildEventHandler.eventNames.length > 1) {
                        eventTypeCondition = `(${eventTypeCondition})`;
                    }

                    build.blockStart(
                        `if (event->widget == &${page.name}_widgets.${buildWidget.varName}.base && ${eventTypeCondition}) {`
                    );

                    this.buildFlow.genFlowCode(
                        build,
                        buildEventHandler.connectionLine.targetComponent,
                        page
                    );

                    build.blockEnd("}");
                }

                if (
                    buildWidget.widget instanceof SelectWidget ||
                    buildWidget.widget instanceof ContainerWidget
                ) {
                    buildEventHandlersForWidgets(buildWidget.widgets!, page);
                }
            }
        };

        buildEventHandlersForWidgets(buildPage.widgets, buildPage.page);

        const body = build.result;
        if (!body) {
            return { onEventName: undefined, onEventCode: undefined };
        }

        build.startBuild();

        const onEventName = `${buildPage.page.name}_page_on_event`;

        build.blockStart(
            `static void ${onEventName}(eezgui_event_info_t *event) {`
        );

        if (body.length > 0) {
            build.text(body);
        } else {
            build.line("(void)event;");
        }

        build.blockEnd("}");
        build.line("");

        return { onEventName, onEventCode: build.result };
    }
}

export async function generateSourceCodeForEezGuiLite(project: Project, destinationFolderPath: string) {
    try {
        await fs.promises.rm(destinationFolderPath + "/eez-gui-lite.c");
    } catch (err) {}

    try {
        await fs.promises.rm(destinationFolderPath + "/eez-gui-lite.h");
    } catch (err) {}


    const eezGuiLitePath = isDev
        ? resolve(`${sourceRootDir()}/../resources/eez-gui-lite`)
        : process.resourcesPath! + "/eez-gui-lite";

    const eezGuiLiteC = await fs.promises.readFile(
        eezGuiLitePath + "/eez-gui-lite.c",
        "utf-8"
    );
    await writeTextFile(destinationFolderPath + "/eez-gui-lite.c", eezGuiLiteC);

    const eezGuiLiteH = await fs.promises.readFile(
        eezGuiLitePath + "/eez-gui-lite.h",
        "utf-8"
    );
    await writeTextFile(destinationFolderPath + "/eez-gui-lite.h", eezGuiLiteH);
}