import {
    IEezObject,
    PropertyInfo,
    getParent,
    getKey,
    isPropertyHidden,
    isProperAncestor,
    getProperty
} from "project-editor/core/object";

import {
    Section,
    getDocumentStore,
    getInheritedValue,
    getPropertyAsString
} from "project-editor/store";

////////////////////////////////////////////////////////////////////////////////

export function getPropertyValue(
    objects: IEezObject[],
    propertyInfo: PropertyInfo
) {
    if (objects.length === 0) {
        return undefined;
    }

    function getObjectPropertyValue(object: IEezObject) {
        let value = (object as any)[propertyInfo.name];

        if (value === undefined && propertyInfo.inheritable) {
            let inheritedValue = getInheritedValue(object, propertyInfo.name);
            if (inheritedValue) {
                value = inheritedValue.value;
            }
        }

        if (value === undefined) {
            value = propertyInfo.defaultValue;
        }

        return value;
    }

    const result = {
        value: getObjectPropertyValue(objects[0])
    };

    for (let i = 1; i < objects.length; i++) {
        const value = getObjectPropertyValue(objects[i]);
        if (value !== result.value) {
            return undefined;
        }
    }

    return result;
}
export function getPropertyValueAsString(
    objects: IEezObject[],
    propertyInfo: PropertyInfo
) {
    if (objects.length === 0) {
        return undefined;
    }

    function getObjectPropertyValue(object: IEezObject) {
        let value = getPropertyAsString(object, propertyInfo);

        if (value === undefined && propertyInfo.inheritable) {
            let inheritedValue = getInheritedValue(object, propertyInfo.name);
            if (inheritedValue) {
                value = inheritedValue.value;
            }
        }

        if (value === undefined) {
            value = propertyInfo.defaultValue;
        }

        return value;
    }

    const result = {
        value: getObjectPropertyValue(objects[0])
    };

    for (let i = 1; i < objects.length; i++) {
        const value = getObjectPropertyValue(objects[i]);
        if (value !== result.value) {
            return undefined;
        }
    }

    return result;
}

export function isPropertyInError(
    object: IEezObject,
    propertyInfo: PropertyInfo
) {
    return (
        getDocumentStore(object)
            .outputSectionsStore.getSection(Section.CHECKS)
            .messages.find(
                message =>
                    message.object &&
                    getParent(message.object) === object &&
                    getKey(message.object) === propertyInfo.name
            ) != undefined
    );
}

export function isArrayElementPropertyVisible(
    propertyInfo: PropertyInfo,
    object?: IEezObject
) {
    if (object) {
        return !isPropertyHidden(object, propertyInfo);
    }

    if (
        propertyInfo.hideInPropertyGrid === undefined ||
        typeof propertyInfo.hideInPropertyGrid !== "boolean" ||
        !propertyInfo.hideInPropertyGrid
    ) {
        return true;
    }

    return false;
}

export function isHighlightedProperty(
    object: IEezObject,
    propertyInfo: PropertyInfo
) {
    const projectEditorStore = getDocumentStore(object);
    const selectedObject =
        projectEditorStore.navigationStore.selectedPanel &&
        projectEditorStore.navigationStore.selectedPanel.selectedObject;
    return !!(
        selectedObject &&
        ((getParent(selectedObject) === object &&
            getKey(selectedObject) === propertyInfo.name) ||
            isProperAncestor(
                getParent(selectedObject),
                getProperty(object, propertyInfo.name)
            ))
    );
}
