import { clipboard } from "@electron/remote";

import {
    IEezObject,
    PropertyType,
    getParent,
    EezObject,
    isSubclassOf,
    ClassInfo,
    findClass,
    SerializedData
} from "project-editor/core/object";

import {
    getChildOfObject,
    getClass,
    getClassInfo,
    isArray,
    isObject
} from "project-editor/store/helper";

import { loadObject, objectToJson } from "project-editor/store/serialization";
import type { DocumentStoreClass } from "project-editor/store";

////////////////////////////////////////////////////////////////////////////////

const CLIPOARD_DATA_ID = "application/eez-studio-project-editor-data";

export function objectToClipboardData(object: IEezObject): string {
    return JSON.stringify({
        objectClassName: getClass(object).name,
        object: objectToJson(object)
    });
}

export function objectsToClipboardData(objects: IEezObject[]): string {
    return JSON.stringify({
        objectClassName: getClass(objects[0]).name,
        objects: objects.map(object => objectToJson(object))
    });
}

export function clipboardDataToObject(
    DocumentStore: DocumentStoreClass,
    data: string
) {
    let serializedData: SerializedData = JSON.parse(data);

    const aClass = findClass(serializedData.objectClassName);
    if (aClass) {
        serializedData.classInfo = aClass.classInfo;
        if (serializedData.object) {
            serializedData.object = loadObject(
                DocumentStore,
                undefined,
                serializedData.object,
                aClass
            );
        } else if (serializedData.objects) {
            serializedData.objects = serializedData.objects.map(object =>
                loadObject(DocumentStore, undefined, object, aClass)
            );
        }
    }

    return serializedData;
}

let clipboardData: string;

export function setClipboardData(event: any, value: string) {
    clipboardData = value;
    event.dataTransfer.setData(CLIPOARD_DATA_ID, clipboardData);
}

export function getEezStudioDataFromDragEvent(
    DocumentStore: DocumentStoreClass,
    event: any
) {
    let data = event.dataTransfer.getData(CLIPOARD_DATA_ID);
    if (!data) {
        data = clipboardData;
    }
    if (data) {
        return clipboardDataToObject(DocumentStore, data);
    }
    return undefined;
}

export function findPastePlaceInside(
    object: IEezObject,
    classInfo: ClassInfo,
    isSingleObject: boolean
) {
    if (isArray(object) && isSubclassOf(classInfo, getClassInfo(object))) {
        return object;
    }

    if (isObject(object)) {
        const findPastePlaceInside = getClassInfo(object).findPastePlaceInside;
        if (findPastePlaceInside) {
            return findPastePlaceInside(object, classInfo, isSingleObject);
        }
    }

    // first, find among array properties
    for (const propertyInfo of getClassInfo(object).properties) {
        if (
            propertyInfo.type === PropertyType.Array &&
            isSubclassOf(classInfo, propertyInfo.typeClass!.classInfo)
        ) {
            let collectionObject = getChildOfObject(object, propertyInfo);
            if (collectionObject) {
                return collectionObject;
            }
        }
    }

    // then, find among object properties
    for (const propertyInfo of getClassInfo(object).properties) {
        if (
            propertyInfo.type == PropertyType.Object &&
            isSubclassOf(classInfo, propertyInfo.typeClass!.classInfo) &&
            isSingleObject
        ) {
            let childObject = getChildOfObject(object, propertyInfo);
            if (!childObject) {
                return propertyInfo;
            }
        }
    }

    return undefined;
}

export function findPastePlaceInsideAndOutside(
    object: IEezObject,
    serializedData: SerializedData
): EezObject | undefined {
    if (!serializedData.classInfo) {
        return undefined;
    }

    let place = findPastePlaceInside(
        object,
        serializedData.classInfo,
        !!serializedData.object
    );
    if (place) {
        return place;
    }

    let parent = getParent(object);
    return parent && findPastePlaceInsideAndOutside(parent, serializedData);
}

export function checkClipboard(
    DocumentStore: DocumentStoreClass,
    object: IEezObject
) {
    let text = pasteFromClipboard();
    if (text) {
        let serializedData = clipboardDataToObject(DocumentStore, text);
        if (serializedData) {
            let pastePlace = findPastePlaceInsideAndOutside(
                object,
                serializedData
            );
            if (pastePlace) {
                return {
                    serializedData: serializedData,
                    pastePlace: pastePlace
                };
            }
        }
    }
    return undefined;
}

export function copyToClipboard(text: string) {
    clipboard.write({
        text
    });
}

export function pasteFromClipboard(): string | undefined {
    return clipboard.readText();
}
