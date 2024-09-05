import {
    IReactionDisposer,
    autorun,
    runInAction,
    makeObservable,
    computed,
    observable,
    action
} from "mobx";

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
import type { LVGLTabWidget, LVGLWidget } from "project-editor/lvgl/widgets";
import {
    Project,
    ProjectType,
    findBitmap
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
    getLvglFlagCodes,
    getLvglStylePropCode,
    getLvglWasmFlowRuntimeConstructor
} from "project-editor/lvgl/lvgl-versions";
import type { IFlowContext } from "project-editor/flow/flow-interfaces";
import {
    LVGLStylePropCode,
    LV_ANIM_OFF
} from "project-editor/lvgl/lvgl-constants";
import {
    pad_bottom_property_info,
    pad_left_property_info,
    pad_right_property_info,
    pad_top_property_info
} from "./style-catalog";
import type { LVGLStyleObjects } from "project-editor/lvgl/style";

////////////////////////////////////////////////////////////////////////////////

export abstract class LVGLPageRuntime {
    lvglVersion: "8.3" | "9.0";

    wasm: IWasmFlowRuntime;
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

    lvglCreateContext: {
        widgetIndex: number;
        pageIndex: number;
        flowState: number;
    } = {
        widgetIndex: 0,
        pageIndex: 0,
        flowState: 0
    };

    constructor(public page: Page) {
        this.lvglVersion = this.project.settings.general.lvglVersion;

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

    abstract get isEditor(): boolean;

    abstract mount(): void;
    abstract unmount(): void;

    abstract getWidgetIndex(object: LVGLWidget | Page): number;

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

    getFontPtr(font: Font) {
        let cashedFont = this.fontsCache.get(font);
        if (!cashedFont || cashedFont.lvglBinFile != font.lvglBinFile) {
            if (cashedFont) {
                this.wasm._lvglFreeFont(cashedFont.fontPtr);
                this.fontsCache.delete(font);
                this.fontAddressToFont.delete(cashedFont.fontPtr);
            }

            const lvglBinFile = font.lvglBinFile;
            if (!lvglBinFile) {
                return 0;
            }

            const bin = Buffer.from(lvglBinFile, "base64");

            const fontMemPtr = this.wasm._malloc(bin.length);
            if (!fontMemPtr) {
                return 0;
            }
            for (let i = 0; i < bin.length; i++) {
                this.wasm.HEAP8[fontMemPtr + i] = bin[i];
            }

            const fontPathStr = this.wasm.allocateUTF8("M:" + fontMemPtr);

            let fontPtr = this.wasm._lvglLoadFont(fontPathStr);

            this.wasm._free(fontPathStr);

            this.wasm._free(fontMemPtr);

            cashedFont = {
                lvglBinFile,
                fontPtr
            };

            this.fontsCache.set(font, cashedFont);
            this.fontAddressToFont.set(fontPtr, font);
        }

        return cashedFont.fontPtr;
    }

    strings: number[] = [];

    allocateUTF8(str: string, free: boolean) {
        const stringPtr = this.wasm.allocateUTF8(str);
        if (free) {
            this.strings.push(stringPtr);
        }
        return stringPtr;
    }

    freeStrings() {
        for (const stringPtr of this.strings) {
            this.wasm._free(stringPtr);
        }
        this.strings = [];
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

                page._lvglWidgetsIncludingUserWidgets.forEach(
                    widget => (widget._lvglObj = undefined)
                );
            }

            page._lvglRuntime = undefined;
        });
    }

    get isV9() {
        return this.lvglVersion == "9.0";
    }

    styleObjMap = new Map<LVGLStyle, LVGLStyleObjects>();

    createStyles() {
        for (const style of this.projectStore.lvglIdentifiers.styles) {
            const lvglStyleObjects = style.lvglCreateStyles(this);
            this.styleObjMap.set(style, lvglStyleObjects);
        }
    }

    deleteStyles() {
        for (const [style, lvglStyleObjects] of this.styleObjMap.entries()) {
            style.lvglDeleteStyles(this, lvglStyleObjects);
        }

        this.styleObjMap.clear();
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
}

////////////////////////////////////////////////////////////////////////////////

export class LVGLPageEditorRuntime extends LVGLPageRuntime {
    autorRunDispose: IReactionDisposer | undefined;
    dispose2: IReactionDisposer | undefined;
    requestAnimationFrameId: number | undefined;

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
                    -(new Date().getTimezoneOffset() / 60) * 100
                );

                this.requestAnimationFrameId = window.requestAnimationFrame(
                    this.tick
                );

                this.autorRunDispose = autorun(() => {
                    if (!this.isMounted) {
                        return;
                    }

                    if (this.dispose2) {
                        this.dispose2();
                        this.dispose2 = undefined;
                    }

                    try {
                        // set all _lvglObj to undefined
                        runInAction(() => {
                            this.page._lvglWidgetsIncludingUserWidgets.forEach(
                                widget => (widget._lvglObj = undefined)
                            );
                        });

                        this.wasm._lvglClearTimeline();

                        this.freeStrings();

                        this.deleteStyles();

                        this.createStyles();

                        const pageObj = this.page.lvglCreate(this, 0);
                        if (!pageObj) {
                            console.error("pageObj is undefined");
                        }

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
                                    if (
                                        tabviewWidget &&
                                        tabviewWidget._lvglObj
                                    ) {
                                        const tabIndex = tabWidget.tabIndex;

                                        if (tabIndex != -1) {
                                            this.wasm._lvglTabviewSetActive(
                                                tabviewWidget._lvglObj,
                                                tabWidget.tabIndex,
                                                LV_ANIM_OFF
                                            );

                                            runInAction(() => {
                                                tabWidget._refreshRelativePosition++;
                                            });
                                        }
                                    }
                                }
                            }
                        });
                    } catch (e) {
                        console.error(e);
                        setTimeout(() => {
                            this.unmount();
                            this.mount();
                        });
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

    override getWidgetIndex(object: LVGLWidget | Page) {
        return 0;
    }
}

////////////////////////////////////////////////////////////////////////////////

export class LVGLNonActivePageViewerRuntime extends LVGLPageRuntime {
    requestAnimationFrameId: number | undefined;

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
                    -(new Date().getTimezoneOffset() / 60) * 100
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

                const lgvlPageRuntime = (
                    this.projectStore.runtime as WasmRuntime
                ).lgvlPageRuntime;

                if (lgvlPageRuntime) {
                    lgvlPageRuntime.onNonActivePageViewRuntimeMounted(this);
                }
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

    override getWidgetIndex(object: LVGLWidget | Page) {
        return 0;
    }
}

////////////////////////////////////////////////////////////////////////////////

export class LVGLPageViewerRuntime extends LVGLPageRuntime {
    reactionDispose: IReactionDisposer | undefined;

    pageStates = new Map<
        Page,
        {
            page: Page;
            nonActivePageViewerRuntime:
                | LVGLNonActivePageViewerRuntime
                | undefined;
            activeObjects: number[] | undefined;
            nonActiveObjects: number[] | undefined;
        }
    >();

    widgetIndex: number;

    constructor(private runtime: WasmRuntime) {
        super(runtime.selectedPage);
        this.wasm = runtime.worker.wasm;

        this.widgetIndex =
            this.runtime.projectStore.lvglIdentifiers.maxWidgetIndex + 1;

        this.pages.forEach(page =>
            this.pageStates.set(page, {
                page,
                nonActivePageViewerRuntime: undefined,
                activeObjects: undefined,
                nonActiveObjects: undefined
            })
        );
    }

    get pages() {
        const pages: Page[] = [];

        function enumInProject(project: Project) {
            pages.push(...project.pages);
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

    async mount() {
        for (const page of this.pages) {
            this.lvglCreate(page);
        }

        this.reactionDispose = autorun(() => {
            const selectedPage = this.runtime.selectedPage;
            const pageState = this.pageStates.get(selectedPage)!;
            setObjects(selectedPage, this, pageState.activeObjects!);
            this.wasm._lvglScreenLoad(-1, selectedPage._lvglObj!);
        });

        this.isMounted = true;
    }

    unmount() {
        if (this.reactionDispose) {
            this.reactionDispose();
        }

        const project = ProjectEditor.getProject(this.page);

        for (const page of project.pages) {
            LVGLPageRuntime.detachRuntimeFromPage(page);
        }

        this.isMounted = false;
    }

    lvglCreate(page: Page) {
        this.page = page;

        runInAction(() => {
            this.page._lvglRuntime = this;
        });

        const pagePath = getObjectPathAsString(this.page);
        const pageIndex = this.runtime.assetsMap.flowIndexes[pagePath];

        this.lvglCreateContext = {
            widgetIndex: 0,
            pageIndex,
            flowState: this.wasm._lvglGetFlowState(0, pageIndex)
        };

        this.createStyles();

        const pageObj = this.page.lvglCreate(this, 0);

        this.wasm._lvglScreenLoad(pageIndex, pageObj);

        runInAction(() => {
            this.page._lvglObj = pageObj;
        });

        this.pageStates.get(page)!.activeObjects = getObjects(page);

        return pageObj;
    }

    onNonActivePageViewRuntimeMounted(runtime: LVGLNonActivePageViewerRuntime) {
        const pageState = this.pageStates.get(runtime.page)!;
        pageState.nonActivePageViewerRuntime = runtime;
        pageState.nonActiveObjects = getObjects(runtime.page);
    }

    onNonActivePageViewRuntimeUnmounted(
        runtime: LVGLNonActivePageViewerRuntime
    ) {
        const pageState = this.pageStates.get(runtime.page)!;
        pageState.nonActivePageViewerRuntime = undefined;
        pageState.nonActiveObjects = undefined;
        if (pageState.activeObjects) {
            setObjects(pageState.page, this, pageState.activeObjects);
        }
    }

    override getWidgetIndex(object: LVGLWidget | Page) {
        const identifier =
            this.runtime.projectStore.lvglIdentifiers.getIdentifier(object);
        if (identifier) {
            return this.lvglCreateContext.widgetIndex + identifier.index;
        }

        return this.widgetIndex++;
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
                    -(new Date().getTimezoneOffset() / 60) * 100
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
                        this.page._lvglWidgetsIncludingUserWidgets.forEach(
                            widget => (widget._lvglObj = undefined)
                        );
                    });

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

                                flags.push("HIDDEN");
                            }

                            lvglWidget.widgetFlags = flags.join("|");
                        }

                        const lvglScreenWidget = this.page.lvglScreenWidget!;
                        if (
                            this.selectedStyle &&
                            this.canvas &&
                            lvglScreenWidget.type ==
                                this.selectedStyle.forWidgetType
                        ) {
                            lvglScreenWidget._useStyleForStylePreview =
                                this.selectedStyle.name;
                            lvglScreenWidget.states =
                                this.project._store.uiStateStore.lvglState;
                        } else {
                            lvglScreenWidget._useStyleForStylePreview = "";
                            lvglScreenWidget.states = "";
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

    override getWidgetIndex(object: LVGLWidget | Page) {
        return 0;
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

    page._lvglWidgetsIncludingUserWidgets.forEach(widget =>
        objects.push(widget._lvglObj!)
    );

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

        page._lvglWidgetsIncludingUserWidgets.forEach(
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
                    -(new Date().getTimezoneOffset() / 60) * 100
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

    getWidgetIndex(object: LVGLWidget | Page) {
        return 0;
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
