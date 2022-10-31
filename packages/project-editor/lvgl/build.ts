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

    // auto-generated widget identifiers
    widgetToIdentifier = new Map<
        LVGLWidget,
        { identifier: string; addToStruct: boolean }
    >();
    widgetIdentifiers = new Set<string>();

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

    getLvglObjectIdentifierInSourceCode(
        lvglObject: Page | LVGLWidget,
        addToStruct: boolean
    ) {
        let identifier;

        if (lvglObject instanceof ProjectEditor.PageClass) {
            identifier = lvglObject.name;
        } else {
            if (lvglObject.identifier) {
                identifier = lvglObject.identifier;
            } else {
                let result = this.widgetToIdentifier.get(lvglObject);
                if (!result) {
                    let index = 0;
                    let prefix = getComponentName(lvglObject.type) + "_";
                    do {
                        index++;
                        identifier = prefix + index;
                    } while (this.widgetIdentifiers.has(identifier));

                    this.widgetIdentifiers.add(identifier);
                    result = {
                        identifier,
                        addToStruct
                    };
                    this.widgetToIdentifier.set(lvglObject, result);
                } else {
                    if (addToStruct) {
                        result.addToStruct = addToStruct;
                    }
                }
                identifier = result.identifier;
            }
        }

        return getName("", identifier, NamingConvention.UnderscoreLowerCase);
    }

    isLvglObjectAccessible(lvglWidget: LVGLWidget) {
        if (this.project._lvglIdentifiers.get(lvglWidget.identifier)) {
            return true;
        }
        return this.widgetToIdentifier.get(lvglWidget)?.addToStruct ?? false;
    }

    getLvglObjectAccessor(lvglObject: Page | LVGLWidget) {
        return `objects.${this.getLvglObjectIdentifierInSourceCode(
            lvglObject,
            true
        )}`;
    }

    getEventHandlerCallbackName(widget: LVGLWidget) {
        const page = getAncestorOfType(
            widget,
            ProjectEditor.PageClass.classInfo
        ) as Page;
        return `event_handler_cb_${this.getScreenIdentifier(
            page
        )}_${this.getLvglObjectIdentifierInSourceCode(widget, false)}`;
    }

    getFontVariableName(fontName: string) {
        return getName(
            "ui_font_",
            fontName,
            NamingConvention.UnderscoreLowerCase
        );
    }

    async buildScreensDecl() {
        this.result = "";
        this.indentation = "";
        const build = this;

        build.line(`typedef struct _objects_t {`);
        build.indent();

        const lvglIdentifiers = [...this.project._lvglIdentifiers.values()];
        lvglIdentifiers.sort((a, b) => a.index - b.index);

        lvglIdentifiers.forEach(lvglIdentifier =>
            build.line(
                `lv_obj_t *${this.getLvglObjectIdentifierInSourceCode(
                    lvglIdentifier.object,
                    false
                )};`
            )
        );

        for (const entry of this.widgetToIdentifier) {
            if (entry[1].addToStruct) {
                build.line(
                    `lv_obj_t *${this.getLvglObjectIdentifierInSourceCode(
                        entry[0],
                        false
                    )};`
                );
            }
        }

        build.unindent();
        build.line(`} objects_t;`);
        build.line("");
        build.line(`extern objects_t objects;`);

        for (const page of this.project.pages) {
            build.line("");
            build.line(`void ${this.getScreenCreateFunctionName(page)}();`);
            build.line(`void ${this.getScreenTickFunctionName(page)}();`);
        }

        return this.result;
    }

    async buildScreensDef() {
        this.result = "";
        this.indentation = "";
        const build = this;

        build.line(`objects_t objects;`);
        build.line("");

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
            build.line(`void ${this.getScreenCreateFunctionName(page)}() {`);
            build.indent();
            page.lvglBuild(this);
            build.unindent();
            build.line("}");
            build.line("");

            build.line(`void ${this.getScreenTickFunctionName(page)}() {`);
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
        for (const page of this.project.pages) {
            build.line(`${this.getScreenCreateFunctionName(page)}();`);
        }
        build.unindent();
        build.line("}");

        build.line("");

        build.line("typedef void (*tick_screen_func_t)();");

        build.line("");

        build.line("tick_screen_func_t tick_screen_funcs[] = {");
        build.indent();
        for (const page of this.project.pages) {
            build.line(`${this.getScreenTickFunctionName(page)},`);
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
