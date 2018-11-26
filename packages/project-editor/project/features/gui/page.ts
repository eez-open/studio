import { observable, computed, action, autorun } from "mobx";

import { _find } from "eez-studio-shared/algorithm";

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
import {
    TreeObjectAdapter,
    DisplayItem,
    DisplayItemChildrenArray,
    getDisplayItemFromObjectId
} from "eez-studio-shared/model/objectAdapter";

import { ListNavigationWithContent } from "project-editor/project/ui/ListNavigation";

import * as data from "project-editor/project/features/data/data";

import { Widget, SelectWidget } from "project-editor/project/features/gui/widget";
import { PageEditor } from "project-editor/project/features/gui/PageEditor";

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
        editorComponent: PageEditor,
        createEditorState: (object: EezObject) => new PageTabState(object),
        navigationComponent: ListNavigationWithContent,
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
}

registerClass(Page);

////////////////////////////////////////////////////////////////////////////////

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
                    if (key.startsWith(selectedObject._id)) {
                        delete this.selectWidgetToSelectedWidget[key];
                    }
                });

                // remember from selectedObject up to the root
                while (selectedObject._parent && selectedObject._parent!._parent) {
                    if (selectedObject._parent!._parent instanceof SelectWidget) {
                        this.selectWidgetToSelectedWidget[selectedObject._parent!._parent!._id] =
                            selectedObject._id;
                    }
                    selectedObject = selectedObject._parent!;
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
        let widget = item.object as SelectWidget;
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
        let selectedWidgetId = this.selectWidgetToSelectedWidget[widget._id];
        if (selectedWidgetId) {
            selectedWidgetItem = getDisplayItemFromObjectId(this, selectedWidgetId);
        }

        if (!selectedWidgetItem) {
            // if not found then select default for enum data
            if (widget.data && widget.widgets) {
                let index: number = data.getEnumValue(widget.data);
                if (index >= 0 && index < widget.widgets._array.length) {
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
