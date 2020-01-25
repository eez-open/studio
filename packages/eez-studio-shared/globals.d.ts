/// <reference path="../../node_modules/electron/electron.d.ts"/>

declare const EEZStudio: {
    title: string;
    electron: Electron.RendererInterface;
    require: any;
    windowType: string;
};

declare module "quill";

declare module "react-visibility-sensor";

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
