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
    getObjectPathAsString,
    getProjectStore,
    ProjectStore
} from "project-editor/store";
import type { WasmRuntime } from "project-editor/flow/runtime/wasm-runtime";
import type { LVGLWidget } from "project-editor/lvgl/widgets";
import { Project, findBitmap } from "project-editor/project/project";
import { getClassesDerivedFrom, setParent } from "project-editor/core/object";
import type { LVGLStyle } from "./style";
import { PageTabState } from "project-editor/features/page/PageEditor";

const lvgl_flow_runtime_constructor = require("project-editor/flow/runtime/lvgl_runtime.js");

////////////////////////////////////////////////////////////////////////////////

export abstract class LVGLPageRuntime {
    wasm: IWasmFlowRuntime;
    isMounted: boolean = false;

    bitmapsCache = new Map<
        Bitmap,
        {
            image: string;
            bitmapPtrPromise: Promise<number>;
            bitmapPtr: number;
        }
    >();

    fontsCache = new Map<
        Font,
        {
            lvglBinFile: string;
            fontPtrPromise: Promise<number>;
        }
    >();
    fontAddressToFont = new Map<number, Font>();

    unusedFontPtrs: number[] = [];

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
        makeObservable(this, {
            asyncOperationsQueue: observable
        });
    }

    abstract get isEditor(): boolean;

    abstract mount(): void;
    abstract unmount(): void;

    abstract getWidgetIndex(object: LVGLWidget | Page): number;

    async loadBitmap(bitmap: Bitmap): Promise<number> {
        const doLoad = async (bitmap: Bitmap) => {
            const bitmapData = await ProjectEditor.getBitmapData(bitmap, 32);

            let bitmapPtr = this.wasm._malloc(
                4 + 4 + 4 + bitmapData.pixels.length
            );

            if (!bitmapPtr) {
                return 0;
            }

            const LV_IMG_CF_TRUE_COLOR = 4;
            const LV_IMG_CF_TRUE_COLOR_ALPHA = 5;
            const LV_IMG_CF_RGB565A8 = 20;

            let header =
                ((bitmapData.bpp == 32
                    ? LV_IMG_CF_TRUE_COLOR_ALPHA
                    : bitmapData.bpp == 24
                    ? LV_IMG_CF_TRUE_COLOR
                    : LV_IMG_CF_RGB565A8) <<
                    0) |
                (bitmapData.width << 10) |
                (bitmapData.height << 21);

            this.wasm.HEAP32[(bitmapPtr >> 2) + 0] = header;

            this.wasm.HEAP32[(bitmapPtr >> 2) + 1] = bitmapData.pixels.length;

            const offset = bitmapPtr + 12;

            this.wasm.HEAP32[(bitmapPtr >> 2) + 2] = offset;

            for (let i = 0; i < bitmapData.pixels.length; i++) {
                this.wasm.HEAP8[offset + i] = bitmapData.pixels[i];
            }

            return bitmapPtr;
        };

        let cashed = this.bitmapsCache.get(bitmap);
        if (!cashed) {
            cashed = {
                image: bitmap.image,
                bitmapPtrPromise: doLoad(bitmap),
                bitmapPtr: 0
            };

            this.bitmapsCache.set(bitmap, cashed);
        }

        const bitmapPtr = await cashed.bitmapPtrPromise;
        cashed.bitmapPtr = bitmapPtr;

        if (cashed.image == bitmap.image) {
            return bitmapPtr;
        }

        this.bitmapsCache.delete(bitmap);
        this.wasm._free(bitmapPtr);

        return this.loadBitmap(bitmap);
    }

    async loadFont(font: Font): Promise<number> {
        if (!font.lvglBinFile) {
            return 0;
        }

        const doLoad = async (font: Font) => {
            const bin = Buffer.from(font.lvglBinFile!, "base64");

            const fontMemPtr = this.wasm._malloc(bin.length);
            if (!fontMemPtr) {
                return 0;
            }
            for (let i = 0; i < bin.length; i++) {
                this.wasm.HEAP8[fontMemPtr + i] = bin[i];
            }

            let fontPtr = this.wasm._lvglLoadFont(
                this.wasm.allocateUTF8("M:" + fontMemPtr)
            );

            this.wasm._free(fontMemPtr);

            return fontPtr;
        };

        let cashed = this.fontsCache.get(font);
        if (!cashed) {
            cashed = {
                lvglBinFile: font.lvglBinFile,
                fontPtrPromise: doLoad(font)
            };

            this.fontsCache.set(font, cashed);
        }

        const fontPtr = await cashed.fontPtrPromise;

        if (cashed.lvglBinFile == font.lvglBinFile) {
            runInAction(() => {
                this.fontAddressToFont.set(fontPtr, font);
            });

            return fontPtr;
        }

        this.fontsCache.delete(font);
        runInAction(() => {
            this.fontAddressToFont.delete(fontPtr);
        });

        if (this.unusedFontPtrs.indexOf(fontPtr) == -1) {
            this.unusedFontPtrs.push(fontPtr);
        }

        return this.loadFont(font);
    }

    freeUnusedFontPtrs() {
        for (const fontPtr of this.unusedFontPtrs) {
            this.wasm._lvglFreeFont(fontPtr);
        }
        this.unusedFontPtrs = [];
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

    asyncOperationsQueue: (() => Promise<void>)[] = [];
    inAsyncQueueProcessing: boolean = false;
    refreshCounter: number = 0;

    async executeAsyncOperation<T>(
        getAsyncParams: () => Promise<T>,
        executeOperationWithAsyncParams: (params: T) => void
    ) {
        const refreshCounter = this.refreshCounter;

        const asyncOperation = async () => {
            const params = await getAsyncParams();
            if (this.isMounted && refreshCounter == this.refreshCounter) {
                executeOperationWithAsyncParams(params);
            }
        };

        runInAction(() => {
            this.asyncOperationsQueue.push(asyncOperation);
        });

        setTimeout(() => this.processAsyncQueue());
    }

    async processAsyncQueue() {
        if (this.inAsyncQueueProcessing) {
            return;
        }
        this.inAsyncQueueProcessing = true;
        while (this.asyncOperationsQueue.length > 0) {
            await this.asyncOperationsQueue[0]();
            runInAction(() => {
                this.asyncOperationsQueue.shift();
            });
        }
        this.inAsyncQueueProcessing = false;
    }

    get isAnyAsyncOperation() {
        return this.asyncOperationsQueue.length > 0;
    }

    static detachRuntimeFromPage(page: Page) {
        runInAction(() => {
            const runtime = page._lvglRuntime;
            if (!runtime) {
                return;
            }

            if (page._lvglObj != undefined) {
                runtime.wasm._lvglDeleteObject(page._lvglObj);
                page._lvglObj = undefined;

                page._lvglWidgetsIncludingUserWidgets.forEach(
                    widget => (widget._lvglObj = undefined)
                );
            }

            page._lvglRuntime = undefined;
        });
    }
}

////////////////////////////////////////////////////////////////////////////////

export class LVGLPageEditorRuntime extends LVGLPageRuntime {
    autorRunDispose: IReactionDisposer | undefined;
    requestAnimationFrameId: number | undefined;

    constructor(page: Page, public ctx: CanvasRenderingContext2D) {
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

        const wasm = lvgl_flow_runtime_constructor(() => {
            if (this.wasm != wasm) {
                return;
            }

            runInAction(() => {
                this.page._lvglRuntime = this;
                this.page._lvglObj = undefined;
            });

            this.wasm._init(0, 0, 0, 0, this.displayWidth, this.displayHeight);

            this.requestAnimationFrameId = window.requestAnimationFrame(
                this.tick
            );

            this.autorRunDispose = autorun(() => {
                this.refreshCounter++;

                if (!this.isMounted) {
                    return;
                }

                // set all _lvglObj to undefined
                runInAction(() => {
                    this.page._lvglWidgetsIncludingUserWidgets.forEach(
                        widget => (widget._lvglObj = undefined)
                    );
                });

                this.wasm._lvglClearTimeline();

                this.freeStrings();

                const pageObj = this.page.lvglCreate(this, 0);
                if (!pageObj) {
                    console.error("pageObj is undefined");
                }

                const editor = getProjectStore(
                    this.page
                ).editorsStore.getEditorByObject(this.page);
                if (editor) {
                    const pageTabState = editor.state as PageTabState;
                    if (pageTabState?.timeline?.isEditorActive) {
                        this.wasm._lvglSetTimelinePosition(
                            pageTabState.timeline.position
                        );
                    }
                }

                this.wasm._lvglScreenLoad(-1, pageObj);

                this.freeUnusedFontPtrs();

                runInAction(() => {
                    if (this.page._lvglObj != undefined) {
                        this.wasm._lvglDeleteObject(this.page._lvglObj);
                    }
                    this.page._lvglObj = pageObj;
                });
            });
        });

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
        public projectStore: ProjectStore,
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
        this.wasm = lvgl_flow_runtime_constructor(() => {
            runInAction(() => {
                this.page._lvglRuntime = this;
                this.page._lvglObj = undefined;
            });

            this.wasm._init(0, 0, 0, 0, this.page.width, this.page.height);

            this.requestAnimationFrameId = window.requestAnimationFrame(
                this.tick
            );

            const pageObj = this.page.lvglCreate(this, 0);
            this.wasm._lvglScreenLoad(-1, pageObj);
            runInAction(() => {
                this.page._lvglRuntime = this;
                this.page._lvglObj = pageObj;
            });

            (
                this.projectStore.runtime as WasmRuntime
            ).lgvlPageRuntime!.onNonActivePageViewRuntimeMounted(this);
        });
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
            this.projectStore.runtime.lgvlPageRuntime!.onNonActivePageViewRuntimeUnmounted(
                this
            );
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

    mount() {
        this.reactionDispose = autorun(() => {
            const selectedPage = this.runtime.selectedPage;
            const pageState = this.pageStates.get(selectedPage)!;
            if (pageState.activeObjects) {
                setObjects(selectedPage, this, pageState.activeObjects!);
                this.wasm._lvglScreenLoad(-1, selectedPage._lvglObj!);
            } else {
                this.lvglCreate(selectedPage);
            }
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

    async loadAllBitmaps() {
        await Promise.all(
            this.runtime.projectStore.project.bitmaps.map(bitmap =>
                this.loadBitmap(bitmap)
            )
        );
    }

    getBitmap(bitmapName: string) {
        const bitmap = findBitmap(
            this.runtime.projectStore.project,
            bitmapName
        );
        if (!bitmap) {
            return 0;
        }
        const cashed = this.bitmapsCache.get(bitmap);
        if (!cashed) {
            return 0;
        }
        return cashed.bitmapPtr;
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
    lvglWidgetsMap = new Map<string, LVGLWidget>();

    selectedStyle: LVGLStyle | undefined;

    autorRunDispose: IReactionDisposer | undefined;
    requestAnimationFrameId: number | undefined;

    canvas: HTMLCanvasElement | null = null;

    constructor(public project: Project) {
        const page = createObject<Page>(
            project._store,
            {
                components: getClassesDerivedFrom(
                    project._store,
                    ProjectEditor.LVGLWidgetClass
                ).map(componentClass =>
                    Object.assign(
                        {},
                        componentClass.objectClass.classInfo.defaultValue,
                        {
                            type: componentClass.name,
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

        for (const component of page.components) {
            this.lvglWidgetsMap.set(component.type, component as LVGLWidget);
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
        return 400;
    }

    get displayHeight() {
        return 400;
    }

    mount() {
        if (this.isMounted) {
            return;
        }

        const wasm = lvgl_flow_runtime_constructor(() => {
            if (this.wasm != wasm) {
                return;
            }

            runInAction(() => {
                this.page._lvglRuntime = this;
                this.page._lvglObj = undefined;
            });

            this.wasm._init(0, 0, 0, 0, this.displayWidth, this.displayHeight);

            this.requestAnimationFrameId = window.requestAnimationFrame(
                this.tick
            );

            this.autorRunDispose = autorun(() => {
                this.refreshCounter++;

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
                // also, set useStyle
                runInAction(() => {
                    for (const lvglWidget of this.lvglWidgetsMap.values()) {
                        const flags = lvglWidget.flags.split("|");

                        const i = flags.indexOf("HIDDEN");
                        if (i != -1) {
                            flags.splice(i, 1);
                        }

                        if (
                            this.selectedStyle &&
                            this.canvas &&
                            lvglWidget.type == this.selectedStyle.forWidgetType
                        ) {
                            lvglWidget.useStyle = this.selectedStyle.name;

                            // "DEFAULT",
                            // "CHECKED",
                            // "PRESSED",
                            // "CHECKED|PRESSED",
                            // "DISABLED",
                            // "FOCUSED"
                            lvglWidget.states =
                                this.project._store.uiStateStore.lvglState;
                        } else {
                            lvglWidget.useStyle = "";
                            lvglWidget.states = "";

                            flags.push("HIDDEN");
                        }

                        lvglWidget.flags = flags.join("|");
                    }
                });

                const pageObj = this.page.lvglCreate(this, 0);
                if (!pageObj) {
                    console.error("pageObj is undefined");
                }

                this.wasm._lvglScreenLoad(-1, pageObj);

                runInAction(() => {
                    if (this.page._lvglObj != undefined) {
                        this.wasm._lvglDeleteObject(this.page._lvglObj);
                    }
                    this.page._lvglObj = pageObj;
                });
            });
        });

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
