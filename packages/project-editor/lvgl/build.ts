import path from "path";
import { copyFile } from "eez-studio-shared/util-electron";
import { TAB, NamingConvention, getName } from "project-editor/build/helper";
import type { Bitmap } from "project-editor/features/bitmap/bitmap";
import { Page } from "project-editor/features/page/page";
import { ProjectEditor } from "project-editor/project-editor-interface";
import type { Project } from "project-editor/project/project";
import { getAncestorOfType } from "project-editor/store";
import type { LVGLWidget } from "./widgets";
import type { Assets } from "project-editor/build/assets";
import { getComponentName } from "project-editor/flow/editor/ComponentsPalette";

export class LVGLBuild {
    project: Project;

    constructor(public assets: Assets) {
        this.project = assets.projectEditorStore.project;
    }

    result: string;
    indentation: string;

    pageIdentifiers = new Map<
        Page,
        {
            widgetToIdentifier: Map<LVGLWidget, string>;
            widgetIdentifiers: Set<string>;
        }
    >();

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

    getScreenStructName(page: Page) {
        return this.getScreenIdentifier(page) + "_t";
    }

    getScreenCreateFunctionName(page: Page) {
        return `create_screen_${this.getScreenIdentifier(page)}`;
    }

    getScreenTickFunctionName(page: Page) {
        return `tick_screen_${this.getScreenIdentifier(page)}`;
    }

    getImageVariableName(bitmap: Bitmap) {
        return getName("img_", bitmap, NamingConvention.UnderscoreLowerCase);
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

    getWidgetIdentifier(widget: LVGLWidget) {
        let widgetToIdentifier;
        let widgetIdentifiers;

        const page = getAncestorOfType(
            widget,
            ProjectEditor.PageClass.classInfo
        ) as Page;

        const pageIdentifier = this.pageIdentifiers.get(page);
        if (pageIdentifier) {
            widgetToIdentifier = pageIdentifier.widgetToIdentifier;
            widgetIdentifiers = pageIdentifier.widgetIdentifiers;
        } else {
            widgetToIdentifier = new Map<LVGLWidget, string>();
            widgetIdentifiers = new Set<string>();
            this.pageIdentifiers.set(page, {
                widgetToIdentifier,
                widgetIdentifiers
            });
        }

        let identifier = widgetToIdentifier.get(widget);
        if (identifier == undefined) {
            if (widget.identifier) {
                identifier = widget.identifier;
                let index = 0;
                while (widgetIdentifiers.has(identifier)) {
                    index++;
                    identifier = widget.identifier + "_" + index;
                }
            } else {
                let index = 0;
                let prefix = getComponentName(widget.type) + "_";
                do {
                    index++;
                    identifier = prefix + index;
                } while (widgetIdentifiers.has(identifier));
            }
            widgetIdentifiers.add(identifier);
            widgetToIdentifier.set(widget, identifier);
        }

        return getName("", identifier, NamingConvention.UnderscoreLowerCase);
    }

    getWidgetStructFieldName(widget: LVGLWidget) {
        return `obj_${this.getWidgetIdentifier(widget)}`;
    }

    getEventHandlerCallbackName(widget: LVGLWidget) {
        const page = getAncestorOfType(
            widget,
            ProjectEditor.PageClass.classInfo
        ) as Page;
        return `event_handler_cb_${this.getScreenIdentifier(
            page
        )}_${this.getWidgetIdentifier(widget)}`;
    }

    getFontVariableName(fontName: string) {
        return getName(
            "ui_font_",
            fontName,
            NamingConvention.UnderscoreLowerCase
        );
    }

    get screenObjFieldName() {
        return "screen_obj";
    }

    async buildScreensDecl() {
        this.result = "";
        this.indentation = "";
        const build = this;

        for (const page of this.project.pages) {
            const screenStructName = build.getScreenStructName(page);
            build.line(`typedef struct _${screenStructName} {`);
            build.indent();
            build.line(`lv_obj_t *${this.screenObjFieldName};`);
            build.line("");

            page._lvglWidgets.forEach(widget =>
                build.line(
                    `lv_obj_t *${this.getWidgetStructFieldName(widget)};`
                )
            );

            build.unindent();
            build.line(`} ${screenStructName};`);
            build.line(``);
            build.line(
                `${screenStructName} *${this.getScreenCreateFunctionName(
                    page
                )}();`
            );
            build.line(
                `void ${this.getScreenTickFunctionName(
                    page
                )}(${screenStructName} *screen);`
            );
            build.line(``);
        }

        return this.result;
    }

    async buildScreensDef() {
        this.result = "";
        this.indentation = "";
        const build = this;

        for (const page of this.project.pages) {
            page._lvglWidgets.forEach(widget => {
                if (widget.eventHandlers.length > 0 || widget.hasEventHandler) {
                    build.line(
                        `static void ${build.getEventHandlerCallbackName(
                            widget
                        )}(lv_event_t *e) {`
                    );
                    build.indent();

                    build.line(`lv_event_code_t event = lv_event_get_code(e);`);

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
                            build.line(
                                `${this.getActionFunctionName(
                                    eventHandler.action
                                )}(e);`
                            );
                        } else {
                            let flowIndex = build.assets.getFlowIndex(page);
                            let componentIndex =
                                build.assets.getComponentIndex(widget);
                            const outputIndex =
                                build.assets.getComponentOutputIndex(
                                    widget,
                                    eventHandler.trigger
                                );

                            build.line(
                                `flowPropagateValue(${flowIndex}, ${componentIndex}, ${outputIndex});`
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

        for (const page of this.project.pages) {
            const screenStructName = build.getScreenStructName(page);

            build.line(
                `${screenStructName} *${this.getScreenCreateFunctionName(
                    page
                )}() {`
            );
            build.indent();
            page.lvglBuild(this);
            build.unindent();
            build.line("}");
            build.line("");

            build.line(
                `void ${this.getScreenTickFunctionName(
                    page
                )}(${screenStructName} *screen) {`
            );
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

        build.line("typedef lv_obj_t **screen_t;");

        build.line("");

        build.line("enum {");
        build.indent();
        for (const page of this.project.pages) {
            build.line(
                `${getName(
                    "SCREEN_",
                    page,
                    NamingConvention.UnderscoreUpperCase
                )},`
            );
        }
        build.line("NUM_SCREENS");
        build.unindent();
        build.line("};");

        build.line("");

        build.line("screen_t get_screen(int screen_index);");
        build.line("void tick_screen(int screen_index);");

        return this.result;
    }

    async buildScreensDefExt() {
        this.result = "";
        this.indentation = "";
        const build = this;

        build.line("#include <assert.h>");

        build.line("");

        build.line("typedef screen_t (*create_screen_func_t)();");

        build.line("");

        build.line("create_screen_func_t create_screen_funcs[] = {");
        build.indent();
        for (const page of this.project.pages) {
            build.line(
                `(create_screen_func_t)${this.getScreenCreateFunctionName(
                    page
                )},`
            );
        }
        build.unindent();
        build.line("};");

        build.line("");

        build.line("typedef void (*tick_screen_func_t)(screen_t);");

        build.line("");

        build.line("tick_screen_func_t tick_screen_funcs[] = {");
        build.indent();
        for (const page of this.project.pages) {
            build.line(
                `(tick_screen_func_t)${this.getScreenTickFunctionName(page)},`
            );
        }
        build.unindent();
        build.line("};");

        build.line("");

        build.line("screen_t screens[NUM_SCREENS];");

        build.text(`
screen_t get_screen(int screen_index) {
    assert(screen_index >= 0 && screen_index < NUM_SCREENS);
    if (!screens[screen_index]) {
        screens[screen_index] = create_screen_funcs[screen_index]();
    }
    return screens[screen_index];
}

void tick_screen(int screen_index) {
    assert(screen_index >= 0 && screen_index < NUM_SCREENS);
    tick_screen_funcs[screen_index](get_screen(screen_index));
}
`);

        return this.result;
    }

    async buildImagesDecl() {
        this.result = "";
        this.indentation = "";
        const build = this;

        for (const bitmap of this.project.bitmaps) {
            build.line(
                `extern const lv_img_dsc_t ${this.getImageVariableName(
                    bitmap
                )};`
            );
        }

        build.text(`
typedef struct _ext_img_desc_t {
    const char *name;
    const lv_img_dsc_t *img_dsc;
} ext_img_desc_t;

extern const ext_img_desc_t images[${this.project.bitmaps.length}];
`);

        return this.result;
    }

    async buildImagesDef() {
        this.result = "";
        this.indentation = "";
        const build = this;

        for (const bitmap of this.project.bitmaps) {
            const varName = this.getImageVariableName(bitmap);

            const bitmapData = await ProjectEditor.getBitmapData(bitmap);

            const bgrPixels = new Uint8Array(bitmapData.pixels);

            build.line(
                `const LV_ATTRIBUTE_MEM_ALIGN uint8_t ${varName}_data[] = { ${bgrPixels.join(
                    ", "
                )} };`
            );
            build.line(``);
            build.line(`const lv_img_dsc_t ${varName} = {`);
            build.indent();
            build.line(`.header.always_zero = 0,`);
            build.line(`.header.w = ${bitmapData.width},`);
            build.line(`.header.h = ${bitmapData.height},`);
            build.line(`.data_size = sizeof(${varName}_data),`);
            build.line(
                `.header.cf = ${
                    bitmapData.bpp == 32
                        ? "LV_IMG_CF_TRUE_COLOR_ALPHA"
                        : "LV_IMG_CF_TRUE_COLOR"
                },`
            );
            build.line(`.data = ${varName}_data`);
            build.unindent();
            build.line(`};`);
            build.line(``);
        }

        build.line(
            `const ext_img_desc_t images[${this.project.bitmaps.length}] = {`
        );
        build.indent();
        for (const bitmap of this.project.bitmaps) {
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

        for (const font of this.project.fonts) {
            build.line(
                `extern const lv_font_t ${this.getFontVariableName(font.name)};`
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
                !this.assets.projectEditorStore.projectTypeTraits
                    .hasFlowSupport ||
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

    async buildVariablesDecl() {
        this.result = "";
        this.indentation = "";
        const build = this;

        for (const variable of this.project.variables.globalVariables) {
            if (
                !this.assets.projectEditorStore.projectTypeTraits
                    .hasFlowSupport ||
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

    async copyFontFiles() {
        if (!this.project.settings.build.destinationFolder) {
            return;
        }
        for (const font of this.project.fonts) {
            if (font.lvglSourceFilePath) {
                copyFile(
                    this.project._DocumentStore.getAbsoluteFilePath(
                        font.lvglSourceFilePath
                    ),
                    this.project._DocumentStore.getAbsoluteFilePath(
                        this.project.settings.build.destinationFolder
                    ) +
                        "/" +
                        path.basename(font.lvglSourceFilePath)
                );
            }
        }
    }
}
