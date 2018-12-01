import React from "react";
import { observable, computed, action } from "mobx";

import { _find } from "eez-studio-shared/algorithm";
import { addAlphaToColor } from "eez-studio-shared/color";

import {
    EezObject,
    ClassInfo,
    PropertyInfo,
    registerClass,
    EezArrayObject,
    PropertyType,
    isSubclassOf,
    IEditorState
} from "eez-studio-shared/model/object";

import { Widget, WidgetContainerDisplayItem } from "eez-studio-page-editor/widget";
import { PageEditorContext } from "eez-studio-page-editor/context";

////////////////////////////////////////////////////////////////////////////////

export class Page extends EezObject {
    @observable
    name: string;

    @observable
    description?: string;

    @observable
    x: number;
    @observable
    y: number;
    @observable
    width: number;
    @observable
    height: number;

    @observable
    style?: string;

    @observable
    widgets: EezArrayObject<Widget>;

    @observable
    closePageIfTouchedOutside: boolean;

    @observable
    usedIn: string[] | undefined;

    static classInfo: ClassInfo = {
        properties: [
            {
                name: "name",
                type: PropertyType.String,
                unique: true
            },
            {
                name: "description",
                type: PropertyType.MultilineText
            },
            {
                name: "x",
                type: PropertyType.Number
            },
            {
                name: "y",
                type: PropertyType.Number
            },
            {
                name: "width",
                type: PropertyType.Number
            },
            {
                name: "height",
                type: PropertyType.Number
            },
            {
                name: "style",
                type: PropertyType.ObjectReference,
                referencedObjectCollectionPath: ["gui", "styles"]
            },
            {
                name: "widgets",
                type: PropertyType.Array,
                typeClass: Widget,
                hideInPropertyGrid: true
            },
            {
                name: "closePageIfTouchedOutside",
                type: PropertyType.Boolean
            },
            {
                name: "usedIn",
                type: PropertyType.ConfigurationReference
            }
        ],
        newItem: (parent: EezObject) => {
            return Promise.resolve({
                name: "Page",
                x: 0,
                y: 0,
                width: 480,
                height: 272,
                widgets: [],
                closePageIfTouchedOutside: false
            });
        },
        createEditorState: (object: EezObject) => new PageTabState(object),
        navigationComponentId: "pages",
        findPastePlaceInside: (
            object: EezObject,
            classInfo: ClassInfo,
            isSingleObject: boolean
        ): EezObject | PropertyInfo | undefined => {
            if (object && isSubclassOf(classInfo, Widget.classInfo)) {
                return (object as Page).widgets;
            }
            return undefined;
        },
        icon: "filter_none"
    };

    @computed
    get boundingRect() {
        return {
            left: this.x,
            top: this.y,
            width: this.width,
            height: this.height
        };
    }

    render() {
        const style = PageEditorContext.findStyleOrGetDefault(this.style);
        return (
            <div
                style={{
                    position: "absolute",
                    left: this.x,
                    top: this.y,
                    width: this.width,
                    height: this.height,
                    backgroundColor: style.backgroundColor,
                    boxShadow: `5px 5px 20px 0px ${addAlphaToColor(style.backgroundColor!, 0.5)}`
                }}
            />
        );
    }
}

registerClass(Page);

////////////////////////////////////////////////////////////////////////////////

export class PageTabState implements IEditorState {
    page: Page;
    widgetContainerDisplayItem: WidgetContainerDisplayItem;

    constructor(object: EezObject) {
        this.page = object as Page;
        this.widgetContainerDisplayItem = new WidgetContainerDisplayItem(this.page);
    }

    @computed
    get selectedObject(): EezObject | undefined {
        return this.widgetContainerDisplayItem.selectedObject || this.page;
    }

    loadState(state: any) {
        this.widgetContainerDisplayItem.loadState(state);
    }

    saveState() {
        return this.widgetContainerDisplayItem.saveState();
    }

    @action
    selectObject(object: EezObject) {
        let item = this.widgetContainerDisplayItem.getObjectAdapter(object);
        if (item) {
            this.widgetContainerDisplayItem.selectItems([item]);
        }
    }
}
