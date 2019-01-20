import {
    PropertyInfo,
    TargetDataType,
    IPropertyGridGroupDefinition
} from "eez-studio-shared/model/object";

////////////////////////////////////////////////////////////////////////////////

export interface IPageInitContext {
    makeDataPropertyInfo(
        name: string,
        targetDataType?: TargetDataType,
        displayName?: string,
        propertyGridGroup?: IPropertyGridGroupDefinition
    ): PropertyInfo;

    makeActionPropertyInfo(
        name: string,
        displayName?: string,
        propertyGridGroup?: IPropertyGridGroupDefinition
    ): PropertyInfo;
}

export let PageInitContext: IPageInitContext;

export function setPageInitContext(context: IPageInitContext) {
    PageInitContext = context;
}
