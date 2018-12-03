import React from "react";
import { observable } from "mobx";

import { _uniqWith } from "eez-studio-shared/algorithm";
import { humanize } from "eez-studio-shared/string";

import { loadObject, objectToJson, objectToJS } from "eez-studio-shared/model/serialization";
export { loadObject, objectToJson, objectToJS };

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
    RelativeFolder,
    ObjectReference,
    ConfigurationReference,
    Boolean,
    GUID,
    Any
}

export enum TargetDataType {
    String,
    Number
}

export enum MessageType {
    INFO,
    ERROR,
    WARNING
}

export interface IMessage {
    type: MessageType;
    text: string;
    object?: EezObject;
}

export interface PropertyInfo {
    name: string;
    type: PropertyType;

    // optional properties
    targetDataType?: TargetDataType;
    displayName?: string;
    enumItems?: EnumItem[];
    typeClass?: EezClass;
    referencedObjectCollectionPath?: string[];
    matchObjectReference?: (object: EezObject, path: (string | number)[], value: string) => boolean;
    replaceObjectReference?: (value: string) => string;
    onSelect?: (object: EezObject, propertyInfo: PropertyInfo) => Promise<any>;
    hideInPropertyGrid?: boolean;
    readOnlyInPropertyGrid?: boolean;
    enumerable?: boolean;
    isOptional?: boolean;
    defaultValue?: any;
    inheritable?: boolean;
    unique?: boolean;
    skipSearch?: boolean;
    childLabel?: (childObject: EezObject, childLabel: string) => string;
    check?: (object: EezObject) => IMessage[];
}

export interface NavigationComponentProps {
    id: string;
    navigationObject: EezObject;
    content: JSX.Element;
}

export class NavigationComponent extends React.Component<NavigationComponentProps, {}> {}

export interface IEditorState {
    loadState(state: any): void;
    saveState(): any;
    selectObject(object: EezObject): void;
}

export interface IEditor {
    object: EezObject;
    state: IEditorState | undefined;
}

export interface EditorComponentProps {
    editor: IEditor;
}

export class EditorComponent extends React.Component<EditorComponentProps, {}> {}

export type InheritedValue =
    | {
          value: any;
          source: string;
      }
    | undefined;

export interface ClassInfo {
    properties: PropertyInfo[];

    // optional properties
    getClass?: (jsObject: any) => any;
    label?: (object: EezObject) => string;
    listLabel?: (object: EezObject) => JSX.Element | string;

    parentClassInfo?: ClassInfo;

    showInNavigation?: boolean;
    hideInProperties?: boolean;
    navigationComponent?: typeof NavigationComponent | null;
    navigationComponentId?: string;
    defaultNavigationKey?: string;

    editorComponent?: typeof EditorComponent;
    createEditorState?: (object: EezObject) => IEditorState;
    newItem?: (object: EezObject) => Promise<any>;
    getInheritedValue?: (object: EezObject, propertyName: string) => InheritedValue;
    defaultValue?: any;
    findPastePlaceInside?: (
        object: EezObject,
        classInfo: ClassInfo,
        isSingleObject: boolean
    ) => EezObject | PropertyInfo | undefined;
    icon?: string;
}

export function makeDerivedClassInfo(
    baseClassInfo: ClassInfo,
    derivedClassInfoProperties: Partial<ClassInfo>
): ClassInfo {
    if (derivedClassInfoProperties.properties) {
        derivedClassInfoProperties.properties = baseClassInfo.properties.concat(
            derivedClassInfoProperties.properties
        );
    }

    const derivedClassInfo = Object.assign({}, baseClassInfo, derivedClassInfoProperties);
    derivedClassInfo.parentClassInfo = baseClassInfo;
    return derivedClassInfo;
}

////////////////////////////////////////////////////////////////////////////////

export class EezObject {
    _id: string;
    _key?: string;
    _parent?: EezObject;
    _lastChildId?: number;
    _modificationTime?: number;
    _propertyInfo?: PropertyInfo;

    static classInfo: ClassInfo;

    get _class() {
        return this.constructor as EezClass;
    }

    get _classInfo(): ClassInfo {
        return this._class.classInfo;
    }

    get _label(): string {
        if (this._classInfo.label) {
            return this._classInfo.label(this);
        }

        let name = (this as any).name;
        if (name) {
            return name;
        }

        return this._id;
    }
}

export class EezArrayObject<T> extends EezObject {
    @observable _array: T[] = [];

    get _class() {
        return this._propertyInfo!.typeClass!;
    }
}

////////////////////////////////////////////////////////////////////////////////

export type EezClass = typeof EezObject;

let classes = new Map<string, EezClass>();

export function registerClass(aClass: EezClass) {
    classes.set(aClass.name, aClass);
}

////////////////////////////////////////////////////////////////////////////////

export class EezValueObject extends EezObject {
    public propertyInfo: PropertyInfo;
    public value: any;

    static create(object: EezObject, propertyInfo: PropertyInfo, value: any) {
        const valueObject = new EezValueObject();

        valueObject._id = object._id + "." + propertyInfo.name;
        valueObject._key = propertyInfo.name;
        valueObject._parent = object;

        valueObject.propertyInfo = propertyInfo;
        valueObject.value = value;

        return valueObject;
    }

    static classInfo: ClassInfo = {
        label: (object: EezValueObject) => {
            return object.value && object.value.toString();
        },
        properties: []
    };
}

registerClass(EezValueObject);

////////////////////////////////////////////////////////////////////////////////

export function findClass(className: string) {
    return classes.get(className);
}

export function getClassesDerivedFrom(parentClass: EezClass) {
    const derivedClasses = [];
    for (const aClass of classes.values()) {
        if (aClass.classInfo.parentClassInfo === parentClass.classInfo) {
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

export function isObjectInstanceOf(object: EezObject, baseClassInfo: ClassInfo) {
    return isSubclassOf(object._classInfo, baseClassInfo);
}

export function isSameInstanceTypeAs(object1: EezObject, object2: EezObject) {
    if (!object1 || !object2) {
        return false;
    }
    return object1._classInfo === object2._classInfo;
}

export function isEqual(object1: EezObject, object2: EezObject) {
    if (isValue(object1)) {
        if (!isValue(object1)) {
            return false;
        }
        return object1._parent == object2._parent && object1._key == object2._key;
    } else {
        if (isValue(object1)) {
            return false;
        }
        return object1 == object2;
    }
}

export function isValue(object: EezObject | undefined) {
    return !!object && object instanceof EezValueObject;
}

export function isObject(object: EezObject | undefined) {
    return !!object && !isValue(object) && !isArray(object);
}

export function isArray(object: EezObject | undefined) {
    return !!object && !isValue(object) && object instanceof EezArrayObject;
}

export function asArray(object: EezObject) {
    return object && (object as EezArrayObject<EezObject>)._array;
}

export function getChildren(parent: EezObject): EezObject[] {
    if (isArray(parent)) {
        return asArray(parent);
    } else {
        let properties = parent._classInfo.properties.filter(
            propertyInfo =>
                (propertyInfo.type === PropertyType.Object ||
                    propertyInfo.type === PropertyType.Array) &&
                !(propertyInfo.enumerable !== undefined && !propertyInfo.enumerable) &&
                getProperty(parent, propertyInfo.name)
        );

        if (properties.length == 1 && properties[0].type === PropertyType.Array) {
            return asArray(getProperty(parent, properties[0].name));
        }

        return properties.map(propertyInfo => getProperty(parent, propertyInfo.name));
    }
}

export function isAncestor(object: EezObject, ancestor: EezObject): boolean {
    if (object == undefined || ancestor == undefined) {
        return false;
    }

    if (object == ancestor) {
        return true;
    }

    let parent = object._parent;
    return !!parent && isAncestor(parent, ancestor);
}

export function isProperAncestor(object: EezObject, ancestor: EezObject) {
    if (object == undefined || object == ancestor) {
        return false;
    }

    let parent = object._parent;
    return !!parent && isAncestor(parent, ancestor);
}

function uniqueTop(objects: EezObject[]): EezObject[] {
    return _uniqWith(objects, (a: EezObject, b: EezObject) => isAncestor(a, b) || isAncestor(b, a));
}

function getParents(objects: EezObject[]): EezObject[] {
    return uniqueTop(objects
        .map(object => object._parent)
        .filter(object => !!object) as EezObject[]);
}

export function reduceUntilCommonParent(objects: EezObject[]): EezObject[] {
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

export function isArrayElement(object: EezObject) {
    return object._parent instanceof EezArrayObject;
}

export function findPropertyByName(object: EezObject, propertyName: string) {
    return object._classInfo.properties.find(propertyInfo => propertyInfo.name == propertyName);
}

export function getInheritedValue(object: EezObject, propertyName: string) {
    const getInheritedValue = object._classInfo.getInheritedValue;
    if (getInheritedValue) {
        return getInheritedValue(object, propertyName);
    }
    return undefined;
}

export function getProperty(object: EezObject, name: string) {
    return (object as any)[name];
}

export function getPropertyAsString(object: EezObject, propertyInfo: PropertyInfo) {
    let value = getProperty(object, propertyInfo.name);
    if (value) {
        if (value instanceof EezObject) {
            return objectToString(value);
        }
        return value.toString();
    }
}

export function humanizePropertyName(object: EezObject, propertyName: string) {
    const property = findPropertyByName(object, propertyName);
    if (property && property.displayName) {
        return property.displayName;
    }
    return humanize(propertyName);
}

export function objectToString(object: EezObject) {
    let label: string;

    if (isValue(object)) {
        label = getProperty(object._parent!, object._key!);
    } else if (isArray(object)) {
        let propertyInfo = findPropertyByName(object._parent!, object._key!);
        label = (propertyInfo && propertyInfo.displayName) || humanize(object._key);
    } else {
        label = object._label;
    }

    if (
        object &&
        object._parent &&
        object._parent instanceof EezArrayObject &&
        object._parent!._parent &&
        object._parent!._key
    ) {
        let propertyInfo = findPropertyByName(object._parent!._parent!, object._parent!._key!);
        if (propertyInfo && propertyInfo.childLabel) {
            label = propertyInfo.childLabel(object, label);
        }
    }

    return label;
}

export function getChildOfObject(
    object: EezObject,
    key: PropertyInfo | string | number
): EezObject | undefined {
    let propertyInfo: PropertyInfo | undefined;

    if (isArray(object)) {
        let elementIndex: number | undefined = undefined;

        if (typeof key == "string") {
            elementIndex = parseInt(key);
        } else if (typeof key == "number") {
            elementIndex = key;
        }

        const array = asArray(object);

        if (elementIndex !== undefined && elementIndex >= 0 && elementIndex < array.length) {
            return array[elementIndex];
        } else {
            console.error("invalid array index");
        }
    } else {
        if (typeof key == "string") {
            propertyInfo = findPropertyByName(object, key);
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

export function getAncestorOfType(object: EezObject, classInfo: ClassInfo): EezObject | undefined {
    if (object) {
        if (object._classInfo === classInfo) {
            return object;
        }
        return object._parent && getAncestorOfType(object._parent!, classInfo);
    }
    return undefined;
}

export function getObjectPath(object: EezObject): (string | number)[] {
    let parent = object._parent;
    if (parent) {
        if (isArrayElement(object)) {
            return getObjectPath(parent).concat(asArray(parent).indexOf(object as EezObject));
        } else {
            return getObjectPath(parent).concat(object._key as string);
        }
    }
    return [];
}

export function getObjectPropertyAsObject(object: EezObject, propertyInfo: PropertyInfo) {
    return getChildOfObject(object, propertyInfo) as EezValueObject;
}

export function getRootObject(object: EezObject) {
    while (object._parent) {
        object = object._parent;
    }
    return object;
}

// Get object ancestors as array,
// from the root object up to the given object (including given object)
export function getAncestors(
    object: EezObject,
    ancestor?: EezObject,
    showSingleArrayChild?: boolean
): EezObject[] {
    if (!ancestor) {
        return getAncestors(object, getRootObject(object));
    }

    if (isValue(object)) {
        object = object._parent!;
    }

    if (isArray(ancestor)) {
        let possibleAncestor = asArray(ancestor).find(
            possibleAncestor =>
                object == possibleAncestor || object._id.startsWith(possibleAncestor._id + ".")
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
                    return [ancestor as EezObject].concat(getAncestors(object, possibleAncestor));
                } else {
                    return getAncestors(object, possibleAncestor);
                }
            }
        }
    } else {
        let numObjectOrArrayProperties = 0;
        for (const propertyInfo of ancestor._classInfo.properties) {
            if (
                propertyInfo.type === PropertyType.Object ||
                propertyInfo.type === PropertyType.Array
            ) {
                numObjectOrArrayProperties++;
            }
        }

        if (numObjectOrArrayProperties > 0) {
            for (const propertyInfo of ancestor._classInfo.properties) {
                if (
                    propertyInfo.type === PropertyType.Object ||
                    propertyInfo.type === PropertyType.Array
                ) {
                    let possibleAncestor: EezObject = (ancestor as any)[propertyInfo.name];

                    if (possibleAncestor === object) {
                        return [];
                    }

                    if (possibleAncestor && object._id.startsWith(possibleAncestor._id + ".")) {
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

export function getHumanReadableObjectPath(object: EezObject) {
    let ancestors = getAncestors(object);
    return ancestors
        .slice(1)
        .map(object => objectToString(object))
        .join(" / ");
}

export function getObjectPathAsString(object: EezObject) {
    return "/" + getObjectPath(object).join("/");
}

export function isObjectExists(object: EezObject) {
    let parent = object._parent;
    if (parent) {
        if (isArray(parent)) {
            if (asArray(parent).indexOf(object) === -1) {
                return false;
            }
        } else {
            const key = object._key;
            if (key && (parent as any)[key] !== object) {
                return false;
            }
        }
    }
    return true;
}

export function getObjectFromPath(rootObject: EezObject, path: string[]) {
    let object = rootObject;

    for (let i = 0; i < path.length && object; i++) {
        object = getChildOfObject(object, path[i]) as EezObject;
    }

    return object;
}

export function getObjectFromStringPath(rootObject: EezObject, stringPath: string) {
    if (stringPath == "/") {
        return rootObject;
    }
    return getObjectFromPath(rootObject, stringPath.split("/").slice(1));
}

export function getObjectFromObjectId(
    rootObject: EezObject,
    objectID: string
): EezObject | undefined {
    function getDescendantObjectFromId(object: EezObject, id: string): EezObject | undefined {
        if (object._id == id) {
            return object;
        }

        if (isArray(object)) {
            let childObject = asArray(object).find(
                child => id == child._id || id.startsWith(child._id + ".")
            );
            if (childObject) {
                if (childObject._id == id) {
                    return childObject;
                }
                return getDescendantObjectFromId(childObject, id);
            }
        } else {
            for (const propertyInfo of object._classInfo.properties) {
                if (
                    propertyInfo.type === PropertyType.Object ||
                    propertyInfo.type === PropertyType.Array
                ) {
                    let childObject = getChildOfObject(object, propertyInfo);
                    if (childObject) {
                        if (childObject._id == id) {
                            return childObject;
                        }
                        if (id.startsWith(childObject._id + ".")) {
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

export function cloneObject(parent: EezObject | undefined, obj: EezObject) {
    return loadObject(parent, objectToJson(obj), obj._class);
}

export function checkObject(object: EezObject): IMessage[] {
    if (isArray(object)) {
        const check = object._propertyInfo!.check;
        if (check) {
            return check(object);
        }
    } else {
        if ((object as any).check) {
            return (object as any).check();
        }
    }
    return [];
}

export function hidePropertiesInPropertyGrid(aClass: EezClass, properties: string[]) {
    aClass.classInfo.properties.forEach(propertyInfo => {
        if (properties.indexOf(propertyInfo.name) !== -1) {
            propertyInfo.hideInPropertyGrid = true;
        }
    });
}
