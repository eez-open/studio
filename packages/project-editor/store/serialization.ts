import { guid } from "eez-studio-shared/guid";
import { observable, toJS } from "mobx";

import {
    IEezObject,
    PropertyInfo,
    PropertyType,
    EezClass,
    EezObject,
    setId,
    setKey,
    setParent,
    setPropertyInfo
} from "project-editor/core/object";
import { ProjectEditor } from "project-editor/project-editor-interface";
import type { Project } from "project-editor/project/project";

import { getClassInfo, ProjectEditorStore } from "project-editor/store";

////////////////////////////////////////////////////////////////////////////////

export function createObject<T extends EezObject>(
    projectEditorStore: ProjectEditorStore,
    jsObject: Partial<T>,
    aClass: EezClass,
    key?: string,
    createNewObjectobjIDs?: boolean
): T {
    currentDocumentStore = projectEditorStore;
    createNewObjectobjIDs = createNewObjectobjIDs ?? true;
    const result = loadObjectInternal(undefined, jsObject, aClass, key);
    currentDocumentStore = undefined;
    return result as T;
}

export function loadProject(
    projectEditorStore: ProjectEditorStore,
    projectObjectOrString: any | string
): Project {
    currentDocumentStore = projectEditorStore;
    createNewObjectobjIDs = false;
    const result = loadObjectInternal(
        undefined,
        projectObjectOrString,
        ProjectEditor.ProjectClass
    ) as Project;
    currentDocumentStore = undefined;
    return result;
}

export function objectToJson(
    object: IEezObject,
    space?: number,
    toJsHook?: (jsObject: any, object: IEezObject) => void
) {
    const saved = {
        _eez_parent: (object as any)._eez_parent,
        _eez_propertyInfo: (object as any)._eez_propertyInfo,
        _eez_id: (object as any)._eez_id,
        _eez_key: (object as any)._eez_key
    };
    delete (object as any)._eez_parent;
    delete (object as any)._eez_propertyInfo;
    delete (object as any)._eez_id;
    delete (object as any)._eez_key;

    let jsObject = toJS(object);

    Object.assign(object, saved);

    if (toJsHook) {
        toJsHook(jsObject, object);
    }

    return JSON.stringify(
        jsObject,
        (key: string | number, value: any) => {
            if (typeof key === "string" && key[0] === "_") {
                return undefined;
            }
            return value;
        },
        space
    );
}

////////////////////////////////////////////////////////////////////////////////

let currentDocumentStore: ProjectEditorStore | undefined;
let createNewObjectobjIDs: boolean;

function loadArrayObject(
    arrayObject: any,
    parent: any,
    propertyInfo: PropertyInfo
) {
    const eezArray: IEezObject = observable([]);

    setId(currentDocumentStore!, eezArray, currentDocumentStore!.getChildId());
    setParent(eezArray, parent);
    setKey(eezArray, propertyInfo.name);
    setPropertyInfo(eezArray, propertyInfo);

    arrayObject.forEach((object: any) =>
        eezArray.push(
            loadObjectInternal(
                eezArray,
                object,
                propertyInfo.typeClass!
            ) as EezObject
        )
    );

    return eezArray;
}

function loadObjectInternal(
    parent: IEezObject | undefined,
    jsObjectOrString: any | string,
    aClass: EezClass,
    key?: string
): IEezObject {
    let jsObject: any =
        typeof jsObjectOrString == "string"
            ? JSON.parse(jsObjectOrString)
            : jsObjectOrString;

    if (Array.isArray(jsObject)) {
        return loadArrayObject(jsObject, parent, {
            type: PropertyType.Array,
            name: key!,
            typeClass: aClass
        });
    }

    let object: EezObject;

    try {
        object = aClass.classInfo.getClass
            ? new (aClass.classInfo.getClass(jsObject, aClass))()
            : new aClass();
    } catch (err) {
        // TODO we need much better error recovery here
        console.error(err);
        return new EezObject();
    }

    const classInfo = getClassInfo(object);

    setId(currentDocumentStore!, object, currentDocumentStore!.getChildId());
    setParent(object, parent as IEezObject);

    if (jsObject.wireID) {
        jsObject.objID = jsObject.wireID;
        delete jsObject.wireID;
    }
    if (createNewObjectobjIDs || jsObject.objID == undefined) {
        jsObject.objID = guid();
    }
    object.objID = jsObject.objID;

    if (classInfo.beforeLoadHook) {
        classInfo.beforeLoadHook(object, jsObject);
    }

    for (const propertyInfo of classInfo.properties) {
        if (propertyInfo.computed === true) {
            continue;
        }

        let value = jsObject[propertyInfo.name];

        if (propertyInfo.type === PropertyType.Object) {
            let childObject: IEezObject | undefined;

            if (value) {
                childObject = loadObjectInternal(
                    object,
                    value,
                    propertyInfo.typeClass!
                );
            } else if (!propertyInfo.isOptional) {
                let typeClass = propertyInfo.typeClass!;
                childObject = loadObjectInternal(
                    object,
                    typeClass.classInfo.defaultValue,
                    typeClass
                );
            }

            if (childObject) {
                setKey(childObject, propertyInfo.name);
                (object as any)[propertyInfo.name] = childObject;
            }
        } else if (propertyInfo.type === PropertyType.Array) {
            if (!value && !propertyInfo.isOptional) {
                value = [];
            }

            if (value) {
                (object as any)[propertyInfo.name] = loadArrayObject(
                    value,
                    object,
                    propertyInfo
                );
            }
        } else {
            if (value !== undefined) {
                (object as any)[propertyInfo.name] = value;
            }
        }
    }

    return object;
}
