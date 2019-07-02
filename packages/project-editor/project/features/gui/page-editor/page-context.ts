import { EezArrayObject } from "project-editor/model/object";
import { PropertyProps } from "project-editor/model/components/PropertyGrid";
export { PropertyProps } from "project-editor/model/components/PropertyGrid";

import { Page } from "project-editor/project/features/gui/page-editor/page";
import { Style } from "project-editor/project/features/gui/page-editor/style";

////////////////////////////////////////////////////////////////////////////////

export interface IDataItem {
    type: string;
    enumItems?: string;
}

export interface IDataContext {
    get(dataItemId: string, params?: { [key: string]: any }): any;
    set(dataItemId: string, value: any): any;
    count(dataItemId: string): number;
    getEnumValue(dataItemId: string): number;
    executeAction(action: string): void;
    push(data: any): IDataContext;
}

export interface IPageContext {
    inEditor: boolean;

    rootDataContext: IDataContext;

    resolution: number;
    allResolutions: {
        name: string;
        shortName: string;
        windowWidth: number;
        windowHeight: number;
    }[];

    renderRootElement(child: React.ReactNode): React.ReactNode;

    findActionIndex(actionName: any): number;
    findDataItemIndex(dataItemId: string): number;
    findDataItem(dataItemId: string): IDataItem | undefined;

    getPages(): EezArrayObject<Page>;
    findPage(pageName: string): Page | undefined;

    layoutConceptName: string;
    getLayouts(): EezArrayObject<Page>;
    findLayout(layoutName: string): Page | undefined;

    findStyle(styleName: string): Style | undefined;
    findFont(fontName: any): any;

    getThemedColor(color: any): string;

    onChangeValueInPropertyGrid?(newValue: any, props: PropertyProps): boolean;
    onKeyDownInPropertyGrid?(event: React.KeyboardEvent, newValue: any, props: PropertyProps): void;
}

let PageContext: IPageContext;

export function getPageContext() {
    return PageContext;
}

export function setPageContext(context: IPageContext) {
    PageContext = context;
}
