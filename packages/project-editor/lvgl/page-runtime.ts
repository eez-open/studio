import {
    IReactionDisposer,
    autorun,
    runInAction,
    makeObservable,
    computed,
    reaction
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
import type { Project } from "project-editor/project/project";
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

    lvglCreateContext: {
        widgetIndex: number;
        flowIndex: number;
        userWidgetComponentIndexes: number[];
    } = {
        widgetIndex: 0,
        flowIndex: 0,
        userWidgetComponentIndexes: []
    };

    constructor(public page: Page) {}

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
            return fontPtr;
        }

        this.fontsCache.delete(font);
        this.wasm._lvglFreeFont(fontPtr);

        return this.loadFont(font);
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
                runtime.wasm._lvglDeleteObject(page._lvglObj);
                page._lvglObj = undefined;

                page._lvglWidgets.forEach(
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

    dispose1: IReactionDisposer | undefined;

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
        const wasm = lvgl_flow_runtime_constructor(() => {
            if (this.wasm != wasm) {
                return;
            }

            runInAction(() => {
                this.page._lvglRuntime = this;
                this.page._lvglObj = undefined;
            });

            this.wasm._init(0, 0, 0, this.displayWidth, this.displayHeight);

            this.requestAnimationFrameId = window.requestAnimationFrame(
                this.tick
            );

            this.autorRunDispose = autorun(() => {
                // set all _lvglObj to undefined
                runInAction(() => {
                    this.page._lvglWidgets.forEach(
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

        if (this.dispose1) {
            this.dispose1();
            this.dispose1 = undefined;
        }

        this.dispose1 = reaction(
            () => ({
                width: this.displayWidth,
                height: this.displayHeight
            }),
            size => {
                this.unmount();
                this.mount();
            }
        );
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
        if (this.dispose1) {
            this.dispose1();
            this.dispose1 = undefined;
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

            this.wasm._init(0, 0, 0, this.page.width, this.page.height);

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

        this.widgetIndex = ProjectEditor.getLvglIdentifiers(this.page).size;

        runtime.projectStore.project.pages.forEach(page =>
            this.pageStates.set(page, {
                page,
                nonActivePageViewerRuntime: undefined,
                activeObjects: undefined,
                nonActiveObjects: undefined
            })
        );
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
        const bitmap = ProjectEditor.findBitmap(
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
            flowIndex: pageIndex,
            userWidgetComponentIndexes: []
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
        let widgetIndex;
        if (object instanceof ProjectEditor.PageClass) {
            widgetIndex = ProjectEditor.getLvglIdentifiers(object).get(
                object.name
            )!.index;
        } else if (object.identifier) {
            widgetIndex =
                this.lvglCreateContext.widgetIndex +
                ProjectEditor.getLvglIdentifiers(object).get(object.identifier)!
                    .index;
        } else {
            widgetIndex = this.widgetIndex++;
        }

        return widgetIndex;
    }
}

////////////////////////////////////////////////////////////////////////////////

export class LVGLStylesEditorRuntime extends LVGLPageRuntime {
    autorRunDispose: IReactionDisposer | undefined;
    requestAnimationFrameId: number | undefined;

    wasmInitialized = false;

    lvglWidgetsMap = new Map<string, LVGLWidget>();

    canvas: HTMLCanvasElement | null = null;
    selectedStyle: LVGLStyle | undefined;

    constructor(public project: Project) {
        const page = createObject<Page>(
            project._store,
            {
                components: getClassesDerivedFrom(
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

        this.mount();
    }

    get displayWidth() {
        return this.project.settings.general.displayWidth;
    }

    get displayHeight() {
        return this.project.settings.general.displayHeight;
    }

    get isEditor() {
        return true;
    }

    mount() {
        autorun(() => {
            this.displayWidth;
            this.displayHeight;

            this.unmount();

            const wasm = lvgl_flow_runtime_constructor(() => {
                if (this.wasm != wasm) {
                    return;
                }

                runInAction(() => {
                    this.page._lvglRuntime = this;
                    this.page._lvglObj = undefined;
                });

                this.wasm._init(0, 0, 0, this.displayWidth, this.displayHeight);
                this.wasmInitialized = true;

                this.requestAnimationFrameId = window.requestAnimationFrame(
                    this.tick
                );

                if (this.autorRunDispose) {
                    this.autorRunDispose();
                }

                this.autorRunDispose = autorun(() => {
                    // set all _lvglObj to undefined
                    runInAction(() => {
                        this.page._lvglWidgets.forEach(
                            widget => (widget._lvglObj = undefined)
                        );
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
        });

        this.isMounted = true;
    }

    unmount() {
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

    tick = () => {
        if (this.canvas && this.wasmInitialized) {
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

    setSelectedStyle(
        selectedStyle: LVGLStyle | undefined,
        canvas: HTMLCanvasElement | null
    ) {
        this.canvas = canvas;

        runInAction(() => {
            for (const lvglWidget of this.lvglWidgetsMap.values()) {
                const flags = lvglWidget.flags.split("|");

                const i = flags.indexOf("HIDDEN");
                if (i != -1) {
                    flags.splice(i, 1);
                }

                if (
                    selectedStyle &&
                    this.canvas &&
                    lvglWidget.type == selectedStyle.forWidgetType
                ) {
                    lvglWidget.useStyle = selectedStyle.name;
                } else {
                    lvglWidget.useStyle = "";
                    flags.push("HIDDEN");
                }

                lvglWidget.flags = flags.join("|");
            }
        });

        this.selectedStyle = selectedStyle;
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
