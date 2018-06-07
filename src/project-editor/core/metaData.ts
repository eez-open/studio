import * as React from "react";

import { Editor, EditorState, getId, setEez } from "project-editor/core/store";
import { Message } from "project-editor/core/output";

////////////////////////////////////////////////////////////////////////////////

export interface EnumItem {
    id: string;
}

export type PropertyType =
    | "string"
    | "multiline-text"
    | "json"
    | "number"
    | "number[]"
    | "array"
    | "object"
    | "enum"
    | "image"
    | "color"
    | "project-relative-folder"
    | "object-reference"
    | "configuration-references"
    | "boolean"
    | "guid"
    | "any";

export interface PropertyMetaData {
    name: string;
    displayName?: string;
    type: PropertyType;
    enumItems?: EnumItem[];
    typeMetaData?: MetaData;
    referencedObjectCollectionPath?: string[];
    matchObjectReference?: (object: EezObject, path: (string | number)[], value: string) => boolean;
    replaceObjectReference?: (value: string) => string;
    onSelect?: (object: EezObject) => Promise<any>;
    hideInPropertyGrid?: boolean;
    enumerable?: boolean;
    isOptional?: boolean;
    defaultValue?: any;
    inheritable?: boolean;
    unique?: boolean;
    skipSearch?: boolean;
    childLabel?: (childObject: EezObject, childLabel: string) => string;
    check?: (object: EezObject) => Message[];
}

export interface NavigationComponentProps {
    id: string;
    navigationObject: EezObject;
    content: JSX.Element;
}

export class NavigationComponent extends React.Component<NavigationComponentProps, {}> {}

export interface EditorComponentProps {
    editor: Editor;
}

export class EditorComponent extends React.Component<EditorComponentProps, {}> {}

export type InheritedValue =
    | {
          value: any;
          source: string;
      }
    | undefined;

export interface MetaData {
    getClass: (jsObject: any) => any;
    className: string;
    label: (object: EezObject) => string;
    listLabel?: (object: EezObject) => JSX.Element | string;

    showInNavigation?: boolean;
    hideInProperties?: boolean;
    navigationComponent?: typeof NavigationComponent | null;
    navigationComponentId?: string;
    defaultNavigationKey?: string;

    editorComponent?: typeof EditorComponent;
    createEditorState?: (object: EezObject) => EditorState;
    properties: (object: EezObject) => PropertyMetaData[];
    newItem?: (object: EezObject) => Promise<any>;
    getInheritedValue?: (object: EezObject, propertyName: string) => InheritedValue;
    defaultValue?: any;
    findPastePlaceInside?: (
        object: EezObject,
        metaData: MetaData,
        isSingleObject: boolean
    ) => EezObject | PropertyMetaData | undefined;
    icon?: string;
}

let metaDataMap: Map<string, MetaData> = new Map<string, MetaData>();

export function registerMetaData(metaData: MetaData) {
    metaDataMap.set(metaData.className, metaData);
    return metaData;
}

export function findMetaData(className: string) {
    return metaDataMap.get(className);
}

////////////////////////////////////////////////////////////////////////////////

export class EezObjectState {
    id: string;
    key?: string;
    parent?: EezObject;
    lastChildId?: number;
    metaData: MetaData;
    modificationTime?: number;
    propertyMetaData?: PropertyMetaData;
}

export class EezObject {
    $eez: EezObjectState;
}

////////////////////////////////////////////////////////////////////////////////

const valueObjectMetaData = registerMetaData({
    getClass: function(jsObject: any) {
        return undefined;
    },
    className: "",
    label: (object: EezValueObject) => {
        return object.value && object.value.toString();
    },
    properties: () => []
});

export class EezValueObject extends EezObject {
    constructor(object: EezObject, public propertyMetaData: PropertyMetaData, public value: any) {
        super();

        setEez(this, {
            id: getId(object) + "." + propertyMetaData.name,
            key: propertyMetaData.name,
            parent: object,
            metaData: valueObjectMetaData
        });
    }
}
