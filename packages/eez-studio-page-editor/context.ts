import { Rect } from "eez-studio-shared/geometry";

import { EezArrayObject } from "eez-studio-shared/model/object";

import { Page } from "eez-studio-page-editor/page";
import { Widget } from "eez-studio-page-editor/widget";

export interface IDataItem {
    type: "integer" | "float" | "boolean" | "string" | "enum" | "list";
    enumItems: string;
}

export interface IDataContext {
    get(dataItemId: string): any;
    count(dataItemId: string): number;
    getEnumValue(dataItemId: string): number;
    findDataItemIndex(dataItemId: string): number;
    findDataItem(dataItemId: string): IDataItem | undefined;
}

export interface IDrawContext {
    drawPageFrame(ctx: CanvasRenderingContext2D, rect: Rect, scale: number, style: string): void;
    drawDefaultWidget(widget: Widget, rect: Rect): HTMLCanvasElement | undefined;
    drawLayoutViewWidget(widget: Widget, rect: Rect): HTMLCanvasElement | undefined;
}

export interface IStyle {
    backgroundColor?: string;
}

export interface IPageContext {
    inEditor: boolean;

    data: IDataContext;
    draw: IDrawContext;

    findActionIndex(actionName: any): number;
    getPages(): EezArrayObject<Page>;
    findPage(pageName: string): Page | undefined;
    findStyle(styleName: any): IStyle | undefined;
    findStyleOrGetDefault(styleName: any): IStyle;
}

export let PageContext: IPageContext;

export function setPageContext(context: IPageContext) {
    PageContext = context;
}
