import React from "react";

import { _uniqWith } from "eez-studio-shared/algorithm";
import { humanize } from "eez-studio-shared/string";

import { loadObject, objectToJson } from "project-editor/core/serialization";
import {
    DocumentStoreClass,
    IContextMenuContext,
    INavigationStore,
    getDocumentStore
} from "project-editor/core/store";
import { DragAndDropManagerClass } from "project-editor/core/dd";
import { Rect } from "eez-studio-shared/geometry";
import type { IResizeHandler } from "project-editor/flow/flow-interfaces";
import { observable } from "mobx";

import {
    IDataContext,
    IVariable,
    ProjectType,
    PropertyType
} from "eez-studio-types";
export { ProjectType, PropertyType } from "eez-studio-types";

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
export const dataGroup = specificGroup;
export const actionsGroup = specificGroup;

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
    propertyGridRowComponent?:
        | React.ComponentClass<PropertyProps>
        | React.FunctionComponent<PropertyProps>;
    propertyGridColumnComponent?:
        | React.ComponentClass<PropertyProps>
        | React.FunctionComponent<PropertyProps>;
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
    toggableProperty?:
        | "input"
        | "output"
        | ((DocumentStore: DocumentStoreClass) => "input" | "output");
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

export interface ClassInfo {
    properties: PropertyInfo[];

    _arrayAndObjectProperties?: PropertyInfo[];

    // optional properties
    getClass?: (jsObject: any, aClass: EezClass) => any;
    label?: (object: IEezObject) => string;
    listLabel?: (object: IEezObject) => JSX.Element | string;

    parentClassInfo?: ClassInfo;

    componentPaletteGroupName?: string;
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

    onVariableConstructor?: (
        dataContext: IDataContext,
        variable: IVariable
    ) => Promise<void>;
    onVariableLoad?: (value: any) => Promise<any>;
    onVariableSave?: (value: any) => Promise<any>;
    renderVariableStatus?: (
        variable: IVariable,
        dataContext: IDataContext
    ) => React.ReactNode;
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

export function registerClass(aClass: EezClass) {
    classes.set(aClass.name, aClass);
}

export function registerClassByName(name: string, aClass: EezClass) {
    classes.set(name, aClass);
}

export function getClassByName(className: string) {
    return classes.get(className);
}

////////////////////////////////////////////////////////////////////////////////

export class EezValueObject extends EezObject {
    static classInfo: ClassInfo = {
        label: (object: EezValueObject) => {
            return object.value && object.value.toString();
        },
        properties: []
    };

    public propertyInfo: PropertyInfo;
    public value: any;

    static create(object: IEezObject, propertyInfo: PropertyInfo, value: any) {
        const valueObject = new EezValueObject();

        const DocumentStore = getDocumentStore(object);

        setId(DocumentStore.objects, valueObject, DocumentStore.getChildId());
        setKey(valueObject, propertyInfo.name);
        setParent(valueObject, object);

        valueObject.propertyInfo = propertyInfo;
        valueObject.value = value;

        return valueObject;
    }
}

registerClass(EezValueObject);

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

export function isObjectInstanceOf(
    object: IEezObject,
    baseClassInfo: ClassInfo
) {
    return isSubclassOf(getClassInfo(object), baseClassInfo);
}

export function isValue(object: IEezObject | undefined) {
    return !!object && object instanceof EezValueObject;
}

export function isObject(object: IEezObject | undefined) {
    return !!object && !isValue(object) && !isArray(object);
}

export function isArray(
    object: IEezObject | undefined
): object is IEezObject[] {
    return !!object && !isValue(object) && Array.isArray(object);
}

export function getChildren(parent: IEezObject): IEezObject[] {
    if (isArray(parent)) {
        return parent;
    } else {
        let properties = getClassInfo(parent).properties.filter(
            propertyInfo =>
                (propertyInfo.type === PropertyType.Object ||
                    propertyInfo.type === PropertyType.Array) &&
                isPropertyEnumerable(parent, propertyInfo) &&
                getProperty(parent, propertyInfo.name)
        );

        if (
            properties.length == 1 &&
            properties[0].type === PropertyType.Array &&
            !(properties[0].showOnlyChildrenInTree === false)
        ) {
            return getProperty(parent, properties[0].name);
        }

        return properties.map(propertyInfo =>
            getProperty(parent, propertyInfo.name)
        );
    }
}

export function getClass(object: IEezObject) {
    if (isArray(object)) {
        return getPropertyInfo(object).typeClass!;
    } else {
        return object.constructor as EezClass;
    }
}

export function getClassInfo(object: IEezObject): ClassInfo {
    return getClass(object).classInfo;
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

export function getEditorComponent(
    object: IEezObject
): typeof EditorComponent | undefined {
    const isEditorSupported = getClassInfo(object).isEditorSupported;
    if (isEditorSupported && !isEditorSupported(object)) {
        return undefined;
    }
    return getClassInfo(object).editorComponent;
}

export function getLabel(object: IEezObject): string {
    if (typeof object === "string") {
        return object;
    }

    const label = getClassInfo(object).label;
    if (label) {
        return label(object);
    }

    let name = (object as any).name;
    if (name) {
        return name;
    }

    return getClass(object).name;
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

export function isArrayElement(object: IEezObject) {
    return isArray(getParent(object));
}

export function findPropertyByNameInObject(
    object: IEezObject,
    propertyName: string
) {
    return getClassInfo(object).properties.find(
        propertyInfo => propertyInfo.name == propertyName
    );
}

export function findPropertyByNameInClassInfo(
    classInfo: ClassInfo,
    propertyName: string
) {
    return classInfo.properties.find(
        propertyInfo => propertyInfo.name == propertyName
    );
}

export function findPropertyByChildObject(
    object: IEezObject,
    childObject: IEezObject
) {
    return getClassInfo(object).properties.find(
        propertyInfo => getProperty(object, propertyInfo.name) === childObject
    );
}

export function getInheritedValue(object: IEezObject, propertyName: string) {
    const getInheritedValue = getClassInfo(object).getInheritedValue;
    if (getInheritedValue) {
        return getInheritedValue(object, propertyName);
    }
    return undefined;
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

export function getPropertyAsString(
    object: IEezObject,
    propertyInfo: PropertyInfo
) {
    let value = getProperty(object, propertyInfo.name);
    if (typeof value === "boolean") {
        return value.toString();
    }
    if (typeof value === "number") {
        return value.toString();
    }
    if (typeof value === "string") {
        return value;
    }
    if (typeof value === "undefined") {
        return "";
    }
    if (isArray(value)) {
        return (value as IEezObject[])
            .map(object => getLabel(object))
            .join(", ");
    }
    return objectToString(value);
}

export function humanizePropertyName(object: IEezObject, propertyName: string) {
    const property = findPropertyByNameInObject(object, propertyName);
    if (property && property.displayName) {
        return property.displayName;
    }
    return humanize(propertyName);
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

export function objectToString(object: IEezObject) {
    let label: string;

    if (isValue(object)) {
        label = getProperty(getParent(object), getKey(object));
    } else if (isArray(object)) {
        let propertyInfo = findPropertyByNameInObject(
            getParent(object),
            getKey(object)
        );
        label =
            (propertyInfo &&
                getObjectPropertyDisplayName(object, propertyInfo)) ||
            humanize(getKey(object));
    } else {
        label = getLabel(object);
    }

    if (
        object &&
        getParent(object) &&
        isArray(getParent(object)) &&
        getParent(getParent(object)) &&
        getKey(getParent(object))
    ) {
        let propertyInfo = findPropertyByNameInObject(
            getParent(getParent(object)),
            getKey(getParent(object))
        );
        if (propertyInfo && propertyInfo.childLabel) {
            label = propertyInfo.childLabel(object, label);
        }
    }

    return label;
}

export function getChildOfObject(
    object: IEezObject,
    key: PropertyInfo | string | number
): IEezObject | undefined {
    let propertyInfo: PropertyInfo | undefined;

    if (isArray(object)) {
        let elementIndex: number | undefined = undefined;

        if (typeof key == "string") {
            elementIndex = parseInt(key);
        } else if (typeof key == "number") {
            elementIndex = key;
        }

        const array = object as IEezObject[];

        if (
            elementIndex !== undefined &&
            elementIndex >= 0 &&
            elementIndex < array.length
        ) {
            return array[elementIndex];
        } else {
            console.error("invalid array index");
        }
    } else {
        if (typeof key == "string") {
            propertyInfo = findPropertyByNameInObject(object, key);
        } else if (typeof key == "number") {
            console.error("invalid key type");
        } else {
            propertyInfo = key;
        }
    }

    if (propertyInfo) {
        let childObjectOrValue = getProperty(object, propertyInfo.name);
        if (propertyInfo.typeClass) {
            return childObjectOrValue;
        } else {
            return EezValueObject.create(
                object,
                propertyInfo,
                childObjectOrValue
            );
        }
    }

    return undefined;
}

export function getAncestorOfType<T>(
    object: IEezObject,
    classInfo: ClassInfo
): T | undefined {
    if (object) {
        if (isObjectInstanceOf(object, classInfo)) {
            return object as T;
        }
        return (
            getParent(object) && getAncestorOfType(getParent(object), classInfo)
        );
    }
    return undefined;
}

export function getObjectPath(object: IEezObject): (string | number)[] {
    let parent = getParent(object);
    if (parent) {
        if (isArray(parent)) {
            return getObjectPath(parent).concat(
                parent.indexOf(object as IEezObject)
            );
        } else {
            return getObjectPath(parent).concat(getKey(object));
        }
    }
    return [];
}

export function getObjectPropertyAsObject(
    object: IEezObject,
    propertyInfo: PropertyInfo
) {
    return getChildOfObject(object, propertyInfo) as EezValueObject;
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

export function getHumanReadableObjectPath(object: IEezObject) {
    let ancestors = getAncestors(object);
    return ancestors
        .slice(1)
        .map(object => objectToString(object))
        .join(" / ");
}

export function getObjectPathAsString(object: IEezObject) {
    return "/" + getObjectPath(object).join("/");
}

export function isObjectExists(object: IEezObject) {
    let parent = getParent(object);
    if (parent) {
        if (isArray(parent)) {
            if (parent.indexOf(object) === -1) {
                return false;
            }
        } else {
            const key = getKey(object);
            if (key && (parent as any)[key] !== object) {
                return false;
            }
        }
    }
    return true;
}

export function getObjectFromPath(rootObject: IEezObject, path: string[]) {
    let object = rootObject;

    for (let i = 0; i < path.length && object; i++) {
        object = getChildOfObject(object, path[i]) as IEezObject;
    }

    return object;
}

export function getObjectFromStringPath(
    rootObject: IEezObject,
    stringPath: string
) {
    if (stringPath == "/") {
        return rootObject;
    }
    return getObjectFromPath(rootObject, stringPath.split("/").slice(1));
}

export function cloneObject(
    DocumentStore: DocumentStoreClass,
    obj: IEezObject
) {
    return loadObject(
        DocumentStore,
        undefined,
        objectToJson(obj),
        getClass(obj)
    );
}

export function isShowOnlyChildrenInTree(object: IEezObject) {
    if (!getParent(object) || !getKey(object)) {
        return true;
    }

    const propertyInfo = findPropertyByNameInObject(
        getParent(object),
        getKey(object)
    );
    if (!propertyInfo) {
        return true;
    }

    return !(propertyInfo.showOnlyChildrenInTree === false);
}

export function areAllChildrenOfTheSameParent(objects: IEezObject[]) {
    for (let i = 1; i < objects.length; i++) {
        if (getParent(objects[i]) !== getParent(objects[0])) {
            return false;
        }
    }
    return true;
}

export function isPartOfNavigation(object: IEezObject) {
    if (getParent(object)) {
        let propertyInfo = findPropertyByChildObject(getParent(object), object);
        if (propertyInfo && propertyInfo.partOfNavigation === false) {
            return false;
        }
    }
    return true;
}

export function getArrayAndObjectProperties(object: IEezObject) {
    if (!getClassInfo(object)._arrayAndObjectProperties) {
        getClassInfo(object)._arrayAndObjectProperties = getClassInfo(
            object
        ).properties.filter(
            propertyInfo =>
                (propertyInfo.type === PropertyType.Array ||
                    propertyInfo.type === PropertyType.Object) &&
                getProperty(object, propertyInfo.name)
        );
    }
    return getClassInfo(object)._arrayAndObjectProperties!;
}

export interface PropertyValueSourceInfo {
    source: "" | "default" | "modified" | "inherited";
    inheritedFrom?: IEezObject;
}

export function getCommonProperties(objects: IEezObject[]) {
    let properties = getClassInfo(objects[0]).properties;

    properties = properties.filter(
        propertyInfo =>
            !objects.find(
                object =>
                    isArray(object) || isPropertyHidden(object, propertyInfo)
            )
    );

    if (objects.length > 1) {
        // some property types are not supported in multi-objects property grid
        properties = properties.filter(
            propertyInfo =>
                propertyInfo.type !== PropertyType.Array &&
                !(
                    propertyInfo.type === PropertyType.String &&
                    propertyInfo.unique === true
                )
        );

        // show only common properties
        properties = properties.filter(
            propertyInfo =>
                !objects.find(
                    object =>
                        !getClassInfo(object).properties.find(
                            pi => pi === propertyInfo
                        )
                )
        );
    }

    return properties;
}

export function getPropertySourceInfo(
    props: PropertyProps
): PropertyValueSourceInfo {
    function getSourceInfo(
        object: IEezObject,
        propertyInfo: PropertyInfo
    ): PropertyValueSourceInfo {
        if (props.propertyInfo.propertyMenu) {
            return {
                source: ""
            };
        }

        let value = (object as any)[propertyInfo.name];

        if (propertyInfo.inheritable) {
            if (value === undefined) {
                let inheritedValue = getInheritedValue(
                    object,
                    propertyInfo.name
                );
                if (inheritedValue) {
                    return {
                        source: "inherited",
                        inheritedFrom: inheritedValue.source
                    };
                }
            }
        }

        if (value !== undefined) {
            return {
                source: "modified"
            };
        }

        return {
            source: "default"
        };
    }

    const sourceInfoArray = props.objects.map(object =>
        getSourceInfo(object, props.propertyInfo)
    );

    for (let i = 1; i < sourceInfoArray.length; i++) {
        if (sourceInfoArray[i].source !== sourceInfoArray[0].source) {
            return {
                source: "modified"
            };
        }
    }

    return sourceInfoArray[0];
}

export function isAnyPropertyModified(props: PropertyProps) {
    const properties = getCommonProperties(props.objects);
    for (let propertyInfo of properties) {
        const sourceInfo = getPropertySourceInfo({ ...props, propertyInfo });
        if (sourceInfo.source === "modified") {
            return true;
        }
    }
    return false;
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

registerClass(RectObject);
