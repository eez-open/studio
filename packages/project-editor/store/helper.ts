import { humanize } from "eez-studio-shared/string";
import * as notification from "eez-studio-ui/notification";

import {
    IEezObject,
    PropertyInfo,
    PropertyType,
    getProperty,
    isPropertyEnumerable,
    getParent,
    getKey,
    isSubclassOf,
    ClassInfo,
    PropertyProps,
    isPropertyHidden,
    getPropertyInfo,
    getAncestors,
    getObjectPropertyDisplayName,
    setKey,
    setParent,
    registerClass,
    EezObject,
    getRootObject,
    getClassByName,
    setId,
    isPropertyOptional,
    getAllClasses,
    findPropertyByNameInClassInfo
} from "project-editor/core/object";

import { getProject, Project } from "project-editor/project/project";
import type { ProjectStore } from "project-editor/store";

import {
    checkClipboard,
    copyProjectEditorDataToClipboard,
    objectToClipboardData
} from "project-editor/store/clipboard";

import { ProjectEditor } from "project-editor/project-editor-interface";
import { createObject, objectToJson } from "project-editor/store/serialization";
import { confirm } from "project-editor/core/util";
import type { Flow } from "project-editor/flow/flow";

import { isArray } from "eez-studio-shared/util";

import { getClass, getClassInfo } from "project-editor/core/object";
export { getClass, getClassInfo } from "project-editor/core/object";

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

    public foundPositions: { start: number; end: number }[] | undefined;

    static create(object: IEezObject, propertyInfo: PropertyInfo, value: any) {
        const valueObject = new EezValueObject();

        const projectStore = getProjectStore(object);

        setId(projectStore, valueObject, projectStore.getChildId());
        setKey(valueObject, propertyInfo.name);
        setParent(valueObject, object);

        valueObject.propertyInfo = propertyInfo;
        valueObject.value = value;

        return valueObject;
    }
}
registerClass("EezValueObject", EezValueObject);

////////////////////////////////////////////////////////////////////////////////

export function isValue(object: IEezObject | PropertyInfo | undefined) {
    return !!object && object instanceof EezValueObject;
}

export function getProjectStore(object: IEezObject) {
    return (getRootObject(object) as Project)?._store;
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

export function getObjectPropertyAsObject(
    object: IEezObject,
    propertyInfo: PropertyInfo
) {
    return getChildOfObject(object, propertyInfo) as EezValueObject;
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
): IEezObject {
    if (stringPath.startsWith("[")) {
        const i = stringPath.indexOf("]:");
        const absoluteFilePath = stringPath.substring(1, i);
        const projectStore = getProjectStore(rootObject);
        const project =
            projectStore.openProjectsManager.getProjectFromFilePath(
                absoluteFilePath
            );
        stringPath = stringPath.substring(i + 2);
        return getObjectFromStringPath(project!, stringPath);
    }
    if (stringPath == "/") {
        return rootObject;
    }
    return getObjectFromPath(rootObject, stringPath.split("/").slice(1));
}

export function objectToString(object: IEezObject) {
    let label: string;

    if (isValue(object)) {
        const parent = getParent(object);
        const propertyKey = getKey(object);
        const propertyInfo = findPropertyByNameInClassInfo(
            getClassInfo(parent),
            propertyKey
        );

        let propertyName;

        if (propertyInfo) {
            propertyName = getObjectPropertyDisplayName(parent, propertyInfo);
        } else {
            const classInfo = getClassInfo(parent);
            if (classInfo.getPropertyDisplayName) {
                propertyName = classInfo.getPropertyDisplayName(
                    parent,
                    propertyKey
                );
            }
        }

        if (!propertyName) {
            propertyName = humanize(propertyKey);
        }

        label = `${propertyName}: ${getProperty(parent, propertyKey)}`;
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

export function getHumanReadableObjectPath(object: IEezObject) {
    let ancestors = getAncestors(object);
    return ancestors
        .slice(1)
        .map(object => objectToString(object))
        .join(" / ");
}

export function isObject(object: IEezObject | undefined) {
    return !!object && !isValue(object) && !isArray(object);
}

export function isEezObjectArray(
    object: IEezObject | PropertyInfo | undefined
): object is EezObject[] {
    return isArray(object);
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

export function getObjectIcon(object: IEezObject) {
    const classInfo = getClassInfo(object);

    if (classInfo.getIcon) {
        const icon = classInfo.getIcon(object);
        if (icon) {
            return icon;
        }
    }

    if (classInfo.icon) {
        return classInfo.icon;
    }

    return undefined;
}

export function isObjectInstanceOf(
    object: IEezObject,
    baseClassInfo: ClassInfo
) {
    return isSubclassOf(getClassInfo(object), baseClassInfo);
}

export function getLabel(object: IEezObject): string {
    if (typeof object === "string") {
        return object;
    }

    if (isArray(object)) {
        return getObjectPropertyDisplayName(
            getParent(object),
            getPropertyInfo(object)
        );
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

export function getListLabel(object: IEezObject, collapsed: boolean) {
    const listLabel = getClassInfo(object).listLabel;
    if (listLabel) {
        return listLabel(object, collapsed);
    }

    return getLabel(object);
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

export function humanizePropertyName(object: IEezObject, propertyName: string) {
    const property = findPropertyByNameInObject(object, propertyName);
    if (property && property.displayName) {
        if (typeof property.displayName == "string") {
            return property.displayName;
        }
        return property.displayName(object);
    }
    return humanize(propertyName);
}

export function getAncestorOfType<T extends EezObject = EezObject>(
    object: IEezObject,
    classInfo: ClassInfo
): T | undefined {
    while (object) {
        if (isObjectInstanceOf(object, classInfo)) {
            return object as T;
        }
        object = getParent(object);
    }
    return undefined;
}

export function getObjectPath(child: IEezObject) {
    let result = [];

    for (let parent = getParent(child); parent; parent = getParent(parent)) {
        if (isArray(parent)) {
            let index = parent.indexOf(child as EezObject);
            if (index === -1) {
                const classInfo = getClassInfo(child);
                if (classInfo.findChildIndex) {
                    index = classInfo.findChildIndex(parent, child);
                }
            }

            result.unshift(index);
        } else {
            result.unshift(getKey(child));
        }

        child = parent;
    }

    return result;
}

export function getObjectPathAsString(object: IEezObject) {
    const path = getObjectPath(object).join("/");
    const project = getProject(object);
    const projectStore = project._store;
    const absoluteFilePath =
        projectStore.openProjectsManager.getProjectFilePath(project);
    if (absoluteFilePath != undefined) {
        return `[${absoluteFilePath}]:/${path}`;
    }
    return `/${path}`;
}

export function isObjectExists(object: IEezObject) {
    let parent = getParent(object);
    if (parent) {
        if (isArray(parent)) {
            if (parent.indexOf(object as EezObject) === -1) {
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

export function getCommonProperties(
    objects: IEezObject[],
    includeHidden: boolean = false
) {
    objects = objects.filter(object => object != undefined);
    if (objects.length == 0) {
        return [];
    }

    let properties = getClassInfo(objects[0]).properties;

    properties = properties.filter(
        propertyInfo =>
            !objects.find(
                object =>
                    isArray(object) ||
                    (!includeHidden && isPropertyHidden(object, propertyInfo))
            )
    );

    if (objects.length > 1) {
        // some property types are not supported in multi-objects property grid
        properties = properties.filter(
            propertyInfo =>
                propertyInfo.type !== PropertyType.Array &&
                !(
                    propertyInfo.type === PropertyType.String &&
                    (propertyInfo.unique || propertyInfo.uniqueIdentifier)
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

interface PropertyValueSourceInfo {
    source: "" | "default" | "modified" | "inherited";
    inheritedFrom?: IEezObject;
}

export function getPropertySourceInfo(
    props: PropertyProps
): PropertyValueSourceInfo {
    function getSourceInfo(
        object: IEezObject,
        propertyInfo: PropertyInfo
    ): PropertyValueSourceInfo {
        let value = (object as any)[propertyInfo.name];

        if (
            props.propertyInfo.propertyMenu &&
            !propertyInfo.inheritable &&
            !propertyInfo.nonInheritable
        ) {
            return {
                source: ""
            };
        }

        if (propertyInfo.inheritable) {
            if (value === undefined) {
                let inheritedValue = getInheritedValue(
                    object,
                    propertyInfo.name
                );
                if (inheritedValue) {
                    if (inheritedValue.source) {
                        return {
                            source: "inherited",
                            inheritedFrom: inheritedValue.source
                        };
                    } else {
                        return {
                            source: "default"
                        };
                    }
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

export function getNumModifications(props: PropertyProps) {
    const properties = getCommonProperties(props.objects);
    let numModifications = 0;
    for (let propertyInfo of properties) {
        if (propertyInfo.computed) {
            continue;
        }
        const sourceInfo = getPropertySourceInfo({
            ...props,
            propertyInfo
        });
        if (sourceInfo.source === "modified") {
            numModifications++;
        }
    }
    return numModifications;
}

export function isAnyPropertyModified(props: PropertyProps) {
    return getNumModifications(props) > 0;
}

export function extendContextMenu(
    context: IContextMenuContext,
    object: IEezObject,
    objects: IEezObject[],
    menuItems: Electron.MenuItem[],
    editable: boolean
) {
    const extendContextMenu = getClassInfo(object).extendContextMenu;
    if (extendContextMenu) {
        extendContextMenu(object, context, objects, menuItems, editable);
    }
}

export function canDuplicate(object: IEezObject) {
    return isArrayElement(object);
}

function isOptional(object: IEezObject) {
    let parent = getParent(object);
    if (!parent) {
        return false;
    }

    let property: PropertyInfo | undefined = findPropertyByNameInObject(
        parent,
        getKey(object)
    );

    if (property == undefined) {
        return false;
    }

    return isPropertyOptional(object, property);
}

export function canDelete(object: IEezObject) {
    return isArrayElement(object) || isOptional(object);
}

export function canCut(object: IEezObject) {
    return canCopy(object) && canDelete(object);
}

export function canCopy(object: IEezObject) {
    return isArrayElement(object) || isOptional(object);
}

export function canContainChildren(object: IEezObject) {
    for (const propertyInfo of getClassInfo(object).properties) {
        if (
            isPropertyEnumerable(object, propertyInfo) &&
            (propertyInfo.type === PropertyType.Array ||
                propertyInfo.type === PropertyType.Object)
        ) {
            return true;
        }
    }

    return false;
}

export function canPaste(projectStore: ProjectStore, object: IEezObject) {
    try {
        return checkClipboard(projectStore, object);
    } catch (e) {
        return undefined;
    }
}

////////////////////////////////////////////////////////////////////////////////

export function canAdd(object: IEezObject) {
    return (
        (isArrayElement(object) || isArray(object)) &&
        getClassInfo(object).newItem != undefined
    );
}

export function getAddItemName(object: IEezObject) {
    const parent = isArray(object) ? object : getParent(object);
    if (!parent) {
        return null;
    }

    const project = getProject(parent);
    if (parent == project.userWidgets) {
        return "User Widget";
    }
    if (parent == project.actions) {
        return "User Action";
    }
    if (getParent(parent) == project.lvglStyles) {
        return "Style";
    }

    if (getParent(parent) == project.lvglGroups) {
        return "Group";
    }

    return humanize(getClass(parent).name);
}

export async function addItem(object: IEezObject) {
    const parent = isArray(object) ? object : getParent(object);
    if (!parent) {
        return null;
    }

    const parentClassInfo = getClassInfo(parent);
    if (!parentClassInfo.newItem) {
        return null;
    }

    let newObject;
    try {
        newObject = await parentClassInfo.newItem(parent);
    } catch (err) {
        if (err !== undefined) {
            notification.error(
                `Adding ${getClass(parent).name} failed: ${err}!`
            );
        }
        return null;
    }

    if (!newObject) {
        console.log(`Canceled adding ${getClass(parent).name}`);
        return null;
    }

    newObject = getProjectStore(object).addObject(parent, newObject);

    if (newObject) {
        ProjectEditor.navigateTo(newObject);
    }

    return newObject;
}

export function pasteItem(object: IEezObject) {
    try {
        const projectStore = getProjectStore(object);

        const c = checkClipboard(projectStore, object);
        if (c) {
            const pastePlace = c.pastePlace;
            if (isArray(pastePlace) || pastePlace instanceof EezObject) {
                if (c.serializedData.object) {
                    if (
                        isArray(pastePlace) &&
                        getParent(object) === pastePlace
                    ) {
                        const pasteObject = createObject(
                            projectStore,
                            c.serializedData.object,
                            getClass(c.serializedData.object),
                            undefined,
                            false
                        );

                        return projectStore.insertObject(
                            pastePlace,
                            pastePlace.indexOf(object as EezObject) + 1,
                            pasteObject
                        );
                    } else {
                        const aClass = getClassByName(
                            projectStore,
                            c.serializedData.objectClassName
                        );

                        if (aClass && aClass.classInfo.pasteItemHook) {
                            return aClass.classInfo.pasteItemHook(
                                object,
                                c as any
                            );
                        }

                        const pasteObject = createObject(
                            projectStore,
                            c.serializedData.object,
                            getClass(c.serializedData.object),
                            undefined,
                            false
                        );

                        return projectStore.addObject(pastePlace, pasteObject);
                    }
                } else if (c.serializedData.objects) {
                    const pasteObjects = c.serializedData.objects.map(object =>
                        createObject(
                            projectStore,
                            object,
                            getClass(object),
                            undefined,
                            false
                        )
                    );

                    return projectStore.addObjects(pastePlace, pasteObjects);
                }
            } else {
                const key = pastePlace.name;

                projectStore.updateObject(object, {
                    [key]: c.serializedData.object
                });

                if (c.serializedData.object) {
                    setKey(c.serializedData.object, key);
                }
            }
        }
    } catch (e) {
        console.error(e);
    }
    return undefined;
}

export function deleteItem(object: EezObject) {
    deleteItems([object]);
}

export function cutItem(object: EezObject) {
    let clipboardText = objectToClipboardData(getProjectStore(object), object);

    deleteItems([object], () => {
        copyProjectEditorDataToClipboard(clipboardText);
    });
}

export function copyItem(object: EezObject) {
    copyProjectEditorDataToClipboard(
        objectToClipboardData(getProjectStore(object), object)
    );
}

export interface IContextMenuContext {
    selectObject(object: EezObject): void;
    selectObjects(objects: EezObject[]): void;
}

////////////////////////////////////////////////////////////////////////////////

export function deleteItems(objects: IEezObject[], callback?: () => void) {
    const projectStore = getProjectStore(objects[0]);

    function doDelete() {
        projectStore.deleteObjects(objects);
        if (callback) {
            callback();
        }
    }

    if (objects.length === 1) {
        if (ProjectEditor.documentSearch.isReferenced(objects[0])) {
            confirm(
                "Are you sure you want to delete this item?",
                "It is used in other parts.",
                doDelete
            );
        } else {
            doDelete();
        }
    } else {
        let isAnyItemReferenced = false;

        for (let i = 0; i < objects.length; i++) {
            if (ProjectEditor.documentSearch.isReferenced(objects[i])) {
                isAnyItemReferenced = true;
                break;
            }
        }

        if (isAnyItemReferenced) {
            confirm(
                "Are you sure you want to delete this items?",
                "Some of them are used in other parts.",
                doDelete
            );
        } else {
            doDelete();
        }
    }
}

export function objectToJS(object: IEezObject): any {
    return JSON.parse(objectToJson(object));
}

export function isObjectReferencable(object: IEezObject) {
    const objectClassInfo = getClassInfo(object);

    if (ProjectEditor.StyleClass.classInfo == objectClassInfo) {
        return true;
    }

    if (ProjectEditor.LVGLStyleClass.classInfo == objectClassInfo) {
        return true;
    }

    if (ProjectEditor.EnumClass.classInfo == objectClassInfo) {
        return true;
    }

    const referencedObjectCollectionPathSet = new Set<string>();

    for (const eezClass of getAllClasses()) {
        for (const propertyInfo of eezClass.classInfo.properties) {
            if (propertyInfo.referencedObjectCollectionPath) {
                referencedObjectCollectionPathSet.add(
                    propertyInfo.referencedObjectCollectionPath
                );
            }
        }
    }

    const referencedObjectClassInfoSet = new Set<ClassInfo>();

    let projectClassInfo = getClassInfo(getProject(object));

    for (const referencedObjectCollectionPath of referencedObjectCollectionPathSet) {
        let classInfo = projectClassInfo;
        for (const part of referencedObjectCollectionPath.split("/")) {
            const propertyInfo = classInfo.properties.find(
                propertyInfo => propertyInfo.name === part
            );
            if (!propertyInfo || !propertyInfo.typeClass) {
                break;
            }
            classInfo = propertyInfo.typeClass.classInfo;
        }

        referencedObjectClassInfoSet.add(classInfo);
    }

    return referencedObjectClassInfoSet.has(objectClassInfo);
}

export function isLVGLCreateInProgress(flow: Flow) {
    const projectStore = getProjectStore(flow);

    return (
        projectStore.projectTypeTraits.isLVGL &&
        flow instanceof ProjectEditor.PageClass &&
        (!flow._lvglRuntime || !flow._lvglObj)
    );
}

export function canContain(parentObject: IEezObject, childObject: IEezObject) {
    if (isArray(parentObject)) {
        parentObject = getParent(parentObject);
        if (!parentObject) {
            return true;
        }
    }

    if (parentObject instanceof ProjectEditor.LVGLStyleClass) {
        if (!(childObject instanceof ProjectEditor.LVGLStyleClass)) {
            return false;
        }

        if (parentObject.forWidgetType != childObject.forWidgetType) {
            return false;
        }
    }

    return true;
}
