import fs from "fs";
import {
    IReactionDisposer,
    autorun,
    runInAction,
    makeObservable,
    computed
} from "mobx";

import type { Page } from "project-editor/features/page/page";
import type { IWasmFlowRuntime } from "eez-studio-types";
import { ProjectEditor } from "project-editor/project-editor-interface";
import type { Bitmap } from "project-editor/features/bitmap/bitmap";
import type { Font } from "project-editor/features/font/font";
import {
    getObjectPathAsString,
    ProjectEditorStore
} from "project-editor/store";
import type { WasmRuntime } from "project-editor/flow/runtime/wasm-runtime";
import type { LVGLWidget } from "project-editor/lvgl/widgets";

const lvgl_flow_runtime_constructor = require("project-editor/flow/runtime/lvgl_runtime.js");

////////////////////////////////////////////////////////////////////////////////

export abstract class LVGLPageRuntime {
    wasm: IWasmFlowRuntime;

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
            lvglBinFilePath: string;
            fontPtrPromise: Promise<number>;
        }
    >();

    constructor(public page: Page) {}

    abstract get isEditor(): boolean;

    abstract mount(): void;
    abstract unmount(): void;

    abstract getWidgetIndex(object: LVGLWidget | Page): number;

    async loadBitmap(bitmap: Bitmap): Promise<number> {
        const doLoad = async (bitmap: Bitmap) => {
            const bitmapData = await ProjectEditor.getBitmapData(bitmap);

            let bitmapPtr = this.wasm._malloc(
                4 + 4 + 4 + bitmapData.pixels.length
            );

            if (!bitmapPtr) {
                return 0;
            }

            const LV_IMG_CF_TRUE_COLOR = 4;
            const LV_IMG_CF_TRUE_COLOR_ALPHA = 5;

            let header =
                ((bitmapData.bpp == 24
                    ? LV_IMG_CF_TRUE_COLOR
                    : LV_IMG_CF_TRUE_COLOR_ALPHA) <<
                    0) |
                (bitmapData.width << 10) |
                (bitmapData.height << 21);

            this.wasm.HEAP32[(bitmapPtr >> 2) + 0] = header;

            this.wasm.HEAP32[(bitmapPtr >> 2) + 1] = bitmapData.pixels.length;

            this.wasm.HEAP32[(bitmapPtr >> 2) + 2] = bitmapPtr + 12;

            const offset = bitmapPtr + 12;
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
        if (!font.lvglBinFilePath) {
            return 0;
        }

        const doLoad = async (font: Font) => {
            const projectEditorStore = ProjectEditor.getProject(
                this.page
            )._DocumentStore;

            const binStr = await fs.promises.readFile(
                projectEditorStore.getAbsoluteFilePath(font.lvglBinFilePath!),
                {
                    encoding: "binary"
                }
            );

            const bin = Buffer.from(binStr, "binary");

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
                lvglBinFilePath: font.lvglBinFilePath,
                fontPtrPromise: doLoad(font)
            };

            this.fontsCache.set(font, cashed);
        }

        const fontPtr = await cashed.fontPtrPromise;

        if (cashed.lvglBinFilePath == font.lvglBinFilePath) {
            return fontPtr;
        }

        this.fontsCache.delete(font);
        this.wasm._lvglFreeFont(fontPtr);

        return this.loadFont(font);
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
        return ProjectEditor.getProject(this.page).settings.general
            .displayWidth;
    }

    get displayHeight() {
        return ProjectEditor.getProject(this.page).settings.general
            .displayHeight;
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

                const pageObj = this.page.lvglCreate(this, 0).obj;
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
            this.requestAnimationFrameId = undefined;
        }

        if (this.autorRunDispose) {
            this.autorRunDispose();
            this.autorRunDispose = undefined;
        }

        LVGLPageRuntime.detachRuntimeFromPage(this.page);
    }

    override getWidgetIndex(object: LVGLWidget | Page) {
        return 0;
    }
}

////////////////////////////////////////////////////////////////////////////////

export class LVGLNonActivePageViewerRuntime extends LVGLPageRuntime {
    requestAnimationFrameId: number | undefined;

    constructor(
        public projectEditorStore: ProjectEditorStore,
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

            const pageObj = this.page.lvglCreate(this, 0).obj;
            this.wasm._lvglScreenLoad(-1, pageObj);
            runInAction(() => {
                this.page._lvglRuntime = this;
                this.page._lvglObj = pageObj;
            });

            (
                this.projectEditorStore.runtime as WasmRuntime
            ).lgvlPageRuntime!.onNonActivePageViewRuntimeMounted(this);
        });
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
            this.projectEditorStore.runtime instanceof
            ProjectEditor.WasmRuntimeClass
        ) {
            this.projectEditorStore.runtime.lgvlPageRuntime!.onNonActivePageViewRuntimeUnmounted(
                this
            );
        }
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
            runtime.projectEditorStore.project._lvglIdentifiers.size;

        runtime.projectEditorStore.project.pages.forEach(page =>
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
    }

    unmount() {
        if (this.reactionDispose) {
            this.reactionDispose();
        }

        const project = ProjectEditor.getProject(this.page);

        for (const page of project.pages) {
            LVGLPageRuntime.detachRuntimeFromPage(page);
        }
    }

    async loadAllBitmaps() {
        await Promise.all(
            this.runtime.projectEditorStore.project.bitmaps.map(bitmap =>
                this.loadBitmap(bitmap)
            )
        );
    }

    getBitmap(bitmapName: string) {
        const bitmap = ProjectEditor.findBitmap(
            this.runtime.projectEditorStore.project,
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

        const pageObj = this.page.lvglCreate(this, 0).obj;

        const pagePath = getObjectPathAsString(this.page);
        const pageIndex = this.runtime.assetsMap.flowIndexes[pagePath];

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
        if (object instanceof ProjectEditor.PageClass) {
            return this.runtime.projectEditorStore.project._lvglIdentifiers.get(
                object.name
            )!.index;
        }
        if (object.identifier) {
            return this.runtime.projectEditorStore.project._lvglIdentifiers.get(
                object.identifier
            )!.index;
        }
        return this.widgetIndex++;
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
