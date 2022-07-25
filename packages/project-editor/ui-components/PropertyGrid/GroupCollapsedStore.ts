import { observable, action, makeObservable } from "mobx";

import { IPropertyGridGroupDefinition } from "project-editor/core/object";

class GroupCollapsedStore {
    map: {
        [key: string]: boolean;
    } = {};

    constructor() {
        makeObservable(this, {
            map: observable,
            toggleColapsed: action
        });

        const savedState = localStorage.getItem("GroupCollapsedStore");
        if (savedState) {
            this.map = JSON.parse(savedState);
        }
    }

    isCollapsed(group: IPropertyGridGroupDefinition) {
        const collapsed = this.map[group.id];
        if (collapsed !== undefined) {
            return collapsed;
        }
        return false;
    }

    toggleColapsed(group: IPropertyGridGroupDefinition) {
        this.map[group.id] = !this.isCollapsed(group);
        localStorage.setItem("GroupCollapsedStore", JSON.stringify(this.map));
    }
}
export const groupCollapsedStore = new GroupCollapsedStore();
