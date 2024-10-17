import crypto from "crypto";
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
    setPropertyInfo,
    getParent,
    getKey,
    isPropertyOptional
} from "project-editor/core/object";
import { visitObjects } from "project-editor/core/search";
import type { Flow } from "project-editor/flow/flow";
import { ProjectEditor } from "project-editor/project-editor-interface";
import type { Project } from "project-editor/project/project";

import {
    getAncestorOfType,
    getClassInfo,
    ProjectStore
} from "project-editor/store";

import { isArray } from "eez-studio-shared/util";

////////////////////////////////////////////////////////////////////////////////

export function createObject<T extends EezObject>(
    projectStore: ProjectStore,
    jsObject: Partial<T>,
    aClass: EezClass,
    key?: string,
    _createNewObjectobjIDs?: boolean
): T {
    currentProjectStore = projectStore;
    createNewObjectobjIDs = _createNewObjectobjIDs ?? true;
    isLoadProject = false;
    const result = loadObjectInternal(undefined, jsObject, aClass, key);
    currentProjectStore = undefined;
    currentProject = undefined;
    return result as T;
}

export function loadProject(
    projectStore: ProjectStore,
    projectObjectOrString: any | string,
    makeEditable: boolean
): Project {
    currentProjectStore = projectStore;
    isLoadProject = true;
    loadProjectMakeEditable = makeEditable;
    createNewObjectobjIDs = false;
    wireSourceChangedList = [];

    rewireBegin();

    const project = loadObjectInternal(
        undefined,
        projectObjectOrString,
        ProjectEditor.ProjectClass,
        undefined
    ) as Project;

    let projectFeatures = ProjectEditor.extensions;
    for (let projectFeature of projectFeatures) {
        if (projectFeature.afterLoadProject) {
            projectFeature.afterLoadProject(project);
        }
    }

    currentProjectStore = undefined;

    project._store = projectStore;

    rewireEnd(project);

    currentProject = undefined;

    return project;
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

let currentProjectStore: ProjectStore | undefined;
let currentProject: Project | undefined;
let isLoadProject: boolean;
let loadProjectMakeEditable: boolean;
let createNewObjectobjIDs: boolean;
let flowsWireIDToObjID: Map<Flow, Map<string, string>> = new Map<
    Flow,
    Map<string, string>
>();
let currentFlowWireIDToObjID: Map<string, string>;
let wireIDToObjID: Map<string, string> = new Map<string, string>();
let oldObjID_to_newObjID: Map<string, string> = new Map<string, string>();
let wireSourceChangedList: {
    object: IEezObject;
    oldSourceName: string;
    newSourceName: string;
}[];

function loadArrayObject(
    arrayObject: any,
    parent: any,
    propertyInfo: PropertyInfo
) {
    const eezArray: IEezObject = observable([]);

    setId(currentProjectStore!, eezArray, currentProjectStore!.getChildId());
    setParent(eezArray, parent);
    setKey(eezArray, propertyInfo.name);
    setPropertyInfo(eezArray, propertyInfo);

    arrayObject.forEach((object: any) =>
        eezArray.push(
            loadObjectInternal(
                eezArray,
                object,
                propertyInfo.typeClass!,
                undefined
            ) as EezObject
        )
    );

    return eezArray;
}

function loadObjectInternal(
    parent: IEezObject | undefined,
    jsObjectOrString: any | string,
    aClass: EezClass,
    key: string | undefined
): IEezObject {
    let jsObject: any =
        typeof jsObjectOrString == "string"
            ? JSON.parse(jsObjectOrString)
            : jsObjectOrString;

    if (isArray(jsObject)) {
        return loadArrayObject(jsObject, parent, {
            type: PropertyType.Array,
            name: key!,
            typeClass: aClass
        });
    }

    let object: EezObject;

    try {
        object = aClass.classInfo.getClass
            ? new (aClass.classInfo.getClass(
                  currentProjectStore!,
                  jsObject,
                  aClass
              ))()
            : new aClass();

        //
        if (!isLoadProject || loadProjectMakeEditable) {
            object.makeEditable();
        }
        //
    } catch (err) {
        // TODO we need much better error recovery here
        console.error(err);

        object = new EezObject();

        //
        if (isLoadProject || loadProjectMakeEditable) {
            object.makeEditable();
        }
        //
        return object;
    }

    if (isLoadProject) {
        if (object instanceof ProjectEditor.ProjectClass) {
            currentProject = object;
            currentProject._store = currentProjectStore!;
        }
    }

    setId(currentProjectStore!, object, currentProjectStore!.getChildId());
    setParent(object, parent as IEezObject);
    if (key != undefined) {
        setKey(object, key);
    }

    const currentObjID = getObjID(object, jsObject, key);
    object.objID = getNewObjID(currentObjID, object, jsObject, key);
    if (currentObjID != undefined && currentObjID != object.objID) {
        oldObjID_to_newObjID.set(currentObjID, object.objID);
    }

    const classInfo = getClassInfo(object);
    if (classInfo.beforeLoadHook) {
        classInfo.beforeLoadHook(
            object,
            jsObject,
            isLoadProject ? currentProject! : currentProjectStore!.project
        );
    }

    if (
        isLoadProject &&
        (object instanceof ProjectEditor.PageClass ||
            object instanceof ProjectEditor.ActionClass)
    ) {
        currentFlowWireIDToObjID = new Map<string, string>();
        flowsWireIDToObjID.set(object, currentFlowWireIDToObjID);
    }

    for (const propertyInfo of classInfo.properties) {
        if (propertyInfo.computed === true) {
            continue;
        }

        if (propertyInfo.computedIfNotLoadProject === true && !isLoadProject) {
            continue;
        }

        let value = jsObject[propertyInfo.name];

        if (propertyInfo.type === PropertyType.Object) {
            let childObject: IEezObject | undefined;

            if (value) {
                childObject = loadObjectInternal(
                    object,
                    value,
                    propertyInfo.typeClass!,
                    propertyInfo.name
                );
            } else if (!isPropertyOptional(object, propertyInfo)) {
                let typeClass = propertyInfo.typeClass!;
                childObject = loadObjectInternal(
                    object,
                    typeClass.classInfo.defaultValue,
                    typeClass,
                    propertyInfo.name
                );
            }

            if (childObject) {
                (object as any)[propertyInfo.name] = childObject;
            }
        } else if (propertyInfo.type === PropertyType.Array) {
            if (!value && !isPropertyOptional(object, propertyInfo)) {
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

        if (object == currentProject && propertyInfo.name == "settings") {
            currentProjectStore!.buildImportedExtensions(currentProject!);
        }
    }

    if (classInfo.afterLoadHook) {
        classInfo.afterLoadHook(
            object,
            isLoadProject ? currentProject! : currentProjectStore!.project!
        );
    }

    return object;
}

function getObjID(object: EezObject, jsObject: any, key: string | undefined) {
    if (jsObject.objID != undefined) {
        return jsObject.objID;
    }

    if (jsObject.wireID != undefined) {
        return getObjIdFromWireId(object, jsObject, key);
    }

    return undefined;
}

function getNewObjID(
    currentObjID: string | undefined,
    object: EezObject,
    jsObject: any,
    key: string | undefined
) {
    if (createNewObjectobjIDs) {
        return guid();
    }

    if (currentObjID != undefined) {
        return currentObjID;
    }

    return generateObjId(object, jsObject, key);
}

function generateObjId(
    object: EezObject,
    jsObject: any,
    key: string | undefined
) {
    function getObjectPath(
        object: IEezObject,
        jsObject: any,
        key: string | undefined
    ): (string | number)[] {
        let parent = getParent(object);
        if (parent) {
            if (isArray(parent)) {
                let id;

                const classInfo = getClassInfo(object);
                const nameProperty = classInfo.properties.find(
                    property => property.name === "name"
                );

                if (
                    nameProperty &&
                    (nameProperty.unique || nameProperty.uniqueIdentifier)
                ) {
                    id = jsObject ? jsObject.name : (object as any).name;
                }

                if (id == undefined) {
                    id = parent.length;
                }

                return getObjectPath(parent, undefined, undefined).concat(id);
            } else {
                return getObjectPath(parent, undefined, undefined).concat(
                    getKey(object) || key || ""
                );
            }
        }
        return [];
    }

    const str = "/" + getObjectPath(object, jsObject, key).join("/");

    const hash = crypto.createHash("md5").update(str).digest("hex");

    return (
        hash.slice(0, 8) +
        "-" +
        hash.slice(8, 12) +
        "-" +
        hash.slice(12, 16) +
        "-" +
        hash.slice(16, 20) +
        "-" +
        hash.slice(20, 32)
    );
}

function getObjIdFromWireId(
    object: EezObject,
    jsObject: any,
    key: string | undefined
) {
    let objID = currentFlowWireIDToObjID.get(jsObject.wireID);
    if (objID == undefined) {
        objID = generateObjId(object, jsObject, key);
        currentFlowWireIDToObjID.set(jsObject.wireID, objID);
        wireIDToObjID.set(jsObject.wireID, objID);
    }
    return objID;
}

export function rewireBegin() {
    flowsWireIDToObjID.clear();
    wireIDToObjID.clear();
    oldObjID_to_newObjID.clear();
}

export function rewireEnd(object: IEezObject) {
    for (const connectionLine of visitObjects(object)) {
        if (connectionLine instanceof ProjectEditor.ConnectionLineClass) {
            const flow = getAncestorOfType<Flow>(
                connectionLine,
                ProjectEditor.FlowClass.classInfo
            )!;

            if (connectionLine.source) {
                const newSource =
                    flowsWireIDToObjID.get(flow)?.get(connectionLine.source) ||
                    oldObjID_to_newObjID.get(connectionLine.source);
                if (newSource != undefined) {
                    connectionLine.source = newSource;
                }
            }

            if (connectionLine.output) {
                const newOutput =
                    wireIDToObjID.get(connectionLine.output) ||
                    oldObjID_to_newObjID.get(connectionLine.output);
                if (newOutput != undefined) {
                    connectionLine.output = newOutput;
                }
            }

            if (connectionLine.target) {
                const newTarget =
                    flowsWireIDToObjID.get(flow)?.get(connectionLine.target) ||
                    oldObjID_to_newObjID.get(connectionLine.target);
                if (newTarget != undefined) {
                    connectionLine.target = newTarget;
                }
            }

            if (connectionLine.input) {
                const newInput =
                    wireIDToObjID.get(connectionLine.input) ||
                    oldObjID_to_newObjID.get(connectionLine.input);
                if (newInput != undefined) {
                    connectionLine.input = newInput;
                }
            }

            for (const wireSourceChanged of wireSourceChangedList) {
                if (
                    connectionLine.source ==
                        (wireSourceChanged.object as EezObject).objID &&
                    connectionLine.output == wireSourceChanged.oldSourceName
                ) {
                    connectionLine.output = wireSourceChanged.newSourceName;
                }
            }
        }
    }

    flowsWireIDToObjID.clear();
    wireIDToObjID.clear();
    oldObjID_to_newObjID.clear();
}

export function wireSourceChanged(
    object: IEezObject,
    oldSourceName: string,
    newSourceName: string
) {
    wireSourceChangedList.push({
        object,
        oldSourceName,
        newSourceName
    });
}

export function getSerializationProject() {
    return currentProject!;
}
