import { TAB, NamingConvention, getName } from "project-editor/build/helper";
import { visitObjects } from "project-editor/core/search";
import type { Bitmap } from "project-editor/features/bitmap/bitmap";
import { Page } from "project-editor/features/page/page";
import { ProjectEditor } from "project-editor/project-editor-interface";
import type { Project } from "project-editor/project/project";
import { getAncestorOfType } from "project-editor/store";
import type { LVGLWidget } from "./widgets";

export class LVGLBuild {
    constructor(public project: Project) {}

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
        this.result = this.result + this.indentation + line + "\n";
    }

    getScreenIdentifier(page: Page) {
        return getName("", page, NamingConvention.UnderscoreLowerCase);
    }

    getScreenStructName(page: Page) {
        return this.getScreenIdentifier(page);
    }

    getScreenCreateFunctionName(page: Page) {
        return `create_${this.getScreenIdentifier(page)}`;
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
                do {
                    index++;
                    identifier = "widget_" + index;
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

    get screenObjFieldName() {
        return "screen_obj";
    }

    async buildScreensDecl() {
        this.result = "";
        this.indentation = "";
        const build = this;

        for (const page of this.project.pages) {
            const screenStructName = build.getScreenStructName(page);
            build.line(`typedef struct ${screenStructName}_t {`);
            build.indent();
            build.line(`lv_obj_t *${this.screenObjFieldName};`);
            build.line("");

            const v = visitObjects(page.components);
            while (true) {
                let visitResult = v.next();
                if (visitResult.done) {
                    break;
                }
                const widget = visitResult.value;
                if (widget instanceof ProjectEditor.LVGLWidgetClass) {
                    if (widget.identifier) {
                        build.line(
                            `lv_obj_t *${getName(
                                "obj_",
                                widget.identifier,
                                NamingConvention.UnderscoreLowerCase
                            )};`
                        );
                    }
                }
            }

            build.unindent();
            build.line(`} ${screenStructName};`);
            build.line(``);
            build.line(
                `${screenStructName} *${this.getScreenCreateFunctionName(
                    page
                )}();`
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
            const v = visitObjects(page.components);
            while (true) {
                let visitResult = v.next();
                if (visitResult.done) {
                    break;
                }
                const widget = visitResult.value;
                if (widget instanceof ProjectEditor.LVGLWidgetClass) {
                    if (widget.eventHandlers.length > 0) {
                        build.line(
                            `static void ${build.getEventHandlerCallbackName(
                                widget
                            )}(lv_event_t *e) {`
                        );
                        build.indent();

                        build.line(
                            `lv_event_code_t event = lv_event_get_code(e);`
                        );

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
                            build.line(
                                `${this.getActionFunctionName(
                                    eventHandler.action
                                )}(e);`
                            );
                            build.unindent();
                            build.line("}");
                        }

                        build.unindent();
                        build.line("}");
                        build.line("");
                    }
                }
            }
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
        }

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
            for (let i = 0; i < bgrPixels.length; i += 4) {
                bgrPixels[i] = bitmapData.pixels[i + 2];
                bgrPixels[i + 2] = bitmapData.pixels[i];
            }

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

        return this.result;
    }

    async buildActionsDecl() {
        this.result = "";
        this.indentation = "";
        const build = this;

        for (const action of this.project.actions) {
            if (action.implementationType === "native") {
                build.line(
                    `extern void ${this.getActionFunctionName(
                        action.name
                    )}(lv_event_t * e);`
                );
            }
        }

        return this.result;
    }
}
