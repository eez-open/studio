import { runInAction, extendObservable, toJS } from "mobx";

import { EezObject, EezClass, getChildren } from "project-editor/model/object";
import { DocumentStore, UndoManager } from "project-editor/model/store";

import { getPageContext } from "project-editor/project/features/gui/page-editor/page-context";

////////////////////////////////////////////////////////////////////////////////

export function getProperty(object: any, propertyName: string, resolution?: number): any {
    if (resolution == undefined) {
        resolution = getPageContext().resolution;
    }
    let dependableProperty = object[propertyName + "_"];
    if (!dependableProperty) {
        return undefined;
    }
    for (let i = resolution; i >= 0; i--) {
        if (i < dependableProperty.length) {
            let value = dependableProperty[i];
            if (value != undefined) {
                return value;
            }
        }
    }
    return undefined;
}

export function setProperty(object: any, propertyName: string, value: any) {
    runInAction(() => {
        let resolution;
        let propertyValue;

        if (Array.isArray(value)) {
            resolution = value[0];
            propertyValue = value[1];
        } else {
            resolution = 0;
            propertyValue = value;
        }

        let dependableProperty = object[propertyName + "_"];
        if (dependableProperty === undefined) {
            dependableProperty = object[propertyName + "_"] = [];
        }
        while (resolution >= dependableProperty.length) {
            dependableProperty.push(undefined);
        }

        dependableProperty[resolution] = propertyValue;
    });
}

////////////////////////////////////////////////////////////////////////////////

export function withResolutionDependableProperties(aClass: EezClass) {
    if ((aClass.classInfo as any).__withResolutionDependablePropertiesCalled) {
        return aClass;
    }
    (aClass.classInfo as any).__withResolutionDependablePropertiesCalled = true;

    const propertyNames = aClass.classInfo.properties
        .filter(propertyInfo => propertyInfo.resolutionDependable)
        .map(propertyInfo => propertyInfo.name);

    if (propertyNames.length === 0) {
        return aClass;
    }

    const oldBeforeLoadHook = aClass.classInfo.beforeLoadHook;

    aClass.classInfo.beforeLoadHook = (object: EezObject, jsObject: any) => {
        if (oldBeforeLoadHook) {
            oldBeforeLoadHook(object, jsObject);
        }

        const dependableProperties: {
            [name: string]: any;
        } = {};

        if (getPageContext().allResolutions.length > 0) {
            propertyNames.forEach(propertyName => {
                let dependableProperty;

                if (jsObject[propertyName] !== undefined) {
                    // migration
                    dependableProperty = [jsObject[propertyName]];
                    delete jsObject[propertyName];
                } else if (jsObject[propertyName + "_"] !== undefined) {
                    dependableProperty = jsObject[propertyName + "_"];
                    delete jsObject[propertyName + "_"];
                } else {
                    dependableProperty = [];
                }

                dependableProperties[propertyName + "_"] = dependableProperty;
            });
        } else {
            propertyNames.forEach(propertyName => {
                if (jsObject[propertyName + "_"] !== undefined) {
                    if (jsObject[propertyName + "_"].length > 0) {
                        jsObject[propertyName] = jsObject[propertyName + "_"][0];
                    }
                    delete jsObject[propertyName + "_"];
                }

                dependableProperties[propertyName] = jsObject[propertyName];
            });
        }

        extendObservable(object, dependableProperties);
    };

    if (getPageContext().allResolutions.length > 0) {
        const oldUpdateObjectValueHook = aClass.classInfo.updateObjectValueHook;

        aClass.classInfo.updateObjectValueHook = (
            object: EezObject,
            propertyName: string,
            value: any
        ) => {
            if (oldUpdateObjectValueHook) {
                const result = oldUpdateObjectValueHook(object, propertyName, value);
                if (result) {
                    return result;
                }
            }

            if (propertyNames.indexOf(propertyName) === -1) {
                return undefined;
            }

            return {
                oldValue: [getPageContext().resolution, (object as any)[propertyName]],
                newValue: [getPageContext().resolution, value]
            };
        };

        propertyNames.forEach(propertyName => {
            Object.defineProperty(aClass.prototype, propertyName, {
                get() {
                    return getProperty(this, propertyName);
                },
                set(value) {
                    setProperty(this, propertyName, value);
                }
            });
        });
    }

    return aClass;
}

////////////////////////////////////////////////////////////////////////////////

export function getPropertyValueForAllResolutions(object: any, propertyName: string) {
    return toJS((object as any)[propertyName + "_"]);
}

export function unsetResolutionDependablePropertyForCurrentResolution(
    object: EezObject,
    propertyName: string
) {
    const allValues: (any | null)[] = getPropertyValueForAllResolutions(object, propertyName);

    allValues[getPageContext().resolution] = null;
    while (allValues.length > 1 && allValues[allValues.length - 1] === null) {
        allValues.pop();
    }

    DocumentStore.updateObject(object, {
        [propertyName + "_"]: allValues
    });
}

export function unsetResolutionDependablePropertyForLowerResolutions(
    object: EezObject,
    propertyName: string
) {
    const allValues: (any | null)[] = getPropertyValueForAllResolutions(object, propertyName);

    allValues.splice(getPageContext().resolution + 1);

    while (allValues.length > 1 && allValues[allValues.length - 1] === null) {
        allValues.pop();
    }

    DocumentStore.updateObject(object, {
        [propertyName + "_"]: allValues
    });
}

export function unsetAllResolutionDependablePropertiesForLowerResolutions(root: EezObject) {
    UndoManager.setCombineCommands(true);

    function resetInObject(object: EezObject) {
        const changes: {
            [key: string]: any;
        } = {};

        object._classInfo.properties.forEach(propertyInfo => {
            if (propertyInfo.resolutionDependable) {
                const value = getPropertyValueForAllResolutions(object, propertyInfo.name);
                for (let i = getPageContext().resolution + 1; i < value.length; i++) {
                    value[i] = null;
                }
                changes[propertyInfo.name + "_"] = value;
            }
        });

        DocumentStore.updateObject(object, changes);

        getChildren(object).forEach(resetInObject);
    }

    resetInObject(root);

    UndoManager.setCombineCommands(false);
}
