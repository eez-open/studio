import React from "react";
import { observable, makeObservable } from "mobx";

import { humanize } from "eez-studio-shared/string";
import { Rect } from "eez-studio-shared/geometry";

import type { IDashboardComponentContext } from "eez-studio-types";

import {
    ProjectStore,
    IContextMenuContext,
    getClassInfo,
    EezValueObject
} from "project-editor/store";

import type { IResizeHandler } from "project-editor/flow/flow-interfaces";

import type { ValueType } from "project-editor/features/variable/value-type";
import type { Project } from "project-editor/project/project";

import { isArray, objectClone } from "eez-studio-shared/util";
import { LVGLParts } from "project-editor/lvgl/lvgl-constants";

////////////////////////////////////////////////////////////////////////////////

export const enum PropertyType {
    Array,
    Object,

    Boolean,

    Number,

    Enum,

    String,
    MultilineText,
    Image,
    Color,
    ThemedColor,
    RelativeFolder,
    RelativeFile,
    ObjectReference,

    JSON,
    JavaScript,
    CSS,
    Python,
    CPP,

    GUID,

    NumberArrayAsString,
    StringArray,
    ConfigurationReference,
    Any,

    LVGLWidget,

    Null
}

export const TYPE_NAMES: { [key in PropertyType]: string } = {
    [PropertyType.Array]: "Array",
    [PropertyType.Object]: "Object",
    [PropertyType.Boolean]: "Boolean",
    [PropertyType.Number]: "Number",
    [PropertyType.Enum]: "Enum",
    [PropertyType.String]: "String",
    [PropertyType.MultilineText]: "MultilineText",
    [PropertyType.Image]: "Image",
    [PropertyType.Color]: "Color",
    [PropertyType.ThemedColor]: "ThemedColor",
    [PropertyType.RelativeFolder]: "RelativeFolder",
    [PropertyType.RelativeFile]: "RelativeFile",
    [PropertyType.ObjectReference]: "ObjectReference",
    [PropertyType.JSON]: "JSON",
    [PropertyType.JavaScript]: "JavaScript",
    [PropertyType.CSS]: "CSS",
    [PropertyType.Python]: "Python",
    [PropertyType.CPP]: "CPP",
    [PropertyType.GUID]: "GUID",
    [PropertyType.NumberArrayAsString]: "NumberArrayAsString",
    [PropertyType.StringArray]: "StringArray",
    [PropertyType.ConfigurationReference]: "ConfigurationReference",
    [PropertyType.Any]: "Any",
    [PropertyType.LVGLWidget]: "LVGLWidget",
    [PropertyType.Null]: "Null"
};

export const enum ProjectType {
    UNDEFINED = "undefined",
    FIRMWARE = "firmware",
    FIRMWARE_MODULE = "firmware-module",
    RESOURCE = "resource",
    APPLET = "applet",
    DASHBOARD = "dashboard",
    LVGL = "lvgl",
    IEXT = "iext"
}

////////////////////////////////////////////////////////////////////////////////

export interface EnumItem {
    id: string | number;
    label?: string;
}

export enum MessageType {
    INFO,
    ERROR,
    WARNING,
    SEARCH_RESULT,
    GROUP
}

export interface IMessage {
    type: MessageType;
    text: string;
    object?: IEezObject;
    messages?: IMessage[];
}

export interface IPropertyGridGroupDefinition {
    id: string;
    title: string;
    position?: number | ((object: IEezObject) => number);
}

export interface PropertyProps {
    propertyInfo: PropertyInfo;
    objects: IEezObject[];
    readOnly: boolean;
    updateObject: (propertyValues: Object) => void;
    collapsed?: boolean;
    onClick?: (event: React.MouseEvent) => void;
}

export interface IOnSelectParams {
    textInputSelection?: {
        start: number | null;
        end: number | null;
        direction: "forward" | "backward" | "none" | null | undefined;
    };
}

export type FlowPropertyType =
    | "input"
    | "assignable"
    | "template-literal"
    | "scpi-template-literal";

export type LvglActionPropertyType =
    | "boolean"
    | "integer"
    | "string"
    | `enum:${string}`
    | "screen"
    | "widget"
    | `widget:${string}`
    | "group"
    | "style"
    | "image";

export interface PropertyInfo {
    name: string;
    type: PropertyType;

    dynamicType?: (object: IEezObject) => PropertyType;
    dynamicTypeReferencedObjectCollectionPath?: (
        object: IEezObject
    ) => string | undefined;

    // optional properties
    displayName?: string | ((object: IEezObject) => string);
    displayValue?: (object: IEezObject) => any;
    enumItems?: EnumItem[] | ((object: IEezObject) => EnumItem[]);
    enumDisallowUndefined?: boolean;
    typeClass?: EezClass;
    referencedObjectCollectionPath?: string;
    filterReferencedObjectCollection?: (
        objects: IEezObject[],
        referencedObject: IEezObject
    ) => boolean;
    computed?: boolean;
    computedIfNotLoadProject?: boolean;
    modifiable?: boolean;
    onSelect?: (
        object: IEezObject,
        propertyInfo: PropertyInfo,
        params?: IOnSelectParams
    ) => Promise<any>;
    isOnSelectAvailable?: (object: IEezObject) => boolean;
    onSelectTitle?: string;

    disabled?: (object: IEezObject, propertyInfo: PropertyInfo) => boolean;

    hideInPropertyGrid?:
        | boolean
        | ((object: IEezObject, propertyInfo: PropertyInfo) => boolean);
    readOnlyInPropertyGrid?:
        | boolean
        | ((object: IEezObject, propertyInfo: PropertyInfo) => boolean);

    propertyGridGroup?: IPropertyGridGroupDefinition;
    propertyGridRowComponent?: React.ComponentType<PropertyProps>;
    propertyGridColumnComponent?: React.ComponentType<PropertyProps>;
    propertyGridFullRowComponent?: React.ComponentType<PropertyProps>;
    propertyGridCollapsable?: boolean;
    propertyGridCollapsableDefaultPropertyName?: string;
    propertyGridCollapsableEnabled?: (object: IEezObject) => boolean;
    enumerable?:
        | boolean
        | ((object: IEezObject, propertyInfo: PropertyInfo) => boolean);
    showOnlyChildrenInTree?: boolean;
    isOptional?:
        | boolean
        | ((object: IEezObject, propertyInfo: PropertyInfo) => boolean);
    defaultValue?: any;
    inheritable?: boolean;
    nonInheritable?: boolean;
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
    uniqueIdentifier?:
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
    check?: (object: IEezObject, messages: IMessage[]) => void;
    interceptAddObject?: (
        parentObject: IEezObject,
        object: EezObject
    ) => EezObject;
    downloadFileName?: (
        object: IEezObject,
        propertyInfo: PropertyInfo
    ) => string;
    defaultImagesPath?: (projectStore: ProjectStore) => string | undefined;
    partOfNavigation?: boolean;
    fileFilters?: any;

    flowProperty?:
        | FlowPropertyType
        | ((object: IEezObject | undefined) => FlowPropertyType | undefined);
    expressionType?: ValueType;
    expressionIsConstant?: boolean;
    isOutputOptional?:
        | boolean
        | ((object: IEezObject, propertyInfo: PropertyInfo) => boolean);

    isFlowPropertyBuildable?: (
        object: IEezObject,
        propertyInfo: PropertyInfo
    ) => boolean;

    monospaceFont?: boolean;
    disableSpellcheck?: boolean;
    cssAttributeName?: string;
    checkboxStyleSwitch?: boolean;
    checkboxHideLabel?: boolean;
    disableBitmapPreview?: boolean;
    inputPlaceholder?: (object: IEezObject) => string;
    embeddedImage?: boolean;

    visitProperty?: (parentObject: IEezObject) => EezValueObject[];

    formText?:
        | string
        | ((object: IEezObject | undefined) => React.ReactNode | undefined);

    propertyNameAbove?: boolean;

    hasExpressionProperties?: boolean;

    hideInDocumentation?: "widget" | "action" | "all" | "none";

    getInstrumentId?: (parentObject: IEezObject) => string | undefined;

    arrayPropertyEditorAdditionalButtons?: (
        parentObject: IEezObject,
        propertyInfo: PropertyInfo,
        projectStore: ProjectStore
    ) => React.ReactNode[];

    colorEditorForLiteral?: boolean;

    lvglActionPropertyType?: LvglActionPropertyType;
}

export type InheritedValue =
    | {
          value: any;
          source: IEezObject | undefined;
      }
    | undefined;

export interface SerializedData {
    originProjectFilePath: string;

    objectClassName: string;
    classInfo?: ClassInfo;

    object?: EezObject;
    objectParentPath?: string;

    objects?: EezObject[];
    objectsParentPath?: string[];
}

interface LVGLClassInfoProperties {
    parts: LVGLParts[] | ((object: IEezObject) => LVGLParts[]);
    defaultFlags: string;

    oldInitFlags?: string;
    oldDefaultFlags?: string;
}

export type WidgetEvents = {
    [eventName: string]: {
        code: number;
        paramExpressionType: ValueType;
        oldName?: string;
    };
};

export interface ClassInfo {
    properties: PropertyInfo[];

    _arrayAndObjectProperties?: PropertyInfo[];

    // optional properties
    getClass?: (
        projectStore: ProjectStore,
        jsObject: any,
        aClass: EezClass
    ) => any;
    label?: (object: IEezObject) => string;
    listLabel?: (object: IEezObject, collapsed: boolean) => React.ReactNode;
    propertiesPanelLabel?: (object: IEezObject) => React.ReactNode;

    parentClassInfo?: ClassInfo;

    componentPaletteGroupName?: string;
    componentPaletteLabel?: string;
    enabledInComponentPalette?: (
        projectType: ProjectType,
        projectStore?: ProjectStore
    ) => boolean;

    hideInProperties?: boolean;
    isPropertyMenuSupported?: boolean;

    newItem?: (parent: IEezObject) => Promise<EezObject | undefined>;

    getInheritedValue?: (
        object: IEezObject,
        propertyName: string
    ) => InheritedValue;
    defaultValue?: any;
    componentDefaultValue?: (projectStore: ProjectStore) => any;
    findPastePlaceInside?: (
        object: IEezObject,
        classInfo: ClassInfo,
        isSingleObject: boolean
    ) => IEezObject | PropertyInfo | undefined;

    icon?: React.ReactNode;
    getIcon?: (
        object?: IEezObject,
        componentClass?: IObjectClassInfo,
        projectStore?: ProjectStore
    ) => React.ReactNode | undefined;

    componentHeaderColor?:
        | ((
              object?: IEezObject,
              componentClass?: IObjectClassInfo,
              projectStore?: ProjectStore
          ) => string)
        | string;
    componentHeaderTextColor?: string;

    beforeLoadHook?: (
        object: IEezObject,
        jsObject: any,
        project: Project
    ) => void;

    afterLoadHook?: (object: IEezObject, project: Project) => void;

    updateObjectValueHook?: (object: IEezObject, values: any) => void;

    extendContextMenu?: (
        object: IEezObject,
        context: IContextMenuContext,
        objects: IEezObject[],
        menuItems: Electron.MenuItem[],
        editable: boolean
    ) => void;

    check?: (object: IEezObject, messages: IMessage[]) => void;

    getRect?: (object: IEezObject) => Rect;
    setRect?: (object: IEezObject, rect: Partial<Rect>) => void;
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
        options?: { dropPlace?: IEezObject | PropertyInfo }
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

    onAfterPaste?: (newObject: IEezObject, fromObject: IEezObject) => void;

    lvgl?:
        | LVGLClassInfoProperties
        | ((object: IEezObject, project: Project) => LVGLClassInfoProperties);

    showTreeCollapseIcon?: "always" | "has-children" | "never";

    getAdditionalFlowProperties?: (object: IEezObject) => PropertyInfo[];

    execute?: (context: IDashboardComponentContext) => void;

    findChildIndex?: (parent: IEezObject[], child: IEezObject) => number;

    widgetEvents?: WidgetEvents | ((object: IEezObject) => WidgetEvents);

    addObjectHook?: (object: IEezObject, parent: IEezObject) => void;

    overrideEventParamExpressionType?: (
        object: IEezObject,
        eventName: string
    ) => ValueType | undefined;

    getPropertyDisplayName?: (
        object: IEezObject,
        propertyKey: string
    ) => string | undefined;
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

    if (derivedClassInfoProperties.defaultValue && baseClassInfo.defaultValue) {
        derivedClassInfoProperties.defaultValue = Object.assign(
            {},
            baseClassInfo.defaultValue,
            derivedClassInfoProperties.defaultValue
        );
    }

    const baseBeforeLoadHook = baseClassInfo.beforeLoadHook;
    const derivedBeforeLoadHook = derivedClassInfoProperties.beforeLoadHook;
    if (baseBeforeLoadHook && derivedBeforeLoadHook) {
        derivedClassInfoProperties.beforeLoadHook = (
            object: IEezObject,
            jsObject: any,
            project: Project
        ) => {
            baseBeforeLoadHook(object, jsObject, project);
            derivedBeforeLoadHook(object, jsObject, project);
        };
    }

    const baseCheck = baseClassInfo.check;
    const derivedCheck = derivedClassInfoProperties.check;
    if (baseCheck && derivedCheck) {
        derivedClassInfoProperties.check = (
            object: IEezObject,
            messages: IMessage[]
        ) => {
            baseCheck(object, messages);
            derivedCheck(object, messages);
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

    const baseAdditionalFlowProperties =
        baseClassInfo.getAdditionalFlowProperties;
    const derivedAdditionalFlowProperties =
        derivedClassInfoProperties.getAdditionalFlowProperties;
    if (baseAdditionalFlowProperties && derivedAdditionalFlowProperties) {
        derivedClassInfoProperties.getAdditionalFlowProperties = (
            object: IEezObject
        ) => {
            return [
                ...baseAdditionalFlowProperties(object),
                ...derivedAdditionalFlowProperties(object)
            ];
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

    objID: string;

    makeEditable() {
        makeObservable(this, {
            objID: observable
        });
    }
}

export type EezClass = typeof EezObject;

let classNameToEezClassMap = new Map<string, EezClass>();
export let eezClassToClassNameMap = new Map<EezClass, string>();

export function registerClass(name: string, eezClass: EezClass) {
    classNameToEezClassMap.set(name, eezClass);
    eezClassToClassNameMap.set(eezClass, name);
}

export function getClassByName(projectStore: ProjectStore, className: string) {
    const result = classNameToEezClassMap.get(className);
    if (result) {
        return result;
    }

    return projectStore.getClassByName(className);
}

export function getAllClasses() {
    return [...classNameToEezClassMap.values()];
}

////////////////////////////////////////////////////////////////////////////////

export function isEezObject(object: any): object is IEezObject {
    return (
        object instanceof EezObject ||
        (isArray(object) && (object.length == 0 || isEezObject(object[0])))
    );
}

////////////////////////////////////////////////////////////////////////////////

export function findClass(className: string) {
    return classNameToEezClassMap.get(className);
}

export interface IObjectClassInfo {
    id: string;
    name: string;
    objectClass: EezClass;
    displayName?: string;
    componentPaletteGroupName?: string;
    props?: any;
}

export function getClassesDerivedFrom(
    projectStore: ProjectStore | undefined,
    parentClass: EezClass
) {
    const derivedClasses: IObjectClassInfo[] = [];

    for (const className of classNameToEezClassMap.keys()) {
        const objectClass = classNameToEezClassMap.get(className)!;
        if (isProperSubclassOf(objectClass.classInfo, parentClass.classInfo)) {
            derivedClasses.push({
                id: className,
                name: className,
                objectClass
            });
        }
    }

    if (projectStore) {
        for (const [
            className,
            objectClass
        ] of projectStore.importedActionComponentClasses) {
            if (
                isProperSubclassOf(objectClass.classInfo, parentClass.classInfo)
            ) {
                derivedClasses.push({
                    id: className,
                    name: className,
                    objectClass
                });
            }
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
    projectStore: ProjectStore,
    object: IEezObject,
    id: string
) {
    (object as any)._eez_id = id;
    projectStore.objects.set(id, object);
}

export function getParentNotObservable(
    object: IEezObject
): IEezObject | undefined {
    return (object as any)._eez_parent;
}

export function getParent(object: IEezObject): IEezObject {
    const parent = (object as any)._eez_parent;

    // make _eez_parent observable
    if (parent) {
        if (isArray(parent)) {
            parent.indexOf(object);
        } else {
            parent[(object as any)._eez_key];
        }
    }

    return parent;
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
): PropertyInfo | undefined {
    let i = propertyName.indexOf("[");
    if (i != -1) {
        // arr[index].{name}

        const propertyInfo = findPropertyByNameInClassInfo(
            classInfo,
            propertyName.substring(0, i)
        );
        if (!propertyInfo) {
            return undefined;
        }

        if (propertyInfo.type != PropertyType.Array) {
            return undefined;
        }

        let j = propertyName.indexOf("]", i + 1);
        return findPropertyByNameInClassInfo(
            propertyInfo.typeClass!.classInfo,
            propertyName.substring(j + 2)
        );
    }

    i = propertyName.indexOf(".");
    if (i != -1) {
        // object.{name}

        const propertyInfo = findPropertyByNameInClassInfo(
            classInfo,
            propertyName.substring(0, i)
        );
        if (!propertyInfo || !propertyInfo.typeClass) {
            return undefined;
        }

        return findPropertyByNameInClassInfo(
            propertyInfo.typeClass.classInfo,
            propertyName.substring(i + 1)
        );
    }

    return classInfo.properties.find(
        propertyInfo => propertyInfo.name == propertyName
    );
}

export function isPropertyDisabled(
    object: IEezObject,
    propertyInfo: PropertyInfo
) {
    if (propertyInfo.disabled && propertyInfo.disabled(object, propertyInfo)) {
        return true;
    }

    return false;
}

export function isPropertyHidden(
    object: IEezObject,
    propertyInfo: PropertyInfo
) {
    if (propertyInfo.disabled && propertyInfo.disabled(object, propertyInfo)) {
        return true;
    }

    if (propertyInfo.hideInPropertyGrid != undefined) {
        if (typeof propertyInfo.hideInPropertyGrid == "boolean") {
            return propertyInfo.hideInPropertyGrid;
        }
        return propertyInfo.hideInPropertyGrid(object, propertyInfo);
    }

    return false;
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

export function isPropertyOptional(
    object: IEezObject,
    propertyInfo: PropertyInfo
) {
    if (!propertyInfo.isOptional) {
        return false;
    }

    if (typeof propertyInfo.isOptional == "boolean") {
        return propertyInfo.isOptional;
    }

    return propertyInfo.isOptional(object, propertyInfo);
}

export function getProperty(object: IEezObject, name: string): any {
    // This is deep get. Name can be:
    //    - identifier
    //    - array[index].{name}
    //    - object.{name}

    let i1 = name.indexOf("[");
    let i2 = name.indexOf(".");

    if (i1 != -1 && i1 < i2) {
        const i = i1;
        // arr[index].{name}
        let j = name.indexOf("]", i + 1);
        return getProperty(
            (object as any)[name.substring(0, i)][
                Number.parseInt(name.substring(i + 1))
            ],
            name.substring(j + 2)
        );
    }

    if (i2 != -1) {
        const i = i2;
        // object.{name}
        return getProperty(
            (object as any)[name.substring(0, i)],
            name.substring(i + 1)
        );
    }

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
    for (
        let parent = getParentNotObservable(object);
        parent;
        parent = getParentNotObservable(object)
    ) {
        object = parent;
    }
    return object;
}

// Get object ancestors as array,
// from the root object up to the given object (including given object)
export function getAncestors(object: IEezObject): IEezObject[] {
    let result = [object];
    for (let parent = getParent(object); parent; parent = getParent(parent)) {
        result.unshift(parent);
    }
    return result;
}

export function areAllChildrenOfTheSameParent(objects: IEezObject[]) {
    for (let i = 1; i < objects.length; i++) {
        if (getParent(objects[i]) !== getParent(objects[0])) {
            return false;
        }
    }
    return true;
}

export function getClassInfoLvglProperties(object: IEezObject) {
    const classInfo = getClassInfo(object);
    if (classInfo.lvgl) {
        if (typeof classInfo.lvgl == "object") {
            return classInfo.lvgl;
        }
        return classInfo.lvgl(object, getRootObject(object) as Project);
    } else {
        return {
            parts: [],
            defaultFlags: "",
            oldInitFlags: "",
            oldDefaultFlags: ""
        };
    }
}

export function getClassInfoLvglParts(object: IEezObject) {
    const lvglClassInfoProperties = getClassInfoLvglProperties(object);

    if (typeof lvglClassInfoProperties.parts == "function") {
        return lvglClassInfoProperties.parts(object);
    }

    return lvglClassInfoProperties.parts;
}

export function getDefaultValue(
    projectStore: ProjectStore | undefined,
    classInfo: ClassInfo
) {
    function removeClickable(flags: string) {
        const flagsArr = flags.split("|");
        const i = flagsArr.indexOf("CLICKABLE");
        if (i != -1) {
            flagsArr.splice(i, 1);
        }
        return flagsArr.join("|");
    }

    let defaultValue = classInfo.defaultValue;
    if (defaultValue) {
        if (classInfo.lvgl) {
            if (typeof classInfo.lvgl == "function") {
                if (projectStore) {
                    defaultValue = objectClone(defaultValue);
                    defaultValue.widgetFlags = removeClickable(
                        classInfo.lvgl(
                            projectStore.project,
                            projectStore.project
                        ).defaultFlags
                    );
                }
            } else {
                defaultValue = objectClone(defaultValue);
                defaultValue.widgetFlags = removeClickable(
                    classInfo.lvgl.defaultFlags
                );
            }
        }
    }
    return defaultValue;
}

export function isFlowPropertyBuildable(
    object: IEezObject,
    propertyInfo: PropertyInfo
) {
    if (propertyInfo.isFlowPropertyBuildable) {
        return propertyInfo.isFlowPropertyBuildable(object, propertyInfo);
    }

    return true;
}

////////////////////////////////////////////////////////////////////////////////

export class RectObject extends EezObject {
    static classInfo: ClassInfo = {
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

    top: number;
    right: number;
    bottom: number;
    left: number;

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            top: observable,
            right: observable,
            bottom: observable,
            left: observable
        });
    }
}

registerClass("RectObject", RectObject);
