import { runInAction, extendObservable } from "mobx";

import { EezObject, EezClass } from "eez-studio-shared/model/object";

import { PageContext } from "eez-studio-page-editor/page-context";

export function getProperty(object: any, name: string): any {
    const currentResolution = PageContext.resolution;
    if (currentResolution !== undefined) {
        return object[name][currentResolution];
    }
    return object[name];
}

export function setProperty(object: any, name: string, value: any) {
    runInAction(() => {
        const currentResolution = PageContext.resolution;
        if (currentResolution !== undefined) {
            object[name][currentResolution] = value;
        } else {
            object[name] = value;
        }
    });
}

export function initResolutionDependableProperties(aClass: EezClass, propertyNames: string[]) {
    aClass.classInfo.beforeLoadHook = (object: EezObject, jsObject: any) => {
        const dependableProperties: {
            [name: string]: any;
        } = {};

        propertyNames.forEach(propertyName => {
            if (jsObject[propertyName] !== undefined) {
                // migration
                dependableProperties[propertyName + "_"] = {};
                if (PageContext.allResolutions !== undefined) {
                    PageContext.allResolutions!.forEach(resolution => {
                        dependableProperties[propertyName + "_"][resolution] =
                            jsObject[propertyName];
                    });
                } else {
                    dependableProperties[propertyName + "_"] = jsObject[propertyName];
                }
                delete jsObject[propertyName];
            } else if (jsObject[propertyName + "_"] !== undefined) {
                dependableProperties[propertyName + "_"] = jsObject[propertyName + "_"];
                delete jsObject[propertyName + "_"];
            } else {
                dependableProperties[propertyName + "_"] = {};
                if (PageContext.allResolutions !== undefined) {
                    PageContext.allResolutions!.forEach(resolution => {
                        dependableProperties[propertyName + "_"][resolution] = undefined;
                    });
                } else {
                    dependableProperties[propertyName + "_"] = undefined;
                }
            }
        });

        extendObservable(object, dependableProperties);
    };

    propertyNames.forEach(propertyName => {
        Object.defineProperty(aClass.prototype, propertyName, {
            get() {
                return getProperty(this, propertyName + "_");
            },
            set(value) {
                setProperty(this, propertyName + "_", value);
            }
        });
    });
}
