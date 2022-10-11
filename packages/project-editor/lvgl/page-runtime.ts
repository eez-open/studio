import { IReactionDisposer, autorun, runInAction } from "mobx";

import type { Page } from "project-editor/features/page/page";
import type { IWasmFlowRuntime } from "eez-studio-types";
import { ProjectEditor } from "project-editor/project-editor-interface";
import type { Bitmap } from "project-editor/features/bitmap/bitmap";
import { visitObjects } from "project-editor/core/search";
import type { WorkerToRenderMessage } from "project-editor/flow/runtime/wasm-worker-interfaces";

const lvgl_flow_runtime_constructor = require("project-editor/flow/runtime/lvgl_runtime.js");

export abstract class LVGLPageRuntime {
    wasm: IWasmFlowRuntime;

    bitmapsCache = new Map<
        Bitmap,
        {
            image: string;
            bitmapPtr: number;
        }
    >();

    constructor(public page: Page) {}

    abstract get isEditor(): boolean;

    async loadBitmap(bitmapName: string) {
        const bitmap = ProjectEditor.findBitmap(
            ProjectEditor.getProject(this.page),
            bitmapName
        );

        if (!bitmap) {
            return 0;
        }

        const cashed = this.bitmapsCache.get(bitmap);
        if (cashed) {
            if (cashed.image == bitmap.image) {
                return cashed.bitmapPtr;
            }

            this.bitmapsCache.delete(bitmap);
            this.wasm._free(cashed.bitmapPtr);
        }

        const bitmapData = await ProjectEditor.getBitmapData(bitmap);

        let bitmapPtr = this.wasm._malloc(4 + 4 + 4 + bitmapData.pixels.length);

        if (!bitmapPtr) {
            return 0;
        }

        let header =
            ((bitmapData.bpp == 24 ? 4 : 5) << 0) |
            (bitmapData.width << 10) |
            (bitmapData.height << 21);

        this.wasm.HEAP32[(bitmapPtr >> 2) + 0] = header;

        this.wasm.HEAP32[(bitmapPtr >> 2) + 1] = bitmapData.pixels.length;

        this.wasm.HEAP32[(bitmapPtr >> 2) + 2] = bitmapPtr + 12;

        const offset = bitmapPtr + 12;
        for (let i = 0; i < bitmapData.pixels.length; i += 4) {
            this.wasm.HEAP8[offset + i] = bitmapData.pixels[i + 2];

            this.wasm.HEAP8[offset + i + 1] = bitmapData.pixels[i + 1];

            this.wasm.HEAP8[offset + i + 2] = bitmapData.pixels[i + 0];

            this.wasm.HEAP8[offset + i + 3] = bitmapData.pixels[i + 3];
        }

        this.bitmapsCache.set(bitmap, {
            image: bitmap.image,
            bitmapPtr
        });

        return bitmapPtr;
    }
}

export class LVGLPageEditorRuntime extends LVGLPageRuntime {
    autorRunDispose: IReactionDisposer | undefined;
    requestAnimationFrameId: number | undefined;

    constructor(
        page: Page,
        public displayWidth: number,
        public displayHeight: number,
        public ctx: CanvasRenderingContext2D
    ) {
        super(page);

        this.wasm = lvgl_flow_runtime_constructor(() => {
            runInAction(() => {
                this.page._lvglRuntime = this;
            });

            this.wasm._init(0, 0, 0);

            this.requestAnimationFrameId = window.requestAnimationFrame(
                this.tick
            );

            this.autorRunDispose = autorun(() => {
                const pageObj = this.page.lvglCreate(this, 0).obj;

                if (this.page._lvglObj != undefined) {
                    this.wasm._lvglDeleteObject(this.page._lvglObj);
                }

                runInAction(() => (this.page._lvglObj = pageObj));
            });
        });
    }

    get isEditor() {
        return true;
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

        if (this.autorRunDispose) {
            this.autorRunDispose();
        }

        if (this.page._lvglObj != undefined) {
            this.wasm._lvglDeleteObject(this.page._lvglObj);
            runInAction(() => {
                const v = visitObjects(this.page.components);
                while (true) {
                    let visitResult = v.next();
                    if (visitResult.done) {
                        break;
                    }
                    if (
                        visitResult.value instanceof
                        ProjectEditor.LVGLWidgetClass
                    ) {
                        const lvglWidget = visitResult.value;
                        lvglWidget._lvglObj = undefined;
                    }
                }

                this.page._lvglObj = undefined;
            });
        }

        runInAction(() => {
            this.page._lvglRuntime = undefined;
        });
    }
}

export class LVGLPageViewerRuntime extends LVGLPageRuntime {
    autorRunDispose: IReactionDisposer | undefined;
    requestAnimationFrameId: number | undefined;

    constructor(
        page: Page,
        public displayWidth: number,
        public displayHeight: number,
        postWorkerToRenderMessage: (data: WorkerToRenderMessage) => void
    ) {
        super(page);
        this.wasm = lvgl_flow_runtime_constructor(postWorkerToRenderMessage);
    }

    get isEditor() {
        return false;
    }

    lvglCreate() {
        this.page.lvglCreate(this, 0);
    }
}
