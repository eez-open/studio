// The framework WASM (eez_runtime) in editor mode: draws one EEZ-GUI page from
// the assets of the editor build (build/editor-build.ts). One instance per page
// editor, kept alive; every change loads new assets into it.

const eez_runtime_constructor = require("project-editor/flow/runtime/wasm/eez_runtime.js");

export class EezGuiEditorWasm {
    private wasm: any;
    // the framework uses the assets in place, they are freed after the next load
    private assetsPtr = 0;

    displayWidth = 0;
    displayHeight = 0;

    static create() {
        return new Promise<EezGuiEditorWasm>(resolve => {
            const editorWasm = new EezGuiEditorWasm();
            editorWasm.wasm = eez_runtime_constructor((message: any) => {
                if (message && message.init) {
                    resolve(editorWasm);
                }
            });
        });
    }

    // the display size is set by the first load
    load(assets: Uint8Array, displayWidth: number, displayHeight: number) {
        const ptr = this.wasm._malloc(assets.length);
        this.wasm.HEAPU8.set(assets, ptr);

        this.wasm._editorLoad(ptr, assets.length, displayWidth, displayHeight);

        if (this.assetsPtr) {
            this.wasm._free(this.assetsPtr);
        }
        this.assetsPtr = ptr;

        if (!this.displayWidth) {
            this.displayWidth = displayWidth;
            this.displayHeight = displayHeight;
        }
    }

    setTheme(themeIndex: number) {
        this.wasm._editorSetTheme(themeIndex);
    }

    // The positions of the scrollable widgets: pairs of the offset of the
    // widget in the loaded assets data and its position in lines (px for a
    // Container). They replace the previous ones and are drawn by the next
    // render. See editorSetScrollPositions in eez-runtime editor.cpp.
    setScrollPositions(pairs: number[]) {
        const count = pairs.length / 2;
        const ptr = this.wasm._malloc(Math.max(pairs.length, 1) * 4);
        this.wasm.HEAP32.set(pairs, ptr >> 2);
        this.wasm._editorSetScrollPositions(ptr, count);
        this.wasm._free(ptr);
    }

    // the whole display, RGBA
    render() {
        const ptr = this.wasm._editorRender();
        return new Uint8ClampedArray(
            this.wasm.HEAPU8.buffer,
            ptr,
            this.displayWidth * this.displayHeight * 4
        ).slice();
    }

    // The boxes of the widgets of the page drawn last, on the display, in the
    // order the framework enumerates them (hidden widgets are not there): the
    // offset of the widget in the loaded assets data (the widgetOffsets of
    // buildEditorAssets), its box, and the scroll position it was drawn with
    // and the largest one, in lines (px for a Container; -1 and 0 if the
    // widget doesn't keep a position). See editorGetWidgetBoxes in eez-runtime
    // editor.cpp.
    getWidgetBoxes() {
        const ptr = this.wasm._editorGetWidgetBoxes() >> 2;
        const heap: Int32Array = this.wasm.HEAP32;
        const count = heap[ptr];
        const boxes: {
            offset: number;
            left: number;
            top: number;
            width: number;
            height: number;
            scrollPosition: number;
            maxScrollPosition: number;
        }[] = [];
        for (let i = 0; i < count; i++) {
            const k = ptr + 1 + i * 7;
            boxes.push({
                offset: heap[k],
                left: heap[k + 1],
                top: heap[k + 2],
                width: heap[k + 3],
                height: heap[k + 4],
                scrollPosition: heap[k + 5],
                maxScrollPosition: heap[k + 6]
            });
        }
        return boxes;
    }

    // The part of the display where the page is: the framework draws a page
    // at its left and top (a page not at 0, 0 over a backdrop). The part of
    // the rectangle outside the display stays transparent.
    renderPage(left: number, top: number, width: number, height: number) {
        const frame = this.render();
        const pixels = new Uint8ClampedArray(width * height * 4);

        const x1 = Math.max(left, 0);
        const x2 = Math.min(left + width, this.displayWidth);
        if (x2 > x1) {
            for (let y = 0; y < height; y++) {
                const displayY = top + y;
                if (displayY < 0 || displayY >= this.displayHeight) {
                    continue;
                }
                pixels.set(
                    frame.subarray(
                        (displayY * this.displayWidth + x1) * 4,
                        (displayY * this.displayWidth + x2) * 4
                    ),
                    (y * width + (x1 - left)) * 4
                );
            }
        }

        return new ImageData(pixels, width, height);
    }
}
