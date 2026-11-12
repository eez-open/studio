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

    // the whole display, RGBA
    render() {
        const ptr = this.wasm._editorRender();
        return new Uint8ClampedArray(
            this.wasm.HEAPU8.buffer,
            ptr,
            this.displayWidth * this.displayHeight * 4
        ).slice();
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
