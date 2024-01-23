/// <reference path="../eez-studio-shared/globals.d.ts"/>

declare const opentype: {
    parse(arg: any): any;
};

declare const ace: {
    edit(arg: any): any;
    acequire(arg: any): any;
};

declare module "jspanel4";

/*
__eezProjectMigration = { sourceWidth: 480, sourceHeight: 272, targetWidth: 800, targetHeight: 480 };
*/
declare const __eezProjectMigration: {
    displaySourceWidth: number;
    displaySourceHeight: number;
    displayTargetWidth: number;
    displayTargetHeight: number;
    fonts: {
        [source: string]: string;
    };
};
