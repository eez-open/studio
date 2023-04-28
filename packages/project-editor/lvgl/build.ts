import { TAB, NamingConvention, getName } from "project-editor/build/helper";
import type { Bitmap } from "project-editor/features/bitmap/bitmap";
import type { Font } from "project-editor/features/font/font";
import { Page } from "project-editor/features/page/page";
import { ProjectEditor } from "project-editor/project-editor-interface";
import { Project, findAction } from "project-editor/project/project";
import { getAncestorOfType } from "project-editor/store";
import type { LVGLWidget } from "./widgets";
import type { Assets } from "project-editor/build/assets";
import { writeTextFile } from "eez-studio-shared/util-electron";
import { getLvglBitmapSourceFile } from "project-editor/lvgl/bitmap";
import type { LVGLStyle } from "project-editor/lvgl/style";

export class LVGLBuild {
    project: Project;

    pages: Page[];

    styles: LVGLStyle[];
    styleNames = new Map<string, string>();

    fonts: Font[];
    fontNames = new Map<string, string>();

    bitmaps: Bitmap[];
    bitmapNames = new Map<string, string>();

    result: string;
    indentation: string;

    constructor(public assets: Assets) {
        this.project = assets.projectStore.project;

        this.enumPages();

        this.enumStyles();
        this.buildStyleNames();

        this.enumFonts();
        this.buildFontNames();

        this.enumBitmaps();
        this.buildBitmapNames();
    }

    enumPages() {
        const pages: Page[] = [];

        for (const project of this.project._store.openProjectsManager
            .projects) {
            pages.push(...project.pages);
        }

        this.pages = pages;
    }

    enumStyles() {
        const styles: LVGLStyle[] = [];

        styles.push(...this.project.lvglStyles.styles);

        for (const project of this.project._store.openProjectsManager
            .projects) {
            styles.push(...project.lvglStyles.styles);
        }

        this.styles = styles;
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

    enumFonts() {
        const fonts: Font[] = [];

        for (const project of this.project._store.openProjectsManager
            .projects) {
            fonts.push(...project.fonts);
        }

        this.fonts = fonts;
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

    enumBitmaps() {
        const bitmaps: Bitmap[] = [];

        for (const project of this.project._store.openProjectsManager
            .projects) {
            bitmaps.push(...project.bitmaps);
        }

        this.bitmaps = bitmaps;
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

    indent() {
        this.indentation += TAB;
    }

    unindent() {
        this.indentation = this.indentation.substring(
            0,
            this.indentation.length - TAB.length
        );
    }

    line(line: string) {
        this.result += this.indentation + line + "\n";
    }

    text(text: string) {
        this.result += text;
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

    getImageVariableName(bitmap: Bitmap) {
        return "img_" + this.bitmapNames.get(bitmap.objID)!;
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
        return "ui_font_" + this.fontNames.get(font.objID)!;
    }

    getStyleFunctionName(style: LVGLStyle) {
        return "apply_style_" + this.styleNames.get(style.objID)!;
    }

    async buildScreensDecl() {
        this.result = "";
        this.indentation = "";
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

        for (const page of this.pages) {
            build.line("");
            if (page.isUsedAsUserWidget) {
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
                build.line(`void ${this.getScreenCreateFunctionName(page)}();`);
                build.line(`void ${this.getScreenTickFunctionName(page)}();`);
            }
        }

        return this.result;
    }

    async buildScreensDef() {
        this.result = "";
        this.indentation = "";
        const build = this;

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

                    build.line(`void *flowState = e->user_data;`);

                    for (const eventHandler of widget.eventHandlers) {
                        if (
                            eventHandler.trigger == "CHECKED" ||
                            eventHandler.trigger == "UNCHECKED"
                        ) {
                            build.line(
                                `lv_obj_t *ta = lv_event_get_target(e);`
                            );
                            break;
                        }
                    }

                    for (const eventHandler of widget.eventHandlers) {
                        if (eventHandler.trigger == "CHECKED") {
                            build.line(
                                `if (event == LV_EVENT_VALUE_CHANGED && lv_obj_has_state(ta, LV_STATE_CHECKED)) {`
                            );
                        } else if (eventHandler.trigger == "UNCHECKED") {
                            build.line(
                                `if (event == LV_EVENT_VALUE_CHANGED && !lv_obj_has_state(ta, LV_STATE_CHECKED)) {`
                            );
                        } else {
                            build.line(
                                `if (event == LV_EVENT_${eventHandler.trigger}) {`
                            );
                        }

                        build.indent();
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
                                        `flowPropagateValue(flowState, -1, ${actionFlowIndex});`
                                    );
                                }
                            }
                        } else {
                            let componentIndex =
                                build.assets.getComponentIndex(widget);
                            const outputIndex =
                                build.assets.getComponentOutputIndex(
                                    widget,
                                    eventHandler.trigger
                                );
                            build.line(
                                `flowPropagateValue(flowState, ${componentIndex}, ${outputIndex});`
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
                build.line(
                    `void ${this.getScreenCreateFunctionName(
                        page
                    )}(lv_obj_t *parent_obj, void *flowState, int startWidgetIndex) {`
                );
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
                build.line(
                    `void ${this.getScreenTickFunctionName(
                        page
                    )}(void *flowState, int startWidgetIndex) {`
                );
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
        this.result = "";
        this.indentation = "";
        const build = this;

        build.line("void create_screens();");
        build.line("void tick_screen(int screen_index);");

        return this.result;
    }

    async buildScreensDefExt() {
        this.result = "";
        this.indentation = "";
        const build = this;

        build.line("void create_screens() {");
        build.indent();
        build.line("lv_disp_t *dispp = lv_disp_get_default();");
        build.line(
            "lv_theme_t *theme = lv_theme_default_init(dispp, lv_palette_main(LV_PALETTE_BLUE), lv_palette_main(LV_PALETTE_RED), false, LV_FONT_DEFAULT);"
        );
        build.line("lv_disp_set_theme(dispp, theme);");

        build.line("");

        for (const page of this.project.pages) {
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
        this.result = "";
        this.indentation = "";
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

extern const ext_img_desc_t images[${this.bitmaps.length}];
`);

        return this.result;
    }

    async buildImagesDef() {
        this.result = "";
        this.indentation = "";
        const build = this;

        build.line(`const ext_img_desc_t images[${this.bitmaps.length}] = {`);
        build.indent();
        for (const bitmap of this.bitmaps) {
            const varName = this.getImageVariableName(bitmap);
            build.line(`{ "${bitmap.name}", &${varName} },`);
        }
        build.unindent();
        build.line(`};`);

        return this.result;
    }

    async buildFontsDecl() {
        this.result = "";
        this.indentation = "";
        const build = this;

        for (const font of this.fonts) {
            build.line(
                `extern const lv_font_t ${this.getFontVariableName(font)};`
            );
        }

        return this.result;
    }

    async buildActionsDecl() {
        this.result = "";
        this.indentation = "";
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
        this.result = "";
        this.indentation = "";
        const build = this;

        build.line("ActionExecFunc actions[] = {");
        build.indent();

        for (const action of this.project.actions) {
            if (
                !this.assets.projectStore.projectTypeTraits.hasFlowSupport ||
                action.implementationType === "native"
            ) {
                build.line(`${this.getActionFunctionName(action.name)},`);
            }
        }

        build.unindent();
        build.line(`};`);

        return this.result;
    }

    async buildVariablesDecl() {
        this.result = "";
        this.indentation = "";
        const build = this;

        for (const variable of this.project.variables.globalVariables) {
            if (
                !this.assets.projectStore.projectTypeTraits.hasFlowSupport ||
                variable.native
            ) {
                let type;
                if (variable.type == "integer") {
                    type = "int32_t ";
                } else if (variable.type == "float") {
                    type = "float ";
                } else if (variable.type == "double") {
                    type = "double ";
                } else if (variable.type == "boolean") {
                    type = "bool ";
                } else if (variable.type == "string") {
                    type = "const char *";
                } else {
                    type = "void *";
                }

                build.line(
                    `extern ${type}${this.getVariableGetterFunctionName(
                        variable.name
                    )}();`
                );

                build.line(
                    `extern void ${this.getVariableSetterFunctionName(
                        variable.name
                    )}(${type}value);`
                );
            }
        }

        return this.result;
    }

    async buildNativeVarsTableDef() {
        this.result = "";
        this.indentation = "";
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
                    `{ NATIVE_VAR_TYPE_${variable.type.toUpperCase()}, ${this.getVariableGetterFunctionName(
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
        this.result = "";
        this.indentation = "";
        const build = this;

        for (const lvglStyle of this.styles) {
            build.line(
                `extern void ${this.getStyleFunctionName(
                    lvglStyle
                )}(lv_obj_t *obj);`
            );
        }

        return this.result;
    }

    async buildStylesDecl() {
        this.result = "";
        this.indentation = "";
        const build = this;

        for (const lvglStyle of this.styles) {
            build.line(
                `void ${this.getStyleFunctionName(lvglStyle)}(lv_obj_t *obj) {`
            );
            build.indent();

            lvglStyle.definition.lvglBuild(build);

            build.unindent();
            build.line("};");
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
                console.error(err);
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
