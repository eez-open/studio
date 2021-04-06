/// <reference path="../../node_modules/electron/electron.d.ts"/>

declare const EEZStudio: {
    title: string;
    isWebStudio?: boolean;
    electron: typeof Electron;
    require: any;
    windowType: string;
    remote: typeof Electron.remote;
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
