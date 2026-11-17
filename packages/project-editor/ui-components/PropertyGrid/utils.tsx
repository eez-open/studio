import {
    IEezObject,
    PropertyInfo,
    getParent,
    getKey,
    isPropertyHidden,
    isProperAncestor,
    getProperty,
    PropertyProps
} from "project-editor/core/object";

import {
    Section,
    getProjectStore,
    getInheritedValue,
    getPropertyAsString
} from "project-editor/store";

import { isArray } from "eez-studio-shared/util";

////////////////////////////////////////////////////////////////////////////////

export function getObjectPropertyValue(
    object: IEezObject,
    propertyInfo: PropertyInfo
) {
    let value = (object as any)[propertyInfo.name];

    if (value === undefined && propertyInfo.inheritable) {
        let inheritedValue = getInheritedValue(object, propertyInfo.name);
        if (inheritedValue) {
            value = inheritedValue.value;
        }
    }

    return value;
}

export function getPropertyValue(
    objects: IEezObject[],
    propertyInfo: PropertyInfo
) {
    objects = objects.filter(object => object != undefined);
    if (objects.length === 0) {
        return undefined;
    }

    const result = {
        value: getObjectPropertyValue(objects[0], propertyInfo)
    };

    for (let i = 1; i < objects.length; i++) {
        const value = getObjectPropertyValue(objects[i], propertyInfo);
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
    return getProjectStore(object)
        .outputSectionsStore.getSection(Section.CHECKS)
        .messages.isPropertyInError(object, propertyInfo);
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
    const projectStore = getProjectStore(object);
    const selectedObject =
        projectStore.navigationStore.selectedPanel &&
        projectStore.navigationStore.selectedPanel.selectedObject;
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

export function getFormText(props: PropertyProps) {
    if (!props.propertyInfo.formText) {
        return undefined;
    }

    if (typeof props.propertyInfo.formText === "string") {
        return props.propertyInfo.formText;
    }

    return props.propertyInfo.formText(props.objects[0]);
}

export function getEnumItems(
    objects: IEezObject[],
    propertyInfo: PropertyInfo
) {
    if (!propertyInfo.enumItems) {
        return [];
    }

    if (isArray(propertyInfo.enumItems)) {
        return propertyInfo.enumItems;
    }

    const enumItems = propertyInfo.enumItems;

    const enumItemsArray = objects.map(object => enumItems(object));

    const result = [];

    for (let enumItems1 of enumItemsArray) {
        for (let enumItem1 of enumItems1) {
            let foundInAll = true;

            for (let enumItems2 of enumItemsArray) {
                let found = false;
                for (let enumItem2 of enumItems2) {
                    if (enumItem1.id == enumItem2.id) {
                        found = true;
                        break;
                    }
                }

                if (!found) {
                    foundInAll = false;
                    break;
                }
            }

            if (foundInAll) {
                let found = false;
                for (let enumItem2 of result) {
                    if (enumItem1.id == enumItem2.id) {
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    result.push(enumItem1);
                }
            }
        }
    }

    return result;
}
