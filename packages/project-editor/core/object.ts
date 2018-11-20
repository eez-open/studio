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

export interface PropertyInfo {
    name: string;
    type: PropertyType;

    // optional properties
    displayName?: string;
    enumItems?: EnumItem[];
    typeClass?: EezClass;
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
    createEditorState?: (object: EezObject) => EditorState;
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
