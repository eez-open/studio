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
    set(dataItemId: string, value: any): any;
    count(dataItemId: string): number;
    getEnumValue(dataItemId: string): number;
    executeAction(action: string): void;
    push(data: any): IDataContext;
}

export interface IStyle {
    backgroundColor?: string;
}

export interface IPageContext {
    inEditor: boolean;

    rootDataContext: IDataContext;

    drawDefaultWidget(widget: Widget, rect: Rect): HTMLCanvasElement | undefined;
    renderRootElement(child: React.ReactNode): React.ReactNode;

    findActionIndex(actionName: any): number;
    findDataItemIndex(dataItemId: string): number;
    findDataItem(dataItemId: string): IDataItem | undefined;

    getPages(): EezArrayObject<Page>;
    findPage(pageName: string): Page | undefined;

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
