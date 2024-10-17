import fs from "fs";
import { resolve } from "path";
import {
    NamingConvention,
    getName,
    Build,
    USER_WIDGET_IDENTIFIER_SEPARATOR
} from "project-editor/build/helper";
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
import { IEezObject, MessageType } from "project-editor/core/object";
import {
    getLvglBitmapSourceFile,
    getLvglStylePropName
} from "project-editor/lvgl/lvgl-versions";
import { sourceRootDir } from "eez-studio-shared/util";
import { getSelectorBuildCode } from "project-editor/lvgl/style-helper";
import type { LVGLGroup } from "./groups";
import { showBuildImageInfoDialog } from "./build-image-info-dialog";
import tinycolor from "tinycolor2";
import { GENERATED_NAME_PREFIX } from "./identifiers";

interface Identifiers {
    identifiers: string[];
    widgetToIdentifier: Map<LVGLWidget, string>;
    widgetToAccessor: Map<LVGLWidget, string>;
    widgetToIndex: Map<LVGLWidget, number>;
}

export class LVGLBuild extends Build {
    project: Project;

    styleNames = new Map<string, string>();
    fontNames = new Map<string, string>();
    bitmapNames = new Map<string, string>();

    updateColorCallbacks: (() => void)[] = [];

    isFirstPass: boolean;

    buildObjectsAccessibleFromSourceCode: {
        fromPage: LVGLWidget[];
        fromUserWidgets: Map<Page, LVGLWidget[]>;
    } = {
        fromPage: [], // all pages share the same Set
        fromUserWidgets: new Map() // different Set for each user widget
    };

    lvglObjectIdentifiers: {
        fromPage: Identifiers;
        fromUserWidgets: Map<Page, Identifiers>;
    } = {
        fromPage: {
            identifiers: [],
            widgetToIdentifier: new Map(),
            widgetToAccessor: new Map(),
            widgetToIndex: new Map()
        },
        fromUserWidgets: new Map()
    };

    fileStaticVars: {
        id: string;
        decl: string;
        varName: string;
    }[] = [];

    constructor(public assets: Assets) {
        super();

        this.project = assets.projectStore.project;

        this.buildStyleNames();
        this.buildFontNames();
        this.buildBitmapNames();
    }

    async firtsPassStart() {
        // PASS 1 (find out which LVGL objects are accessible through global objects structure)
        this.isFirstPass = true;

        for (const page of this.pages) {
            if (!page.isUsedAsUserWidget) {
                this.markObjectAccessibleFromSourceCode(page.lvglScreenWidget!);
            }
        }
    }

    async firstPassFinish() {
        await this.buildScreensDef();
        await this.buildStylesDef();

        this.finalizeObjectAccessibleFromSourceCodeTable();
        this.isFirstPass = false;
        this.updateColorCallbacks = [];
    }

    markObjectAccessibleFromSourceCode(widget: LVGLWidget) {
        const page = getAncestorOfType(
            widget,
            ProjectEditor.PageClass.classInfo
        ) as Page;

        if (page.isUsedAsUserWidget) {
            let widgets =
                this.buildObjectsAccessibleFromSourceCode.fromUserWidgets.get(
                    page
                );

            if (!widgets) {
                widgets = [];
                this.buildObjectsAccessibleFromSourceCode.fromUserWidgets.set(
                    page,
                    widgets
                );
            }

            if (!widgets.includes(widget)) {
                widgets.push(widget);
            }
        } else {
            if (
                !this.buildObjectsAccessibleFromSourceCode.fromPage.includes(
                    widget
                )
            ) {
                this.buildObjectsAccessibleFromSourceCode.fromPage.push(widget);
            }
        }
    }

    finalizeObjectAccessibleFromSourceCodeTable() {
        let genIndex = 0;

        function generateUniqueObjectName() {
            return GENERATED_NAME_PREFIX + genIndex++;
        }

        function addPageIdentifiers(
            widgets: LVGLWidget[],
            pageIdentifiers: Identifiers,
            prefix: string,
            isUserWidget: boolean
        ) {
            let startIndex = isUserWidget
                ? pageIdentifiers.identifiers.length
                : 0;

            for (const widget of widgets) {
                const identifier = widget.identifier
                    ? getName(
                          "",
                          widget.identifier,
                          NamingConvention.UnderscoreLowerCase
                      )
                    : generateUniqueObjectName();

                pageIdentifiers.widgetToIdentifier.set(
                    widget,
                    prefix + identifier
                );

                pageIdentifiers.widgetToAccessor.set(
                    widget,
                    isUserWidget
                        ? `((lv_obj_t **)&objects)[startWidgetIndex + ${
                              pageIdentifiers.identifiers.length - startIndex
                          }]`
                        : `objects.${prefix + identifier}`
                );

                pageIdentifiers.widgetToIndex.set(
                    widget,
                    pageIdentifiers.identifiers.length - startIndex
                );

                pageIdentifiers.identifiers.push(prefix + identifier);

                if (widget instanceof ProjectEditor.LVGLUserWidgetWidgetClass) {
                    const page = widget.userWidgetPage;
                    if (page) {
                        addIdentifiersForUserWidget(
                            prefix +
                                identifier +
                                USER_WIDGET_IDENTIFIER_SEPARATOR,
                            page,
                            pageIdentifiers
                        );
                    }
                }
            }
        }

        const addIdentifiersForUserWidget = (
            prefix: string,
            page: Page,
            pageIdentifiers: Identifiers
        ) => {
            let savedGenIndex = genIndex;
            genIndex = 0;

            const widgets =
                this.buildObjectsAccessibleFromSourceCode.fromUserWidgets.get(
                    page
                );
            if (widgets) {
                addPageIdentifiers(widgets, pageIdentifiers, prefix, true);
            }

            genIndex = savedGenIndex;
        };

        for (const page of this.pages) {
            if (!page.isUsedAsUserWidget) {
                const identifier = getName(
                    "",
                    page.name,
                    NamingConvention.UnderscoreLowerCase
                );

                this.lvglObjectIdentifiers.fromPage.widgetToIdentifier.set(
                    page.lvglScreenWidget!,
                    identifier
                );

                this.lvglObjectIdentifiers.fromPage.widgetToAccessor.set(
                    page.lvglScreenWidget!,
                    `objects.${identifier}`
                );

                this.lvglObjectIdentifiers.fromPage.widgetToIndex.set(
                    page.lvglScreenWidget!,
                    this.lvglObjectIdentifiers.fromPage.identifiers.length
                );

                this.lvglObjectIdentifiers.fromPage.identifiers.push(
                    identifier
                );
            } else {
                const widgets =
                    this.buildObjectsAccessibleFromSourceCode.fromUserWidgets.get(
                        page
                    ) ?? [];

                let pageIdentifiers: Identifiers = {
                    identifiers: [],
                    widgetToIdentifier: new Map(),
                    widgetToAccessor: new Map(),
                    widgetToIndex: new Map()
                };

                addPageIdentifiers(widgets, pageIdentifiers, "", true);

                this.lvglObjectIdentifiers.fromUserWidgets.set(
                    page,
                    pageIdentifiers
                );
            }
        }

        genIndex = 0;

        const widgets =
            this.buildObjectsAccessibleFromSourceCode.fromPage.filter(
                widget =>
                    !this.lvglObjectIdentifiers.fromPage.widgetToIdentifier.get(
                        widget
                    )
            );

        addPageIdentifiers(
            widgets,
            this.lvglObjectIdentifiers.fromPage,
            "",
            false
        );
    }

    isAccessibleFromSourceCode(widget: LVGLWidget) {
        if (widget.identifier) {
            return true;
        }

        let page = getAncestorOfType(
            widget,
            ProjectEditor.PageClass.classInfo
        ) as Page;

        if (page.isUsedAsUserWidget) {
            return (
                this.buildObjectsAccessibleFromSourceCode.fromUserWidgets
                    .get(page)
                    ?.includes(widget) ?? false
            );
        }

        return this.buildObjectsAccessibleFromSourceCode.fromPage.includes(
            widget
        );
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

    getPageIdentifiers(object: IEezObject) {
        const flow = getAncestorOfType(
            object,
            ProjectEditor.FlowClass.classInfo
        );
        if (
            flow instanceof ProjectEditor.PageClass &&
            flow.isUsedAsUserWidget
        ) {
            const pageIdentifiers =
                this.lvglObjectIdentifiers.fromUserWidgets.get(flow);
            if (!pageIdentifiers) {
                this.assets.projectStore.outputSectionsStore.write(
                    Section.OUTPUT,
                    MessageType.ERROR,
                    "Page identifiers not found",
                    object
                );
            }
            return pageIdentifiers;
        }
        return this.lvglObjectIdentifiers.fromPage;
    }

    getLvglObjectIdentifierInSourceCode(widget: LVGLWidget) {
        if (this.isFirstPass) {
            this.markObjectAccessibleFromSourceCode(widget);
            return "";
        }

        const pageIdentifiers = this.getPageIdentifiers(widget);
        if (!pageIdentifiers) {
            return "";
        }

        const identifier = pageIdentifiers.widgetToIdentifier.get(widget);
        if (identifier == undefined) {
            this.assets.projectStore.outputSectionsStore.write(
                Section.OUTPUT,
                MessageType.ERROR,
                `Widget identifier not found`,
                widget
            );
            return "";
        }

        return identifier;
    }

    getWidgetObjectIndex(widget: LVGLWidget) {
        if (this.isFirstPass) {
            this.markObjectAccessibleFromSourceCode(widget);
            return 0;
        }

        const pageIdentifiers = this.getPageIdentifiers(widget);
        if (!pageIdentifiers) {
            return 0;
        }

        const index = pageIdentifiers.widgetToIndex.get(widget);

        if (index == undefined) {
            this.assets.projectStore.outputSectionsStore.write(
                Section.OUTPUT,
                MessageType.ERROR,
                `Widget index not found`,
                widget
            );
            return 0;
        }

        return index;
    }

    getWidgetObjectIndexByName(fromObject: IEezObject, objectName: string) {
        if (this.isFirstPass) {
            return 0;
        }

        const pageIdentifiers = this.getPageIdentifiers(fromObject);
        if (!pageIdentifiers) {
            return 0;
        }
        const index = pageIdentifiers.identifiers.indexOf(objectName);

        if (index == -1) {
            if (!this.isFirstPass) {
                this.assets.projectStore.outputSectionsStore.write(
                    Section.OUTPUT,
                    MessageType.ERROR,
                    `Widget index not found for "${objectName}"`,
                    fromObject
                );
                return 0;
            }
        }

        return index;
    }

    getLvglObjectAccessor(widget: LVGLWidget) {
        if (this.isFirstPass) {
            this.markObjectAccessibleFromSourceCode(widget);
            return "";
        }

        const pageIdentifiers = this.getPageIdentifiers(widget);
        if (!pageIdentifiers) {
            return 0;
        }

        const accessor = pageIdentifiers.widgetToAccessor.get(widget);
        if (accessor == undefined) {
            this.assets.projectStore.outputSectionsStore.write(
                Section.OUTPUT,
                MessageType.ERROR,
                `Widget accessor not found`,
                widget
            );
            return "";
        }

        return accessor;
    }

    getLvglWidgetAccessorInEventHandler(widgetPath: LVGLWidget[]) {
        return (
            "objects." +
            widgetPath
                .map(widget => this.getLvglObjectIdentifierInSourceCode(widget))
                .join(USER_WIDGET_IDENTIFIER_SEPARATOR)
        );
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

    getCheckedEventHandlerCallbackName(widget: LVGLWidget) {
        const page = getAncestorOfType(
            widget,
            ProjectEditor.PageClass.classInfo
        ) as Page;
        return `event_handler_checked_cb_${this.getScreenIdentifier(
            page
        )}_${this.getLvglObjectIdentifierInSourceCode(widget)}`;
    }

    getUncheckedEventHandlerCallbackName(widget: LVGLWidget) {
        const page = getAncestorOfType(
            widget,
            ProjectEditor.PageClass.classInfo
        ) as Page;
        return `event_handler_unchecked_cb_${this.getScreenIdentifier(
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
            (state == "CHECKED|PRESSED" ? "CHECKED_PRESSED" : state)
        );
    }

    getGetStyleFunctionName(style: LVGLStyle, part: string, state: string) {
        return (
            "get_style_" +
            this.styleNames.get(style.objID)! +
            "_" +
            part +
            "_" +
            (state == "CHECKED|PRESSED" ? "CHECKED_PRESSED" : state)
        );
    }

    getGroupVariableName(group: LVGLGroup) {
        return `groups.${group.name}`;
    }

    getColorAccessor(color: string, themeIndex: string) {
        let colorValue;
        if (color.startsWith("#")) {
            colorValue = color;
        } else {
            const colorIndex = this.project.colorToIndexMap.get(color);
            if (colorIndex != undefined) {
                return {
                    colorAccessor: `theme_colors[${themeIndex}][${colorIndex}]`,
                    fromTheme: true
                };
            }
            colorValue = color;
        }

        return {
            colorAccessor: this.getColorHexStr(colorValue),
            fromTheme: false
        };
    }

    getColorHexStr(colorValue: string) {
        const rgb = tinycolor(colorValue).toRgb();

        // result is in BGR format
        let colorNum =
            (rgb.b << 0) | (rgb.g << 8) | (rgb.r << 16) | (255 << 24);

        // signed to unsigned
        colorNum = colorNum >>> 0;

        return "0x" + colorNum.toString(16).padStart(8, "0");
    }

    buildColor<T>(
        color: string,
        getParams: () => T,
        callback: (color: string, params: T) => void,
        updateCallback: (color: string, params: T) => void
    ) {
        const { colorAccessor, fromTheme } = this.getColorAccessor(color, "0");
        callback(colorAccessor, getParams());

        if (!this.isFirstPass && fromTheme) {
            this.updateColorCallbacks.push(() => {
                const { colorAccessor } = this.getColorAccessor(
                    color,
                    "theme_index"
                );
                updateCallback(colorAccessor, getParams());
            });
        }
    }

    buildColor2<T>(
        color1: string,
        color2: string,
        getParams: () => T,
        callback: (color1: string, color2: string, params: T) => void,
        updateCallback: (color1: string, color2: string, params: T) => void
    ) {
        const { colorAccessor: color1Accessor, fromTheme: color1FromTheme } =
            this.getColorAccessor(color1, "0");

        const { colorAccessor: color2Accessor, fromTheme: color2FromTheme } =
            this.getColorAccessor(color2, "0");

        callback(color1Accessor, color2Accessor, getParams());

        if (!this.isFirstPass && (color1FromTheme || color2FromTheme)) {
            this.updateColorCallbacks.push(() => {
                const { colorAccessor: color1Accessor } = this.getColorAccessor(
                    color1,
                    "theme_index"
                );
                const { colorAccessor: color2Accessor } = this.getColorAccessor(
                    color2,
                    "theme_index"
                );
                updateCallback(color1Accessor, color2Accessor, getParams());
            });
        }
    }

    genFileStaticVar(id: string, type: string, prefixName: string) {
        let staticVar = this.fileStaticVars.find(
            fileStaticVar => fileStaticVar.id == id
        );
        if (!staticVar) {
            const varName = prefixName + this.fileStaticVars.length;
            staticVar = {
                id,
                decl: `static ${type} ${varName};`,
                varName
            };
            this.fileStaticVars.push(staticVar);
        }
        return staticVar.varName;
    }

    assingToFileStaticVar(varName: string, value: string) {
        this.line(`${varName} = ${value};`);
    }

    async buildScreensDecl() {
        this.startBuild();
        const build = this;

        // groups
        if (this.project.lvglGroups.groups.length > 0) {
            build.line(`typedef struct _groups_t {`);
            build.indent();

            this.project.lvglGroups.groups.forEach(group => {
                build.line(`lv_group_t *${group.name};`);
            });

            build.unindent();
            build.line(`} groups_t;`);
            build.line("");
            build.line(`extern groups_t groups;`);
            build.line("");
            build.line(`void ui_create_groups();`);
            build.line("");
        }

        // objects
        build.line(`typedef struct _objects_t {`);
        build.indent();

        this.lvglObjectIdentifiers.fromPage.identifiers.forEach(
            (identifier, i) => {
                build.line(`lv_obj_t *${identifier};`);
            }
        );

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

        if (this.updateColorCallbacks.length > 0) {
            build.line("");
            build.line(`enum Themes {`);
            build.indent();
            this.project.themes.forEach(theme => {
                build.line(
                    `THEME_ID_${getName(
                        "",
                        theme.name,
                        NamingConvention.UnderscoreUpperCase
                    )},`
                );
            });
            build.unindent();
            build.line(`};`);
            build.line(`enum Colors {`);
            build.indent();
            this.project.colors.forEach(color => {
                build.line(
                    `COLOR_ID_${getName(
                        "",
                        color.name,
                        NamingConvention.UnderscoreUpperCase
                    )},`
                );
            });
            build.unindent();
            build.line(`};`);
            build.line("void change_color_theme(uint32_t themeIndex);");
            build.line(
                `extern uint32_t theme_colors[${this.project.themes.length}][${this.project.colors.length}];`
            );
        }

        return this.result;
    }

    async buildScreensDef() {
        this.startBuild();
        const build = this;

        build.line(`#include <string.h>`);
        build.line("");

        if (this.project.lvglGroups.groups.length > 0) {
            build.line(`groups_t groups;`);
            build.line("static bool groups_created = false;");
            build.line("");
        }

        build.line(`objects_t objects;`);
        build.line(`lv_obj_t *tick_value_change_obj;`);
        build.line("");

        if (this.fileStaticVars.length > 0) {
            this.fileStaticVars.forEach(fileStaticVar =>
                build.line(fileStaticVar.decl)
            );
            build.line("");
        }

        if (build.assets.projectStore.projectTypeTraits.hasFlowSupport) {
            for (const page of this.pages) {
                page._lvglWidgets.forEach(widget => {
                    if (
                        widget.eventHandlers.length > 0 ||
                        widget.hasEventHandler
                    ) {
                        build.line(
                            `static void ${build.getEventHandlerCallbackName(
                                widget
                            )}(lv_event_t *e) {`
                        );
                        build.indent();

                        build.line(
                            `lv_event_code_t event = lv_event_get_code(e);`
                        );

                        build.line(
                            `void *flowState = lv_event_get_user_data(e);`
                        );

                        build.line("");

                        if (widget.hasEventHandler) {
                            widget.buildEventHandler(build);
                        }

                        if (
                            widget.eventHandlers.length > 0 &&
                            widget.hasEventHandler
                        ) {
                            build.line("");
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
                                    if (action.implementationType == "native") {
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

                        build.unindent();
                        build.line("}");
                        build.line("");
                    }
                });
            }
        } else {
            for (const page of this.pages) {
                page._lvglWidgets.forEach(widget => {
                    for (const eventHandler of widget.eventHandlers) {
                        if (eventHandler.eventName == "CHECKED") {
                            build.line(
                                `static void ${build.getCheckedEventHandlerCallbackName(
                                    widget
                                )}(lv_event_t *e) {`
                            );
                            build.indent();

                            build.line(
                                `lv_obj_t *ta = lv_event_get_target(e);`
                            );

                            build.line(
                                `if (lv_obj_has_state(ta, LV_STATE_CHECKED)) {`
                            );
                            build.indent();

                            const action = findAction(
                                this.project,
                                eventHandler.action
                            );
                            if (action) {
                                build.line(
                                    `${this.getActionFunctionName(
                                        eventHandler.action
                                    )}(e);`
                                );
                            }

                            build.unindent();
                            build.line("}");

                            build.unindent();
                            build.line("}");
                            build.line("");
                        } else if (eventHandler.eventName == "UNCHECKED") {
                            build.line(
                                `static void ${build.getUncheckedEventHandlerCallbackName(
                                    widget
                                )}(lv_event_t *e) {`
                            );
                            build.indent();

                            build.line(
                                `lv_obj_t *ta = lv_event_get_target(e);`
                            );

                            build.line(
                                `if (!lv_obj_has_state(ta, LV_STATE_CHECKED)) {`
                            );
                            build.indent();

                            const action = findAction(
                                this.project,
                                eventHandler.action
                            );
                            if (action) {
                                build.line(
                                    `${this.getActionFunctionName(
                                        eventHandler.action
                                    )}(e);`
                                );
                            }

                            build.unindent();
                            build.line("}");

                            build.unindent();
                            build.line("}");
                            build.line("");
                        }
                    }

                    if (widget.hasEventHandler) {
                        build.line(
                            `static void ${build.getEventHandlerCallbackName(
                                widget
                            )}(lv_event_t *e) {`
                        );
                        build.indent();

                        build.line(
                            `lv_event_code_t event = lv_event_get_code(e);`
                        );

                        widget.buildEventHandler(build);

                        build.unindent();
                        build.line("}");
                        build.line("");
                    }
                });
            }
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

        if (this.updateColorCallbacks.length > 0) {
            build.line(`void change_color_theme(uint32_t theme_index) {`);
            build.indent();
            this.updateColorCallbacks.forEach((callback, i) => {
                callback();
                build.line("");
            });

            build.pages
                .filter(page => !page.isUsedAsUserWidget)
                .forEach(page =>
                    build.line(
                        `lv_obj_invalidate(objects.${this.getScreenIdentifier(
                            page
                        )});`
                    )
                );

            build.unindent();
            build.line("}");
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

        //
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

        //
        if (this.project.lvglGroups.groups.length > 0) {
            build.line("void ui_create_groups() {");
            build.indent();

            build.line("if (!groups_created) {");
            build.indent();

            this.project.lvglGroups.groups.forEach(group => {
                build.line(
                    `${build.getGroupVariableName(group)} = lv_group_create();`
                );
            });
            if (this.assets.projectStore.projectTypeTraits.hasFlowSupport) {
                build.line(
                    "eez_flow_init_groups((lv_group_t **)&groups, sizeof(groups) / sizeof(lv_group_t *));"
                );
            }

            build.line("groups_created = true;");

            build.unindent();
            build.line("}");

            build.unindent();
            build.line("}");

            build.line("");
        }

        if (this.assets.projectStore.projectTypeTraits.hasFlowSupport) {
            if (this.pages.length > 0) {
                build.line(
                    `static const char *screen_names[] = { ${this.pages
                        .map(page => `"${page.name}"`)
                        .join(", ")} };`
                );
            }
            if (this.lvglObjectIdentifiers.fromPage.identifiers.length > 0) {
                build.line(
                    `static const char *object_names[] = { ${this.lvglObjectIdentifiers.fromPage.identifiers
                        .map(identifier => `"${identifier}"`)
                        .join(", ")} };`
                );
            }
            if (this.project.lvglGroups.groups.length > 0) {
                build.line(
                    `static const char *group_names[] = { ${this.project.lvglGroups.groups
                        .map(group => `"${group.name}"`)
                        .join(", ")} };`
                );
            }
            if (this.styles.length > 0) {
                build.line(
                    `static const char *style_names[] = { ${this.styles
                        .map(style => `"${style.name}"`)
                        .join(", ")} };`
                );
            }
            if (this.updateColorCallbacks.length > 0) {
                build.line(
                    `static const char *theme_names[] = { ${this.project.themes
                        .map(theme => `"${theme.name}"`)
                        .join(", ")} };`
                );
            }
            build.line("");
        }

        //
        if (this.updateColorCallbacks.length > 0) {
            build.line(
                `uint32_t theme_colors[${this.project.themes.length}][${this.project.colors.length}] = {`
            );
            build.indent();
            this.project.themes.map(theme => {
                const colors = this.project.colors.map(color =>
                    this.getColorHexStr(
                        this.project.getThemeColor(theme.objID, color.objID)
                    )
                );

                build.line(`{ ${colors.join(", ")} },`);
            });
            build.unindent();
            build.line("};");
            build.line("");
        }

        //
        build.line("void create_screens() {");
        build.indent();

        if (this.project.lvglGroups.groups.length > 0) {
            build.line("ui_create_groups();");
            build.line("");
        }

        if (
            this.assets.projectStore.projectTypeTraits.hasFlowSupport &&
            this.styles.length > 0
        ) {
            build.line("eez_flow_init_styles(add_style, remove_style);");
            build.line("");
        }

        if (this.assets.projectStore.projectTypeTraits.hasFlowSupport) {
            if (this.pages.length > 0) {
                build.line(
                    `eez_flow_init_screen_names(screen_names, sizeof(screen_names) / sizeof(const char *));`
                );
            }
            if (this.lvglObjectIdentifiers.fromPage.identifiers.length > 0) {
                build.line(
                    `eez_flow_init_object_names(object_names, sizeof(object_names) / sizeof(const char *));`
                );
            }
            if (this.project.lvglGroups.groups.length > 0) {
                build.line(
                    `eez_flow_init_group_names(group_names, sizeof(group_names) / sizeof(const char *));`
                );
            }
            if (this.styles.length > 0) {
                build.line(
                    `eez_flow_init_style_names(style_names, sizeof(style_names) / sizeof(const char *));`
                );
            }
            if (this.updateColorCallbacks.length > 0) {
                build.line(
                    `eez_flow_init_themes(theme_names, sizeof(theme_names) / sizeof(const char *), change_color_theme);`
                );
            }
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
                if (action.userProperties.length > 0) {
                    build.line("");
                    build.line(`enum {`);
                    build.indent();
                    for (let i = 0; i < action.userProperties.length; i++) {
                        build.line(
                            `ACTION_${getName(
                                "",
                                action.name,
                                NamingConvention.UnderscoreUpperCase
                            )}_PROPERTY_${getName(
                                "",
                                action.userProperties[i].name,
                                NamingConvention.UnderscoreUpperCase
                            )},`
                        );
                    }
                    build.unindent();
                    build.line(`};`);
                }

                build.line(
                    `extern void ${this.getActionFunctionName(
                        action.name
                    )}(lv_event_t * e);`
                );

                if (action.userProperties.length > 0) {
                    build.line("");
                }
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

        build.line(`#include "screens.h"`);
        build.line("");

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
                                    lvglStyle,
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
        const destinationFolder = this.project.settings.build.destinationFolder;
        if (!destinationFolder) {
            return;
        }

        let showInfoDialog = false;

        await Promise.all(
            this.bitmaps.map(bitmap =>
                (async () => {
                    const output =
                        "ui_image_" + this.bitmapNames.get(bitmap.objID)!;

                    try {
                        let source = await getLvglBitmapSourceFile(
                            bitmap,
                            this.getImageVariableName(bitmap)
                        );

                        source = `#ifdef __has_include
    #if __has_include("lvgl.h")
        #ifndef LV_LVGL_H_INCLUDE_SIMPLE
            #define LV_LVGL_H_INCLUDE_SIMPLE
        #endif
    #endif
#endif
${source}`;

                        await writeTextFile(
                            this.project._store.getAbsoluteFilePath(
                                destinationFolder
                            ) +
                                "/" +
                                (this.project.settings.build
                                    .separateFolderForImagesAndFonts
                                    ? "images/"
                                    : "") +
                                output +
                                ".c",
                            source
                        );
                    } catch (err) {
                        this.project._store.outputSectionsStore.write(
                            Section.OUTPUT,
                            MessageType.ERROR,
                            `Error genereting bitmap file '${output}.c': ${err}`
                        );
                        if (this.isV9) {
                            showInfoDialog = true;
                        }
                    }
                })()
            )
        );

        if (showInfoDialog) {
            showBuildImageInfoDialog();
        }
    }

    async copyFontFiles() {
        const destinationFolder = this.project.settings.build.destinationFolder;
        if (!destinationFolder) {
            return;
        }

        await Promise.all(
            this.fonts.map(font =>
                (async () => {
                    if (font.lvglSourceFile) {
                        const output = getName(
                            "ui_font_",
                            font.name || "",
                            NamingConvention.UnderscoreLowerCase
                        );

                        try {
                            await writeTextFile(
                                this.project._store.getAbsoluteFilePath(
                                    destinationFolder
                                ) +
                                    "/" +
                                    (this.project.settings.build
                                        .separateFolderForImagesAndFonts
                                        ? "fonts/"
                                        : "") +
                                    output +
                                    ".c",
                                font.lvglSourceFile
                            );
                        } catch (err) {
                            this.project._store.outputSectionsStore.write(
                                Section.OUTPUT,
                                MessageType.ERROR,
                                `Error writing font file '${output}.c': ${err}`
                            );
                        }
                    }
                })()
            )
        );
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
