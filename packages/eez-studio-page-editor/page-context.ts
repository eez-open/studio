import { Rect } from "eez-studio-shared/geometry";

import { EezArrayObject } from "eez-studio-shared/model/object";

import { Page } from "eez-studio-page-editor/page";
import { Widget } from "eez-studio-page-editor/widget";

////////////////////////////////////////////////////////////////////////////////

export interface IDataItem {
    type: string;
    enumItems?: string;
}

export interface IDataContext {
    get(dataItemId: string): any;
    count(dataItemId: string): number;
    getEnumValue(dataItemId: string): number;
    findDataItemIndex(dataItemId: string): number;
    findDataItem(dataItemId: string): IDataItem | undefined;
}

export interface IStyle {
    backgroundColor?: string;
}

export interface IPageContext {
    inEditor: boolean;

    data: IDataContext;

    drawPageFrame(ctx: CanvasRenderingContext2D, rect: Rect, scale: number, style: string): void;
    drawDefaultWidget(widget: Widget, rect: Rect): HTMLCanvasElement | undefined;
    renderLayoutViewWidget(widget: Widget, rect: Rect): React.ReactNode;

    findActionIndex(actionName: any): number;

    layoutConceptName: string;
    getLayouts(): EezArrayObject<Page>;
    findLayout(layoutName: string): Page | undefined;

    findStyle(styleName: any): IStyle | undefined;
    findStyleOrGetDefault(styleName: any): IStyle;
}

export let PageContext: IPageContext;

export function setPageContext(context: IPageContext) {
    PageContext = context;
}
