import { clipboard } from "@electron/remote";
import {
    action,
    computed,
    makeObservable,
    observable,
    reaction,
    runInAction,
    toJS
} from "mobx";

import {
    IEezObject,
    PropertyType,
    getParent,
    EezObject,
    isSubclassOf,
    ClassInfo,
    findClass,
    SerializedData,
    PropertyInfo
} from "project-editor/core/object";

import {
    createObject,
    getChildOfObject,
    getClass,
    getClassInfo,
    isEezObjectArray,
    isObject,
    objectToJson,
    ProjectStore,
    rewireBegin,
    rewireEnd,
    canContain,
    getObjectPathAsString
} from "project-editor/store";

////////////////////////////////////////////////////////////////////////////////

const CLIPOARD_DATA_ID = "application/eez-studio-project-editor-data";

////////////////////////////////////////////////////////////////////////////////

export function cloneObjectWithNewObjIds(
    projectStore: ProjectStore,
    object: IEezObject
) {
    return createObject(
        projectStore,
        toJS(object) as any,
        getClass(object),
        undefined,
        true
    );
}

export function cloneObjectWithoutNewObjIds(
    projectStore: ProjectStore,
    object: IEezObject
) {
    return createObject(
        projectStore,
        toJS(object) as any,
        getClass(object),
        undefined,
        false
    );
}

////////////////////////////////////////////////////////////////////////////////

export function objectToClipboardData(
    projectStore: ProjectStore,
    object: IEezObject
): string {
    rewireBegin();
    const clonedObject = cloneObjectWithoutNewObjIds(projectStore, object);
    rewireEnd(clonedObject);

    let objectParentPath;
    const parentObject = getParent(object);
    if (parentObject) {
        objectParentPath = getObjectPathAsString(parentObject);
    }

    const serializeData: SerializedData = {
        originProjectFilePath: projectStore.filePath!,
        objectClassName: getClass(object).name,
        object: objectToJson(clonedObject) as any as EezObject,
        objectParentPath
    };

    return JSON.stringify(serializeData);
}

export function objectsToClipboardData(
    projectStore: ProjectStore,
    objects: EezObject[]
): string {
    rewireBegin();
    const clonedObjects = objects.map(object =>
        cloneObjectWithoutNewObjIds(projectStore, object)
    );
    rewireEnd(clonedObjects);

    const serializeData: SerializedData = {
        originProjectFilePath: projectStore.filePath!,
        objectClassName: getClass(objects[0]).name,
        objects: clonedObjects.map(
            clonedObject => objectToJson(clonedObject) as any as EezObject
        ),
        objectsParentPath: objects.map(object =>
            getObjectPathAsString(getParent(object))
        )
    };

    return JSON.stringify(serializeData);
}

////////////////////////////////////////////////////////////////////////////////

export function clipboardDataToObject(
    projectStore: ProjectStore,
    data: string
) {
    let serializedData: SerializedData = JSON.parse(data);

    const aClass = findClass(serializedData.objectClassName);
    if (aClass) {
        serializedData.classInfo = aClass.classInfo;
        if (serializedData.object) {
            rewireBegin();
            serializedData.object = createObject(
                projectStore,
                serializedData.object,
                aClass,
                undefined,
                true
            ) as EezObject;
            rewireEnd(serializedData.object);
        } else if (serializedData.objects) {
            rewireBegin();
            serializedData.objects = serializedData.objects.map(
                object =>
                    createObject(
                        projectStore,
                        object,
                        aClass,
                        undefined,
                        true
                    ) as EezObject
            );
            rewireEnd(serializedData.objects);
        }
    }

    return serializedData;
}

////////////////////////////////////////////////////////////////////////////////

let clipboardData: string;

export function setClipboardData(event: any, value: string) {
    clipboardData = value;
    event.dataTransfer.setData(CLIPOARD_DATA_ID, clipboardData);
}

export function getEezStudioDataFromDragEvent(
    projectStore: ProjectStore,
    event: any
) {
    let data = event.dataTransfer.getData(CLIPOARD_DATA_ID);
    if (!data) {
        data = clipboardData;
    }
    if (data) {
        return clipboardDataToObject(projectStore, data);
    }
    return undefined;
}

////////////////////////////////////////////////////////////////////////////////

class PasteModel {
    changed: number = 0;

    sourceProjectStore: ProjectStore | undefined;

    constructor() {
        makeObservable(this, {
            changed: observable,
            sourceProjectStore: observable,
            onPasteContentChanged: action,
            serializedData: computed
        });

        reaction(
            () => this.changed,
            async () => {
                let textBuffer = clipboard.readBuffer(CLIPOARD_DATA_ID);
                if (textBuffer && textBuffer.length > 0) {
                    const text = textBuffer.toString("utf-8");
                    const serializedData: SerializedData = JSON.parse(text);

                    const projectStore = ProjectStore.create({
                        type: "read-only"
                    });

                    await projectStore.openFile(
                        serializedData.originProjectFilePath
                    );

                    runInAction(() => {
                        this.sourceProjectStore = projectStore;
                    });
                } else {
                    runInAction(() => {
                        this.sourceProjectStore = undefined;
                    });
                }
            }
        );
    }

    onPasteContentChanged() {
        this.changed++;
    }

    get serializedData() {
        if (!this.sourceProjectStore) {
            return undefined;
        }

        let textBuffer = clipboard.readBuffer(CLIPOARD_DATA_ID);
        if (textBuffer && textBuffer.length > 0) {
            const text = textBuffer.toString("utf-8");
            let serializedData = clipboardDataToObject(
                this.sourceProjectStore,
                text
            );
            if (serializedData) {
                return serializedData;
            }
        }
        return undefined;
    }
}

export const pasteModel = new PasteModel();

export function copyProjectEditorDataToClipboard(text: string) {
    clipboard.writeBuffer(CLIPOARD_DATA_ID, Buffer.from(text, "utf-8"));
    pasteModel.onPasteContentChanged();
}

document.addEventListener("copy", function (e) {
    pasteModel.onPasteContentChanged();
});

export function getProjectEditorDataFromClipboard(
    projectStore: ProjectStore
): SerializedData | undefined {
    // make it observable
    pasteModel.changed;

    let textBuffer = clipboard.readBuffer(CLIPOARD_DATA_ID);
    if (textBuffer && textBuffer.length > 0) {
        const text = textBuffer.toString("utf-8");
        let serializedData = clipboardDataToObject(projectStore, text);
        if (serializedData) {
            return serializedData;
        }
    }
    return undefined;
}

////////////////////////////////////////////////////////////////////////////////

export function findPastePlaceInside(
    object: IEezObject,
    classInfo: ClassInfo,
    isSingleObject: boolean
) {
    if (
        isEezObjectArray(object) &&
        isSubclassOf(classInfo, getClassInfo(object))
    ) {
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
): IEezObject | PropertyInfo | undefined {
    if (!serializedData.classInfo) {
        return undefined;
    }

    if (serializedData.object) {
        if (!canContain(object, serializedData.object)) {
            return undefined;
        }
    } else {
        for (const childObject of serializedData.objects!) {
            if (!canContain(object, childObject)) {
                return undefined;
            }
        }
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

export function checkClipboard(projectStore: ProjectStore, object: IEezObject) {
    let serializedData = getProjectEditorDataFromClipboard(projectStore);
    if (serializedData) {
        let pastePlace = findPastePlaceInsideAndOutside(object, serializedData);
        if (pastePlace) {
            return {
                serializedData: serializedData,
                pastePlace: pastePlace
            };
        }
    }
    return undefined;
}
