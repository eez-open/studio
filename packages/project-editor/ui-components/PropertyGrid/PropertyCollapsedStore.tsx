import { observable, action, makeObservable } from "mobx";

import { IEezObject, PropertyInfo } from "project-editor/core/object";

////////////////////////////////////////////////////////////////////////////////

class PropertyCollapsedStore {
    map: {
        [key: string]: boolean;
    } = {};

    constructor() {
        makeObservable(this, {
            map: observable,
            toggleColapsed: action
        });

        const savedState = localStorage.getItem("PropertyCollapsedStore");
        if (savedState) {
            this.map = JSON.parse(savedState);
        }
    }

    getKey(propertyInfo: PropertyInfo) {
        return propertyInfo.name;
    }

    isCollapsed(object: IEezObject, propertyInfo: PropertyInfo) {
        const enabled =
            !propertyInfo.propertyGridCollapsableEnabled ||
            propertyInfo.propertyGridCollapsableEnabled(object);

        if (!enabled) {
            return true;
        }

        const collapsed = this.map[this.getKey(propertyInfo)];
        if (collapsed !== undefined) {
            return collapsed;
        }
        return !(propertyInfo.name === "style");
    }

    toggleColapsed(object: IEezObject, propertyInfo: PropertyInfo) {
        this.map[this.getKey(propertyInfo)] = !this.isCollapsed(
            object,
            propertyInfo
        );
        localStorage.setItem(
            "PropertyCollapsedStore",
            JSON.stringify(this.map)
        );
    }
}

export const propertyCollapsedStore = new PropertyCollapsedStore();
