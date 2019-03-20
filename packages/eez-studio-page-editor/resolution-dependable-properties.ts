import { runInAction, extendObservable } from "mobx";

import { EezObject, EezClass } from "eez-studio-shared/model/object";

import { PageContext } from "eez-studio-page-editor/page-context";

export function getProperty(object: any, propertyName: string, resolution?: number): any {
    if (resolution == undefined) {
        resolution = PageContext.resolution;
    }
    let dependableProperty = object[propertyName + "_"];
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
        let dependableProperty = object[propertyName + "_"];
        while (PageContext.resolution >= dependableProperty.length) {
            dependableProperty.push(undefined);
        }
        object[propertyName + "_"][PageContext.resolution] = value;
    });
}

export function initResolutionDependableProperties(aClass: EezClass, propertyNames: string[]) {
    aClass.classInfo.beforeLoadHook = (object: EezObject, jsObject: any) => {
        const dependableProperties: {
            [name: string]: any;
        } = {};

        propertyNames.forEach(propertyName => {
            let dependableProperty;

            if (jsObject[propertyName] !== undefined) {
                // migration
                dependableProperty = [
                    jsObject[propertyName],
                    jsObject[propertyName],
                    jsObject[propertyName],
                    jsObject[propertyName],
                    jsObject[propertyName]
                ];
                delete jsObject[propertyName];
            } else if (jsObject[propertyName + "_"] !== undefined) {
                dependableProperty = jsObject[propertyName + "_"];
                delete jsObject[propertyName + "_"];
            } else {
                dependableProperty = [];
            }

            dependableProperties[propertyName + "_"] = dependableProperty;
        });

        extendObservable(object, dependableProperties);
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
