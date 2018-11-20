import {
    ClassInfo,
    findClass,
    EezObject,
    loadObject,
    objectToJson,
    isArray,
    isObject,
    isSubclassOf,
    getChildOfObject,
    PropertyType
} from "project-editor/core/object";

export const EEZ_STUDIO_DATA_TYPE = "text/eez-studio-project-editor-data";

export interface SerializedData {
    objectClassName: string;
    classInfo?: ClassInfo;
    object?: EezObject;
    objects?: EezObject[];
}

export function objectToClipboardData(object: EezObject): string {
    return JSON.stringify({
        objectClassName: object._class.name,
        object: objectToJson(object)
    });
}

export function objectsToClipboardData(objects: EezObject[]): string {
    return JSON.stringify({
        objectClassName: objects[0]._class.name,
        objects: objects.map(object => objectToJson(object))
    });
}

export function clipboardDataToObject(data: string) {
    let serializedData: SerializedData = JSON.parse(data);

    const aClass = findClass(serializedData.objectClassName);
    if (aClass) {
        if (serializedData.object) {
            serializedData.object = loadObject(undefined, serializedData.object, aClass);
        } else if (serializedData.objects) {
            serializedData.objects = serializedData.objects.map(object =>
                loadObject(undefined, object, aClass)
            );
        }
    }

    return serializedData;
}

let clipboardData: string;

export function setClipboardData(event: any, value: string) {
    clipboardData = value;
    event.dataTransfer.setData(EEZ_STUDIO_DATA_TYPE, clipboardData);
}

export function getEezStudioDataFromDragEvent(event: any) {
    let data = event.dataTransfer.getData(EEZ_STUDIO_DATA_TYPE);
    if (!data) {
        data = clipboardData;
    }
    if (data) {
        return clipboardDataToObject(data);
    }
    return undefined;
}

export function findPastePlaceInside(
    object: EezObject,
    classInfo: ClassInfo,
    isSingleObject: boolean
) {
    if (isArray(object) && isSubclassOf(classInfo, object._classInfo)) {
        return object;
    }

    if (isObject(object)) {
        const findPastePlaceInside = object._classInfo.findPastePlaceInside;
        if (findPastePlaceInside) {
            return findPastePlaceInside(object, classInfo, isSingleObject);
        }
    }

    // first, find among array properties
    for (const propertyInfo of object._classInfo.properties) {
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
    for (const propertyInfo of object._classInfo.properties) {
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

export function findPastePlaceInsideAndOutside(object: EezObject, serializedData: SerializedData) {
    if (!serializedData.classInfo) {
        return undefined;
    }

    let place = findPastePlaceInside(object, serializedData.classInfo, !!serializedData.object);
    if (place) {
        return place;
    }

    let parent = object._parent;
    return (
        parent && findPastePlaceInside(parent, serializedData.classInfo, !!serializedData.object)
    );
}

export function checkClipboard(object: EezObject) {
    let text = EEZStudio.electron.remote.clipboard.readText();
    if (text) {
        let serializedData = clipboardDataToObject(atob(text));
        if (serializedData) {
            let pastePlace = findPastePlaceInsideAndOutside(object, serializedData);
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
