/// <reference path="../../node_modules/electron/electron.d.ts"/>

declare const EEZStudio: {
    title: string;
    electron: typeof Electron;
    require: any;
    windowType: string;
    remote: any;
};

declare module "quill";

//
interface HTMLCanvasElement {
    transferControlToOffscreen(): HTMLCanvasElement;
}
interface CanvasRenderingContext2D {
    commit(): void;
}

//
declare class GoldenLayout {
    constructor(config: any, layout: any);
}

declare module "xml-formatter";

declare const WasmFlowRuntime: {
    HEAPU8: Uint8Array;
    _malloc(size: number): number;
    _free(ptr: number): void;

    _mainLoop();
    _getSyncedBuffer(): number;
    _onMouseWheelEvent(wheelDeltaY: number, wheelClicked: number);
    _onPointerEvent(x: number, y: number, pressed: number);
    _loadAssets(assets: number, assetsSize: number);
};
