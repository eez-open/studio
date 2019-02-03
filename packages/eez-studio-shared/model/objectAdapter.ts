import { observable, action, computed } from "mobx";
import { createTransformer } from "mobx-utils";

import { _each, _find, _pickBy, _isEqual, _map } from "eez-studio-shared/algorithm";

import {
    isArray,
    asArray,
    getProperty,
    EezObject,
    EezArrayObject,
    PropertyType,
    isSameInstanceTypeAs,
    isAncestor,
    reduceUntilCommonParent as reduceObjectsUntilCommonParent,
    IEditorState,
    getRootObject,
    getObjectFromObjectId,
    isPropertyEnumerable,
    EezBrowsableObject
} from "eez-studio-shared/model/object";
import { objectsToClipboardData } from "eez-studio-shared/model/clipboard";
import {
    canCut,
    canPaste,
    canDelete,
    extendContextMenu,
    cutItem,
    copyItem,
    pasteItem,
    deleteItems,
    createContextMenu,
    IMenu,
    IMenuItem,
    UIElementsFactory,
    IMenuAnchorPosition
} from "eez-studio-shared/model/store";

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

    showSelectionContextMenu(position: IMenuAnchorPosition): void;
}

////////////////////////////////////////////////////////////////////////////////

export function getDisplayItemFromObjectId(item: DisplayItem, id: string): DisplayItem | undefined {
    if (item.object._id == id) {
        return item;
    }

    let result = _find(item.children, (displayItemChild: any) => {
        let child: DisplayItem = displayItemChild;
        return id === child.object._id || id.startsWith(child.object._id + ".");
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
    let parentItems = objects.map(object => getDisplayItemFromObjectId(rootItem, object._id));
    return parentItems.filter(item => item !== undefined) as DisplayItem[];
}

////////////////////////////////////////////////////////////////////////////////

export type TreeObjectAdapterChildrenArray = ITreeObjectAdapter[];
export type TreeObjectAdapterChildrenObject = { [key: string]: ITreeObjectAdapter };
export type TreeObjectAdapterChildren =
    | TreeObjectAdapterChildrenArray
    | TreeObjectAdapterChildrenObject;

export interface ITreeObjectAdapter extends DisplayItem, DisplayItemSelection, IEditorState {
    object: EezObject;
    selected: boolean;
    expanded: boolean;
    children: TreeObjectAdapterChildren;
    hasChildren: boolean;
    selectedItems: ITreeObjectAdapter[];
    selectedObject: EezObject | undefined;
    selectedObjects: EezObject[];
    selectedItem: ITreeObjectAdapter | undefined;
    selectItem(item: ITreeObjectAdapter): void;
    selectItems(items: ITreeObjectAdapter[]): void;
    selectObjects(objects: EezObject[]): void;
    selectObjectIds(objectIds: string[]): void;
    selectObject(object: EezObject): void;
    toggleSelected(item: ITreeObjectAdapter): void;
    toggleExpanded(): void;
    loadState(state: any): void;
    saveState(): void;
    getObjectAdapter(
        objectAdapterOrObjectOrObjectId:
            | ITreeObjectAdapter
            | EezObject
            | EezArrayObject<EezObject>
            | string
    ): ITreeObjectAdapter | undefined;
    getAncestorObjectAdapter(object: EezObject): ITreeObjectAdapter | undefined;
    getParent(item: ITreeObjectAdapter): ITreeObjectAdapter | undefined;
    getAncestors(item: ITreeObjectAdapter): ITreeObjectAdapter[];
    canCut(): boolean;
    cutSelection(): void;
    canCopy(): boolean;
    copySelection(): void;
    canPaste(): boolean;
    pasteSelection(): void;
    canDelete(): boolean;
    deleteSelection(): void;
    createSelectionContextMenu(): IMenu | undefined;
    showSelectionContextMenu(position: IMenuAnchorPosition): void;
}

export class TreeObjectAdapter implements ITreeObjectAdapter {
    private transformer: (object: EezObject) => ITreeObjectAdapter;

    @observable selected: boolean;
    @observable expanded: boolean;

    constructor(
        public object: EezObject,
        transformer?: (object: EezObject) => ITreeObjectAdapter,
        expanded?: boolean
    ) {
        if (transformer) {
            this.transformer = transformer;
        } else {
            this.transformer = createTransformer((object: EezObject) => {
                return new TreeObjectAdapter(object, this.transformer);
            });
        }
        this.expanded = expanded || false;
    }

    static createWithExpandedAll(object: EezObject) {
        const transformer: (object: EezObject) => ITreeObjectAdapter = createTransformer(
            (object: EezObject) => {
                return new TreeObjectAdapter(object, transformer, true);
            }
        );

        return new TreeObjectAdapter(object, transformer);
    }

    browsableObjectChildren(browsableObject: EezBrowsableObject) {
        if (!browsableObject.value || typeof browsableObject.value !== "object") {
            return [];
        }

        let browsableObjectValue = browsableObject.value;

        function getAllProps(obj: any) {
            var props: string[] = [];

            do {
                props = props.concat(Object.getOwnPropertyNames(obj));
            } while ((obj = Object.getPrototypeOf(obj)));

            return [...new Set(props)]; // return unique values
        }

        if (Array.isArray(browsableObjectValue)) {
            if (browsableObjectValue.length === 0) {
                return [];
            }
            browsableObjectValue = browsableObjectValue[0];
        }

        const children = [];
        for (var propertyName of getAllProps(browsableObjectValue)) {
            if (propertyName.startsWith("_")) {
                continue;
            }

            if (
                [
                    "constructor",
                    "hasOwnProperty",
                    "isPrototypeOf",
                    "propertyIsEnumerable",
                    "toString",
                    "valueOf",
                    "toLocaleString"
                ].indexOf(propertyName) !== -1
            ) {
                continue;
            }

            const childValue = browsableObjectValue[propertyName];
            const childBrowsableObject = EezBrowsableObject.create(
                browsableObject,
                {
                    name:
                        propertyName +
                        (Array.isArray(childValue) ? "[]" : "") +
                        (typeof childValue === "function" ? "()" : ""),
                    type: PropertyType.Object,
                    typeClass: EezBrowsableObject
                },
                childValue
            );
            children.push(new TreeObjectAdapter(childBrowsableObject, this.transformer));
        }
        return children;
    }

    @computed
    get children(): TreeObjectAdapterChildren {
        if (this.object instanceof EezBrowsableObject) {
            return this.browsableObjectChildren(this.object);
        }

        if (isArray(this.object)) {
            return asArray(this.object).map(child => this.transformer(child));
        }

        let properties = this.object._classInfo.properties.filter(
            propertyInfo =>
                (propertyInfo.type === PropertyType.Object ||
                    propertyInfo.type === PropertyType.Array) &&
                isPropertyEnumerable(this.object, propertyInfo) &&
                getProperty(this.object, propertyInfo.name)
        );

        if (
            properties.length === 1 &&
            properties[0].type === PropertyType.Array &&
            !(properties[0].showOnlyChildrenInTree === false)
        ) {
            return asArray(getProperty(this.object, properties[0].name)).map(child =>
                this.transformer(child)
            );
        }

        if (
            properties.length === 1 &&
            properties[0].type === PropertyType.Object &&
            properties[0].typeClass === EezBrowsableObject
        ) {
            const browsableObject = getProperty(this.object, properties[0].name);
            return this.browsableObjectChildren(browsableObject);
        }

        return properties.reduce(
            (children, propertyInfo) => {
                const childObject = getProperty(this.object, propertyInfo.name);

                if (isArray(childObject)) {
                    children[propertyInfo.name] = new TreeObjectAdapter(
                        childObject,
                        this.transformer
                    );
                } else {
                    children[propertyInfo.name] = this.transformer(childObject);
                }

                return children;
            },
            {} as TreeObjectAdapterChildrenObject
        );
    }

    @computed
    get hasChildren() {
        return _map(this.children).length > 0;
    }

    @computed
    get selectedItems(): ITreeObjectAdapter[] {
        let items: ITreeObjectAdapter[] = [];

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
    selectItem(item: ITreeObjectAdapter) {
        item.selected = true;

        for (let parent = this.getParent(item); parent; parent = this.getParent(parent)) {
            parent.expanded = true;
        }
    }

    @action
    selectItems(items: ITreeObjectAdapter[]) {
        // deselect previously selected items
        this.selectedItems.forEach(item => (item.selected = false));

        // select items
        items.forEach(item => this.selectItem(item));
    }

    @action
    selectObjects(objects: EezObject[]) {
        const items: ITreeObjectAdapter[] = [];
        for (const object of objects) {
            const item = this.getAncestorObjectAdapter(object);
            if (item) {
                items.push(item);
            }
        }
        this.selectItems(items);
    }

    @action
    selectObjectIds(objectIds: string[]) {
        const currentlySelectedObjectIds = this.selectedItems.map(item => item.object._id);
        if (_isEqual(objectIds.sort(), currentlySelectedObjectIds.sort())) {
            return;
        }

        const rootObject = getRootObject(this.object);

        const objects: EezObject[] = [];
        for (const objectId of objectIds) {
            const object = getObjectFromObjectId(rootObject, objectId);
            if (object) {
                objects.push(object);
            }
        }

        this.selectObjects(objects);
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
    toggleSelected(item: ITreeObjectAdapter) {
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
                    (childItem: ITreeObjectAdapter) => childItem.selected || childItem.expanded
                ),
                (childItem: any, i: any) => {
                    state[i] = childItem.saveState();
                }
            );
        }

        return state;
    }

    getObjectAdapter(
        objectAdapterOrObjectOrObjectId:
            | ITreeObjectAdapter
            | EezObject
            | EezArrayObject<EezObject>
            | string
    ): ITreeObjectAdapter | undefined {
        function getObjectAdapterFromObjectId(
            objectAdapter: ITreeObjectAdapter,
            id: string
        ): ITreeObjectAdapter | undefined {
            if (objectAdapter.object._id == id) {
                return objectAdapter;
            }

            let result = _find(objectAdapter.children, (displayItemChild: any) => {
                let child: DisplayItem = displayItemChild;
                return id == child.object._id || id.startsWith(child.object._id + ".");
            });
            if (result) {
                return getObjectAdapterFromObjectId(result as any, id);
            }

            return undefined;
        }

        if (objectAdapterOrObjectOrObjectId instanceof EezArrayObject) {
            return getObjectAdapterFromObjectId(this, objectAdapterOrObjectOrObjectId._id);
        }

        if (objectAdapterOrObjectOrObjectId instanceof EezObject) {
            return getObjectAdapterFromObjectId(this, objectAdapterOrObjectOrObjectId._id);
        }

        if (!(typeof objectAdapterOrObjectOrObjectId === "string")) {
            return objectAdapterOrObjectOrObjectId;
        }

        return getObjectAdapterFromObjectId(this, objectAdapterOrObjectOrObjectId);
    }

    getAncestorObjectAdapter(object: EezObject) {
        if (!isAncestor(object, this.object)) {
            return undefined;
        }

        let objectAdapter: ITreeObjectAdapter = this;
        while (true) {
            let childObjectAdapter = _find(objectAdapter.children, (treeObjectAdpterChild: any) => {
                let child: ITreeObjectAdapter = treeObjectAdpterChild;
                return isAncestor(object, child.object);
            });
            if (!childObjectAdapter) {
                return objectAdapter;
            }
            objectAdapter = childObjectAdapter as any;
        }
    }

    getParent(item: ITreeObjectAdapter) {
        for (let parent = item.object._parent; parent; parent = parent._parent) {
            let parentObjectAdapter = this.getObjectAdapter(parent);
            if (parentObjectAdapter) {
                return parentObjectAdapter;
            }
        }
        return undefined;
    }

    getAncestors(item: ITreeObjectAdapter) {
        let ancestors: ITreeObjectAdapter[] = [];

        if (this != item) {
            let parentItem: ITreeObjectAdapter = this;

            while (true) {
                ancestors.unshift(parentItem);

                let result = _find(parentItem.children, (treeObjectAdpterChild: any) => {
                    let child: ITreeObjectAdapter = treeObjectAdpterChild;

                    if (child == item) {
                        return true;
                    }

                    if (item.object._id.startsWith(child.object._id + ".")) {
                        return true;
                    }

                    return false;
                });

                if (!result) {
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

    createSelectionContextMenu() {
        if (this.selectedItems.length == 1) {
            return createContextMenu(this.selectedItems[0].object);
        }

        let menuItems: IMenuItem[] = [];

        let clipboardMenuItems: IMenuItem[] = [];

        if (this.canCut()) {
            clipboardMenuItems.push(
                UIElementsFactory.createMenuItem({
                    label: "Cut",
                    click: () => {
                        this.cutSelection();
                    }
                })
            );
        }

        if (this.canCopy()) {
            clipboardMenuItems.push(
                UIElementsFactory.createMenuItem({
                    label: "Copy",
                    click: () => {
                        this.copySelection();
                    }
                })
            );
        }

        if (this.canPaste()) {
            clipboardMenuItems.push(
                UIElementsFactory.createMenuItem({
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
                    UIElementsFactory.createMenuItem({
                        type: "separator"
                    })
                );
            }
            menuItems = menuItems.concat(clipboardMenuItems);
        }

        if (this.canDelete()) {
            if (menuItems.length > 0) {
                menuItems.push(
                    UIElementsFactory.createMenuItem({
                        type: "separator"
                    })
                );
            }

            menuItems.push(
                UIElementsFactory.createMenuItem({
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
            const menu = UIElementsFactory.createMenu();
            menuItems.forEach(menuItem => menu.append(menuItem));
            return menu;
        }

        return undefined;
    }

    showSelectionContextMenu(position: IMenuAnchorPosition) {
        let menu = this.createSelectionContextMenu();

        if (menu) {
            menu.popup({}, position);
        }
    }
}
