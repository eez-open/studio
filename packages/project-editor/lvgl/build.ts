import fs from "fs";
import { resolve } from "path";
import { NamingConvention, getName, Build } from "project-editor/build/helper";
import type { Bitmap } from "project-editor/features/bitmap/bitmap";
import type { Font } from "project-editor/features/font/font";
import { Page } from "project-editor/features/page/page";
import { ProjectEditor } from "project-editor/project-editor-interface";
import { Project, findAction } from "project-editor/project/project";
import { Section, getAncestorOfType } from "project-editor/store";
import type { LVGLWidget } from "./widgets";
import type { Assets } from "project-editor/build/assets";
import { isDev, writeTextFile } from "eez-studio-shared/util-electron";
import type { LVGLStyle } from "project-editor/lvgl/style";
import {
    isEnumType,
    getEnumTypeNameFromType
} from "project-editor/features/variable/value-type";
import { MessageType } from "project-editor/core/object";
import {
    getLvglBitmapSourceFile,
    getLvglStylePropName
} from "project-editor/lvgl/lvgl-versions";
import { sourceRootDir } from "eez-studio-shared/util";
import { getSelectorBuildCode } from "project-editor/lvgl/style-helper";

export class LVGLBuild extends Build {
    project: Project;

    styleNames = new Map<string, string>();
    fontNames = new Map<string, string>();
    bitmapNames = new Map<string, string>();

    constructor(public assets: Assets) {
        super();

        this.project = assets.projectStore.project;

        this.buildStyleNames();
        this.buildFontNames();
        this.buildBitmapNames();
    }

    get pages() {
        return this.project._store.lvglIdentifiers.pages;
    }

    get styles() {
        return this.project._store.lvglIdentifiers.styles;
    }

    get fonts() {
        return this.project._store.lvglIdentifiers.fonts;
    }

    get bitmaps() {
        return this.project._store.lvglIdentifiers.bitmaps;
    }

    get isV9() {
        return this.project.settings.general.lvglVersion == "9.0";
    }

    getStylePropName(stylePropName: string) {
        return getLvglStylePropName(this.project, stylePropName);
    }

    buildStyleNames() {
        const names = new Set<string>();

        for (const style of this.styles) {
            let name = getName("", style, NamingConvention.UnderscoreLowerCase);

            // make sure that name is unique
            if (names.has(name)) {
                for (let i = 1; ; i++) {
                    const newName = name + i.toString();
                    if (!names.has(newName)) {
                        name = newName;
                        break;
                    }
                }
            }

            this.styleNames.set(style.objID, name);
            names.add(name);
        }
    }

    buildFontNames() {
        const names = new Set<string>();

        for (const font of this.fonts) {
            let name = getName("", font, NamingConvention.UnderscoreLowerCase);

            // make sure that name is unique
            if (names.has(name)) {
                for (let i = 1; ; i++) {
                    const newName = name + i.toString();
                    if (!names.has(newName)) {
                        name = newName;
                        break;
                    }
                }
            }

            this.fontNames.set(font.objID, name);
            names.add(name);
        }
    }

    buildBitmapNames() {
        const names = new Set<string>();

        for (const bitmap of this.bitmaps) {
            let name = getName(
                "",
                bitmap,
                NamingConvention.UnderscoreLowerCase
            );

            // make sure that name is unique
            if (names.has(name)) {
                for (let i = 1; ; i++) {
                    const newName = name + i.toString();
                    if (!names.has(newName)) {
                        name = newName;
                        break;
                    }
                }
            }

            this.bitmapNames.set(bitmap.objID, name);
            names.add(name);
        }
    }

    getScreenIdentifier(page: Page) {
        return getName("", page, NamingConvention.UnderscoreLowerCase);
    }

    getScreenCreateFunctionName(page: Page) {
        return page.isUsedAsUserWidget
            ? `create_user_widget_${this.getScreenIdentifier(page)}`
            : `create_screen_${this.getScreenIdentifier(page)}`;
    }

    getScreenTickFunctionName(page: Page) {
        return page.isUsedAsUserWidget
            ? `tick_user_widget_${this.getScreenIdentifier(page)}`
            : `tick_screen_${this.getScreenIdentifier(page)}`;
    }

    getImageVariableName(bitmap: Bitmap | string) {
        const IMAGE_PREFIX = "img_";

        if (typeof bitmap == "string") {
            const bitmapobject = this.bitmaps.find(
                bitmapobject => bitmapobject.name == bitmap
            );
            if (bitmapobject) {
                this.assets.markBitmapUsed(bitmapobject);
            }

            return getName(
                IMAGE_PREFIX,
                bitmap,
                NamingConvention.UnderscoreLowerCase
            );
        } else {
            this.assets.markBitmapUsed(bitmap);

            return IMAGE_PREFIX + this.bitmapNames.get(bitmap.objID)!;
        }
    }

    getActionFunctionName(actionName: string) {
        return getName(
            "action_",
            actionName,
            NamingConvention.UnderscoreLowerCase
        );
    }

    getVariableGetterFunctionName(variableName: string) {
        return getName(
            "get_var_",
            variableName,
            NamingConvention.UnderscoreLowerCase
        );
    }

    getVariableSetterFunctionName(variableName: string) {
        return getName(
            "set_var_",
            variableName,
            NamingConvention.UnderscoreLowerCase
        );
    }

    getLvglObjectIdentifierInSourceCode(lvglObject: Page | LVGLWidget) {
        return this.project._store.lvglIdentifiers.getIdentifier(lvglObject)
            .identifier;
    }

    getWidgetObjectIndex(lvglWidget: LVGLWidget) {
        const identifier =
            this.project._store.lvglIdentifiers.getIdentifier(lvglWidget);

        return identifier.index;
    }

    getLvglObjectAccessor(lvglObject: Page | LVGLWidget) {
        const identifier = this.getLvglObjectIdentifierInSourceCode(lvglObject);

        if (lvglObject instanceof ProjectEditor.LVGLWidgetClass) {
            const page = getAncestorOfType(
                lvglObject,
                ProjectEditor.PageClass.classInfo
            ) as Page;

            if (page.isUsedAsUserWidget) {
                return `((lv_obj_t **)&objects)[startWidgetIndex + ${this.getWidgetObjectIndex(
                    lvglObject
                )}]`;
            }
        }

        return `objects.${identifier}`;
    }

    getEventHandlerCallbackName(widget: LVGLWidget) {
        const page = getAncestorOfType(
            widget,
            ProjectEditor.PageClass.classInfo
        ) as Page;
        return `event_handler_cb_${this.getScreenIdentifier(
            page
        )}_${this.getLvglObjectIdentifierInSourceCode(widget)}`;
    }

    getFontVariableName(font: Font) {
        this.assets.markFontUsed(font);
        return "ui_font_" + this.fontNames.get(font.objID)!;
    }

    getAddStyleFunctionName(style: LVGLStyle) {
        return "add_style_" + this.styleNames.get(style.objID)!;
    }

    getRemoveStyleFunctionName(style: LVGLStyle) {
        return "remove_style_" + this.styleNames.get(style.objID)!;
    }

    getInitStyleFunctionName(style: LVGLStyle, part: string, state: string) {
        return (
            "init_style_" +
            this.styleNames.get(style.objID)! +
            "_" +
            part +
            "_" +
            state
        );
    }

    getGetStyleFunctionName(style: LVGLStyle, part: string, state: string) {
        return (
            "get_style_" +
            this.styleNames.get(style.objID)! +
            "_" +
            part +
            "_" +
            state
        );
    }

    async buildScreensDecl() {
        this.startBuild();
        const build = this;

        build.line(`typedef struct _objects_t {`);
        build.indent();

        this.project._store.lvglIdentifiers.identifiersArray
            .get(this.project.pages[0])!
            .forEach((lvglIdentifier, i) => {
                build.line(`lv_obj_t *${lvglIdentifier.identifier};`);
            });

        build.unindent();
        build.line(`} objects_t;`);
        build.line("");
        build.line(`extern objects_t objects;`);

        build.line("");
        build.line(`enum ScreensEnum {`);
        build.indent();
        for (let i = 0; i < this.pages.length; i++) {
            build.line(
                `SCREEN_ID_${this.getScreenIdentifier(
                    this.pages[i]
                ).toUpperCase()} = ${i + 1},`
            );
        }
        build.unindent();
        build.line(`};`);

        for (const page of this.pages) {
            build.line("");
            if (page.isUsedAsUserWidget) {
                if (build.project.projectTypeTraits.hasFlowSupport) {
                    build.line(
                        `void ${this.getScreenCreateFunctionName(
                            page
                        )}(lv_obj_t *parent_obj, void *flowState, int startWidgetIndex);`
                    );
                    build.line(
                        `void ${this.getScreenTickFunctionName(
                            page
                        )}(void *flowState, int startWidgetIndex);`
                    );
                } else {
                    build.line(
                        `void ${this.getScreenCreateFunctionName(
                            page
                        )}(lv_obj_t *parent_obj, int startWidgetIndex);`
                    );
                    build.line(
                        `void ${this.getScreenTickFunctionName(
                            page
                        )}(int startWidgetIndex);`
                    );
                }
            } else {
                build.line(`void ${this.getScreenCreateFunctionName(page)}();`);
                build.line(`void ${this.getScreenTickFunctionName(page)}();`);
            }
        }

        return this.result;
    }

    async buildScreensDef() {
        this.startBuild();
        const build = this;

        build.line(`#include <string.h>`);
        build.line("");

        build.line(`objects_t objects;`);
        build.line(`lv_obj_t *tick_value_change_obj;`);
        build.line("");

        for (const page of this.pages) {
            page._lvglWidgets.forEach(widget => {
                if (widget.eventHandlers.length > 0 || widget.hasEventHandler) {
                    build.line(
                        `static void ${build.getEventHandlerCallbackName(
                            widget
                        )}(lv_event_t *e) {`
                    );
                    build.indent();

                    build.line(`lv_event_code_t event = lv_event_get_code(e);`);

                    if (this.project.projectTypeTraits.hasFlowSupport) {
                        build.line(
                            `void *flowState = lv_event_get_user_data(e);`
                        );
                    }

                    for (const eventHandler of widget.eventHandlers) {
                        if (
                            eventHandler.eventName == "CHECKED" ||
                            eventHandler.eventName == "UNCHECKED"
                        ) {
                            build.line(
                                `lv_obj_t *ta = lv_event_get_target(e);`
                            );
                            break;
                        }
                    }

                    for (const eventHandler of widget.eventHandlers) {
                        if (eventHandler.eventName == "CHECKED") {
                            build.line(
                                `if (event == LV_EVENT_VALUE_CHANGED && lv_obj_has_state(ta, LV_STATE_CHECKED)) {`
                            );
                        } else if (eventHandler.eventName == "UNCHECKED") {
                            build.line(
                                `if (event == LV_EVENT_VALUE_CHANGED && !lv_obj_has_state(ta, LV_STATE_CHECKED)) {`
                            );
                        } else {
                            build.line(
                                `if (event == LV_EVENT_${eventHandler.eventName}) {`
                            );
                        }

                        build.indent();

                        build.line(
                            `e->user_data = (void *)${eventHandler.userData};`
                        );

                        if (eventHandler.handlerType == "action") {
                            const action = findAction(
                                this.project,
                                eventHandler.action
                            );
                            if (action) {
                                if (
                                    action.implementationType == "native" ||
                                    !this.project.projectTypeTraits
                                        .hasFlowSupport
                                ) {
                                    build.line(
                                        `${this.getActionFunctionName(
                                            eventHandler.action
                                        )}(e);`
                                    );
                                } else {
                                    let actionFlowIndex =
                                        build.assets.getFlowIndex(action);
                                    build.line(
                                        `flowPropagateValueLVGLEvent(flowState, -1, ${actionFlowIndex}, e);`
                                    );
                                }
                            }
                        } else {
                            let componentIndex =
                                build.assets.getComponentIndex(widget);
                            const outputIndex =
                                build.assets.getComponentOutputIndex(
                                    widget,
                                    eventHandler.eventName
                                );

                            build.line(
                                `flowPropagateValueLVGLEvent(flowState, ${componentIndex}, ${outputIndex}, e);`
                            );
                        }
                        build.unindent();
                        build.line("}");
                    }

                    if (widget.hasEventHandler) {
                        widget.buildEventHandler(build);
                    }

                    build.unindent();
                    build.line("}");
                    build.line("");
                }
            });
        }

        for (const page of this.pages) {
            if (page.isUsedAsUserWidget) {
                if (build.project.projectTypeTraits.hasFlowSupport) {
                    build.line(
                        `void ${this.getScreenCreateFunctionName(
                            page
                        )}(lv_obj_t *parent_obj, void *flowState, int startWidgetIndex) {`
                    );
                } else {
                    build.line(
                        `void ${this.getScreenCreateFunctionName(
                            page
                        )}(lv_obj_t *parent_obj, int startWidgetIndex) {`
                    );
                }
            } else {
                build.line(
                    `void ${this.getScreenCreateFunctionName(page)}() {`
                );
            }
            build.indent();
            page.lvglBuild(this);
            build.unindent();
            build.line("}");
            build.line("");

            if (page.isUsedAsUserWidget) {
                if (build.project.projectTypeTraits.hasFlowSupport) {
                    build.line(
                        `void ${this.getScreenTickFunctionName(
                            page
                        )}(void *flowState, int startWidgetIndex) {`
                    );
                } else {
                    build.line(
                        `void ${this.getScreenTickFunctionName(
                            page
                        )}(int startWidgetIndex) {`
                    );
                }
            } else {
                build.line(`void ${this.getScreenTickFunctionName(page)}() {`);
            }
            build.indent();
            page.lvglBuildTick(this);
            build.unindent();
            build.line("}");
            build.line("");
        }

        return this.result;
    }

    async buildScreensDeclExt() {
        this.startBuild();
        const build = this;

        build.line("void create_screens();");
        build.line("void tick_screen(int screen_index);");

        return this.result;
    }

    async buildScreensDefExt() {
        this.startBuild();
        const build = this;

        if (
            this.assets.projectStore.projectTypeTraits.hasFlowSupport &&
            this.styles.length > 0
        ) {
            build.line(
                "extern void add_style(lv_obj_t *obj, int32_t styleIndex);"
            );
            build.line(
                "extern void remove_style(lv_obj_t *obj, int32_t styleIndex);"
            );
            build.line("");
        }

        build.line("void create_screens() {");
        build.indent();
        if (
            this.assets.projectStore.projectTypeTraits.hasFlowSupport &&
            this.styles.length > 0
        ) {
            build.line("eez_flow_init_styles(add_style, remove_style);");
            build.line("");
        }
        build.line("lv_disp_t *dispp = lv_disp_get_default();");
        build.line(
            `lv_theme_t *theme = lv_theme_default_init(dispp, lv_palette_main(LV_PALETTE_BLUE), lv_palette_main(LV_PALETTE_RED), ${
                this.project.settings.general.darkTheme ? "true" : "false"
            }, LV_FONT_DEFAULT);`
        );
        build.line("lv_disp_set_theme(dispp, theme);");

        build.line("");

        for (const page of this.project.userPages) {
            if (!page.isUsedAsUserWidget) {
                build.line(`${this.getScreenCreateFunctionName(page)}();`);
            }
        }
        build.unindent();
        build.line("}");

        build.line("");

        build.line("typedef void (*tick_screen_func_t)();");

        build.line("");

        build.line("tick_screen_func_t tick_screen_funcs[] = {");
        build.indent();
        for (const page of this.project.pages) {
            if (page.isUsedAsUserWidget) {
                build.line(`0,`);
            } else {
                build.line(`${this.getScreenTickFunctionName(page)},`);
            }
        }
        build.unindent();
        build.line("};");

        build.text(`
void tick_screen(int screen_index) {
    tick_screen_funcs[screen_index]();
}
`);

        return this.result;
    }

    async buildImagesDecl() {
        this.startBuild();
        const build = this;

        for (const bitmap of this.bitmaps) {
            build.line(
                `extern const lv_img_dsc_t ${this.getImageVariableName(
                    bitmap
                )};`
            );
        }

        build.text(`
#ifndef EXT_IMG_DESC_T
#define EXT_IMG_DESC_T
typedef struct _ext_img_desc_t {
    const char *name;
    const lv_img_dsc_t *img_dsc;
} ext_img_desc_t;
#endif

extern const ext_img_desc_t images[${this.bitmaps.length || 1}];
`);

        return this.result;
    }

    async buildImagesDef() {
        this.startBuild();
        const build = this;

        build.line(
            `const ext_img_desc_t images[${this.bitmaps.length || 1}] = {`
        );
        build.indent();
        if (this.bitmaps.length > 0) {
            for (const bitmap of this.bitmaps) {
                const varName = this.getImageVariableName(bitmap);
                build.line(`{ "${bitmap.name}", &${varName} },`);
            }
        } else {
            build.line(`0`);
        }
        build.unindent();
        build.line(`};`);

        return this.result;
    }

    async buildFontsDecl() {
        this.startBuild();
        const build = this;

        for (const font of this.fonts) {
            build.line(
                `extern const lv_font_t ${this.getFontVariableName(font)};`
            );
        }

        return this.result;
    }

    async buildActionsDecl() {
        this.startBuild();
        const build = this;

        for (const action of this.project.actions) {
            if (
                !this.assets.projectStore.projectTypeTraits.hasFlowSupport ||
                action.implementationType === "native"
            ) {
                build.line(
                    `extern void ${this.getActionFunctionName(
                        action.name
                    )}(lv_event_t * e);`
                );
            }
        }

        return this.result;
    }

    async buildActionsArrayDef() {
        if (!this.project.projectTypeTraits.hasFlowSupport) {
            return "";
        }

        this.startBuild();
        const build = this;

        build.line("ActionExecFunc actions[] = {");
        build.indent();

        let numActions = 0;
        for (const action of this.project.actions) {
            if (
                !this.assets.projectStore.projectTypeTraits.hasFlowSupport ||
                action.implementationType === "native"
            ) {
                build.line(`${this.getActionFunctionName(action.name)},`);
                numActions++;
            }
        }

        if (numActions == 0) {
            build.line("0");
        }

        build.unindent();
        build.line(`};`);

        return this.result;
    }

    async buildVariablesDecl() {
        this.startBuild();
        const build = this;

        for (const variable of this.project.variables.globalVariables) {
            if (
                !this.assets.projectStore.projectTypeTraits.hasFlowSupport ||
                variable.native
            ) {
                let nativeType;

                if (variable.type == "integer") {
                    nativeType = "int32_t ";
                } else if (variable.type == "float") {
                    nativeType = "float ";
                } else if (variable.type == "double") {
                    nativeType = "double ";
                } else if (variable.type == "boolean") {
                    nativeType = "bool ";
                } else if (variable.type == "string") {
                    nativeType = "const char *";
                } else if (isEnumType(variable.type)) {
                    const enumType = getEnumTypeNameFromType(variable.type);
                    nativeType = `${enumType} `;
                } else {
                }

                build.line(
                    `extern ${nativeType}${this.getVariableGetterFunctionName(
                        variable.name
                    )}();`
                );

                build.line(
                    `extern void ${this.getVariableSetterFunctionName(
                        variable.name
                    )}(${nativeType}value);`
                );
            }
        }

        return this.result;
    }

    async buildNativeVarsTableDef() {
        if (!this.project.projectTypeTraits.hasFlowSupport) {
            return "";
        }

        this.startBuild();
        const build = this;

        build.line("native_var_t native_vars[] = {");
        build.indent();

        build.line("{ NATIVE_VAR_TYPE_NONE, 0, 0 },");

        for (const variable of this.project.variables.globalVariables) {
            if (
                !this.assets.projectStore.projectTypeTraits.hasFlowSupport ||
                variable.native
            ) {
                build.line(
                    `{ NATIVE_VAR_TYPE_${
                        isEnumType(variable.type)
                            ? "INTEGER"
                            : variable.type.toUpperCase()
                    }, ${this.getVariableGetterFunctionName(
                        variable.name
                    )}, ${this.getVariableSetterFunctionName(
                        variable.name
                    )} }, `
                );
            }
        }

        build.unindent();
        build.line("};");

        return this.result;
    }

    async buildStylesDef() {
        this.startBuild();
        const build = this;

        for (const lvglStyle of this.styles) {
            build.line("// Style: " + lvglStyle.name);

            const definition = lvglStyle.fullDefinition;
            if (definition) {
                Object.keys(definition).forEach(part => {
                    Object.keys(definition[part]).forEach(state => {
                        // build style get function
                        build.line(
                            `lv_style_t *${this.getGetStyleFunctionName(
                                lvglStyle,
                                part,
                                state
                            )}();`
                        );
                    });
                });
            }

            build.line(
                `void ${this.getAddStyleFunctionName(
                    lvglStyle
                )}(lv_obj_t *obj);`
            );
            build.line(
                `void ${this.getRemoveStyleFunctionName(
                    lvglStyle
                )}(lv_obj_t *obj);`
            );

            build.line("");
        }

        return this.result;
    }

    async buildStylesDecl() {
        this.startBuild();
        const build = this;

        if (this.styles.length > 0) {
            for (const lvglStyle of this.styles) {
                build.line("//");
                build.line("// Style: " + lvglStyle.name);
                build.line("//");
                build.line("");

                const definition = lvglStyle.fullDefinition;
                if (definition) {
                    Object.keys(definition).forEach(part => {
                        Object.keys(definition[part]).forEach(state => {
                            // build style init function
                            build.line(
                                `void ${this.getInitStyleFunctionName(
                                    lvglStyle,
                                    part,
                                    state
                                )}(lv_style_t *style) {`
                            );
                            build.indent();

                            if (
                                lvglStyle.parentStyle?.fullDefinition?.[part]?.[
                                    state
                                ]
                            ) {
                                build.line(
                                    `${this.getInitStyleFunctionName(
                                        lvglStyle.parentStyle,
                                        part,
                                        state
                                    )}(style);`
                                );
                                build.line("");
                            }

                            if (lvglStyle.definition) {
                                lvglStyle.definition.lvglBuildStyle(
                                    build,
                                    part,
                                    state
                                );
                            }

                            build.unindent();
                            build.line("};");
                            build.line("");

                            // build style get function
                            build.line(
                                `lv_style_t *${this.getGetStyleFunctionName(
                                    lvglStyle,
                                    part,
                                    state
                                )}() {`
                            );
                            build.indent();

                            build.line("static lv_style_t *style;");

                            build.line(`if (!style) {`);
                            build.indent();
                            {
                                if (build.isV9) {
                                    build.line(
                                        `style = lv_malloc(sizeof(lv_style_t));`
                                    );
                                } else {
                                    build.line(
                                        `style = lv_mem_alloc(sizeof(lv_style_t));`
                                    );
                                }

                                build.line(`lv_style_init(style);`);

                                build.line(
                                    `${this.getInitStyleFunctionName(
                                        lvglStyle,
                                        part,
                                        state
                                    )}(style);`
                                );
                            }
                            build.unindent();
                            build.line("}");

                            build.line(`return style;`);

                            build.unindent();
                            build.line("};");
                            build.line("");
                        });
                    });
                }

                // build style add function
                build.line(
                    `void ${this.getAddStyleFunctionName(
                        lvglStyle
                    )}(lv_obj_t *obj) {`
                );
                build.indent();

                if (definition) {
                    Object.keys(definition).forEach(part => {
                        Object.keys(definition[part]).forEach(state => {
                            const selectorCode = getSelectorBuildCode(
                                part,
                                state
                            );
                            build.line(
                                `lv_obj_add_style(obj, ${this.getGetStyleFunctionName(
                                    lvglStyle,
                                    part,
                                    state
                                )}(), ${selectorCode});`
                            );
                        });
                    });
                }

                build.unindent();
                build.line("};");
                build.line("");

                // build style remove function
                build.line(
                    `void ${this.getRemoveStyleFunctionName(
                        lvglStyle
                    )}(lv_obj_t *obj) {`
                );
                build.indent();

                if (definition) {
                    Object.keys(definition).forEach(part => {
                        Object.keys(definition[part]).forEach(state => {
                            const selectorCode = getSelectorBuildCode(
                                part,
                                state
                            );
                            build.line(
                                `lv_obj_remove_style(obj, ${this.getGetStyleFunctionName(
                                    lvglStyle,
                                    part,
                                    state
                                )}(), ${selectorCode});`
                            );
                        });
                    });
                }

                build.unindent();
                build.line("};");
                build.line("");
            }

            build.line("//");
            build.line("//");
            build.line("//");
            build.line("");

            build.line("void add_style(lv_obj_t *obj, int32_t styleIndex) {");
            build.indent();
            build.line("typedef void (*AddStyleFunc)(lv_obj_t *obj);");
            build.line("static const AddStyleFunc add_style_funcs[] = {");
            build.indent();
            for (const lvglStyle of this.styles) {
                build.line(`${this.getAddStyleFunctionName(lvglStyle)},`);
            }
            build.unindent();
            build.line("};");
            build.line("add_style_funcs[styleIndex](obj);");
            build.unindent();
            build.line("}");

            build.line("");

            build.line(
                "void remove_style(lv_obj_t *obj, int32_t styleIndex) {"
            );
            build.indent();
            build.line("typedef void (*RemoveStyleFunc)(lv_obj_t *obj);");
            build.line("static const RemoveStyleFunc remove_style_funcs[] = {");
            build.indent();
            for (const lvglStyle of this.styles) {
                build.line(`${this.getRemoveStyleFunctionName(lvglStyle)},`);
            }
            build.unindent();
            build.line("};");
            build.line("remove_style_funcs[styleIndex](obj);");
            build.unindent();
            build.line("}");
        }

        return this.result;
    }

    async buildEezForLvglCheck() {
        if (!this.project.projectTypeTraits.hasFlowSupport) {
            return "";
        }

        this.startBuild();

        const build = this;

        if (this.project.settings.build.generateSourceCodeForEezFramework) {
            build.line(`#include "eez-flow.h"`);
        } else {
            build.line("#if !defined(EEZ_FOR_LVGL)");
            build.line(`#warning "EEZ_FOR_LVGL is not enabled"`);
            build.line(`#define EEZ_FOR_LVGL`);
            build.line("#endif");
        }
        return this.result;
    }

    async copyBitmapFiles() {
        if (!this.project.settings.build.destinationFolder) {
            return;
        }
        for (const bitmap of this.bitmaps) {
            const output = "ui_image_" + this.bitmapNames.get(bitmap.objID)!;

            try {
                await writeTextFile(
                    this.project._store.getAbsoluteFilePath(
                        this.project.settings.build.destinationFolder
                    ) +
                        "/" +
                        output +
                        ".c",
                    await getLvglBitmapSourceFile(
                        bitmap,
                        this.getImageVariableName(bitmap)
                    )
                );
            } catch (err) {
                this.project._store.outputSectionsStore.write(
                    Section.OUTPUT,
                    MessageType.ERROR,
                    `Error genereting bitmap '${output}.c' file: ${err}`
                );
            }
        }
    }

    async copyFontFiles() {
        if (!this.project.settings.build.destinationFolder) {
            return;
        }
        for (const font of this.fonts) {
            if (font.lvglSourceFile) {
                const output = getName(
                    "ui_font_",
                    font.name || "",
                    NamingConvention.UnderscoreLowerCase
                );

                await writeTextFile(
                    this.project._store.getAbsoluteFilePath(
                        this.project.settings.build.destinationFolder
                    ) +
                        "/" +
                        output +
                        ".c",
                    font.lvglSourceFile
                );
            }
        }
    }
}

export async function generateSourceCodeForEezFramework(
    project: Project,
    destinationFolderPath: string,
    isUsingCrypyoSha256: boolean
) {
    try {
        await fs.promises.rm(destinationFolderPath + "/eez-flow.cpp");
    } catch (err) {}

    try {
        await fs.promises.rm(destinationFolderPath + "/eez-flow.h");
    } catch (err) {}

    try {
        await fs.promises.rm(destinationFolderPath + "/eez-flow-lz4.c");
    } catch (err) {}

    try {
        await fs.promises.rm(destinationFolderPath + "/eez-flow-lz4.h");
    } catch (err) {}

    try {
        await fs.promises.rm(destinationFolderPath + "/eez-flow-sha256.c");
    } catch (err) {}

    try {
        await fs.promises.rm(destinationFolderPath + "/eez-flow-sha256.h");
    } catch (err) {}

    if (
        !(
            project.projectTypeTraits.isLVGL &&
            project.projectTypeTraits.hasFlowSupport &&
            project.settings.build.generateSourceCodeForEezFramework
        )
    ) {
        return;
    }

    // post fix structs.h
    try {
        let structs_H = await fs.promises.readFile(
            destinationFolderPath + "/structs.h",
            "utf-8"
        );
        structs_H = structs_H.replace(`#include <eez/flow/flow.h>\n`, "");
        await fs.promises.writeFile(
            destinationFolderPath + "/structs.h",
            structs_H,
            "utf-8"
        );
    } catch (err) {}

    // post fix ui.h
    try {
        let ui_H = await fs.promises.readFile(
            destinationFolderPath + "/ui.h",
            "utf-8"
        );
        ui_H = ui_H.replace(
            `#if defined(EEZ_FOR_LVGL)\n#include <eez/flow/lvgl_api.h>\n#endif\n`,
            ""
        );
        await fs.promises.writeFile(
            destinationFolderPath + "/ui.h",
            ui_H,
            "utf-8"
        );
    } catch (err) {}

    const eezframeworkAmalgamationPath = isDev
        ? resolve(`${sourceRootDir()}/../resources/eez-framework-amalgamation`)
        : process.resourcesPath! + "/eez-framework-amalgamation";

    await fs.promises.cp(
        eezframeworkAmalgamationPath + "/eez-flow.cpp",
        destinationFolderPath + "/eez-flow.cpp"
    );

    await fs.promises.cp(
        eezframeworkAmalgamationPath + "/eez-flow.h",
        destinationFolderPath + "/eez-flow.h"
    );

    let eezH = await fs.promises.readFile(
        destinationFolderPath + "/eez-flow.h",
        "utf-8"
    );

    if (project.settings.build.compressFlowDefinition) {
        await fs.promises.cp(
            eezframeworkAmalgamationPath + "/eez-flow-lz4.c",
            destinationFolderPath + "/eez-flow-lz4.c"
        );

        await fs.promises.cp(
            eezframeworkAmalgamationPath + "/eez-flow-lz4.h",
            destinationFolderPath + "/eez-flow-lz4.h"
        );
    } else {
        eezH = eezH.replace(
            "#define EEZ_FOR_LVGL_LZ4_OPTION 1",
            "#define EEZ_FOR_LVGL_LZ4_OPTION 0"
        );
    }

    if (isUsingCrypyoSha256) {
        await fs.promises.cp(
            eezframeworkAmalgamationPath + "/eez-flow-sha256.c",
            destinationFolderPath + "/eez-flow-sha256.c"
        );

        await fs.promises.cp(
            eezframeworkAmalgamationPath + "/eez-flow-sha256.h",
            destinationFolderPath + "/eez-flow-sha256.h"
        );
    } else {
        eezH = eezH.replace(
            "#define EEZ_FOR_LVGL_SHA256_OPTION 1",
            "#define EEZ_FOR_LVGL_SHA256_OPTION 0"
        );
    }

    eezH = eezH.replace(
        "#define EEZ_FLOW_QUEUE_SIZE 1000",
        "#define EEZ_FLOW_QUEUE_SIZE " +
            project.settings.build.executionQueueSize
    );

    eezH = eezH.replace(
        "#define EEZ_FLOW_EVAL_STACK_SIZE 20",
        "#define EEZ_FLOW_EVAL_STACK_SIZE " +
            project.settings.build.expressionEvaluatorStackSize
    );

    await fs.promises.writeFile(
        destinationFolderPath + "/eez-flow.h",
        eezH,
        "utf-8"
    );

    project._store.outputSectionsStore.write(
        Section.OUTPUT,
        MessageType.INFO,
        `EEZ Flow engine built`
    );
}
