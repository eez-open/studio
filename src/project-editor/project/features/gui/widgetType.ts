import { observable, computed } from "mobx";

import { EezObject, registerMetaData } from "project-editor/core/metaData";

import { ListNavigationWithContent } from "project-editor/project/ListNavigation";

import { widgetMetaData, WidgetProperties } from "project-editor/project/features/gui/widget";
import { WidgetContainerDisplayItem } from "project-editor/project/features/gui/page";
import { WidgetTypeEditor } from "project-editor/project/features/gui/WidgetTypeEditor";

////////////////////////////////////////////////////////////////////////////////

export class WidgetTypeProperties extends EezObject {
    @observable name: string;
    @observable description?: string;
    @observable width: number;
    @observable height: number;
    @observable style: string;
    @observable widgets: WidgetProperties[];
}

export class WidgetTypeTabState {
    widgetContainerDisplayItem: WidgetContainerDisplayItem;

    constructor(object: EezObject) {
        this.widgetContainerDisplayItem = new WidgetContainerDisplayItem(object);
    }

    saveState() {
        return this.widgetContainerDisplayItem.saveState();
    }

    loadState(state: any) {
        this.widgetContainerDisplayItem.loadState(state);
    }

    selectObject(object: EezObject) {
        let item = this.widgetContainerDisplayItem.getObjectAdapter(object);
        if (item) {
            this.widgetContainerDisplayItem.selectItems([item]);
        }
    }

    @computed
    get selectedObject(): EezObject | undefined {
        return this.widgetContainerDisplayItem.selectedObject;
    }
}

export const widgetTypeMetaData = registerMetaData({
    getClass: function(jsObject: any) {
        return WidgetTypeProperties;
    },
    className: "WidgetType",
    label: (object: EezObject) => (object as WidgetTypeProperties).name,
    properties: () => [
        {
            name: "name",
            type: "string",
            unique: true
        },
        {
            name: "description",
            type: "multiline-text"
        },
        {
            name: "width",
            type: "number"
        },
        {
            name: "height",
            type: "number"
        },
        {
            name: "style",
            type: "object-reference",
            referencedObjectCollectionPath: ["gui", "styles"]
        },
        {
            name: "widgets",
            type: "array",
            typeMetaData: widgetMetaData,
            hideInPropertyGrid: true
        }
    ],
    newItem: (parent: EezObject) => {
        return Promise.resolve({
            name: "Widget",
            width: 120,
            height: 60,
            widgets: []
        });
    },
    editorComponent: WidgetTypeEditor,
    createEditorState: (object: EezObject) => new WidgetTypeTabState(object),
    navigationComponent: ListNavigationWithContent,
    navigationComponentId: "widgets",
    icon: "widgets"
});
