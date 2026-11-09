import {
    EezObject,
    IEezObject,
    IMessage,
    MessageType,
    getParent,
    getProperty,
    getRootObject
} from "project-editor/core/object";
import type { Project } from "./project";
import {
    Message,
    ProjectStore,
    findPropertyByNameInObject,
    getAncestorOfType,
    getChildOfObject,
    propertyNotFoundMessage,
    propertyNotSetMessage,
    propertyNotUniqueMessage
} from "project-editor/store";
import type { AssetType } from "project-editor/project/assets";
import { ProjectEditor } from "project-editor/project-editor-interface";
import type { Flow } from "project-editor/flow/flow";
import type { Page } from "project-editor/features/page/page";

export function findAllReferencedObjects(
    project: Project,
    referencedObjectCollectionPath: string,
    referencedObjectName: string
) {
    return project._assets.maps["name"].allAssets.get(
        referencedObjectCollectionPath + "/" + referencedObjectName
    );
}

export function checkObjectReference(
    object: IEezObject,
    propertyName: string,
    messages: IMessage[],
    mandatory?: boolean
) {
    const value = getProperty(object, propertyName);
    if (value) {
        const propertyInfo = findPropertyByNameInObject(object, propertyName);
        if (!propertyInfo) {
            throw `unknow object property: ${propertyName}`;
        }
        if (!propertyInfo.referencedObjectCollectionPath) {
            throw `no referencedObjectCollectionPath for property: ${propertyName}`;
        }

        const objects = findAllReferencedObjects(
            getProject(object),
            propertyInfo.referencedObjectCollectionPath,
            value
        );

        if (!objects || objects.length == 0) {
            messages.push(propertyNotFoundMessage(object, propertyName));
        } else if (objects.length > 1) {
            messages.push(
                new Message(
                    MessageType.ERROR,
                    `Ambiguous, found in multiple projects: ${objects
                        .map(object => getProject(object).projectName)
                        .join(", ")}`,
                    getChildOfObject(object, propertyName)
                )
            );
        }
    } else {
        if (mandatory) {
            messages.push(propertyNotSetMessage(object, propertyName));
        }
    }
}

export function getProject(object: IEezObject) {
    return getRootObject(object) as Project;
}

export function getFlow(object: IEezObject) {
    return getAncestorOfType(object, ProjectEditor.FlowClass.classInfo) as Flow;
}

export function getPage(object: IEezObject) {
    return getAncestorOfType(object, ProjectEditor.PageClass.classInfo) as Page;
}

export function isObjectReadOnly(object: IEezObject) {
    return getProject(object)._isReadOnly;
}

export function isAnyObjectReadOnly(objects: IEezObject[]) {
    return !!objects.find(isObjectReadOnly);
}

// A module project can use these items of its master project when they have
// an "id": global variables, actions, pages, user widgets, styles, fonts,
// bitmaps and colors.
function isExportableAsset(object: IEezObject) {
    if (object instanceof ProjectEditor.VariableClass) {
        const variables = getProject(object)?.variables;
        return !!variables && getParent(object) === variables.globalVariables;
    }
    return (
        object instanceof ProjectEditor.ActionClass ||
        object instanceof ProjectEditor.PageClass ||
        object instanceof ProjectEditor.StyleClass ||
        object instanceof ProjectEditor.FontClass ||
        object instanceof ProjectEditor.BitmapClass ||
        object instanceof ProjectEditor.ColorClass
    );
}

// The id of an item exported to the module projects, undefined if the item is
// not exported. Only a firmware project without a master project exports.
export function getExportedId(object: IEezObject): number | undefined {
    const id = (object as any).id;
    if (typeof id != "number" || !isExportableAsset(object)) {
        return undefined;
    }
    const project = getProject(object);
    if (
        !(project instanceof ProjectEditor.ProjectClass) ||
        !project.projectTypeTraits.isFirmware ||
        project.settings.general.masterProject
    ) {
        return undefined;
    }
    return id;
}

// True for an object of the master project of the opened (module) project.
export function isMasterProjectObject(object: IEezObject) {
    const project = getProject(object);
    if (!(project instanceof ProjectEditor.ProjectClass)) {
        return false;
    }
    const masterProject = project._store?.project?.masterProject;
    return !!masterProject && project === masterProject;
}

// The exported items of a master project collection, the child styles of a
// style are listed after it.
export function getExportedItems(collection: IEezObject[] | undefined) {
    const items: IEezObject[] = [];

    function add(object: IEezObject) {
        if (getExportedId(object) != undefined) {
            items.push(object);
        }
        if (object instanceof ProjectEditor.StyleClass) {
            object.childStyles.forEach(add);
        }
    }

    collection?.forEach(add);

    return items;
}

export function checkAssetId(
    projectStore: ProjectStore,
    assetType: AssetType,
    asset: EezObject & {
        id: number | undefined;
    },
    messages: IMessage[],
    min: number = 1,
    max: number = 1000
) {
    if (asset.id != undefined) {
        if (!(asset.id >= min && asset.id <= max)) {
            messages.push(
                new Message(
                    MessageType.ERROR,
                    `"Id": invalid value, should be between ${min} and ${max}.`,
                    getChildOfObject(asset, "id")
                )
            );
        } else {
            if (
                projectStore.project._assets.maps["id"].allAssets.get(
                    `${assetType}/${asset.id}`
                )!.length > 1
            ) {
                messages.push(propertyNotUniqueMessage(asset, "id"));
            }
        }
    }
}
