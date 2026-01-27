import fs from "fs"
import {
    IReactionDisposer,
    autorun,
    runInAction,
    makeObservable,
    computed,
    observable,
    action
} from "mobx";
import tinycolor from "tinycolor2";

import type { Page } from "project-editor/features/page/page";
import type { IWasmFlowRuntime } from "eez-studio-types";
import { ProjectEditor } from "project-editor/project-editor-interface";
import type { Bitmap } from "project-editor/features/bitmap/bitmap";
import type { Font } from "project-editor/features/font/font";
import {
    createObject,
    getAncestorOfType,
    getClassInfo,
    getObjectPathAsString,
    getProjectStore
} from "project-editor/store";
import type { WasmRuntime } from "project-editor/flow/runtime/wasm-runtime";
import type {
    LVGLTabWidget,
    LVGLUserWidgetWidget,
    LVGLWidget
} from "project-editor/lvgl/widgets";
import {
    LVGLVersion,
    Project,
    ProjectType,
    findBitmap,
    findFont,
    findFontByVarName
} from "project-editor/project/project";
import {
    getClassesDerivedFrom,
    getDefaultValue,
    setParent
} from "project-editor/core/object";
import type { LVGLStyle } from "project-editor/lvgl/style";
import type { PageTabState } from "project-editor/features/page/PageEditor";
import {
    getLvglBitmapPtr,
    getLvglEvents,
    getLvglFlagCodes,
    getLvglStylePropCode,
    getLvglWasmFlowRuntimeConstructor
} from "project-editor/lvgl/lvgl-versions";
import type { IFlowContext } from "project-editor/flow/flow-interfaces";
import {
    LVGLStylePropCode,
    LVGL_CONSTANTS_ALL
} from "project-editor/lvgl/lvgl-constants";
import {
    BUILT_IN_FONTS,
    pad_bottom_property_info,
    pad_left_property_info,
    pad_right_property_info,
    pad_top_property_info
} from "./style-catalog";
import type { LVGLStyleObjects } from "project-editor/lvgl/style";
import type { Theme } from "project-editor/features/style/theme";
import {
    NamingConvention,
    USER_WIDGET_IDENTIFIER_SEPARATOR,
    getName
} from "project-editor/build/helper";
import { SimulatorLVGLCode } from "project-editor/lvgl/to-lvgl-code";

////////////////////////////////////////////////////////////////////////////////

interface LVGLCreateContext {
    page: Page;
    pageIndex: number;
    flowState: number;
}

export abstract class LVGLPageRuntime {
    lvglVersion: LVGLVersion;
    wasm: IWasmFlowRuntime;
    toLVGLCode = new SimulatorLVGLCode(this, LVGL_CONSTANTS_ALL);
    isMounted: boolean = false;
    bitmapsCache = new Map<
        Bitmap,
        {
            imageElement: HTMLImageElement;
            bitmapPtr: number;
        }
    >();
    fontsCache = new Map<
        Font,
        {
            lvglBinFile: string;
            fontPtr: number;
        }
    >();
    fontAddressToFont = new Map<number, Font>();
    lvglCreateContext: LVGLCreateContext;
    tick_value_change_obj: number = 0;
    widgetIndexes: number[] = [];
    pointers: number[] = [];
    oldStyleObjMap = new Map<LVGLStyle, LVGLStyleObjects>();
    styleObjMap = new Map<LVGLStyle, LVGLStyleObjects>();
    themeIndex: number = 0;
    changeColorCallbacks: {
        page: Page | undefined;
        callback: () => void;
    }[] = [];
    stringLiterals = new Map<string, number>();
    postCreateCallbacks: (() => void)[] = [];

    constructor(public page: Page) {
        this.lvglVersion = this.project.settings.general.lvglVersion;

        this.lvglCreateContext = {
            page,
            pageIndex: 0,
            flowState: 0
        };

        makeObservable(this, {
            projectStore: computed,
            project: computed
        });
    }

    get projectStore() {
        return getProjectStore(this.page);
    }

    get project() {
        return this.projectStore.project;
    }

    get isV9() {
        return this.lvglVersion.startsWith("9.");
    }

    isLVGLVersion(prefixes: string[]): boolean {
        for (const prefix of prefixes) {
            if (this.lvglVersion.startsWith(prefix)) {
                return true;
            }
        }
        return false;
    }

    abstract get isEditor(): boolean;

    abstract mount(): void;
    abstract unmount(): void;

    _isInsideUserWidget: number = 0;

    beginUserWidget(widget: LVGLUserWidgetWidget) {
        this._isInsideUserWidget++;
    }

    get isInsideUserWidget() {
        return this._isInsideUserWidget > 0;
    }

    endUserWidget() {
        this._isInsideUserWidget--;
    }

    getWidgetIndex(object: LVGLWidget | Page) {
        return 0;
    }

    getCreateWidgetIndex(object: LVGLWidget | Page) {
        const widgetIndex = this.getWidgetIndex(object);
        this.widgetIndexes.push(widgetIndex);
        return widgetIndex;
    }

    getLvglStylePropCode(code: LVGLStylePropCode): number {
        return getLvglStylePropCode(this.page, code) ?? 0;
    }

    async preloadImages() {
        const startTime = new Date().getTime();
        const TIMEOUT = 1000;

        const bitmapObjects =
            this.project._assets.maps.name.getAllObjectsOfType("bitmaps");
        bitmapObjects.forEach(
            bitmapObject => (bitmapObject.object as Bitmap).imageElement
        );

        while (true) {
            let loaded = !bitmapObjects.find(
                bitmapObject =>
                    (bitmapObject.object as Bitmap).imageElement == undefined
            );

            if (loaded || new Date().getTime() - startTime > TIMEOUT) {
                break;
            }

            // wait for a while
            await new Promise(resolve => setTimeout(resolve, 10));
        }
    }

    getLvglScreenByName(screenName: string) {
        return (
            this.project._store.lvglIdentifiers.pages
                .filter(page => !page.isUsedAsUserWidget)
                .findIndex(page => page.name == screenName) + 1
        );
    }

    getLvglGroupByName(groupName: string) {
        return this.project.lvglGroups.groups.findIndex(
            group => group.name == groupName
        );
    }

    getLvglStyleByName(styleName: string) {
        return this.projectStore.lvglIdentifiers.styles.findIndex(
            style => style.name == styleName
        );
    }

    getBitmapPtrByName(bitmapName: string) {
        const bitmap = findBitmap(this.project, bitmapName);
        if (!bitmap) {
            return 0;
        }
        return this.getBitmapPtr(bitmap);
    }

    getBitmapPtr(bitmap: Bitmap) {
        let cachedBitmap = this.bitmapsCache.get(bitmap);
        if (!cachedBitmap || cachedBitmap.imageElement != bitmap.imageElement) {
            if (cachedBitmap) {
                this.wasm._free(cachedBitmap.bitmapPtr);
                this.bitmapsCache.delete(bitmap);
            }

            if (!bitmap.imageElement) {
                return 0;
            }

            const bitmapData = ProjectEditor.getBitmapData(bitmap, 32);

            let bitmapPtr = getLvglBitmapPtr(this.page, this.wasm, bitmapData);

            cachedBitmap = {
                imageElement: bitmap.imageElement,
                bitmapPtr
            };

            this.bitmapsCache.set(bitmap, cachedBitmap);
        }

        return cachedBitmap.bitmapPtr;
    }

    getFontPtrByName(fontName: string) {
        if (fontName.startsWith("MONTSERRAT_")) {
            const fontNamePtr = this.wasm.stringToNewUTF8(fontName);
            const fontPtr = this.wasm._lvglGetBuiltinFontPtr(fontNamePtr);
            this.wasm._free(fontNamePtr);
            return fontPtr;
        }

        const font = findFont(this.project, fontName);
        
        if (!font) {
            return 0;
        }
        
        return this.getFontPtr(font);
    }

    getFontPtr(font: Font) {
        try {
            let cashedFont;
            
            if (!font.lvglUseFreeType) {
                cashedFont = this.fontsCache.get(font);
                if (!cashedFont || cashedFont.lvglBinFile != font.lvglBinFile) {
                    if (cashedFont) {
                        this.wasm._lvglFreeFont(cashedFont.fontPtr);
                        this.fontsCache.delete(font);
                        this.fontAddressToFont.delete(cashedFont.fontPtr);
                    }

                    const lvglBinFile = font.lvglBinFile;
                    if (lvglBinFile) {
                        const bin = Buffer.from(lvglBinFile, "base64");

                        const fontMemPtr = this.wasm._malloc(bin.length);
                        if (!fontMemPtr) {
                            return 0;
                        }
                        for (let i = 0; i < bin.length; i++) {
                            this.wasm.HEAP8[fontMemPtr + i] = bin[i];
                        }

                        const fontPathStr = this.wasm.stringToNewUTF8("M:" + fontMemPtr);

                        let fallbackUserFont = 0;
                        let fallbackBuiltinFont = -1;
                        if (font.lvglFallbackFont) {
                            if (font.lvglFallbackFont.startsWith("ui_font_")) {
                                const fallbackFont = findFontByVarName(
                                    this.project,
                                    font.lvglFallbackFont
                                );

                                if (fallbackFont) {
                                    fallbackUserFont = this.getFontPtr(fallbackFont);
                                }
                            } else if (font.lvglFallbackFont.startsWith("lv_font_")) {
                                fallbackBuiltinFont = BUILT_IN_FONTS.indexOf(
                                    font.lvglFallbackFont
                                        .slice("lv_font_".length)
                                        .toUpperCase()
                                );
                            }
                        }

                        let fontPtr = this.wasm._lvglLoadFont(
                            fontPathStr,
                            fallbackUserFont,
                            fallbackBuiltinFont
                        );

                        this.wasm._free(fontPathStr);

                        this.wasm._free(fontMemPtr);

                        cashedFont = {
                            lvglBinFile,
                            fontPtr
                        };

                        this.fontsCache.set(font, cashedFont);
                        this.fontAddressToFont.set(fontPtr, font);
                    }
                }
            } else {
                cashedFont = this.fontsCache.get(font);

                let fontSize = font.source!.size || 16;
                let lvglBinFile = `fontSize=${fontSize};renderMode=${font.lvglFreeTypeRenderMode};style=${font.lvglFreeTypeStyle}`;

                if (!cashedFont || cashedFont.lvglBinFile != lvglBinFile) {
                    // read font file from font.source.filePath to Uint8Array variable using fs.readFileSync code
                    const fontFileBuffer = fs.readFileSync( this.project._store.getAbsoluteFilePath(font.source!.filePath));
                    const fontFileUint8Array = new Uint8Array(fontFileBuffer);
                    
                    const fsFilePath = `/runtime_font_${font.name}_${fontSize}.ttf`;

                    this.wasm.FS.writeFile(fsFilePath, fontFileUint8Array);

                    const renderMode: number =
                        font.lvglFreeTypeRenderMode == "OUTLINE" ? 1 : 0;
                    
                    const style: number = 
                        font.lvglFreeTypeStyle == "BOLD" ? 1 << 1 : 
                        font.lvglFreeTypeStyle == "ITALIC" ? 1 << 0 :
                        font.lvglFreeTypeStyle == "BOLD_ITALIC" ? (1 << 1) | (1 << 0) : 0;

                    const fontPtr = this.wasm._lvglCreateFreeTypeFont(
                        this.wasm.stringToNewUTF8(fsFilePath), 
                        fontSize,
                        renderMode,
                        style
                    );

                    cashedFont = {
                        lvglBinFile,
                        fontPtr
                    };

                    this.fontsCache.set(font, cashedFont);
                    this.fontAddressToFont.set(fontPtr, font);
                }
            }

            if (cashedFont) {
                return cashedFont.fontPtr;
            }

            return 0;
        } catch (err) {
            console.error("Error in getFontPtr:", err);
            return 0;
        }
    }

    allocateUTF8(str: string, free: boolean) {
        const stringPtr = this.wasm.stringToNewUTF8(str);
        if (free) {
            this.pointers.push(stringPtr);
        }
        return stringPtr;
    }

    allocateInt32Array(arr: number[], free: boolean) {
        const ptr = this.wasm._malloc(arr.length * 4);
        if (free) {
            this.pointers.push(ptr);
        }
        this.wasm.HEAP32.set(arr, ptr / 4);
        return ptr;
    }

    freePointers() {
        for (const ptr of this.pointers) {
            this.wasm._free(ptr);
        }
        this.pointers = [];
    }

    static detachRuntimeFromPage(page: Page) {
        runInAction(() => {
            const runtime = page._lvglRuntime;
            if (!runtime) {
                return;
            }

            if (page._lvglObj != undefined) {
                //runtime.wasm._lvglDeleteObject(page._lvglObj);
                page._lvglObj = undefined;

                page._lvglWidgets.forEach(
                    widget => (widget._lvglObj = undefined)
                );
            }

            page._lvglRuntime = undefined;
        });
    }

    createStyles() {
        for (const [style, lvglStyleObjects] of this.styleObjMap.entries()) {
            this.oldStyleObjMap.set(style, lvglStyleObjects);
        }

        this.styleObjMap.clear();

        for (const style of this.projectStore.lvglIdentifiers.styles) {
            const lvglStyleObjects = style.lvglCreateStyles(this);
            this.styleObjMap.set(style, lvglStyleObjects);
        }
    }

    deleteStyles() {
        for (const [style, lvglStyleObjects] of this.oldStyleObjMap.entries()) {
            style.lvglDeleteStyles(this, lvglStyleObjects);
        }

        this.oldStyleObjMap.clear();
    }

    addStyle(targetObj: number, styleIndex: number) {
        const lvglStyle = this.projectStore.lvglIdentifiers.styles[styleIndex];
        if (lvglStyle) {
            lvglStyle.lvglAddStyleToObject(this, targetObj);
        }
    }

    removeStyle(targetObj: number, styleIndex: number) {
        const lvglStyle = this.projectStore.lvglIdentifiers.styles[styleIndex];
        if (lvglStyle) {
            lvglStyle.lvglRemoveStyleFromObject(this, targetObj);
        }
    }

    setColorTheme(themeName: string) {
        const themeIndex = this.project.themes.findIndex(
            theme => theme.name == themeName
        );
        this.themeIndex = themeIndex != -1 ? themeIndex : 0;

        this.changeColorCallbacks.forEach(callback => callback.callback());

        if (this instanceof LVGLPageViewerRuntime) {
            for (const pageState of this.pageStates.values()) {
                if (pageState.nonActivePageViewerRuntime) {
                    pageState.nonActivePageViewerRuntime.changeColorCallbacks.forEach(
                        callback => callback.callback()
                    );
                    if (
                        pageState.nonActivePageViewerRuntimeWasm &&
                        pageState.nonActivePageViewerRuntimePageObj
                    ) {
                        pageState.nonActivePageViewerRuntimeWasm._lvglObjInvalidate(
                            pageState.nonActivePageViewerRuntimePageObj
                        );
                    }
                }
                if (pageState.pageObj) {
                    this.wasm._lvglObjInvalidate(pageState.pageObj);
                }
            }
        }
    }

    getThemedColorInProject(colorValue: string): string | undefined {
        let selectedTheme;

        if (this.isEditor) {
            selectedTheme =
                this.projectStore.navigationStore?.selectedThemeObject.get() as Theme;
            if (!selectedTheme) {
                selectedTheme = this.project.themes[0];
            }
        } else {
            let themeIndex = 0;
            if (this instanceof LVGLNonActivePageViewerRuntime) {
                const lgvlPageRuntime = (
                    this.projectStore.runtime as WasmRuntime
                ).lgvlPageRuntime;
                if (lgvlPageRuntime) {
                    themeIndex = lgvlPageRuntime.themeIndex;
                }
            } else {
                themeIndex = this.themeIndex;
            }

            selectedTheme = this.project.themes[themeIndex];
        }

        if (!selectedTheme) {
            return undefined;
        }

        let index = this.project.colorToIndexMap.get(colorValue);
        if (index === undefined) {
            return undefined;
        }

        return selectedTheme.colors[index];
    }

    getThemedColor(colorValue: string) {
        if (typeof colorValue != "string" || colorValue.startsWith("#")) {
            return { colorValue, isFromTheme: false };
        }

        let color = this.getThemedColorInProject(colorValue);
        if (color) {
            return { colorValue: color, isFromTheme: true };
        }

        return { colorValue, isFromTheme: false };
    }

    colorRgbToNum(color: string) {
        const { colorValue, isFromTheme } = this.getThemedColor(color);

        const rgb = tinycolor(colorValue).toRgb();

        // result is in BGR format
        let result = (rgb.b << 0) | (rgb.g << 8) | (rgb.r << 16) | (255 << 24);

        // signed to unsigned
        result = result >>> 0;

        return { colorNum: result, isFromTheme };
    }

    getColorNum(color: string) {
        const { colorNum } = this.colorRgbToNum(color);
        return colorNum;
    }

    lvglSetAndUpdateColor(
        color: string,
        callback: (wasm: IWasmFlowRuntime, colorNum: number) => void
    ) {
        const { colorNum, isFromTheme } = this.colorRgbToNum(color);
        callback(this.wasm, colorNum);
        if (isFromTheme && !this.isEditor) {
            this.changeColorCallbacks.push({
                page: this.page,
                callback: () => {
                    const { colorNum } = this.colorRgbToNum(color);
                    callback(this.wasm, colorNum);
                }
            });
        }
    }

    lvglSetAndUpdateStyleColor(
        color: string,
        callback: (wasm: IWasmFlowRuntime, colorNum: number) => void
    ) {
        const { colorNum, isFromTheme } = this.colorRgbToNum(color);
        callback(this.wasm, colorNum);
        if (isFromTheme && !this.isEditor) {
            this.changeColorCallbacks.push({
                page: undefined,
                callback: () => {
                    const { colorNum } = this.colorRgbToNum(color);
                    callback(this.wasm, colorNum);
                }
            });
        }
    }

    lvglUpdateColor(
        color: string,
        callback: (wasm: IWasmFlowRuntime, colorNum: number) => void
    ) {
        const { isFromTheme } = this.colorRgbToNum(color);
        if (isFromTheme && !this.isEditor) {
            this.changeColorCallbacks.push({
                page: this.page,
                callback: () => {
                    const { colorNum } = this.colorRgbToNum(color);
                    callback(this.wasm, colorNum);
                }
            });
        }
    }

    registerGroupWidget(group: string, groupIndex: number, obj: number) {}

    addPostCreateCallback(callback: () => void) {
        this.postCreateCallbacks.push(callback);
    }

    stringLiteral(str: string) {
        let strPtr = this.stringLiterals.get(str);
        if (!strPtr) {
            strPtr = this.wasm.stringToNewUTF8(str);
            this.stringLiterals.set(str, strPtr);
        }
        return strPtr;
    }

    addTickCallback(callback: (flowState: number) => void) {}

    addEventHandler(
        obj: number,
        eventName: string,
        callback: (event: number) => void
    ) {}

    lvglOnEventHandler(obj: number, eventCode: number, event: number) {}

    // button matrix buffers
    buttonMatrixBuffers: {
        mapBuffer: number;
        mapArray: Uint32Array;
        ctrlMapBuffer: number;
    }[] = [];

    addButtonMatrixBuffers(mapBuffer: number, mapArray: Uint32Array, ctrlMapBuffer: number) {
        this.buttonMatrixBuffers.push({
            mapBuffer,
            mapArray,
            ctrlMapBuffer
        });
    }

    freeAllButtonMatrixBuffers() {
        for (const buffers of this.buttonMatrixBuffers) {
            buffers.mapArray
                    .slice(0, -1)
                    .forEach(value => this.wasm._free(value));

            this.wasm._free(buffers.mapBuffer);

            if (buffers.ctrlMapBuffer) {
                this.wasm._free(buffers.ctrlMapBuffer);
            }
        }

        this.buttonMatrixBuffers = [];
    }
}

////////////////////////////////////////////////////////////////////////////////

export class LVGLPageEditorRuntime extends LVGLPageRuntime {
    autorRunDispose: IReactionDisposer | undefined;
    dispose2: IReactionDisposer | undefined;
    requestAnimationFrameId: number | undefined;
    wasError: boolean = false;

    constructor(
        page: Page,
        public ctx: CanvasRenderingContext2D,
        private flowContext: IFlowContext
    ) {
        super(page);

        makeObservable(this, {
            displayWidth: computed,
            displayHeight: computed
        });
    }

    get isEditor() {
        return true;
    }

    get displayWidth() {
        let width = this.page.width;
        if (typeof width != "number" || isNaN(width) || width < 1) {
            width = 1;
        }
        return width;
    }

    get displayHeight() {
        let height = this.page.height;
        if (typeof height != "number" || isNaN(height) || height < 1) {
            height = 1;
        }
        return height;
    }

    mount() {
        if (this.isMounted) {
            return;
        }

        const wasm = getLvglWasmFlowRuntimeConstructor(this.lvglVersion)(
            async () => {
                await this.preloadImages();

                if (this.wasm != wasm) {
                    return;
                }

                runInAction(() => {
                    this.page._lvglRuntime = this;
                    this.page._lvglObj = undefined;
                });

                this.wasm._init(
                    0,
                    0,
                    0,
                    0,
                    this.displayWidth,
                    this.displayHeight,
                    this.project.settings.general.darkTheme,
                    -(new Date().getTimezoneOffset() / 60) * 100,
                    false
                );

                this.requestAnimationFrameId = window.requestAnimationFrame(
                    this.tick
                );

                this.autorRunDispose = autorun(() => {
                    if (!this.isMounted) {
                        return;
                    }

                    this.project._store.lastRevision;

                    if (this.wasError) {
                        setTimeout(() => {
                            this.unmount();
                            this.wasError = false;
                            this.mount();
                        });
                        return;
                    }

                    if (this.dispose2) {
                        this.dispose2();
                        this.dispose2 = undefined;
                    }

                    try {
                        // set all _lvglObj to undefined
                        runInAction(() => {
                            this.page._lvglWidgets.forEach(
                                widget => (widget._lvglObj = undefined)
                            );
                        });

                        this.wasm._lvglClearTimeline();

                        this.freePointers();

                        this.freeAllButtonMatrixBuffers();

                        this.createStyles();

                        const pageObj = this.page.lvglCreate(this, 0);
                        if (!pageObj) {
                            console.error("pageObj is undefined");
                        }

                        for (const callback of this.postCreateCallbacks) {
                            callback();
                        }
                        this.postCreateCallbacks = [];

                        const editor =
                            this.projectStore.editorsStore.getEditorByObject(
                                this.page
                            );
                        if (editor) {
                            const pageTabState = editor.state as PageTabState;
                            if (pageTabState?.timeline?.isEditorActive) {
                                this.wasm._lvglSetTimelinePosition(
                                    pageTabState.timeline.position
                                );
                            }
                        }

                        this.wasm._lvglScreenLoad(-1, pageObj);

                        runInAction(() => {
                            if (this.page._lvglObj != undefined) {
                                this.wasm._lvglDeleteObject(this.page._lvglObj);
                            }
                            this.page._lvglObj = pageObj;
                        });

                        this.deleteStyles();

                        this.dispose2 = autorun(() => {
                            for (const objectAdapter of this.flowContext
                                .viewState.selectedObjects) {
                                const tabWidget =
                                    getAncestorOfType<LVGLTabWidget>(
                                        objectAdapter.object,
                                        ProjectEditor.LVGLTabWidgetClass
                                            .classInfo
                                    );
                                if (tabWidget) {
                                    const tabviewWidget = tabWidget.tabview;
                                    if (tabviewWidget) {
                                        const tabIndex = tabWidget.tabIndex;
                                        if (tabIndex != -1) {
                                            runInAction(() => {
                                                tabviewWidget._selectedTabIndex =
                                                    tabIndex;
                                            });
                                        }
                                    }
                                }
                            }
                        });
                    } catch (e) {
                        console.error(e);
                        this.wasError = true;
                    }
                });
            }
        );

        this.wasm = wasm;
        this.isMounted = true;
    }

    tick = () => {
        this.wasm._mainLoop();

        var buf_addr = this.wasm._getSyncedBuffer();
        if (buf_addr != 0) {
            const screen = new Uint8ClampedArray(
                this.wasm.HEAPU8.subarray(
                    buf_addr,
                    buf_addr + this.displayWidth * this.displayHeight * 4
                )
            );

            var imgData = new ImageData(
                screen,
                this.displayWidth,
                this.displayHeight
            );

            this.ctx.putImageData(
                imgData,
                0,
                0,
                0,
                0,
                this.displayWidth,
                this.displayHeight
            );
        } else {
            if (this.wasError) {
                this.ctx.clearRect(0, 0, this.displayWidth, this.displayHeight);
            }
        }

        this.requestAnimationFrameId = window.requestAnimationFrame(this.tick);
    };

    unmount() {
        if (!this.isMounted) {
            return;
        }

        if (this.requestAnimationFrameId != undefined) {
            window.cancelAnimationFrame(this.requestAnimationFrameId);
            this.requestAnimationFrameId = undefined;
        }

        if (this.autorRunDispose) {
            this.autorRunDispose();
            this.autorRunDispose = undefined;
        }

        if (this.dispose2) {
            this.dispose2();
            this.dispose2 = undefined;
        }

        LVGLPageRuntime.detachRuntimeFromPage(this.page);

        this.isMounted = false;
    }
}

////////////////////////////////////////////////////////////////////////////////

export class LVGLNonActivePageViewerRuntime extends LVGLPageRuntime {
    requestAnimationFrameId: number | undefined;

    mountToLvglPageRuntimeInterval: any;

    constructor(
        page: Page,
        public displayWidth: number,
        public displayHeight: number,
        public ctx: CanvasRenderingContext2D
    ) {
        super(page);
    }

    get isEditor() {
        return false;
    }

    mount() {
        this.wasm = getLvglWasmFlowRuntimeConstructor(this.lvglVersion)(
            async () => {
                runInAction(() => {
                    this.page._lvglRuntime = this;
                    this.page._lvglObj = undefined;
                });

                this.wasm._init(
                    0,
                    0,
                    0,
                    0,
                    this.page.width,
                    this.page.height,
                    this.project.settings.general.darkTheme,
                    -(new Date().getTimezoneOffset() / 60) * 100,
                    false
                );

                this.requestAnimationFrameId = window.requestAnimationFrame(
                    this.tick
                );

                this.createStyles();

                const pageObj = this.page.lvglCreate(this, 0);
                this.wasm._lvglScreenLoad(-1, pageObj);
                runInAction(() => {
                    this.page._lvglRuntime = this;
                    this.page._lvglObj = pageObj;
                });

                this.mountToLvglPageRuntimeInterval = setInterval(() => {
                    const lgvlPageRuntime = (
                        this.projectStore.runtime as WasmRuntime
                    ).lgvlPageRuntime;

                    if (lgvlPageRuntime) {
                        clearInterval(this.mountToLvglPageRuntimeInterval);
                        this.mountToLvglPageRuntimeInterval = undefined;

                        lgvlPageRuntime.onNonActivePageViewRuntimeMounted(
                            this,
                            this.wasm,
                            pageObj
                        );
                    }
                }, 10);
            }
        );
        this.isMounted = true;
    }

    tick = () => {
        this.wasm._mainLoop();

        var buf_addr = this.wasm._getSyncedBuffer();
        if (buf_addr != 0) {
            const screen = new Uint8ClampedArray(
                this.wasm.HEAPU8.subarray(
                    buf_addr,
                    buf_addr + this.displayWidth * this.displayHeight * 4
                )
            );

            var imgData = new ImageData(
                screen,
                this.displayWidth,
                this.displayHeight
            );

            this.ctx.putImageData(
                imgData,
                0,
                0,
                0,
                0,
                this.displayWidth,
                this.displayHeight
            );
        }

        this.requestAnimationFrameId = window.requestAnimationFrame(this.tick);
    };

    unmount() {
        if (this.requestAnimationFrameId != undefined) {
            window.cancelAnimationFrame(this.requestAnimationFrameId);
        }

        if (this.mountToLvglPageRuntimeInterval) {
            clearInterval(this.mountToLvglPageRuntimeInterval);
            this.mountToLvglPageRuntimeInterval = undefined;
        }

        if (
            this.projectStore.runtime instanceof ProjectEditor.WasmRuntimeClass
        ) {
            if (this.projectStore.runtime.lgvlPageRuntime) {
                this.projectStore.runtime.lgvlPageRuntime.onNonActivePageViewRuntimeUnmounted(
                    this
                );
            }
        }

        this.isMounted = false;
    }
}

////////////////////////////////////////////////////////////////////////////////

export class LVGLPageViewerRuntime extends LVGLPageRuntime {
    reactionDispose: IReactionDisposer | undefined;
    pageStates = new Map<
        Page,
        {
            page: Page;
            pageObj: number;
            nonActivePageViewerRuntime:
                | LVGLNonActivePageViewerRuntime
                | undefined;
            nonActivePageViewerRuntimeWasm: IWasmFlowRuntime | undefined;
            nonActivePageViewerRuntimePageObj: number;
            activeObjects: number[] | undefined;
            nonActiveObjects: number[] | undefined;
            widgetIndexes: number[];
        }
    >();
    pageGroupWidgets = new Map<
        Page,
        {
            group: string;
            groupIndex: number;
            obj: number;
        }[]
    >();
    lvglGroupObjects: number[] = [];
    userWidgetsStack: LVGLUserWidgetWidget[] = [];
    nextWidgetIndex = -1;
    tickCallbacks: {
        page: Page;
        flowState: number;
        callback: (flowState: number) => void;
    }[] = [];
    eventHandlers: {
        page: Page;
        obj: number;
        eventCode: number;
        callback: (event: number) => void;
    }[] = [];

    constructor(private runtime: WasmRuntime) {
        super(runtime.selectedPage);
        this.wasm = runtime.worker.wasm;

        this.pages.forEach(page =>
            this.pageStates.set(page, {
                page,
                pageObj: 0,
                nonActivePageViewerRuntime: undefined,
                nonActivePageViewerRuntimeWasm: undefined,
                nonActivePageViewerRuntimePageObj: 0,
                activeObjects: undefined,
                nonActiveObjects: undefined,
                widgetIndexes: []
            })
        );
    }

    get pages() {
        const pages: Page[] = [];

        function enumInProject(project: Project) {
            pages.push(...project.userPages);
            for (const importDirective of project.settings.general.imports) {
                if (importDirective.project) {
                    enumInProject(importDirective.project);
                }
            }
        }

        enumInProject(this.runtime.projectStore.project);

        return pages;
    }

    get isEditor() {
        return false;
    }

    override registerGroupWidget(
        group: string,
        groupIndex: number,
        obj: number
    ) {
        let groupWidgets = this.pageGroupWidgets.get(this.page);
        if (!groupWidgets) {
            groupWidgets = [];
            this.pageGroupWidgets.set(this.page, groupWidgets);
        }
        groupWidgets.push({
            group,
            groupIndex,
            obj
        });
    }

    async mount() {
        this.lvglGroupObjects = [];

        // init themes
        {
            let themeNamesPtr = this.wasm._malloc(this.project.themes.length * 4);

            let themeColorsPtr = this.wasm._malloc(
                this.project.colors.length * this.project.themes.length * 4
            );

            for (let i = 0; i < this.project.themes.length; i++) {
                const theme = this.project.themes[i];

                const themeNamePtr = this.wasm.stringToNewUTF8(theme.name);
                this.wasm.HEAP32[themeNamesPtr / 4 + i] = themeNamePtr;

                for (let j = 0; j < this.project.colors.length; j++) {
                    const colorValue = theme.colors[j];
                    const rgb = tinycolor(colorValue).toRgb();

                    // result is in BGR format
                    let colorNum =
                        (rgb.b << 0) | (rgb.g << 8) | (rgb.r << 16) | (255 << 24);

                    // signed to unsigned
                    colorNum = colorNum >>> 0;

                    this.wasm.HEAP32[themeColorsPtr / 4 + i * this.project.colors.length + j] = colorNum;
                }
            }

            this.wasm._eez_flow_init_themes(themeNamesPtr, this.project.themes.length, 0, themeColorsPtr, this.project.colors.length);
        }

        // create groups
        for (const group of this.project.lvglGroups.groups) {
            const groupObj = this.wasm._lvglCreateGroup();

            this.lvglGroupObjects.push(groupObj);

            if (
                group.name ==
                this.project.lvglGroups.defaultGroupForEncoderInSimulator
            ) {
                this.wasm._lvglSetEncoderGroup(groupObj);
            }

            if (
                group.name ==
                this.project.lvglGroups.defaultGroupForKeyboardInSimulator
            ) {
                this.wasm._lvglSetKeyboardGroup(groupObj);
            }
        }

        this.pageGroupWidgets.clear();

        for (const page of this.pages) {
            if (
                !this.project.settings.build.screensLifetimeSupport ||
                page.createAtStart
            ) {
                this.lvglCreate(page);
            }
        }

        // add widgets to groups
        for (const page of this.pages) {
            this.addGroupObjectsForPage(page);
        }

        this.reactionDispose = autorun(() => {
            const selectedPage = this.runtime.selectedPage;
            const pageState = this.pageStates.get(selectedPage)!;
            setObjects(selectedPage, this, pageState.activeObjects!);
            this.wasm._lvglScreenLoad(
                this.pages.indexOf(selectedPage),
                selectedPage._lvglObj!
            );
        });

        this.isMounted = true;
    }

    unmount() {
        if (this.reactionDispose) {
            this.reactionDispose();
        }

        for (const page of this.pages) {
            LVGLPageRuntime.detachRuntimeFromPage(page);
        }

        this.isMounted = false;
    }

    lvglCreateScreen(screenIndex: number) {
        const page = this.pages[screenIndex];

        const pageState = this.pageStates.get(page)!;
        if (!pageState.pageObj) {
            this.lvglCreate(page);
            this.addGroupObjectsForPage(page);
        }
    }

    lvglDeleteScreen(screenIndex: number) {
        const page = this.pages[screenIndex];
        const pageState = this.pageStates.get(page)!;
        if (pageState.pageObj) {
            this.changeColorCallbacks = this.changeColorCallbacks.filter(
                callback => callback.page != page
            );

            this.tickCallbacks = this.tickCallbacks.filter(
                tickCallback => tickCallback.page != page
            );

            this.eventHandlers = this.eventHandlers.filter(
                eventHandler => eventHandler.page != page
            );

            this.pageGroupWidgets.delete(page);
            this.wasm._lvglGroupRemoveObjectsForScreen(pageState.pageObj);

            this.wasm._lvglDeleteObject(pageState.pageObj);

            for (const widgetIndex of pageState.widgetIndexes) {
                this.wasm._lvglDeleteObjectIndex(widgetIndex);
            }

            this.wasm._lvglDeletePageFlowState(screenIndex);

            pageState.pageObj = 0;
        }
    }

    lvglCreate(page: Page) {
        this.page = page;

        runInAction(() => {
            this.page._lvglRuntime = this;
        });

        const pagePath = getObjectPathAsString(this.page);
        const pageIndex = this.runtime.assetsMap.flowIndexes[pagePath];

        this.lvglCreateContext = {
            page: this.page,
            pageIndex,
            flowState: this.wasm._lvglGetFlowState(0, pageIndex)
        };

        this.createStyles();

        this.widgetIndexes = [];

        const pageObj = this.page.lvglCreate(this, 0);

        for (const callback of this.postCreateCallbacks) {
            callback();
        }
        this.postCreateCallbacks = [];

        if (
            pageObj &&
            this.project.settings.build.screensLifetimeSupport &&
            this.page.deleteOnScreenUnload
        ) {
            this.wasm._lvglDeleteScreenOnUnload(pageIndex);
        }

        const pageState = this.pageStates.get(this.page)!;

        pageState.pageObj = pageObj;
        pageState.widgetIndexes = this.widgetIndexes;

        this.wasm._lvglAddScreenLoadedEventHandler(pageObj);

        runInAction(() => {
            this.page._lvglObj = pageObj;
        });

        this.pageStates.get(page)!.activeObjects = getObjects(page);

        return pageObj;
    }

    onNonActivePageViewRuntimeMounted(
        runtime: LVGLNonActivePageViewerRuntime,
        wasm: IWasmFlowRuntime,
        pageObj: number
    ) {
        const pageState = this.pageStates.get(runtime.page)!;
        if (pageState) {
            pageState.nonActivePageViewerRuntime = runtime;
            pageState.nonActivePageViewerRuntimeWasm = wasm;
            pageState.nonActivePageViewerRuntimePageObj = pageObj;
            pageState.nonActiveObjects = getObjects(runtime.page);
        }
    }

    onNonActivePageViewRuntimeUnmounted(
        runtime: LVGLNonActivePageViewerRuntime
    ) {
        const pageState = this.pageStates.get(runtime.page)!;
        if (pageState) {
            pageState.nonActivePageViewerRuntime = undefined;
            pageState.nonActiveObjects = undefined;
            if (pageState.activeObjects) {
                setObjects(pageState.page, this, pageState.activeObjects);
            }
        }
    }

    //

    addGroupObjectsForPage(page: Page) {
        if (!page._lvglObj) {
            return;
        }

        for (let i = 0; i < this.project.lvglGroups.groups.length; i++) {
            const group = this.project.lvglGroups.groups[i];

            const groupWidgets = this.pageGroupWidgets.get(page);

            if (groupWidgets) {
                let widgetsInGroup = groupWidgets.filter(
                    groupObject => groupObject.group == group.name
                );

                widgetsInGroup.sort((a, b) => {
                    let aIndex = a.groupIndex;
                    let bIndex = b.groupIndex;

                    if (aIndex <= 0) {
                        if (bIndex > 0) {
                            return 1;
                        }
                    } else if (bIndex <= 0) {
                        return -1;
                    }

                    if (aIndex == bIndex) {
                        aIndex = widgetsInGroup.indexOf(a);
                        bIndex = widgetsInGroup.indexOf(b);
                    }

                    return aIndex - bIndex;
                });

                for (const widgetInGroup of widgetsInGroup) {
                    this.wasm._lvglGroupAddObject(
                        page._lvglObj,
                        this.lvglGroupObjects[i],
                        widgetInGroup.obj
                    );
                }
            }
        }
    }

    //
    override beginUserWidget(widget: LVGLUserWidgetWidget) {
        this.userWidgetsStack.push(widget);
    }

    override get isInsideUserWidget() {
        return this.userWidgetsStack.length > 0;
    }

    override endUserWidget() {
        this.userWidgetsStack.pop();
    }

    override getWidgetIndex(object: LVGLWidget | Page) {
        const identifier = [
            ...this.userWidgetsStack.map(
                widget =>
                    widget.identifier ||
                    this.runtime.assetsMap.lvglWidgetGeneratedIdentifiers[
                        widget.objID
                    ]
            ),
            object instanceof ProjectEditor.LVGLWidgetClass
                ? object.identifier ||
                  this.runtime.assetsMap.lvglWidgetGeneratedIdentifiers[
                      object.objID
                  ]
                : object.name
        ]
            .map(identifier =>
                identifier
                    ? getName(
                          "",
                          identifier,
                          NamingConvention.UnderscoreLowerCase
                      )
                    : "?"
            )
            .join(USER_WIDGET_IDENTIFIER_SEPARATOR);

        const widgetIndex =
            this.runtime.assetsMap.lvglWidgetIndexes[identifier];
        if (widgetIndex != undefined) {
            return widgetIndex;
        }

        if (this.nextWidgetIndex == -1) {
            this.nextWidgetIndex = Math.max(
                ...Object.keys(this.runtime.assetsMap.lvglWidgetIndexes).map(
                    key => this.runtime.assetsMap.lvglWidgetIndexes[key]
                )
            );

            if (this.nextWidgetIndex == -Infinity) {
                this.nextWidgetIndex = 0;
            } else {
                this.nextWidgetIndex++;
            }
        }

        return this.nextWidgetIndex++;
    }

    getLvglObjectByName(
        objectName: string,
        userWidgetsStack: LVGLUserWidgetWidget[]
    ) {
        const identifier = [
            ...userWidgetsStack.map(
                widget =>
                    widget.identifier ||
                    this.runtime.assetsMap.lvglWidgetGeneratedIdentifiers[
                        widget.objID
                    ]
            ),
            objectName
        ]
            .map(identifier =>
                identifier
                    ? getName(
                          "",
                          identifier,
                          NamingConvention.UnderscoreLowerCase
                      )
                    : "?"
            )
            .join(USER_WIDGET_IDENTIFIER_SEPARATOR);
        
        return this.runtime.assetsMap.lvglWidgetIndexes[identifier];
    }

    getLvglObjectNameFromIndex(index: number) {
        for (const [name, idx] of Object.entries(
            this.runtime.assetsMap.lvglWidgetIndexes
        )) {
            if (idx == index) {
                return this.stringLiteral(name);
            }
        }

        return 0;
    }

    override addTickCallback(callback: (flowState: number) => void) {
        this.tickCallbacks.push({
            page: this.page,
            flowState: this.lvglCreateContext.flowState,
            callback
        });
    }

    lvglScreenTick() {
        for (let tickCallback of this.tickCallbacks) {
            if (this.runtime.selectedPage == tickCallback.page) {
                tickCallback.callback(tickCallback.flowState);
            }
        }
    }

    override addEventHandler(
        obj: number,
        eventName: string,
        callback: (event: number) => void
    ) {
        const eventCode = getLvglEvents(this.project)[eventName].code;

        this.eventHandlers.push({
            page: this.page,
            obj,
            eventCode,
            callback
        });

        this.wasm._lvglAddEventHandler(obj, eventCode);
    }

    override lvglOnEventHandler(obj: number, eventCode: number, event: number) {
        for (const eventHandler of this.eventHandlers) {
            if (
                eventHandler.obj == obj &&
                eventHandler.eventCode == eventCode
            ) {
                eventHandler.callback(event);
            }
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

export class LVGLStylesEditorRuntime extends LVGLPageRuntime {
    static PREVIEW_WIDTH = 400;
    static PREVIEW_HEIGHT = 400;
    lvglWidgetsMap = new Map<string, LVGLWidget>();
    selectedStyle: LVGLStyle | undefined;
    autorRunDispose: IReactionDisposer | undefined;
    requestAnimationFrameId: number | undefined;
    canvas: HTMLCanvasElement | null = null;

    constructor(project: Project) {
        const widgets = getClassesDerivedFrom(
            project._store,
            ProjectEditor.LVGLWidgetClass
        ).filter(componentClass =>
            componentClass.objectClass.classInfo.enabledInComponentPalette
                ? componentClass.objectClass.classInfo.enabledInComponentPalette(
                      ProjectType.LVGL,
                      project._store
                  )
                : true
        );

        const page = createObject<Page>(
            project._store,
            {
                components: widgets.map(componentClass =>
                    Object.assign(
                        {},
                        getDefaultValue(
                            project._store,
                            componentClass.objectClass.classInfo
                        ),
                        {
                            type: componentClass.name,
                            left: 0,
                            leftUnit: "px",
                            top: 0,
                            topUnit: "px"
                        }
                    )
                )
            },
            ProjectEditor.PageClass,
            undefined,
            true
        );

        setParent(page, project);

        super(page);

        const lvglScreenWidget = page.lvglScreenWidget!;

        lvglScreenWidget.localStyles.definition =
            lvglScreenWidget.localStyles.addPropertyToDefinition(
                pad_top_property_info,
                "MAIN",
                "DEFAULT",
                10
            );
        lvglScreenWidget.localStyles.definition =
            lvglScreenWidget.localStyles.addPropertyToDefinition(
                pad_bottom_property_info,
                "MAIN",
                "DEFAULT",
                10
            );
        lvglScreenWidget.localStyles.definition =
            lvglScreenWidget.localStyles.addPropertyToDefinition(
                pad_left_property_info,
                "MAIN",
                "DEFAULT",
                10
            );
        lvglScreenWidget.localStyles.definition =
            lvglScreenWidget.localStyles.addPropertyToDefinition(
                pad_right_property_info,
                "MAIN",
                "DEFAULT",
                10
            );

        this.lvglWidgetsMap.set(lvglScreenWidget.type, lvglScreenWidget);

        for (const component of lvglScreenWidget.children) {
            this.lvglWidgetsMap.set(component.type, component);
        }

        makeObservable(this, {
            selectedStyle: observable,
            setSelectedStyle: action
        });

        this.mount();
    }

    get isEditor() {
        return true;
    }

    get displayWidth() {
        return LVGLStylesEditorRuntime.PREVIEW_WIDTH;
    }

    get displayHeight() {
        return LVGLStylesEditorRuntime.PREVIEW_HEIGHT;
    }

    mount() {
        if (this.isMounted) {
            return;
        }

        const wasm = getLvglWasmFlowRuntimeConstructor(this.lvglVersion)(
            async () => {
                if (this.wasm != wasm) {
                    return;
                }

                runInAction(() => {
                    this.page._lvglRuntime = this;
                    this.page._lvglObj = undefined;
                });

                this.wasm._init(
                    0,
                    0,
                    0,
                    0,
                    this.displayWidth,
                    this.displayHeight,
                    this.project.settings.general.darkTheme,
                    -(new Date().getTimezoneOffset() / 60) * 100,
                    false
                );

                this.requestAnimationFrameId = window.requestAnimationFrame(
                    this.tick
                );

                this.autorRunDispose = autorun(() => {
                    if (!this.isMounted) {
                        return;
                    }

                    // set all _lvglObj to undefined
                    runInAction(() => {
                        this.page._lvglWidgets.forEach(
                            widget => (widget._lvglObj = undefined)
                        );
                    });

                    this.freeAllButtonMatrixBuffers();

                    this.selectedStyle;
                    this.project._store.uiStateStore.lvglState;

                    // set all flags to HIDDEN, except selected widget
                    // also, set _useStyleForStylePreview
                    runInAction(() => {
                        for (const lvglWidget of this.lvglWidgetsMap.values()) {
                            const flags =
                                lvglWidget.widgetFlags.trim() != ""
                                    ? lvglWidget.widgetFlags.split("|")
                                    : [];

                            const i = flags.indexOf("HIDDEN");
                            if (i != -1) {
                                flags.splice(i, 1);
                            }

                            if (
                                this.selectedStyle &&
                                this.canvas &&
                                lvglWidget.type ==
                                    this.selectedStyle.forWidgetType
                            ) {
                                lvglWidget._useStyleForStylePreview =
                                    this.selectedStyle.name;

                                // "DEFAULT",
                                // "CHECKED",
                                // "PRESSED",
                                // "CHECKED|PRESSED",
                                // "DISABLED",
                                // "FOCUSED"
                                lvglWidget.states =
                                    this.project._store.uiStateStore.lvglState;
                            } else {
                                lvglWidget._useStyleForStylePreview = "";
                                lvglWidget.states = "";

                                if (lvglWidget != this.page.lvglScreenWidget) {
                                    flags.push("HIDDEN");
                                }
                            }

                            lvglWidget.widgetFlags = flags.join("|");
                        }
                    });

                    const pageObj = this.page.lvglCreate(this, 0);
                    if (!pageObj) {
                        console.error("pageObj is undefined");
                        return;
                    }

                    this.wasm._lvglScreenLoad(-1, pageObj);

                    runInAction(() => {
                        if (this.page._lvglObj != undefined) {
                            this.wasm._lvglDeleteObject(this.page._lvglObj);
                        }
                        this.page._lvglObj = pageObj;
                    });
                });
            }
        );

        this.wasm = wasm;
        this.isMounted = true;
    }

    tick = () => {
        if (this.canvas) {
            this.wasm._mainLoop();

            var buf_addr = this.wasm._getSyncedBuffer();
            if (buf_addr != 0) {
                const screen = new Uint8ClampedArray(
                    this.wasm.HEAPU8.subarray(
                        buf_addr,
                        buf_addr + this.displayWidth * this.displayHeight * 4
                    )
                );

                var imgData = new ImageData(
                    screen,
                    this.displayWidth,
                    this.displayHeight
                );

                const ctx = this.canvas.getContext("2d");

                if (ctx) {
                    ctx.putImageData(
                        imgData,
                        0,
                        0,
                        0,
                        0,
                        this.displayWidth,
                        this.displayHeight
                    );
                }
            }
        }

        this.requestAnimationFrameId = window.requestAnimationFrame(this.tick);
    };

    unmount() {
        if (!this.isMounted) {
            return;
        }

        if (this.requestAnimationFrameId) {
            window.cancelAnimationFrame(this.requestAnimationFrameId);
            this.requestAnimationFrameId = undefined;
        }

        if (this.autorRunDispose) {
            this.autorRunDispose();
            this.autorRunDispose = undefined;
        }

        LVGLPageRuntime.detachRuntimeFromPage(this.page);

        this.isMounted = false;
    }

    getLvglObj(lvglStyle: LVGLStyle) {
        const lvglWidget = this.lvglWidgetsMap.get(lvglStyle.forWidgetType);
        return lvglWidget ? lvglWidget._lvglObj : 0;
    }

    setSelectedStyle(
        selectedStyle: LVGLStyle | undefined,
        canvas: HTMLCanvasElement | null
    ) {
        this.selectedStyle = selectedStyle;
        this.canvas = canvas;
    }
}

////////////////////////////////////////////////////////////////////////////////

function getObjects(page: Page) {
    const objects = [];
    objects.push(page._lvglObj!);

    page._lvglWidgets.forEach(widget => objects.push(widget._lvglObj!));

    return objects;
}

function setObjects(
    page: Page,
    lvglRuntime: LVGLPageRuntime,
    objects: number[]
) {
    let index = 0;

    runInAction(() => {
        page._lvglRuntime = lvglRuntime;

        page._lvglObj = objects[index++];

        page._lvglWidgets.forEach(
            widget => (widget._lvglObj = objects[index++])
        );
    });
}

////////////////////////////////////////////////////////////////////////////////

export class LVGLReflectEditorRuntime extends LVGLPageRuntime {
    static PREVIEW_WIDTH = 400;
    static PREVIEW_HEIGHT = 400;

    foundDifferences = false;

    constructor(project: Project) {
        const widgets = getClassesDerivedFrom(
            project._store,
            ProjectEditor.LVGLWidgetClass
        ).filter(componentClass =>
            componentClass.objectClass.classInfo.enabledInComponentPalette
                ? componentClass.objectClass.classInfo.enabledInComponentPalette(
                      ProjectType.LVGL,
                      project._store
                  )
                : true
        );

        const page = createObject<Page>(
            project._store,
            {
                components: widgets.map(componentClass =>
                    Object.assign(
                        {},
                        getDefaultValue(
                            project._store,
                            componentClass.objectClass.classInfo
                        ),
                        {
                            type: componentClass.name,
                            left: 0,
                            leftUnit: "px",
                            top: 0,
                            topUnit: "px",
                            width: LVGLStylesEditorRuntime.PREVIEW_WIDTH,
                            widthUnit: "px",
                            height: LVGLStylesEditorRuntime.PREVIEW_HEIGHT,
                            heightUnit: "px",
                            localStyles: {}
                        }
                    )
                )
            },
            ProjectEditor.PageClass,
            undefined,
            true
        );

        setParent(page, project);

        super(page);

        this.mount();
    }

    get isEditor() {
        return true;
    }

    get displayWidth() {
        return LVGLStylesEditorRuntime.PREVIEW_WIDTH;
    }

    get displayHeight() {
        return LVGLStylesEditorRuntime.PREVIEW_HEIGHT;
    }

    mount() {
        this.wasm = getLvglWasmFlowRuntimeConstructor(this.lvglVersion)(
            async () => {
                runInAction(() => {
                    this.page._lvglRuntime = this;
                    this.page._lvglObj = undefined;
                });

                this.wasm._init(
                    0,
                    0,
                    0,
                    0,
                    this.displayWidth,
                    this.displayHeight,
                    this.project.settings.general.darkTheme,
                    -(new Date().getTimezoneOffset() / 60) * 100,
                    false
                );

                const pageObj = this.page.lvglCreate(this, 0);
                if (!pageObj) {
                    console.error("pageObj is undefined");
                    return;
                }

                const flags = getLvglFlagCodes(this.page) as {
                    [key: string]: number;
                };

                const children = this.page.lvglScreenWidget!.children;
                for (let i = 0; i < children.length; i++) {
                    const obj = children[i]._lvglObj!;

                    let reflectFlagsArr: string[] = [];
                    for (const key of Object.keys(flags)) {
                        if (this.wasm._lvglObjHasFlag(obj, flags[key])) {
                            reflectFlagsArr.push(key);
                        }
                    }
                    const reflectFlags = reflectFlagsArr.sort().join("|");

                    const classInfo = getClassInfo(children[i]);
                    const defaultValue = getDefaultValue(
                        this.project._store,
                        classInfo
                    );
                    let objInitFlags = defaultValue.widgetFlags;
                    if (defaultValue.hiddenFlag) {
                        objInitFlags = "HIDDEN|" + objInitFlags;
                    }
                    if (defaultValue.clickableFlag) {
                        objInitFlags = "CLICKABLE|" + objInitFlags;
                    }
                    let objDefaultFlags;
                    if (typeof classInfo.lvgl == "function") {
                        objDefaultFlags = classInfo.lvgl(
                            children[i],
                            this.project
                        ).defaultFlags;
                    } else {
                        objDefaultFlags = classInfo.lvgl!.defaultFlags;
                    }

                    objInitFlags = objInitFlags.split("|").sort().join("|");
                    objDefaultFlags = objDefaultFlags
                        .split("|")
                        .sort()
                        .join("|");

                    if (
                        objInitFlags != objDefaultFlags ||
                        objDefaultFlags != reflectFlags
                    ) {
                        if (!this.foundDifferences) {
                            this.foundDifferences = true;
                            console.log("<LVGLReflectEditorRuntime>");
                            console.log("\tLVGL version:", this.lvglVersion);
                        }

                        console.log("\t" + children[i].type);
                        console.log("\t\tInitFlags   : " + objInitFlags);
                        console.log("\t\tDefaultFlags: " + objDefaultFlags);
                        console.log("\t\tReflect     : " + reflectFlags);
                    }
                }

                if (this.foundDifferences) {
                    console.log("/<LVGLReflectEditorRuntime>");
                }
            }
        );
    }

    unmount() {
        LVGLPageRuntime.detachRuntimeFromPage(this.page);
    }
}

// let versionReflected = new Set<string>();

export function reflectLvglVersion(project: Project) {
    /*
    if (versionReflected.has(project.settings.general.lvglVersion)) {
        return;
    }
    versionReflected.add(project.settings.general.lvglVersion);
    new LVGLReflectEditorRuntime(project);
    */
}
