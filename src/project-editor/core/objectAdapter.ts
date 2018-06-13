import { observable, action, computed, isObservableArray } from "mobx";
import { createTransformer } from "mobx-utils";

import { _each, _find, _pickBy } from "shared/algorithm";

import {
    isArray,
    asArray,
    getParent,
    getProperty,
    canCut,
    canPaste,
    canDelete,
    hasAncestor,
    extendContextMenu,
    getId,
    getMetaData,
    isSameInstanceTypeAs
} from "project-editor/core/store";
import { reduceUntilCommonParent as reduceObjectsUntilCommonParent } from "project-editor/core/store";

import { EezObject } from "project-editor/core/metaData";
import { objectsToClipboardData } from "project-editor/core/store";
import {
    cutItem,
    copyItem,
    pasteItem,
    deleteItems,
    showContextMenu as showSingleItemContextMenu
} from "project-editor/core/store";

const { Menu, MenuItem } = EEZStudio.electron.remote;

////////////////////////////////////////////////////////////////////////////////

export type DisplayItemChildrenArray = DisplayItem[];
export type DisplayItemChildrenObject = { [key: string]: DisplayItem };
export type DisplayItemChildren = DisplayItemChildrenArray | DisplayItemChildrenObject;

export interface DisplayItem {
    object: EezObject;
    selected: boolean;
    children: DisplayItemChildren;
}

export interface DisplayItemSelection extends DisplayItem {
    selectItems(items: DisplayItem[]): void;
    toggleSelected(item: DisplayItem): void;

    canCut(): boolean;
    cutSelection(): void;

    canCopy(): boolean;
    copySelection(): void;

    canPaste(): boolean;
    pasteSelection(): void;

    canDelete(): boolean;
    deleteSelection(): void;

    showSelectionContextMenu(): void;
}

////////////////////////////////////////////////////////////////////////////////

export function getDisplayItemFromObjectId(item: DisplayItem, id: string): DisplayItem | undefined {
    if (getId(item.object) == id) {
        return item;
    }

    let result = _find(item.children, (displayItemChild: any) => {
        let child: DisplayItem = displayItemChild;
        return id === getId(child.object) || id.startsWith(getId(child.object) + ".");
    });

    if (result) {
        return getDisplayItemFromObjectId(result as any, id);
    }

    return undefined;
}

export function reduceUntilCommonParent(
    rootItem: DisplayItem,
    items: DisplayItem[]
): DisplayItem[] {
    let objects = reduceObjectsUntilCommonParent(items.map(item => item.object));
    let parentItems = objects.map(object => getDisplayItemFromObjectId(rootItem, getId(object)));
    return parentItems.filter(item => item !== undefined) as DisplayItem[];
}

////////////////////////////////////////////////////////////////////////////////

export type TreeObjectAdapterChildrenArray = TreeObjectAdapter[];
export type TreeObjectAdapterChildrenObject = { [key: string]: TreeObjectAdapter };
export type TreeObjectAdapterChildren =
    | TreeObjectAdapterChildrenArray
    | TreeObjectAdapterChildrenObject;

export class TreeObjectAdapter {
    private transformer: (object: EezObject) => TreeObjectAdapter;

    @observable selected: boolean = false;
    @observable expanded: boolean = false;

    constructor(public object: EezObject, transformer?: (object: EezObject) => TreeObjectAdapter) {
        if (transformer) {
            this.transformer = transformer;
        } else {
            this.transformer = createTransformer((object: EezObject) => {
                return new TreeObjectAdapter(object, this.transformer);
            });
        }
    }

    @computed
    get children(): TreeObjectAdapterChildren {
        if (isArray(this.object)) {
            return asArray(this.object).map(child => this.transformer(child));
        }

        let properties = getMetaData(this.object)
            .properties(this.object)
            .filter(
                propertyMetaData =>
                    (propertyMetaData.type == "object" || propertyMetaData.type == "array") &&
                    !(propertyMetaData.enumerable !== undefined && !propertyMetaData.enumerable) &&
                    getProperty(this.object, propertyMetaData.name)
            );

        if (properties.length == 1 && properties[0].type == "array") {
            return asArray(getProperty(this.object, properties[0].name)).map(child =>
                this.transformer(child)
            );
        }

        return properties.reduce(
            (children, propertyMetaData) => {
                const childObject = getProperty(this.object, propertyMetaData.name);

                if (isArray(childObject)) {
                    children[propertyMetaData.name] = new TreeObjectAdapter(
                        childObject,
                        this.transformer
                    );
                } else {
                    children[propertyMetaData.name] = this.transformer(childObject);
                }

                return children;
            },
            {} as TreeObjectAdapterChildrenObject
        );
    }

    @computed
    get selectedItems(): TreeObjectAdapter[] {
        let items: TreeObjectAdapter[] = [];

        if (this.selected) {
            items.push(this);
        }

        _each(this.children, (item: any) => {
            items.push(...item.selectedItems);
        });

        return items;
    }

    @computed
    get selectedObject() {
        if (this.selectedItems.length == 1) {
            return this.selectedItems[0].object;
        }
        return undefined;
    }

    @computed
    get selectedObjects() {
        return this.selectedItems.map(item => item.object);
    }

    @computed
    get selectedItem() {
        if (this.selectedItems.length == 1) {
            return this.selectedItems[0];
        }
        return undefined;
    }

    @action
    selectItem(item: TreeObjectAdapter) {
        item.selected = true;

        for (let parent = this.getParent(item); parent; parent = this.getParent(parent)) {
            parent.expanded = true;
        }
    }

    @action
    selectItems(items: TreeObjectAdapter[]) {
        // deselect previously selected items
        this.selectedItems.forEach(item => (item.selected = false));

        // select items
        items.forEach(item => this.selectItem(item));
    }

    @action
    selectObject(object: EezObject) {
        let objectAdapter = this.getAncestorObjectAdapter(object);
        if (objectAdapter) {
            this.selectItems([objectAdapter]);
        } else {
            this.selectItems([]);
        }
    }

    @action
    toggleSelected(item: TreeObjectAdapter) {
        if (item.selected) {
            item.selected = false;
        } else {
            this.selectItem(item);
        }
    }

    @action
    toggleExpanded() {
        this.expanded = !this.expanded;
    }

    @action
    loadState(state: any) {
        this.expanded = true;
        this.selected = state.$selected;

        _each(state, (value: any, key: any) => {
            if (typeof key == "string" && key.startsWith("$")) {
                return;
            }

            let child = (this.children as any)[key];
            if (child) {
                child.loadState(value);
            }
        });
    }

    saveState() {
        let state: any = {};

        if (this.selected) {
            state.$selected = true;
        }

        if (this.expanded) {
            _each(
                _pickBy(
                    this.children,
                    (childItem: TreeObjectAdapter) => childItem.selected || childItem.expanded
                ),
                (childItem: any, i: any) => {
                    state[i] = childItem.saveState();
                }
            );
        }

        return state;
    }

    getObjectAdapter(objectAdapterOrObjectOrObjectId: TreeObjectAdapter | EezObject | string) {
        function getObjectAdapterFromObjectId(
            objectAdapter: TreeObjectAdapter,
            id: string
        ): TreeObjectAdapter | undefined {
            if (getId(objectAdapter.object) == id) {
                return objectAdapter;
            }

            let result = _find(objectAdapter.children, (displayItemChild: any) => {
                let child: DisplayItem = displayItemChild;
                return id == getId(child.object) || id.startsWith(getId(child.object) + ".");
            });
            if (result) {
                return getObjectAdapterFromObjectId(result as any, id);
            }

            return undefined;
        }

        if (objectAdapterOrObjectOrObjectId instanceof TreeObjectAdapter) {
            return objectAdapterOrObjectOrObjectId;
        }

        if (objectAdapterOrObjectOrObjectId instanceof EezObject) {
            return getObjectAdapterFromObjectId(this, getId(objectAdapterOrObjectOrObjectId));
        }

        if (isObservableArray(objectAdapterOrObjectOrObjectId)) {
            return getObjectAdapterFromObjectId(
                this,
                getId(objectAdapterOrObjectOrObjectId as any)
            );
        }

        return getObjectAdapterFromObjectId(this, objectAdapterOrObjectOrObjectId);
    }

    getAncestorObjectAdapter(object: EezObject) {
        if (!hasAncestor(object, this.object)) {
            return undefined;
        }

        let objectAdapter: TreeObjectAdapter = this;
        while (true) {
            let childObjectAdapter = _find(objectAdapter.children, (treeObjectAdpterChild: any) => {
                let child: TreeObjectAdapter = treeObjectAdpterChild;
                return hasAncestor(object, child.object);
            });
            if (!childObjectAdapter) {
                return objectAdapter;
            }
            objectAdapter = childObjectAdapter as any;
        }
    }

    getParent(item: TreeObjectAdapter) {
        for (let parent = getParent(item.object); parent; parent = getParent(parent)) {
            let parentObjectAdapter = this.getObjectAdapter(parent);
            if (parentObjectAdapter) {
                return parentObjectAdapter;
            }
        }
        return undefined;
    }

    getAncestors(item: TreeObjectAdapter) {
        let ancestors: TreeObjectAdapter[] = [];

        if (this != item) {
            let parentItem: TreeObjectAdapter = this;

            while (true) {
                ancestors.unshift(parentItem);

                let result = _find(parentItem.children, (treeObjectAdpterChild: any) => {
                    let child: TreeObjectAdapter = treeObjectAdpterChild;

                    if (child == item) {
                        return true;
                    }

                    if (getId(item.object).startsWith(getId(child.object) + ".")) {
                        return true;
                    }

                    return false;
                });

                if (!result) {
                    console.log("UPS!!!");
                    break;
                }

                if (<any>result == item) {
                    break;
                }

                parentItem = result as any;
            }
        }

        ancestors.unshift(item);

        return ancestors;
    }

    canCut() {
        if (this.selectedItems.length == 0) {
            return false;
        }

        for (let i = 0; i < this.selectedItems.length; i++) {
            if (!canCut(this.selectedItems[i].object)) {
                return false;
            }
        }

        return true;
    }

    cutSelection() {
        if (this.canCut()) {
            if (this.selectedItems.length == 1) {
                cutItem(this.selectedItems[0].object);
            } else {
                let objects = this.selectedItems.map(item => item.object);
                let cliboardText = btoa(objectsToClipboardData(objects));
                deleteItems(objects, () => {
                    EEZStudio.electron.remote.clipboard.write({
                        text: cliboardText
                    });
                });
            }
        }
    }

    canCopy() {
        if (this.selectedItems.length == 0) {
            return false;
        }

        for (let i = 0; i < this.selectedItems.length; i++) {
            if (!canCut(this.selectedItems[i].object)) {
                return false;
            }
        }

        return true;
    }

    copySelection() {
        if (this.canCopy()) {
            if (this.selectedItems.length == 1) {
                copyItem(this.selectedItems[0].object);
            } else {
                let objects = this.selectedItems.map(item => item.object);
                EEZStudio.electron.remote.clipboard.write({
                    text: btoa(objectsToClipboardData(objects))
                });
            }
        }
    }

    canPaste() {
        if (this.selectedItems.length == 0) {
            if (canPaste(this.object)) {
                return true;
            }
            return false;
        }

        if (this.selectedItems.length == 1) {
            if (canPaste(this.selectedItems[0].object)) {
                return true;
            }
            return false;
        }

        return false;
    }

    pasteSelection() {
        if (this.canPaste()) {
            if (this.selectedItems.length == 0) {
                pasteItem(this.object);
            } else {
                pasteItem(this.selectedItems[0].object);
            }
        }
    }

    canDelete() {
        if (this.selectedItems.length == 0) {
            return false;
        }

        for (let i = 0; i < this.selectedItems.length; i++) {
            if (!canDelete(this.selectedItems[i].object)) {
                return false;
            }
        }

        return true;
    }

    deleteSelection() {
        if (this.canDelete()) {
            let objects = this.selectedItems.map(item => item.object);
            deleteItems(objects);
        }
    }

    showSelectionContextMenu() {
        if (this.selectedItems.length == 1) {
            showSingleItemContextMenu(this.selectedItems[0].object);
            return;
        }

        let menuItems: Electron.MenuItem[] = [];

        let clipboardMenuItems: Electron.MenuItem[] = [];

        if (this.canCut()) {
            clipboardMenuItems.push(
                new MenuItem({
                    label: "Cut",
                    click: () => {
                        this.cutSelection();
                    }
                })
            );
        }

        if (this.canCopy()) {
            clipboardMenuItems.push(
                new MenuItem({
                    label: "Copy",
                    click: () => {
                        this.copySelection();
                    }
                })
            );
        }

        if (this.canPaste()) {
            clipboardMenuItems.push(
                new MenuItem({
                    label: "Paste",
                    click: () => {
                        this.pasteSelection();
                    }
                })
            );
        }

        if (clipboardMenuItems.length > 0) {
            if (menuItems.length > 0) {
                menuItems.push(
                    new MenuItem({
                        type: "separator"
                    })
                );
            }
            menuItems = menuItems.concat(clipboardMenuItems);
        }

        if (this.canDelete()) {
            if (menuItems.length > 0) {
                menuItems.push(
                    new MenuItem({
                        type: "separator"
                    })
                );
            }

            menuItems.push(
                new MenuItem({
                    label: "Delete",
                    click: () => {
                        this.deleteSelection();
                    }
                })
            );
        }

        let selectedObjects = this.selectedObjects;
        if (selectedObjects.length > 0) {
            let i: number;
            for (i = 1; i < selectedObjects.length; i++) {
                if (isSameInstanceTypeAs(selectedObjects[i], selectedObjects[0])) {
                    break;
                }
            }
            if (i == selectedObjects.length) {
                extendContextMenu(selectedObjects[0], selectedObjects, menuItems);
            }
        }

        if (menuItems.length > 0) {
            const menu = new Menu();
            menuItems.forEach(menuItem => menu.append(menuItem));
            menu.popup({});
        }
    }
}
