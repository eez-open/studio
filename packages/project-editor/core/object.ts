import React from "react";

import { _uniqWith } from "eez-studio-shared/algorithm";
import { humanize } from "eez-studio-shared/string";

import { loadObject, objectToJson } from "project-editor/core/serialization";
import { IContextMenuContext, INavigationStore } from "project-editor/core/store";
import { DragAndDropManagerClass } from "project-editor/core/dd";

////////////////////////////////////////////////////////////////////////////////

export interface EnumItem {
    id: string | number;
    label?: string;
}

export enum PropertyType {
    String,
    StringArray,
    MultilineText,
    JSON,
    Cpp,
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
    Any
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

    menu?: (
        object: IEezObject
    ) =>
        | {
              label: string;
              click: () => void;
          }[]
        | undefined;
}

export const generalGroup: IPropertyGridGroupDefinition = {
    id: "general",
    title: "General",
    position: 0
};

export const geometryGroup: IPropertyGridGroupDefinition = {
    id: "geometry",
    title: "Position and size",
    position: 1
};

export const dataGroup: IPropertyGridGroupDefinition = {
    id: "data",
    title: "Data and actions",
    position: 2
};

export const actionsGroup = dataGroup;

export const styleGroup: IPropertyGridGroupDefinition = {
    id: "style",
    title: "Style",
    position: 3
};

export const specificGroup: IPropertyGridGroupDefinition = {
    id: "specific",
    title: "Specific",
    position: 4
};

export interface PropertyProps {
    propertyInfo: PropertyInfo;
    objects: IEezObject[];
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
    displayName?: string;
    enumItems?: EnumItem[];
    typeClass?: EezClass;
    referencedObjectCollectionPath?: string[];
    matchObjectReference?: (
        object: IEezObject,
        path: (string | number)[],
        value: string
    ) => boolean;
    replaceObjectReference?: (value: string) => string;
    computed?: boolean;
    onSelect?: (
        object: IEezObject,
        propertyInfo: PropertyInfo,
        params?: IOnSelectParams
    ) => Promise<any>;
    onSelectTitle?: string;
    hideInPropertyGrid?: boolean | ((object: IEezObject, propertyInfo: PropertyInfo) => boolean);
    readOnlyInPropertyGrid?: boolean;
    propertyGridGroup?: IPropertyGridGroupDefinition;
    propertyGridComponent?: typeof React.Component;
    propertyGridCollapsable?: boolean;
    propertyGridCollapsableDefaultPropertyName?: string;
    propertyGridCollapsableEnabled?: () => boolean;
    enumerable?: boolean | ((object: IEezObject, propertyInfo: PropertyInfo) => boolean);
    showOnlyChildrenInTree?: boolean;
    isOptional?: boolean;
    defaultValue?: any;
    inheritable?: boolean;
    propertyMenu?: (props: PropertyProps) => Electron.MenuItem[];
    unique?: boolean;
    skipSearch?: boolean;
    childLabel?: (childObject: IEezObject, childLabel: string) => string;
    check?: (object: IEezObject) => IMessage[];
    interceptAddObject?: (parentObject: IEezObject, object: IEezObject) => IEezObject;
    downloadFileName?: (object: IEezObject, propertyInfo: PropertyInfo) => string;
    embeddedImage?: boolean;
    partOfNavigation?: boolean;
    fileFilters?: any;
}

export interface NavigationComponentProps {
    id: string;
    navigationObject: IEezObject;
    navigationStore?: INavigationStore;
    dragAndDropManager?: DragAndDropManagerClass;
    onDoubleClickItem?: (item: IEezObject) => void;
}

export class NavigationComponent extends React.Component<NavigationComponentProps, {}> {}

export interface IEditorState {
    loadState(state: any): void;
    saveState(): any;
    selectObject(object: IEezObject): void;
}

export interface IEditor {
    object: IEezObject;
    state: IEditorState | undefined;
}

export interface EditorComponentProps {
    editor: IEditor;
}

export class EditorComponent extends React.Component<EditorComponentProps, {}> {}

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

    showInNavigation?: boolean;
    hideInProperties?: boolean;
    isPropertyMenuSupported?: boolean;
    navigationComponent?: typeof NavigationComponent | null;
    navigationComponentId?: string;
    defaultNavigationKey?: string;

    editorComponent?: typeof EditorComponent;
    isEditorSupported?: (object: IEezObject) => boolean;

    createEditorState?: (object: IEezObject) => IEditorState;
    newItem?: (object: IEezObject) => Promise<any>;
    findItemByName?: (name: string) => IEezObject | undefined;
    getInheritedValue?: (object: IEezObject, propertyName: string) => InheritedValue;
    defaultValue?: any;
    findPastePlaceInside?: (
        object: IEezObject,
        classInfo: ClassInfo,
        isSingleObject: boolean
    ) => IEezObject | PropertyInfo | undefined;
    icon?: string;

    propertyGridTableComponent?: any;

    beforeLoadHook?(object: IEezObject, jsObject: any): void;

    updateObjectValueHook?: (
        object: IEezObject,
        propertyName: string,
        value: any
    ) =>
        | {
              oldValue: any;
              newValue: any;
          }
        | undefined;

    afterUpdateObjectHook?: (object: IEezObject, changedProperties: any, oldValues: any) => void;

    creatableFromPalette?: boolean;

    extendContextMenu?: (
        object: IEezObject,
        context: IContextMenuContext,
        objects: IEezObject[],
        menuItems: Electron.MenuItem[]
    ) => void;

    check?: (object: IEezObject) => IMessage[];
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
        derivedClassInfoProperties.beforeLoadHook = (object: IEezObject, jsObject: any) => {
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

    const derivedClassInfo = Object.assign({}, baseClassInfo, derivedClassInfoProperties);
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

        setId(valueObject, getId(object) + "." + propertyInfo.name);
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
        (Array.isArray(object) && (object.length == 0 || isEezObject(object[0])))
    );
}

////////////////////////////////////////////////////////////////////////////////

export function findClass(className: string) {
    return classes.get(className);
}

export function getClassesDerivedFrom(parentClass: EezClass) {
    const derivedClasses = [];
    for (const aClass of classes.values()) {
        if (isProperSubclassOf(aClass.classInfo, parentClass.classInfo)) {
            derivedClasses.push(aClass);
        }
    }
    return derivedClasses;
}

export function isSubclassOf(classInfo: ClassInfo | undefined, baseClassInfo: ClassInfo) {
    while (classInfo) {
        if (classInfo === baseClassInfo) {
            return true;
        }
        classInfo = classInfo.parentClassInfo;
    }
    return false;
}

export function isProperSubclassOf(classInfo: ClassInfo | undefined, baseClassInfo: ClassInfo) {
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

export function isObjectInstanceOf(object: IEezObject, baseClassInfo: ClassInfo) {
    return isSubclassOf(getClassInfo(object), baseClassInfo);
}

export function isValue(object: IEezObject | undefined) {
    return !!object && object instanceof EezValueObject;
}

export function isObject(object: IEezObject | undefined) {
    return !!object && !isValue(object) && !isArray(object);
}

export function isArray(object: IEezObject | undefined): object is IEezObject[] {
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

        return properties.map(propertyInfo => getProperty(parent, propertyInfo.name));
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

const objectMetaPropertiesMap = new Map<IEezObject, any>();

(window as any).EEZStudio._objectMetaPropertiesMap = objectMetaPropertiesMap;

function getObjectMetaProperty(object: IEezObject, propertyName: string): any {
    let objectMetaProperties = objectMetaPropertiesMap.get(object);
    return objectMetaProperties && objectMetaProperties[propertyName];
}

function setObjectMetaProperty(object: IEezObject, propertyName: string, propertyValue: any) {
    let objectMetaProperties = objectMetaPropertiesMap.get(object);
    if (!objectMetaProperties) {
        objectMetaProperties = {};
        objectMetaPropertiesMap.set(object, objectMetaProperties);
    }
    objectMetaProperties[propertyName] = propertyValue;
}

export function getId(object: IEezObject) {
    return getObjectMetaProperty(object, "id");
}

export function setId(object: IEezObject, id: string) {
    return setObjectMetaProperty(object, "id", id);
}

export function getParent(object: IEezObject): IEezObject {
    return getObjectMetaProperty(object, "parent");
}

export function setParent(object: IEezObject, parentObject: IEezObject) {
    return setObjectMetaProperty(object, "parent", parentObject);
}

export function getKey(object: IEezObject): string {
    return getObjectMetaProperty(object, "key");
}

export function setKey(object: IEezObject, key: string) {
    return setObjectMetaProperty(object, "key", key);
}

export function getPropertyInfo(object: IEezObject): PropertyInfo {
    return getObjectMetaProperty(object, "propertyInfo");
}

export function setPropertyInfo(object: IEezObject, propertyInfo: PropertyInfo) {
    return setObjectMetaProperty(object, "propertyInfo", propertyInfo);
}

export function getNextChildId(object: IEezObject) {
    let lastChildId = getObjectMetaProperty(object, "lastChildId");
    if (lastChildId == undefined) {
        lastChildId = 1;
    } else {
        lastChildId++;
    }
    setObjectMetaProperty(object, "lastChildId", lastChildId);
    return lastChildId;
}

export function getEditorComponent(object: IEezObject): typeof EditorComponent | undefined {
    const isEditorSupported = getClassInfo(object).isEditorSupported;
    if (isEditorSupported && !isEditorSupported(object)) {
        return undefined;
    }
    return getClassInfo(object).editorComponent;
}

export function getLabel(object: IEezObject): string {
    const label = getClassInfo(object).label;
    if (label) {
        return label(object);
    }

    let name = (object as any).name;
    if (name) {
        return name;
    }

    return getId(object);
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

function uniqueTop(objects: IEezObject[]): IEezObject[] {
    return _uniqWith(
        objects,
        (a: IEezObject, b: IEezObject) => isAncestor(a, b) || isAncestor(b, a)
    );
}

function getParents(objects: IEezObject[]): IEezObject[] {
    return uniqueTop(
        objects.map(object => getParent(object)).filter(object => !!object) as IEezObject[]
    );
}

export function reduceUntilCommonParent(objects: IEezObject[]): IEezObject[] {
    let uniqueTopObjects = uniqueTop(objects);

    let parents = getParents(uniqueTopObjects);

    if (parents.length == 1) {
        return uniqueTopObjects;
    }

    if (parents.length > 1) {
        return reduceUntilCommonParent(parents);
    }

    return [];
}

export function isArrayElement(object: IEezObject) {
    return isArray(getParent(object));
}

export function findPropertyByNameInObject(object: IEezObject, propertyName: string) {
    return getClassInfo(object).properties.find(propertyInfo => propertyInfo.name == propertyName);
}

export function findPropertyByNameInClassInfo(classInfo: ClassInfo, propertyName: string) {
    return classInfo.properties.find(propertyInfo => propertyInfo.name == propertyName);
}

export function findPropertyByChildObject(object: IEezObject, childObject: IEezObject) {
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

export function isPropertyHidden(object: IEezObject, propertyInfo: PropertyInfo) {
    if (propertyInfo.hideInPropertyGrid === undefined) {
        return false;
    }

    if (typeof propertyInfo.hideInPropertyGrid === "boolean") {
        return propertyInfo.hideInPropertyGrid;
    }

    return propertyInfo.hideInPropertyGrid(object, propertyInfo);
}

export function isPropertyEnumerable(object: IEezObject, propertyInfo: PropertyInfo) {
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

export function getPropertyAsString(object: IEezObject, propertyInfo: PropertyInfo) {
    let value = getProperty(object, propertyInfo.name);
    if (typeof value === "number") {
        return value.toString();
    }
    if (typeof value === "string") {
        return value;
    }
    if (isArray(value)) {
        return (value as IEezObject[]).map(object => getLabel(object)).join(", ");
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

export function objectToString(object: IEezObject) {
    let label: string;

    if (isValue(object)) {
        label = getProperty(getParent(object), getKey(object));
    } else if (isArray(object)) {
        let propertyInfo = findPropertyByNameInObject(getParent(object), getKey(object));
        label = (propertyInfo && propertyInfo.displayName) || humanize(getKey(object));
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

        if (elementIndex !== undefined && elementIndex >= 0 && elementIndex < array.length) {
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
            return EezValueObject.create(object, propertyInfo, childObjectOrValue);
        }
    }

    return undefined;
}

export function getAncestorOfType(
    object: IEezObject,
    classInfo: ClassInfo
): IEezObject | undefined {
    if (object) {
        if (isObjectInstanceOf(object, classInfo)) {
            return object;
        }
        return getParent(object) && getAncestorOfType(getParent(object), classInfo);
    }
    return undefined;
}

export function getObjectPath(object: IEezObject): (string | number)[] {
    let parent = getParent(object);
    if (parent) {
        if (isArray(parent)) {
            return getObjectPath(parent).concat(parent.indexOf(object as IEezObject));
        } else {
            return getObjectPath(parent).concat(getKey(object));
        }
    }
    return [];
}

export function getObjectPropertyAsObject(object: IEezObject, propertyInfo: PropertyInfo) {
    return getChildOfObject(object, propertyInfo) as EezValueObject;
}

export function getRootObject(object: IEezObject) {
    while (getParent(object)) {
        object = getParent(object);
    }
    return object;
}

// Get object ancestors as array,
// from the root object up to the given object (including given object)
export function getAncestors(
    object: IEezObject,
    ancestor?: IEezObject,
    showSingleArrayChild?: boolean
): IEezObject[] {
    if (!ancestor) {
        return getAncestors(object, getRootObject(object));
    }

    if (isValue(object)) {
        object = getParent(object);
    }

    if (isArray(ancestor)) {
        let possibleAncestor = ancestor.find(
            possibleAncestor =>
                object == possibleAncestor ||
                getId(object).startsWith(getId(possibleAncestor) + ".")
        );
        if (possibleAncestor) {
            if (possibleAncestor == object) {
                if (showSingleArrayChild) {
                    return [ancestor, object];
                } else {
                    return [object];
                }
            } else {
                if (showSingleArrayChild) {
                    return [ancestor as IEezObject].concat(getAncestors(object, possibleAncestor));
                } else {
                    return getAncestors(object, possibleAncestor);
                }
            }
        }
    } else {
        let numObjectOrArrayProperties = 0;
        for (const propertyInfo of getClassInfo(ancestor).properties) {
            if (
                propertyInfo.type === PropertyType.Object ||
                propertyInfo.type === PropertyType.Array
            ) {
                numObjectOrArrayProperties++;
            }
        }

        if (numObjectOrArrayProperties > 0) {
            for (const propertyInfo of getClassInfo(ancestor).properties) {
                if (
                    propertyInfo.type === PropertyType.Object ||
                    propertyInfo.type === PropertyType.Array
                ) {
                    let possibleAncestor: IEezObject = (ancestor as any)[propertyInfo.name];

                    if (possibleAncestor === object) {
                        return [ancestor];
                    }

                    if (
                        possibleAncestor &&
                        getId(object).startsWith(getId(possibleAncestor) + ".")
                    ) {
                        return [ancestor].concat(
                            getAncestors(object, possibleAncestor, numObjectOrArrayProperties > 1)
                        );
                    }
                }
            }
        }
    }
    return [];
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

export function getObjectFromStringPath(rootObject: IEezObject, stringPath: string) {
    if (stringPath == "/") {
        return rootObject;
    }
    return getObjectFromPath(rootObject, stringPath.split("/").slice(1));
}

export function getObjectFromObjectId(
    rootObject: IEezObject,
    objectID: string
): IEezObject | undefined {
    function getDescendantObjectFromId(object: IEezObject, id: string): IEezObject | undefined {
        if (getId(object) == id) {
            return object;
        }

        if (isArray(object)) {
            let childObject = object.find(
                child => id == getId(child) || id.startsWith(getId(child) + ".")
            );
            if (childObject) {
                if (getId(childObject) == id) {
                    return childObject;
                }
                return getDescendantObjectFromId(childObject, id);
            }
        } else {
            for (const propertyInfo of getClassInfo(object).properties) {
                if (
                    propertyInfo.type === PropertyType.Object ||
                    propertyInfo.type === PropertyType.Array
                ) {
                    let childObject = getChildOfObject(object, propertyInfo);
                    if (childObject) {
                        if (getId(childObject) == id) {
                            return childObject;
                        }
                        if (id.startsWith(getId(childObject) + ".")) {
                            return getDescendantObjectFromId(childObject, id);
                        }
                    }
                }
            }
        }

        return undefined;
    }

    return getDescendantObjectFromId(rootObject, objectID as string);
}

export function cloneObject(parent: IEezObject | undefined, obj: IEezObject) {
    return loadObject(parent, objectToJson(obj), getClass(obj));
}

export function isShowOnlyChildrenInTree(object: IEezObject) {
    if (!getParent(object) || !getKey(object)) {
        return true;
    }

    const propertyInfo = findPropertyByNameInObject(getParent(object), getKey(object));
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
        getClassInfo(object)._arrayAndObjectProperties = getClassInfo(object).properties.filter(
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
            !objects.find(object => isArray(object) || isPropertyHidden(object, propertyInfo))
    );

    if (objects.length > 1) {
        // some property types are not supported in multi-objects property grid
        properties = properties.filter(
            propertyInfo =>
                propertyInfo.type !== PropertyType.Array &&
                !(propertyInfo.type === PropertyType.String && propertyInfo.unique === true)
        );

        // show only common properties
        properties = properties.filter(
            propertyInfo =>
                !objects.find(
                    object => !getClassInfo(object).properties.find(pi => pi === propertyInfo)
                )
        );
    }

    return properties;
}

export function getPropertySourceInfo(props: PropertyProps): PropertyValueSourceInfo {
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
                let inheritedValue = getInheritedValue(object, propertyInfo.name);
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

    const sourceInfoArray = props.objects.map(object => getSourceInfo(object, props.propertyInfo));

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
