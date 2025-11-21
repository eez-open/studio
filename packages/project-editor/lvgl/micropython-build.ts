import {
    NamingConvention,
    getName,
    Build
} from "project-editor/build/helper";
import type { Bitmap } from "project-editor/features/bitmap/bitmap";
import type { Font } from "project-editor/features/font/font";
import { Page } from "project-editor/features/page/page";
import { ProjectEditor } from "project-editor/project-editor-interface";
import { Project } from "project-editor/project/project";
import { getAncestorOfType } from "project-editor/store";
import type { LVGLWidget } from "./widgets";
import type { Assets } from "project-editor/build/assets";
import type { LVGLStyle } from "project-editor/lvgl/style";
import type { IEezObject } from "project-editor/core/object";
import { MicroPythonLVGLCode } from "project-editor/lvgl/to-micropython-code";
import { GENERATED_NAME_PREFIX } from "./identifiers";
import { isGeometryControlledByParent } from "./widget-common";

interface Identifiers {
    identifiers: string[];
    widgetToIdentifier: Map<LVGLWidget, string>;
    widgetToAccessor: Map<LVGLWidget, string>;
    widgetToIndex: Map<LVGLWidget, number>;
}

/**
 * MicroPython LVGL 9.x Build System
 *
 * Generates MicroPython code compatible with lv_micropython bindings.
 * Output is a single .py file that can be run on MicroPython with LVGL support.
 */
export class MicroPythonLVGLBuild extends Build {
    project: Project;

    toMicroPythonCode = new MicroPythonLVGLCode(this);

    styleNames = new Map<string, string>();
    fontNames = new Map<string, string>();
    bitmapNames = new Map<string, string>();

    updateColorCallbacks: {
        object: IEezObject;
        callback: () => void;
    }[] = [];

    isFirstPass: boolean;

    buildObjectsAccessibleFromSourceCode: {
        fromPage: LVGLWidget[];
        fromUserWidgets: Map<Page, LVGLWidget[]>;
    } = {
        fromPage: [],
        fromUserWidgets: new Map()
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
        page: Page;
    }[] = [];

    objectAccessors: string[] | undefined;
    currentPage: Page;

    tickCallbacks: (() => void)[];
    eventHandlers = new Map<LVGLWidget, (() => void)[]>();
    postBuildCallbacks: (() => void)[] = [];

    // Python-specific indentation tracking
    private indentLevel = 0;
    private readonly INDENT = "    "; // 4 spaces for Python

    constructor(public assets: Assets) {
        super();

        this.project = assets.projectStore.project;

        this.buildStyleNames();
        this.buildFontNames();
        this.buildBitmapNames();
    }

    //--------------------------------------------------------------------------
    // Build phases
    //--------------------------------------------------------------------------

    async firtsPassStart() {
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

        const generateUniqueObjectName = () => {
            return GENERATED_NAME_PREFIX + genIndex++;
        };

        const addPageIdentifiers = (
            widgets: LVGLWidget[],
            pageIdentifiers: Identifiers,
            prefix: string,
            isUserWidget: boolean
        ) => {
            let startIndex = isUserWidget
                ? pageIdentifiers.identifiers.length
                : 0;

            for (const widget of widgets) {
                let identifier;

                if (widget.identifier) {
                    identifier = getName(
                        "",
                        widget.identifier,
                        NamingConvention.UnderscoreLowerCase
                    );
                } else {
                    identifier =
                        this.assets.map.lvglWidgetGeneratedIdentifiers[
                            widget.objID
                        ];

                    if (!identifier) {
                        identifier = generateUniqueObjectName();
                        this.assets.map.lvglWidgetGeneratedIdentifiers[
                            widget.objID
                        ] = identifier;
                    }
                }

                pageIdentifiers.widgetToIdentifier.set(
                    widget,
                    prefix + identifier
                );

                // Python accessor format
                pageIdentifiers.widgetToAccessor.set(
                    widget,
                    isUserWidget
                        ? `objects[start_widget_index + ${
                              pageIdentifiers.identifiers.length - startIndex
                          }]`
                        : `objects["${prefix + identifier}"]`
                );

                pageIdentifiers.widgetToIndex.set(
                    widget,
                    pageIdentifiers.identifiers.length - startIndex
                );

                pageIdentifiers.identifiers.push(prefix + identifier);
            }
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
                    `objects["${identifier}"]`
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

    //--------------------------------------------------------------------------
    // Accessors
    //--------------------------------------------------------------------------

    get pages() {
        return this.project._store.lvglIdentifiers.pages;
    }

    get userPages() {
        return this.project._store.lvglIdentifiers.userPages;
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
        return true; // MicroPython targets LVGL 9.x
    }

    //--------------------------------------------------------------------------
    // Name building
    //--------------------------------------------------------------------------

    buildStyleNames() {
        const names = new Set<string>();

        for (const style of this.styles) {
            let name = getName("", style, NamingConvention.UnderscoreLowerCase);

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

    getStyleName(style: LVGLStyle) {
        return this.styleNames.get(style.objID) || "unknown_style";
    }

    getFontName(font: Font) {
        return this.fontNames.get(font.objID) || "unknown_font";
    }

    getBitmapName(bitmap: Bitmap) {
        return this.bitmapNames.get(bitmap.objID) || "unknown_bitmap";
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

    getLvglObjectAccessor(widget: LVGLWidget): string {
        const page = getAncestorOfType(
            widget,
            ProjectEditor.PageClass.classInfo
        ) as Page;

        if (page.isUsedAsUserWidget) {
            const pageIdentifiers =
                this.lvglObjectIdentifiers.fromUserWidgets.get(page);
            if (pageIdentifiers) {
                return (
                    pageIdentifiers.widgetToAccessor.get(widget) || "None"
                );
            }
        }

        return (
            this.lvglObjectIdentifiers.fromPage.widgetToAccessor.get(widget) ||
            "None"
        );
    }

    getImageAccessor(bitmap: Bitmap) {
        return `img_${this.getBitmapName(bitmap)}`;
    }

    //--------------------------------------------------------------------------
    // Python-specific output methods (override Build class)
    //--------------------------------------------------------------------------

    override line(text: string = "") {
        if (text) {
            super.line(this.INDENT.repeat(this.indentLevel) + text);
        } else {
            super.line("");
        }
    }

    override blockStart(text: string) {
        this.line(text);
        this.indentLevel++;
    }

    override blockEnd(text: string) {
        this.indentLevel--;
        if (text) {
            this.line(text);
        }
    }

    //--------------------------------------------------------------------------
    // Widget building helpers
    //--------------------------------------------------------------------------

    buildWidgetAssign(widget: LVGLWidget) {
        if (this.isAccessibleFromSourceCode(widget)) {
            const identifier =
                this.lvglObjectIdentifiers.fromPage.widgetToIdentifier.get(
                    widget
                );
            if (identifier) {
                this.line(`objects["${identifier}"] = obj`);
            }
        }
    }

    buildWidgetSetPosAndSize(widget: LVGLWidget) {
        if (widget instanceof ProjectEditor.LVGLScreenWidgetClass) {
            const page = getAncestorOfType(
                widget,
                ProjectEditor.PageClass.classInfo
            ) as Page;

            this.line(`obj.set_pos(${page.left}, ${page.top})`);
            this.line(`obj.set_size(${page.width}, ${page.height})`);
        } else if (isGeometryControlledByParent(widget)) {
            // skip
        } else {
            this.line(
                `obj.set_pos(${widget.lvglBuildLeft}, ${widget.lvglBuildTop})`
            );
            this.line(
                `obj.set_size(${widget.lvglBuildWidth}, ${widget.lvglBuildHeight})`
            );
        }
    }

    assignToObjectsStruct(accessor: string) {
        // For Python, we store in a dict
        this.line(`${accessor} = obj`);
    }

    //--------------------------------------------------------------------------
    // Tick and event callbacks
    //--------------------------------------------------------------------------

    addTickCallback(callback: () => void) {
        if (!this.tickCallbacks) {
            this.tickCallbacks = [];
        }
        this.tickCallbacks.push(callback);
    }

    addEventHandler(widget: LVGLWidget, callback: () => void) {
        let eventHandlers = this.eventHandlers.get(widget);
        if (!eventHandlers) {
            eventHandlers = [];
            this.eventHandlers.set(widget, eventHandlers);
        }
        eventHandlers.push(callback);
    }

    postBuildStart() {
        this.postBuildCallbacks = [];
    }

    postBuildAdd(callback: () => void) {
        this.postBuildCallbacks.push(callback);
    }

    postBuildEnd() {
        for (const callback of this.postBuildCallbacks) {
            callback();
        }
        this.postBuildCallbacks = [];
    }

    //--------------------------------------------------------------------------
    // Color handling
    //--------------------------------------------------------------------------

    buildColor<T>(
        object: IEezObject,
        color: string,
        getParams: () => T,
        callback: (color: string, params: T) => void,
        updateCallback: (color: any, params: T) => void
    ) {
        const params = getParams();
        callback(color, params);
    }

    buildColor2<T>(
        object: IEezObject,
        color1: string,
        color2: string,
        getParams: () => T,
        callback: (color1: string, color2: string, params: T) => void,
        updateCallback: (color1: any, color2: any, params: T) => void
    ) {
        const params = getParams();
        callback(color1, color2, params);
    }

    getColorHexStr(color: string): string {
        // Convert color to hex format for Python
        if (color.startsWith("#")) {
            return `0x${color.substring(1).toUpperCase()}`;
        }
        return color;
    }

    //--------------------------------------------------------------------------
    // Static variables
    //--------------------------------------------------------------------------

    genFileStaticVar(id: string, type: string, prefixName: string): string {
        const existing = this.fileStaticVars.find(v => v.id === id);
        if (existing) {
            return existing.varName;
        }

        const varName = `${prefixName}_${this.fileStaticVars.length}`;
        this.fileStaticVars.push({
            id,
            decl: `${varName} = None`,
            varName,
            page: this.currentPage
        });

        return varName;
    }

    assingToFileStaticVar(varName: string, value: string) {
        this.line(`${varName} = ${value}`);
    }

    //--------------------------------------------------------------------------
    // Main build methods
    //--------------------------------------------------------------------------

    async buildScreensDef() {
        // Build screen definitions - this is called during first pass
        // The actual output is generated later
    }

    async buildStylesDef() {
        // Build style definitions - this is called during first pass
    }

    /**
     * Generate the complete MicroPython file
     */
    async generateMicroPythonFile(): Promise<string> {
        this.startBuild();

        // Header
        this.line("# Generated by EEZ Studio");
        this.line("# MicroPython LVGL 9.x Code");
        this.line("# https://github.com/eez-open/studio");
        this.line("");
        this.line("import lvgl as lv");
        this.line("");

        // Global objects dictionary
        this.line("# Global objects storage");
        this.line("objects = {}");
        this.line("tick_value_change_obj = None");
        this.line("");

        // Static variables
        if (this.fileStaticVars.length > 0) {
            this.line("# Static variables");
            this.fileStaticVars.forEach(v => this.line(v.decl));
            this.line("");
        }

        // Styles
        await this.generateStyles();

        // Screen creation functions
        await this.generateScreenFunctions();

        // Tick functions
        await this.generateTickFunctions();

        // Main create_screens function
        await this.generateCreateScreens();

        return this.result;
    }

    private async generateStyles() {
        if (this.styles.length === 0) return;

        this.line("# Styles");
        this.line("styles = {}");
        this.line("");

        this.blockStart("def init_styles():");
        this.line("global styles");

        for (const style of this.styles) {
            const styleName = this.getStyleName(style);
            this.line("");
            this.line(`# Style: ${style.name}`);
            this.line(`styles["${styleName}"] = lv.style_t()`);
            this.line(`styles["${styleName}"].init()`);

            // Generate style properties
            // This would need to be expanded based on the actual style properties
        }

        this.blockEnd("");
        this.line("");
    }

    private async generateScreenFunctions() {
        this.line("# Screen creation functions");
        this.line("");

        for (const page of this.pages) {
            if (page.isUsedAsUserWidget) continue;

            this.currentPage = page;
            const funcName = this.getScreenCreateFunctionName(page);

            this.blockStart(`def ${funcName}():`);
            this.line("global objects");
            this.line("");

            // Create screen
            this.line("# Create screen");
            this.line("obj = lv.obj(None)");

            const screenIdentifier = this.getScreenIdentifier(page);
            this.line(`objects["${screenIdentifier}"] = obj`);
            this.line(`obj.set_size(${page.width}, ${page.height})`);
            this.line("");

            // Build widgets
            if (page.lvglScreenWidget) {
                this.line("parent_obj = obj");
                await this.buildWidgets(page.lvglScreenWidget);
            }

            this.blockEnd("");
            this.line("");
        }
    }

    private async buildWidgets(widget: LVGLWidget) {
        // Build child widgets
        const children = widget.children as LVGLWidget[];
        if (children) {
            for (const child of children) {
                this.toMicroPythonCode.startWidget(child);

                // Let the widget build itself
                if (typeof (child as any).lvglBuildObj === "function") {
                    (child as any).lvglBuildObj(this.toMicroPythonCode);
                }

                this.toMicroPythonCode.endWidget();

                // Recursively build children
                await this.buildWidgets(child);
            }
        }
    }

    private async generateTickFunctions() {
        this.line("# Tick functions");
        this.line("");

        for (const page of this.pages) {
            if (page.isUsedAsUserWidget) continue;

            const funcName = this.getScreenTickFunctionName(page);

            this.blockStart(`def ${funcName}():`);
            this.line("global objects, tick_value_change_obj");

            if (this.tickCallbacks && this.tickCallbacks.length > 0) {
                for (const callback of this.tickCallbacks) {
                    callback();
                }
            } else {
                this.line("pass  # No tick operations");
            }

            this.blockEnd("");
            this.line("");
        }
    }

    private async generateCreateScreens() {
        this.line("# Main initialization");
        this.line("");

        this.blockStart("def create_screens():");

        // Initialize styles
        if (this.styles.length > 0) {
            this.line("init_styles()");
            this.line("");
        }

        // Initialize display and theme
        this.line("# Initialize display theme");
        this.line("disp = lv.display.get_default()");
        this.line(
            `theme = lv.theme_default_init(disp, lv.palette_main(lv.PALETTE.BLUE), lv.palette_main(lv.PALETTE.RED), ${
                this.project.settings.general.darkTheme ? "True" : "False"
            }, lv.font_default())`
        );
        this.line("disp.set_theme(theme)");
        this.line("");

        // Create screens
        this.line("# Create screens");
        for (const page of this.userPages) {
            if (page.createAtStart || !this.project.settings.build.screensLifetimeSupport) {
                this.line(`${this.getScreenCreateFunctionName(page)}()`);
            }
        }

        this.blockEnd("");
        this.line("");

        // Entry point
        this.line("# Entry point");
        this.line("if __name__ == '__main__':");
        this.line("    create_screens()");
    }
}

/**
 * Build MicroPython code for an LVGL project
 */
export async function buildMicroPythonLVGL(assets: Assets): Promise<string> {
    const build = new MicroPythonLVGLBuild(assets);

    await build.firtsPassStart();
    await build.firstPassFinish();

    return await build.generateMicroPythonFile();
}
