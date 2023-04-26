import {
    EezObject,
    IEezObject,
    IMessage,
    MessageType,
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

export function isObjectReadOnly(object: IEezObject) {
    return getProject(object)._isReadOnly;
}

export function isAnyObjectReadOnly(objects: IEezObject[]) {
    return !!objects.find(isObjectReadOnly);
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
