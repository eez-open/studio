// ProjectProperties => actions, data, extensionDefinitions
// BuildProperties => configurations, files
// GuiProperties => pages, styles, fonts, bitmaps
// StoryboardProperties => pages, lines
// PageProperties => resolutions
// PageResolutionProperties => widgets
// SelectWidgetProperties => widgets
// ContainerWidgetProperties => widgets
// FontProperties => glyphs
// ScpiProperties => subsystems
// ScpiSubsystemProperties => commands
// ShortcutsProperties => shortcuts

// SettingsProperties =>
// GeneralProperties =>
// BuildConfigurationProperties =>
// BuildFileProperties =>
// ActionProperties =>
// DataItemProperties =>
// ExtensionDefinitionProperties =>
// StoryboardPageProperties =>
// StoryboardLineTargetProperties =>
// StoryboardLineSourceProperties =>
// TextWidgetProperties =>
// BitmapWidgetProperties =>
// DisplayDataWidgetProperties =>
// MultilineTextWidgetProperties =>
// SelectWidgetEditorProperties =>
// RectangleWidgetProperties =>
// AppViewWidgetProperties =>
// GridWidgetProperties =>
// ListWidgetProperties =>
// LayoutViewWidgetProperties =>
// ButtonWidgetProperties =>
// BarGraphWidgetProperties =>
// YTGraphWidgetProperties =>
// ToggleButtonWidgetProperties =>
// ButtonGroupWidgetProperties =>
// ListGraphWidgetProperties =>
// UpDownWidgetProperties =>
// StyleProperties =>
// FontSourceProperties =>
// GlyphProperties =>
// GlyphSourceProperties =>
// BitmapProperties =>
// ScpiCommandProperties =>
// ShortcutProperties =>
// ShortcutActionProperties =>

import React from "react";
import { observable } from "mobx";

import { Editor, EditorState } from "project-editor/core/store";
import { Message } from "project-editor/core/output";

////////////////////////////////////////////////////////////////////////////////

export interface EnumItem {
    id: string | number;
}

export enum PropertyType {
    String,
    MultilineText,
    JSON,
    Number,
    NumberArray,
    Array,
    Object,
    Enum,
    Image,
    Color,
    ProjectRelativeFolder,
    ObjectReference,
    ConfigurationReference,
    Boolean,
    GUID,
    Any
}

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
    readOnlyInPropertyGrid?: boolean;
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

export class EezObject {
    _id: string;
    _key?: string;
    _parent?: EezObject;
    _lastChildId?: number;
    _modificationTime?: number;
    _propertyMetaData?: PropertyMetaData;

    get _metaData(): MetaData {
        return (this.constructor as any).metaData;
    }
}

export class EezArrayObject<T> extends EezObject {
    @observable _array: T[] = [];

    get _metaData(): MetaData {
        return this._propertyMetaData!.typeMetaData!;
    }
}

////////////////////////////////////////////////////////////////////////////////

export class EezValueObject extends EezObject {
    constructor(object: EezObject, public propertyMetaData: PropertyMetaData, public value: any) {
        super();

        this._id = object._id + "." + propertyMetaData.name;
        this._key = propertyMetaData.name;
        this._parent = object;
    }

    static metaData = {
        getClass: function(jsObject: any) {
            return undefined;
        },
        className: "",
        label: (object: EezValueObject) => {
            return object.value && object.value.toString();
        },
        properties: () => []
    };
}

registerMetaData(EezValueObject.metaData);
