import { PropertyInfo, EezObject } from "eez-studio-shared/model/object";

////////////////////////////////////////////////////////////////////////////////

export interface IPageInitContext {
    dataItemsCollectionPath?: string[];
    onDataItemSelect?: (object: EezObject, propertyInfo: PropertyInfo) => Promise<any>;
}

export let PageInitContext: IPageInitContext;

export function setPageInitContext(context: IPageInitContext) {
    PageInitContext = context;
}
