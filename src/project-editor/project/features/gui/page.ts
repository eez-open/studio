import { observable, computed, action, autorun } from "mobx";

import { _find } from "shared/algorithm";

import { ProjectStore, hasAncestor, getParent, getId } from "project-editor/core/store";
import {
    EezObject,
    MetaData,
    PropertyMetaData,
    registerMetaData
} from "project-editor/core/metaData";
import {
    TreeObjectAdapter,
    DisplayItem,
    DisplayItemChildrenArray,
    getDisplayItemFromObjectId
} from "project-editor/core/objectAdapter";

import { ListNavigationWithContent } from "project-editor/project/ListNavigation";

import * as data from "project-editor/project/features/data/data";

import {
    WidgetProperties,
    widgetMetaData,
    getWidgetType,
    SelectWidgetProperties
} from "project-editor/project/features/gui/widget";
import { PageEditor } from "project-editor/project/features/gui/PageEditor";

////////////////////////////////////////////////////////////////////////////////

export class PageOrientationProperties extends EezObject {
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
    widgets: WidgetProperties[];

    @computed
    get boundingRect() {
        return {
            left: this.x,
            top: this.y,
            width: this.width,
            height: this.height
        };
    }
}

export const pageOrientationMetaData = registerMetaData({
    getClass: function(jsObject: any) {
        return PageOrientationProperties;
    },
    className: "PageOrientation",
    label: (object: EezObject) => {
        let parent = getParent(object);
        if (parent instanceof PageProperties) {
            if (parent.portrait == object) {
                return "portrait";
            } else {
                return "landscape";
            }
        }
        return "PageOrientation";
    },
    properties: () => [
        {
            name: "x",
            type: "number"
        },
        {
            name: "y",
            type: "number"
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
            x: 0,
            y: 0,
            width: 240,
            height: 320,
            widgets: []
        });
    },
    findPastePlaceInside: (
        object: EezObject,
        metaData: MetaData,
        isSingleObject: boolean
    ): EezObject | PropertyMetaData | undefined => {
        if (metaData == widgetMetaData) {
            let pageOrientation = object as PageOrientationProperties;
            if (pageOrientation) {
                return pageOrientation.widgets as any;
            }
        }
        return undefined;
    }
});

////////////////////////////////////////////////////////////////////////////////

export class PageProperties extends EezObject {
    @observable
    name: string;
    @observable
    description?: string;
    @observable
    portrait: PageOrientationProperties;
    @observable
    landscape: PageOrientationProperties;
    @observable
    closePageIfTouchedOutside: boolean;
    @observable
    usedIn: string[] | undefined;
}

export interface IWidgetContainerDisplayItem extends DisplayItem {
    getSelectedWidgetForSelectWidget(item: DisplayItem): DisplayItem | undefined;
}

export class WidgetContainerDisplayItem extends TreeObjectAdapter
    implements IWidgetContainerDisplayItem {
    // this is used to remember the last selected widget for the select widget
    selectWidgetToSelectedWidget: any = {};

    constructor(object: EezObject) {
        super(object);

        autorun(() => {
            // update selectWidgetToSelectedWidget when selection is changed
            let selectedObjects = this.selectedObjects;
            for (let i = 0; i < selectedObjects.length; i++) {
                let selectedObject = selectedObjects[i];

                // remove all what we remembered below selected object
                Object.keys(this.selectWidgetToSelectedWidget).forEach(key => {
                    if (key.startsWith(getId(selectedObject))) {
                        delete this.selectWidgetToSelectedWidget[key];
                    }
                });

                // remember from selectedObject up to the root
                while (getParent(selectedObject) && getParent(getParent(selectedObject)!)) {
                    if (getParent(getParent(selectedObject)!) instanceof SelectWidgetProperties) {
                        this.selectWidgetToSelectedWidget[
                            getId(getParent(getParent(selectedObject)!)!)
                        ] = getId(selectedObject);
                    }
                    selectedObject = getParent(selectedObject)!;
                }
            }

            // remove nonexistent objects from the selectWidgetToSelectedWidget
            Object.keys(this.selectWidgetToSelectedWidget).forEach(key => {
                if (!getDisplayItemFromObjectId(this, key)) {
                    delete this.selectWidgetToSelectedWidget[key];
                } else if (
                    !getDisplayItemFromObjectId(this, this.selectWidgetToSelectedWidget[key])
                ) {
                    delete this.selectWidgetToSelectedWidget[key];
                }
            });
        });
    }

    loadState(state: any) {
        // restore selectWidgetToSelectedWidget
        if (state.selectWidgetToSelectedWidget) {
            this.selectWidgetToSelectedWidget = state.selectWidgetToSelectedWidget;
        }

        super.loadState(state.tree || {});
    }

    saveState() {
        return {
            tree: super.saveState(),
            selectWidgetToSelectedWidget: this.selectWidgetToSelectedWidget
        };
    }

    getSelectedWidgetForSelectWidget(item: DisplayItem): DisplayItem | undefined {
        let widget = item.object as SelectWidgetProperties;
        let widgetsItemChildren = item.children as DisplayItemChildrenArray;

        let selectedWidgetItem: DisplayItem | undefined;

        // first, find selected widget by checking if any child widget is selected or has descendant that is selected
        function isSelected(item: DisplayItem): boolean {
            return (
                item.selected ||
                !!_find(item.children, (displayItemChild: any) => {
                    let child: DisplayItem = displayItemChild;
                    return isSelected(child);
                })
            );
        }
        selectedWidgetItem = widgetsItemChildren.find(childWidgetItem =>
            isSelected(childWidgetItem)
        );

        // second, use selectWidgetToSelectedWidget to find selected widget
        let selectedWidgetId = this.selectWidgetToSelectedWidget[getId(widget)];
        if (selectedWidgetId) {
            selectedWidgetItem = getDisplayItemFromObjectId(this, selectedWidgetId);
        }

        if (!selectedWidgetItem) {
            // if not found then select default for enum data
            if (widget.data && widget.widgets) {
                let index: number = data.getEnumValue(widget.data);
                if (index >= 0 && index < widget.widgets.length) {
                    selectedWidgetItem = widgetsItemChildren[index];
                }
            }
        }

        if (!selectedWidgetItem) {
            // if still nothing selected then just select the first one
            if (widgetsItemChildren.length) {
                selectedWidgetItem = widgetsItemChildren[0];
            }
        }

        return selectedWidgetItem;
    }
}

export class PageOrientationState {
    widgetContainerDisplayItem: WidgetContainerDisplayItem;

    constructor(pageOrientation: PageOrientationProperties) {
        this.widgetContainerDisplayItem = new WidgetContainerDisplayItem(pageOrientation);
    }

    saveState() {
        return this.widgetContainerDisplayItem.saveState();
    }

    loadState(state: any) {
        this.widgetContainerDisplayItem.loadState(state);
    }
}

export class PageTabState {
    pageProperties: PageProperties;

    @observable
    selectedScreenOrientation: string;

    @observable
    portraitState: PageOrientationState;
    @observable
    landscapeState: PageOrientationState;

    constructor(object: EezObject) {
        this.pageProperties = object as PageProperties;

        this.selectedScreenOrientation = ProjectStore.selectedScreenOrientation;

        this.portraitState = new PageOrientationState(this.pageProperties.portrait);
        this.landscapeState = new PageOrientationState(this.pageProperties.landscape);
    }

    @computed
    get selectedPageOrientation() {
        return this.selectedScreenOrientation == "portrait"
            ? this.pageProperties.portrait
            : this.pageProperties.landscape;
    }

    @computed
    get selectedPageOrientationState() {
        return this.selectedScreenOrientation == "portrait"
            ? this.portraitState
            : this.landscapeState;
    }

    @action
    selectPortrait() {
        this.selectedScreenOrientation = "portrait";
    }

    @action
    selectLandscape() {
        this.selectedScreenOrientation = "landscape";
    }

    @computed
    get selectedObject(): EezObject | undefined {
        let object = this.selectedPageOrientationState.widgetContainerDisplayItem.selectedObject;
        if (object) {
            return object;
        }
        if (
            this.selectedPageOrientationState.widgetContainerDisplayItem.selectedItems.length == 0
        ) {
            return this.selectedPageOrientation;
        }
        return undefined;
    }

    loadState(state: any) {
        this.selectedScreenOrientation = state.selectedScreenOrientation;
        this.portraitState.loadState(state.portraitState);
        this.landscapeState.loadState(state.landscapeState);
    }

    saveState() {
        return {
            selectedScreenOrientation: this.selectedScreenOrientation,
            portraitState: this.portraitState.saveState(),
            landscapeState: this.landscapeState.saveState()
        };
    }

    @action
    selectObject(object: EezObject) {
        if (hasAncestor(object, this.pageProperties.portrait)) {
            this.selectedScreenOrientation = "portrait";
        } else {
            this.selectedScreenOrientation = "landscape";
        }

        let item = this.selectedPageOrientationState.widgetContainerDisplayItem.getObjectAdapter(
            object
        );
        if (item) {
            this.selectedPageOrientationState.widgetContainerDisplayItem.selectItems([item]);
        }
    }
}

export const pageMetaData = registerMetaData({
    getClass: function(jsObject: any) {
        return PageProperties;
    },
    className: "Page",
    label: (page: PageProperties) => {
        return page.name;
    },
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
            name: "portrait",
            type: "object",
            typeMetaData: pageOrientationMetaData,
            hideInPropertyGrid: true
        },
        {
            name: "landscape",
            type: "object",
            typeMetaData: pageOrientationMetaData,
            hideInPropertyGrid: true
        },
        {
            name: "closePageIfTouchedOutside",
            type: "boolean"
        },
        {
            name: "usedIn",
            type: "configuration-references"
        }
    ],
    newItem: (parent: EezObject) => {
        return Promise.resolve({
            name: "Page",
            portrait: {
                x: 0,
                y: 0,
                width: 240,
                height: 320,
                widgets: []
            },
            landscape: {
                x: 0,
                y: 0,
                width: 320,
                height: 240,
                widgets: []
            },
            closePageIfTouchedOutside: false
        });
    },
    editorComponent: PageEditor,
    createEditorState: (object: EezObject) => new PageTabState(object),
    navigationComponent: ListNavigationWithContent,
    navigationComponentId: "pages",
    icon: "filter_none"
});

////////////////////////////////////////////////////////////////////////////////

export function isWidgetOpaque(widgetObj: WidgetProperties) {
    if (widgetObj.type && widgetObj.type.startsWith("Local.")) {
        return true;
    }

    let widgetType = getWidgetType(widgetObj);
    return widgetType && widgetType.isOpaque;
}
