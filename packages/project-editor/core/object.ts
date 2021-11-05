import React from "react";
import { observable } from "mobx";

import { _uniqWith } from "eez-studio-shared/algorithm";
import { humanize } from "eez-studio-shared/string";
import { Rect } from "eez-studio-shared/geometry";

import type {
    DocumentStoreClass,
    IContextMenuContext,
    INavigationStore
} from "project-editor/core/store";
import type { DragAndDropManagerClass } from "project-editor/core/dd";

import type { IResizeHandler } from "project-editor/flow/flow-interfaces";

import type { ValueType } from "project-editor/features/variable/value-type";

////////////////////////////////////////////////////////////////////////////////

export const enum PropertyType {
    String,
    StringArray,
    MultilineText,
    JSON,
    CSS,
    CPP,
    Number,
    NumberArray,
    Array,
    Object,
    Enum,
    Image,
    Color,
    ThemedColor,
    RelativeFolder,
    RelativeFile,
    ObjectReference,
    ConfigurationReference,
    Boolean,
    GUID,
    Any,
    Null
}

export const enum ProjectType {
    MASTER_FIRMWARE = "master",
    FIRMWARE_MODULE = "firmware-module",
    RESOURCE = "resource",
    APPLET = "applet",
    DASHBOARD = "dashboard"
}

////////////////////////////////////////////////////////////////////////////////

export interface EnumItem {
    id: string | number;
    label?: string;
}

export enum MessageType {
    INFO,
    ERROR,
    WARNING
}

export interface IMessage {
    type: MessageType;
    text: string;
    object?: IEezObject;
}

export interface IPropertyGridGroupDefinition {
    id: string;
    title: string;
    position?: number;
}

export const generalGroup: IPropertyGridGroupDefinition = {
    id: "general",
    title: "General",
    position: 0
};

export const specificGroup: IPropertyGridGroupDefinition = {
    id: "specific",
    title: "Specific",
    position: 1
};

export const flowGroup: IPropertyGridGroupDefinition = {
    id: "flow",
    title: "Flow",
    position: 2
};

export const styleGroup: IPropertyGridGroupDefinition = {
    id: "style",
    title: "Style",
    position: 3
};

export const geometryGroup: IPropertyGridGroupDefinition = {
    id: "geometry",
    title: "Position and size",
    position: 4
};

export interface PropertyProps {
    propertyInfo: PropertyInfo;
    objects: IEezObject[];
    readOnly: boolean;
    updateObject: (propertyValues: Object) => void;
}

export interface IOnSelectParams {
    textInputSelection?: {
        start: number | null;
        end: number | null;
    };
}

export interface PropertyInfo {
    name: string;
    type: PropertyType;

    // optional properties
    displayName?: string | ((object: IEezObject) => string);
    enumItems?: EnumItem[];
    typeClass?: EezClass;
    referencedObjectCollectionPath?: string;
    computed?: boolean;
    onSelect?: (
        object: IEezObject,
        propertyInfo: PropertyInfo,
        params?: IOnSelectParams
    ) => Promise<any>;
    onSelectTitle?: string;
    hideInPropertyGrid?:
        | boolean
        | ((object: IEezObject, propertyInfo: PropertyInfo) => boolean);
    readOnlyInPropertyGrid?:
        | boolean
        | ((object: IEezObject, propertyInfo: PropertyInfo) => boolean);
    propertyGridGroup?: IPropertyGridGroupDefinition;
    propertyGridRowComponent?: React.ComponentType<PropertyProps>;
    propertyGridColumnComponent?: React.ComponentType<PropertyProps>;
    propertyGridCollapsable?: boolean;
    propertyGridCollapsableDefaultPropertyName?: string;
    propertyGridCollapsableEnabled?: (object: IEezObject) => boolean;
    enumerable?:
        | boolean
        | ((object: IEezObject, propertyInfo: PropertyInfo) => boolean);
    showOnlyChildrenInTree?: boolean;
    isOptional?: boolean;
    defaultValue?: any;
    inheritable?: boolean;
    propertyMenu?: (props: PropertyProps) => Electron.MenuItem[];
    unique?:
        | boolean
        | ((
              object: IEezObject,
              parent: IEezObject,
              propertyInfo: PropertyInfo
          ) => (
              object: any,
              ruleName: string
          ) => Promise<string | null> | string | null);
    skipSearch?: boolean;
    childLabel?: (childObject: IEezObject, childLabel: string) => string;
    check?: (object: IEezObject) => IMessage[];
    interceptAddObject?: (
        parentObject: IEezObject,
        object: IEezObject
    ) => IEezObject;
    downloadFileName?: (
        object: IEezObject,
        propertyInfo: PropertyInfo
    ) => string;
    embeddedImage?: boolean;
    partOfNavigation?: boolean;
    fileFilters?: any;

    flowProperty?:
        | "input"
        | "output"
        | "assignable"
        | ((
              DocumentStore: DocumentStoreClass
          ) => "input" | "output" | "assignable");
    expressionType?: ValueType;
    expressionIsConstant?: boolean;
    isOutputOptional?:
        | boolean
        | ((object: IEezObject, propertyInfo: PropertyInfo) => boolean);

    monospaceFont?: boolean;
    disableSpellcheck?: boolean;
}

export interface NavigationComponentProps {
    id: string;
    navigationObject: IEezObject;
    navigationStore?: INavigationStore;
    dragAndDropManager?: DragAndDropManagerClass;
    onDoubleClickItem?: (item: IEezObject) => void;
}

export class NavigationComponent extends React.Component<
    NavigationComponentProps,
    {}
> {}

export interface IEditorState {
    loadState(state: any): void;
    saveState(): any;
    selectObject(object: IEezObject): void;
    selectObjects(objects: IEezObject[]): void;
    ensureSelectionVisible(): void;
}

export interface IEditor {
    object: IEezObject;
    state: IEditorState | undefined;
}

export interface EditorComponentProps {
    editor: IEditor;
}

export class EditorComponent extends React.Component<
    EditorComponentProps,
    {}
> {}

export type InheritedValue =
    | {
          value: any;
          source: IEezObject;
      }
    | undefined;

export interface SerializedData {
    objectClassName: string;
    classInfo?: ClassInfo;
    object?: IEezObject;
    objects?: IEezObject[];
}

export interface ClassInfo {
    properties: PropertyInfo[];

    _arrayAndObjectProperties?: PropertyInfo[];

    // optional properties
    getClass?: (jsObject: any, aClass: EezClass) => any;
    label?: (object: IEezObject) => string;
    listLabel?: (object: IEezObject) => JSX.Element | string;

    parentClassInfo?: ClassInfo;

    componentPaletteGroupName?: string;
    componentPaletteLabel?: string;
    enabledInComponentPalette?: (projectType: ProjectType) => boolean;

    showInNavigation?: boolean;
    hideInProperties?: boolean;
    isPropertyMenuSupported?: boolean;
    navigationComponent?: typeof NavigationComponent | null;
    navigationComponentId?: string;
    defaultNavigationKey?: string;

    editorComponent?: typeof EditorComponent;
    isEditorSupported?: (object: IEezObject) => boolean;

    createEditorState?: (object: IEezObject) => IEditorState | undefined;
    newItem?: (object: IEezObject) => Promise<any>;
    getInheritedValue?: (
        object: IEezObject,
        propertyName: string
    ) => InheritedValue;
    defaultValue?: any;
    findPastePlaceInside?: (
        object: IEezObject,
        classInfo: ClassInfo,
        isSingleObject: boolean
    ) => IEezObject | PropertyInfo | undefined;

    icon?: string | React.ReactNode;
    componentHeaderColor?: string;

    propertyGridTableComponent?: any;

    beforeLoadHook?: (object: IEezObject, jsObject: any) => void;

    updateObjectValueHook?: (object: IEezObject, values: any) => void;

    afterUpdateObjectHook?: (
        object: IEezObject,
        changedProperties: any,
        oldValues: any
    ) => void;

    extendContextMenu?: (
        object: IEezObject,
        context: IContextMenuContext,
        objects: IEezObject[],
        menuItems: Electron.MenuItem[]
    ) => void;

    check?: (object: IEezObject) => IMessage[];

    getRect?: (object: IEezObject) => Rect;
    setRect?: (object: IEezObject, rect: Rect) => void;
    isMoveable?: (object: IEezObject) => boolean;
    isSelectable?: (object: IEezObject) => boolean;
    showSelectedObjectsParent?: (object: IEezObject) => boolean;
    getResizeHandlers?: (
        object: IEezObject
    ) => IResizeHandler[] | undefined | false;
    open?: (object: IEezObject) => void;

    flowComponentId?: number;

    isFlowExecutableComponent?: boolean;

    getImportedProject?: (object: IEezObject) =>
        | {
              findReferencedObject: (
                  root: IEezObject,
                  referencedObjectCollectionPath: string,
                  referencedObjectName: string
              ) => IEezObject | undefined;
          }
        | undefined;

    deleteObjectRefHook?: (
        object: IEezObject,
        options?: { dropPlace?: IEezObject }
    ) => void;
    deleteObjectFilterHook?: (object: IEezObject) => boolean;

    objectsToClipboardData?: (objects: IEezObject) => any;

    pasteItemHook?: (
        object: IEezObject,
        clipboardData: {
            serializedData: SerializedData;
            pastePlace: EezObject;
        }
    ) => IEezObject;
}

export function makeDerivedClassInfo(
    baseClassInfo: ClassInfo,
    derivedClassInfoProperties: Partial<ClassInfo>
): ClassInfo {
    if (derivedClassInfoProperties.properties) {
        const b = baseClassInfo.properties; // base class properties
        const d = derivedClassInfoProperties.properties; // derived class properties
        const r = []; // resulting properties

        // put base and overriden properties into resulting properties array
        for (let i = 0; i < b.length; ++i) {
            let j;
            for (j = 0; j < d.length; ++j) {
                if (b[i].name === d[j].name) {
                    break;
                }
            }
            r.push(j < d.length ? d[j] /* overriden */ : b[i] /* base */);
        }

        // put derived (not overriden) properties into resulting array
        for (let i = 0; i < d.length; ++i) {
            let j;
            for (j = 0; j < r.length; ++j) {
                if (d[i].name === r[j].name) {
                    break;
                }
            }
            if (j === r.length) {
                r.push(d[i]);
            }
        }

        derivedClassInfoProperties.properties = r;
    }

    const baseBeforeLoadHook = baseClassInfo.beforeLoadHook;
    const derivedBeforeLoadHook = derivedClassInfoProperties.beforeLoadHook;
    if (baseBeforeLoadHook && derivedBeforeLoadHook) {
        derivedClassInfoProperties.beforeLoadHook = (
            object: IEezObject,
            jsObject: any
        ) => {
            baseBeforeLoadHook(object, jsObject);
            derivedBeforeLoadHook(object, jsObject);
        };
    }

    const baseCheck = baseClassInfo.check;
    const derivedCheck = derivedClassInfoProperties.check;
    if (baseCheck && derivedCheck) {
        derivedClassInfoProperties.check = (object: IEezObject) => {
            return baseCheck(object).concat(derivedCheck(object));
        };
    }

    const baseUpdateObjectValueHook = baseClassInfo.updateObjectValueHook;
    const derivedUpdateObjectValueHook =
        derivedClassInfoProperties.updateObjectValueHook;
    if (baseUpdateObjectValueHook && derivedUpdateObjectValueHook) {
        derivedClassInfoProperties.updateObjectValueHook = (
            object: IEezObject,
            values: any
        ) => {
            baseUpdateObjectValueHook(object, values);
            derivedUpdateObjectValueHook(object, values);
        };
    }

    const derivedClassInfo = Object.assign(
        {},
        baseClassInfo,
        derivedClassInfoProperties
    );
    derivedClassInfo.parentClassInfo = baseClassInfo;
    return derivedClassInfo;
}

////////////////////////////////////////////////////////////////////////////////

export type IEezObject = EezObject | EezObject[];

////////////////////////////////////////////////////////////////////////////////

export class EezObject {
    static classInfo: ClassInfo;
}

export type EezClass = typeof EezObject;

let classes = new Map<string, EezClass>();

export function registerClass(name: string, aClass: EezClass) {
    classes.set(name, aClass);
}

export function getClassByName(className: string) {
    return classes.get(className);
}

////////////////////////////////////////////////////////////////////////////////

export function isEezObject(object: any): object is IEezObject {
    return (
        object instanceof EezObject ||
        (Array.isArray(object) &&
            (object.length == 0 || isEezObject(object[0])))
    );
}

////////////////////////////////////////////////////////////////////////////////

export function findClass(className: string) {
    return classes.get(className);
}

export interface IObjectClassInfo {
    name: string;
    objectClass: EezClass;
}

export function getClassesDerivedFrom(parentClass: EezClass) {
    const derivedClasses: IObjectClassInfo[] = [];

    for (const className of classes.keys()) {
        const objectClass = classes.get(className)!;
        if (isProperSubclassOf(objectClass.classInfo, parentClass.classInfo)) {
            derivedClasses.push({
                name: className,
                objectClass
            });
        }
    }

    return derivedClasses;
}

export function isSubclassOf(
    classInfo: ClassInfo | undefined,
    baseClassInfo: ClassInfo
) {
    while (classInfo) {
        if (classInfo === baseClassInfo) {
            return true;
        }
        classInfo = classInfo.parentClassInfo;
    }
    return false;
}

export function isProperSubclassOf(
    classInfo: ClassInfo | undefined,
    baseClassInfo: ClassInfo
) {
    if (classInfo) {
        while (true) {
            classInfo = classInfo.parentClassInfo;
            if (!classInfo) {
                return false;
            }
            if (classInfo === baseClassInfo) {
                return true;
            }
        }
    }
    return false;
}

export function getId(object: IEezObject) {
    return (object as any)._eez_id;
}

export function setId(
    objects: Map<string, IEezObject>,
    object: IEezObject,
    id: string
) {
    (object as any)._eez_id = id;
    objects.set(id, object);
}

export function getParent(object: IEezObject): IEezObject {
    return (object as any)._eez_parent;
}

export function setParent(object: IEezObject, parentObject: IEezObject) {
    (object as any)._eez_parent = parentObject;
}

export function getKey(object: IEezObject): string {
    return (object as any)._eez_key;
}

export function setKey(object: IEezObject, key: string) {
    (object as any)._eez_key = key;
}

export function getPropertyInfo(object: IEezObject): PropertyInfo {
    return (object as any)._eez_propertyInfo;
}

export function setPropertyInfo(
    object: IEezObject,
    propertyInfo: PropertyInfo
) {
    (object as any)._eez_propertyInfo = propertyInfo;
}

export function isAncestor(object: IEezObject, ancestor: IEezObject): boolean {
    if (object == undefined || ancestor == undefined) {
        return false;
    }

    if (object == ancestor) {
        return true;
    }

    let parent = getParent(object);
    return !!parent && isAncestor(parent, ancestor);
}

export function isProperAncestor(object: IEezObject, ancestor: IEezObject) {
    if (object == undefined || object == ancestor) {
        return false;
    }

    let parent = getParent(object);
    return !!parent && isAncestor(parent, ancestor);
}

export function findPropertyByNameInClassInfo(
    classInfo: ClassInfo,
    propertyName: string
) {
    return classInfo.properties.find(
        propertyInfo => propertyInfo.name == propertyName
    );
}

export function isPropertyHidden(
    object: IEezObject,
    propertyInfo: PropertyInfo
) {
    if (propertyInfo.hideInPropertyGrid === undefined) {
        return false;
    }

    if (typeof propertyInfo.hideInPropertyGrid === "boolean") {
        return propertyInfo.hideInPropertyGrid;
    }

    return propertyInfo.hideInPropertyGrid(object, propertyInfo);
}

export function isPropertyReadOnly(
    object: IEezObject,
    propertyInfo: PropertyInfo
) {
    if (propertyInfo.readOnlyInPropertyGrid === undefined) {
        return false;
    }

    if (typeof propertyInfo.readOnlyInPropertyGrid === "boolean") {
        return propertyInfo.readOnlyInPropertyGrid;
    }

    return propertyInfo.readOnlyInPropertyGrid(object, propertyInfo);
}

export function isAnyPropertyReadOnly(
    objects: IEezObject[],
    propertyInfo: PropertyInfo
) {
    return !!objects.find(object => isPropertyReadOnly(object, propertyInfo));
}

export function isPropertyEnumerable(
    object: IEezObject,
    propertyInfo: PropertyInfo
) {
    if (propertyInfo.enumerable === undefined) {
        return true;
    }

    if (typeof propertyInfo.enumerable === "boolean") {
        return propertyInfo.enumerable;
    }

    return propertyInfo.enumerable(object, propertyInfo);
}

export function getProperty(object: IEezObject, name: string) {
    return (object as any)[name];
}

export function getObjectPropertyDisplayName(
    object: IEezObject,
    propertyInfo: PropertyInfo
) {
    if (propertyInfo.displayName) {
        if (typeof propertyInfo.displayName === "string") {
            return propertyInfo.displayName;
        }
        return propertyInfo.displayName(object);
    }
    return humanize(propertyInfo.name);
}

export function getRootObject(object: IEezObject) {
    let parent;
    while (!!(parent = getParent(object))) {
        object = parent;
    }
    return object;
}

// Get object ancestors as array,
// from the root object up to the given object (including given object)
export function getAncestors(object: IEezObject): IEezObject[] {
    let parent = getParent(object);
    if (parent) {
        return getAncestors(parent).concat([object]);
    }
    return [object];
}

export function areAllChildrenOfTheSameParent(objects: IEezObject[]) {
    for (let i = 1; i < objects.length; i++) {
        if (getParent(objects[i]) !== getParent(objects[0])) {
            return false;
        }
    }
    return true;
}

export interface PropertyValueSourceInfo {
    source: "" | "default" | "modified" | "inherited";
    inheritedFrom?: IEezObject;
}

////////////////////////////////////////////////////////////////////////////////

export class RectObject extends EezObject {
    static classInfo = {
        properties: [
            {
                name: "top",
                type: PropertyType.Number
            },
            {
                name: "right",
                type: PropertyType.Number
            },
            {
                name: "bottom",
                type: PropertyType.Number
            },
            {
                name: "left",
                type: PropertyType.Number
            }
        ],
        defaultValue: {
            top: 0,
            right: 0,
            bottom: 0,
            left: 0
        }
    };

    @observable top: number;
    @observable right: number;
    @observable bottom: number;
    @observable left: number;
}

registerClass("RectObject", RectObject);
