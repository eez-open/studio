import { observable, action } from "mobx";

import { IPropertyGridGroupDefinition } from "project-editor/core/object";

class GroupCollapsedStore {
    @observable map: {
        [key: string]: boolean;
    } = {};

    constructor() {
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

    @action
    toggleColapsed(group: IPropertyGridGroupDefinition) {
        this.map[group.id] = !this.isCollapsed(group);
        localStorage.setItem("GroupCollapsedStore", JSON.stringify(this.map));
    }
}
export const groupCollapsedStore = new GroupCollapsedStore();
