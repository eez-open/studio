import crypto from "crypto";
import { guid } from "eez-studio-shared/guid";
import { observable, toJS } from "mobx";

import {
    IEezObject,
    ClassInfo,
    PropertyInfo,
    PropertyType,
    EezClass,
    EezObject,
    setId,
    setKey,
    setParent,
    setPropertyInfo,
    getParent,
    getKey
} from "project-editor/core/object";
import { Component } from "project-editor/flow/component";
import type { ConnectionLine, Flow } from "project-editor/flow/flow";
import { ProjectEditor } from "project-editor/project-editor-interface";
import type { Project } from "project-editor/project/project";

import {
    getClassInfo,
    isArray,
    ProjectEditorStore
} from "project-editor/store";

////////////////////////////////////////////////////////////////////////////////

export function createObject<T extends EezObject>(
    projectEditorStore: ProjectEditorStore,
    jsObject: Partial<T>,
    aClass: EezClass,
    key?: string,
    _createNewObjectobjIDs?: boolean
): T {
    currentDocumentStore = projectEditorStore;
    createNewObjectobjIDs = _createNewObjectobjIDs ?? true;
    isLoadProject = false;
    currentProject = projectEditorStore.project;
    const result = loadObjectInternal(undefined, jsObject, aClass, key);
    currentDocumentStore = undefined;
    currentProject = undefined;
    return result as T;
}

export function loadProject(
    projectEditorStore: ProjectEditorStore,
    projectObjectOrString: any | string
): Project {
    currentDocumentStore = projectEditorStore;
    isLoadProject = true;
    createNewObjectobjIDs = false;

    flowToWireIDToObjID = new Map<Flow, Map<string, string>>();

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

    currentDocumentStore = undefined;
    currentProject = undefined;

    fixConnectionLines(project);

    wireIDToObjID = undefined as any;
    flowToWireIDToObjID = undefined as any;

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

let currentDocumentStore: ProjectEditorStore | undefined;
let currentProject: Project | undefined;
let isLoadProject: boolean;
let createNewObjectobjIDs: boolean;
let wireIDToObjID: Map<string, string>;
let flowToWireIDToObjID: Map<Flow, Map<string, string>>;

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

    if (object instanceof ProjectEditor.ProjectClass) {
        currentProject = object;
    }

    if (isLoadProject) {
        if (object instanceof ProjectEditor.FlowClass) {
            wireIDToObjID = new Map<string, string>();
            flowToWireIDToObjID.set(object, wireIDToObjID);
        }
    }

    if (object instanceof ProjectEditor.ConnectionLineClass) {
        const source = wireIDToObjID.get(jsObject.source);
        if (source) {
            jsObject.source = source;
        }

        const target = wireIDToObjID.get(jsObject.target);
        if (target) {
            jsObject.target = target;
        }
    }

    const classInfo = getClassInfo(object);

    setId(currentDocumentStore!, object, currentDocumentStore!.getChildId());
    setParent(object, parent as IEezObject);
    if (key != undefined) {
        setKey(object, key);
    }

    let objID = getObjID(object, jsObject, classInfo, key);
    object.objID = objID;
    currentProject?._objectsMap.set(objID, object);

    if (classInfo.beforeLoadHook) {
        classInfo.beforeLoadHook(object, jsObject);
    }

    let rewireFlow = false;
    if (
        !isLoadProject &&
        createNewObjectobjIDs &&
        object instanceof ProjectEditor.FlowClass
    ) {
        createNewObjectobjIDs = false;
        rewireFlow = true;
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
                    propertyInfo.typeClass!,
                    propertyInfo.name
                );
            } else if (!propertyInfo.isOptional) {
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

    if (rewireFlow) {
        (object as Flow).rewire();
        createNewObjectobjIDs = true;
    }

    return object;
}

function getObjID(
    object: EezObject,
    jsObject: any,
    classInfo: ClassInfo,
    key: string | undefined
) {
    if (createNewObjectobjIDs) {
        return guid();
    }

    if (jsObject.objID != undefined) {
        return jsObject.objID;
    }

    if (jsObject.wireID != undefined) {
        return getObjIdFromWireId(object, jsObject, key);
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

                if (nameProperty && nameProperty.unique) {
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
    let objID = wireIDToObjID.get(jsObject.wireID);
    if (objID == undefined) {
        objID = generateObjId(object, jsObject, key);
        wireIDToObjID.set(jsObject.wireID, objID);
    }
    return objID;
}

function fixConnectionLines(project: Project) {
    function findObjID(component: Component, wireID: string) {
        if (component) {
            let flow;

            if (
                component instanceof
                ProjectEditor.CallActionActionComponentClass
            ) {
                flow = ProjectEditor.findAction(project, component.action);
            } else if (
                component instanceof ProjectEditor.LayoutViewWidgetClass
            ) {
                flow = ProjectEditor.findPage(project, component.layout);
            }

            if (flow) {
                const wireIDToObjID = flowToWireIDToObjID.get(flow);
                if (wireIDToObjID) {
                    return wireIDToObjID.get(wireID);
                }
            }
        }
        return undefined;
    }

    function fixConnectionLine(connectionLine: ConnectionLine) {
        const outputObjID = findObjID(
            connectionLine.sourceComponent,
            connectionLine.output
        );
        if (outputObjID) {
            connectionLine.output = outputObjID;
        }

        const inputObjID = findObjID(
            connectionLine.targetComponent,
            connectionLine.input
        );
        if (inputObjID) {
            connectionLine.input = inputObjID;
        }
    }

    function fixConnectionLinesInFlow(flow: Flow) {
        flow.connectionLines.forEach(fixConnectionLine);
    }

    project.pages.forEach(fixConnectionLinesInFlow);
    project.actions.forEach(fixConnectionLinesInFlow);
}
