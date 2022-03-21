export interface RendererToWorkerMessage {
    assets?: {
        data: Uint8Array;
        map: {
            dashboardComponentTypeToNameMap: {
                [componentType: number]: string;
            };
        };
    };
    wheel?: {
        deltaY: number;
        clicked: number;
    };
    pointerEvents?: {
        x: number;
        y: number;
        pressed: number;
    }[];
    messageFromDebugger?: ArrayBuffer;
}

export interface WorkerToRenderMessage {
    init?: any;
    screen?: Uint8ClampedArray;
    messageToDebugger?: Uint8Array;
}
