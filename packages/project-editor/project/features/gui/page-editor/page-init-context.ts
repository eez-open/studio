import { PropertyInfo, IPropertyGridGroupDefinition } from "project-editor/model/object";

////////////////////////////////////////////////////////////////////////////////

export interface IPageInitContext {
    makeDataPropertyInfo(
        name: string,
        displayName?: string,
        propertyGridGroup?: IPropertyGridGroupDefinition
    ): PropertyInfo;

    makeActionPropertyInfo(
        name: string,
        displayName?: string,
        propertyGridGroup?: IPropertyGridGroupDefinition
    ): PropertyInfo;

    layoutCollectionPath: string[];
}

export let PageInitContext: IPageInitContext;

export function setPageInitContext(context: IPageInitContext) {
    PageInitContext = context;
}
