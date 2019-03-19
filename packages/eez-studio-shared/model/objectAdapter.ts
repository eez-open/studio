import { observable, action, computed, runInAction, autorun } from "mobx";
import { createTransformer } from "mobx-utils";

import { _each, _find, _pickBy, _isEqual, _map } from "eez-studio-shared/algorithm";

import { stringCompare } from "eez-studio-shared/string";

import {
    isArray,
    asArray,
    getProperty,
    EezObject,
    EezArrayObject,
    PropertyType,
    isAncestor,
    reduceUntilCommonParent as reduceObjectsUntilCommonParent,
    IEditorState,
    getRootObject,
    getObjectFromObjectId,
    isPropertyEnumerable,
    EezBrowsableObject,
    objectToString,
    isShowOnlyChildrenInTree,
    cloneObject,
    PropertyInfo,
    isArrayElement,
    isObjectInstanceOf
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
    deleteItem,
    deleteItems,
    createContextMenu,
    showContextMenu,
    IMenu,
    IMenuItem,
    UIElementsFactory,
    IMenuAnchorPosition,
    canContainChildren,
    DocumentStore,
    NavigationStore
} from "eez-studio-shared/model/store";
import {
    objectToClipboardData,
    setClipboardData,
    findPastePlaceInside
} from "eez-studio-shared/model/clipboard";
import { DragAndDropManager } from "eez-studio-shared/model/dd";

////////////////////////////////////////////////////////////////////////////////

export function getPropertyNames(obj: any) {
    var allPropertyNames: string[] = [];

    do {
        allPropertyNames = allPropertyNames.concat(Object.getOwnPropertyNames(obj));
    } while ((obj = Object.getPrototypeOf(obj)));

    return [...new Set(allPropertyNames)].filter(propertyName => {
        if (propertyName.startsWith("_")) {
            return false;
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
            return false;
        }

        return true;
    });
}

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

    browsableObjectChildren(browsableObject: EezBrowsableObject) {
        if (
            !browsableObject.value ||
            typeof browsableObject.value !== "object" ||
            browsableObject.value instanceof Date
        ) {
            return [];
        }

        let browsableObjectValue = browsableObject.value;

        // prevent cycle
        for (
            let ancestor = this.object._parent;
            ancestor !== undefined && ancestor instanceof EezBrowsableObject;
            ancestor = ancestor._parent
        ) {
            if (ancestor.value === browsableObjectValue) {
                return [];
            }
        }

        if (Array.isArray(browsableObjectValue)) {
            if (browsableObjectValue.length === 0) {
                return [];
            }
            browsableObjectValue = browsableObjectValue[0];
        }

        const children = [];
        const propertyNames = getPropertyNames(browsableObjectValue);
        for (var propertyName of propertyNames) {
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
            children.push(new TreeObjectAdapter(childBrowsableObject, this.transformer, false));
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
                    UIElementsFactory.copyToClipboard(cliboardText);
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
                UIElementsFactory.copyToClipboard(btoa(objectsToClipboardData(objects)));
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
                if (selectedObjects[i]._parent !== selectedObjects[0]._parent) {
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

////////////////////////////////////////////////////////////////////////////////

export interface ITreeItem {}

interface ITreeRow {
    item: ITreeItem;
    level: number;
    draggable: boolean;
    collapsable: boolean;
}

interface IDraggableTreeAdapter {
    isDragging: boolean;
    isDragSource(item: ITreeItem): boolean;
    onDragStart(row: ITreeItem, event: any): void;
    onDrag(row: ITreeItem, event: any): void;
    onDragEnd(event: any): void;
    onDragOver(dropItem: ITreeItem | undefined, event: any): void;
    onDragLeave(event: any): void;
    onDrop(dropPosition: DropPosition, event: any): void;
    isAncestorOfDragObject(dropItem: ITreeItem): boolean;
    canDrop(
        dropItem: ITreeItem,
        dropPosition: DropPosition,
        prevObjectId: string | undefined,
        nextObjectId: string | undefined
    ): boolean;
    canDropInside(dropItem: ITreeItem): boolean;
    dropItem: ITreeItem | undefined;
}

interface ICollapsableTreeAdapter {
    isExpanded(item: ITreeItem): boolean;
    toggleExpanded(item: ITreeItem): void;
}

export interface ITreeAdapter {
    allRows: ITreeRow[];
    maxLevel?: number;

    getItemId(item: ITreeItem): string;
    getItemFromId(id: string): ITreeItem | undefined;
    getItemParent(item: ITreeItem): ITreeItem | undefined;
    itemToString(item: ITreeItem): string;
    isAncestor(item: ITreeItem, ancestor: ITreeItem): boolean;

    isSelected(item: ITreeItem): boolean;
    selectItem(item: ITreeItem): void;
    toggleSelected(item: ITreeItem): void;
    showSelectionContextMenu(position: IMenuAnchorPosition): void;
    cutSelection(): void;
    copySelection(): void;
    pasteSelection(): void;
    deleteSelection(): void;

    onDoubleClick(item: ITreeItem): void;

    collapsableAdapter: ICollapsableTreeAdapter | undefined;
    draggableAdapter: IDraggableTreeAdapter | undefined;
}

export type SortDirectionType = "asc" | "desc" | "none";

export enum DropPosition {
    DROP_POSITION_NONE,
    DROP_POSITION_BEFORE,
    DROP_POSITION_AFTER,
    DROP_POSITION_INSIDE
}

export class TreeAdapter implements ITreeAdapter {
    constructor(
        private rootItem: ITreeObjectAdapter,
        private item?: ITreeObjectAdapter,
        private filter?: (object: EezObject) => boolean,
        private collapsable?: boolean,
        private sortDirection?: SortDirectionType,
        public maxLevel?: number,
        onDoubleClick?: (object: EezObject) => void
    ) {
        this.onDoubleClickCallback = onDoubleClick;
    }

    onDoubleClickCallback: ((object: EezObject) => void) | undefined;

    get allRows() {
        const { filter, collapsable, sortDirection, maxLevel } = this;

        const draggable = sortDirection === undefined || sortDirection === "none";

        const children: ITreeRow[] = [];

        function getChildren(item: ITreeObjectAdapter) {
            let itemChildren = _map(item.children, childItem => childItem) as ITreeObjectAdapter[];

            if (sortDirection === "asc") {
                itemChildren = itemChildren.sort((a, b) =>
                    stringCompare(a.object._label, b.object._label)
                );
            } else if (sortDirection === "desc") {
                itemChildren = itemChildren.sort((a, b) =>
                    stringCompare(b.object._label, a.object._label)
                );
            }

            return itemChildren;
        }

        function enumChildren(childItems: ITreeObjectAdapter[], level: number) {
            childItems.forEach(childItem => {
                if (!filter || filter(childItem.object)) {
                    const showOnlyChildren =
                        childItem.children.length == 1 &&
                        isArray(childItem.object) &&
                        isShowOnlyChildrenInTree(childItem.object);

                    const childItems = getChildren(childItem);

                    if (showOnlyChildren) {
                        enumChildren(childItems, level);
                    } else {
                        const row = {
                            item: childItem,
                            level,
                            draggable,
                            collapsable: false
                        };

                        children.push(row);

                        const maxLevelReached = maxLevel !== undefined && level === maxLevel;

                        if (!maxLevelReached && childItem.expanded && childItems.length > 0) {
                            enumChildren(childItems, level + 1);
                        }

                        row.collapsable =
                            collapsable! &&
                            !maxLevelReached &&
                            (childItems.length > 0 || canContainChildren(childItem.object));
                    }
                }
            });
        }

        enumChildren(getChildren(this.item || this.rootItem), 0);

        return children;
    }

    getItemId(item: ITreeObjectAdapter) {
        return item.object._id;
    }

    getItemFromId(id: string): ITreeObjectAdapter | undefined {
        return this.rootItem.getObjectAdapter(id);
    }

    getItemParent(item: ITreeObjectAdapter): ITreeObjectAdapter | undefined {
        return this.rootItem.getParent(item);
    }

    itemToString(item: ITreeObjectAdapter): string {
        return objectToString(item.object);
    }

    isAncestor(item: ITreeObjectAdapter, ancestor: ITreeObjectAdapter): boolean {
        return isAncestor(item.object, ancestor.object);
    }

    isSelected(item: ITreeObjectAdapter) {
        return item.selected;
    }

    selectItem(item: ITreeObjectAdapter) {
        this.rootItem.selectItems([item]);
    }

    toggleSelected(item: ITreeObjectAdapter): void {
        this.rootItem.toggleSelected(item);
    }

    showSelectionContextMenu(position: IMenuAnchorPosition) {
        this.rootItem.showSelectionContextMenu(position);
    }

    cutSelection() {
        this.rootItem.cutSelection();
    }

    copySelection() {
        this.rootItem.cutSelection();
    }

    pasteSelection() {
        this.rootItem.cutSelection();
    }

    deleteSelection() {
        this.rootItem.cutSelection();
    }

    get collapsableAdapter() {
        return this.collapsable ? this : undefined;
    }

    isExpanded(item: ITreeObjectAdapter) {
        return item.expanded;
    }

    toggleExpanded(item: ITreeObjectAdapter): void {
        item.toggleExpanded();
    }

    onDoubleClick(item: ITreeObjectAdapter): void {
        if (this.onDoubleClickCallback) {
            this.onDoubleClickCallback(item.object);
        }
    }

    get draggableAdapter() {
        return this.sortDirection === undefined || this.sortDirection === "none" ? this : undefined;
    }

    get isDragging() {
        return !!DragAndDropManager.dragObject;
    }

    isDragSource(item: ITreeObjectAdapter) {
        return DragAndDropManager.dragObject === item.object;
    }

    onDragStart(item: ITreeObjectAdapter, event: any) {
        event.dataTransfer.effectAllowed = "copyMove";
        setClipboardData(event, objectToClipboardData(item.object));
        event.dataTransfer.setDragImage(DragAndDropManager.blankDragImage, 0, 0);
        // postpone render, otherwise we can receive onDragEnd immediatelly
        setTimeout(() => {
            DragAndDropManager.start(event, item.object);
        });
    }

    onDrag(event: any) {
        DragAndDropManager.drag(event);
    }

    onDragEnd(event: any) {
        DragAndDropManager.end(event);
    }

    onDragOver(dropItem: ITreeObjectAdapter | undefined, event: any) {
        if (dropItem) {
            event.preventDefault();
            event.stopPropagation();
            DragAndDropManager.setDropEffect(event);
        }

        if (this.dropItem !== dropItem) {
            this.dropItem = dropItem;
        }
    }

    onDragLeave(event: any) {
        if (this.dropItem) {
            this.dropItem = undefined;
        }
    }

    onDrop(dropPosition: DropPosition, event: any) {
        DragAndDropManager.deleteDragItem();

        if (DragAndDropManager.dragObject) {
            let object = cloneObject(undefined, DragAndDropManager.dragObject);

            let dropItem = DragAndDropManager.dropObject as ITreeObjectAdapter;

            if (dropPosition == DropPosition.DROP_POSITION_BEFORE) {
                DocumentStore.insertObjectBefore(dropItem.object, object);
            } else if (dropPosition == DropPosition.DROP_POSITION_AFTER) {
                DocumentStore.insertObjectAfter(dropItem.object, object);
            } else if (dropPosition == DropPosition.DROP_POSITION_INSIDE) {
                let dropPlace = findPastePlaceInside(dropItem.object, object._classInfo, true);
                if (dropPlace) {
                    if (isArray(dropPlace as EezObject)) {
                        DocumentStore.addObject(dropPlace as EezObject, object);
                    } else {
                        DocumentStore.updateObject(dropItem.object, {
                            [(dropPlace as PropertyInfo).name]: object
                        });
                    }
                }
            }
        }

        DragAndDropManager.end(event);
    }

    isAncestorOfDragObject(dropItem: ITreeObjectAdapter) {
        return isAncestor(dropItem.object, DragAndDropManager.dragObject!);
    }

    canDrop(
        dropItem: ITreeObjectAdapter,
        dropPosition: DropPosition,
        prevObjectId: string | undefined,
        nextObjectId: string | undefined
    ): boolean {
        const dragObject = DragAndDropManager.dragObject!;

        // check: can't drop object within itself
        if (this.isAncestorOfDragObject(dropItem)) {
            return false;
        }

        // check: can't drop object if parent can't accept it
        if (
            !(
                isArrayElement(dropItem.object) &&
                isObjectInstanceOf(dragObject, dropItem.object._parent!._classInfo)
            )
        ) {
            return false;
        }

        // check: it makes no sense to drop dragObject before or after itself
        if (dropItem.object === dragObject) {
            return false;
        }

        if (dropItem.object._parent === dragObject._parent) {
            if (dropPosition === DropPosition.DROP_POSITION_BEFORE) {
                if (prevObjectId !== dragObject._id) {
                    return true;
                }
            } else if (dropPosition === DropPosition.DROP_POSITION_AFTER) {
                if (nextObjectId !== dragObject._id) {
                    return true;
                }
            }
        } else {
            return true;
        }

        return false;
    }

    canDropInside(dropItem: ITreeObjectAdapter) {
        return !!findPastePlaceInside(
            dropItem.object,
            DragAndDropManager.dragObject!._classInfo,
            true
        );
    }

    get dropItem(): ITreeObjectAdapter | undefined {
        return DragAndDropManager.dropObject as (ITreeObjectAdapter | undefined);
    }

    set dropItem(value: ITreeObjectAdapter | undefined) {
        if (value) {
            DragAndDropManager.setDropObject(value);
        } else {
            DragAndDropManager.unsetDropObject();
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

class ListItem {
    constructor(public object: EezObject) {}

    @observable
    selected: boolean = false;

    get item() {
        return this;
    }

    get level() {
        return 0;
    }

    get draggable() {
        return true;
    }

    get collapsable() {
        return false;
    }
}

export class ListAdapter implements ITreeAdapter {
    constructor(
        private object: EezObject,
        private sortDirection?: SortDirectionType,
        onDoubleClick?: (object: EezObject) => void
    ) {
        this.onDoubleClickCallback = onDoubleClick;

        autorun(() => {
            const selectedItem = this.selectedItem;
            if (selectedItem && !selectedItem.selected) {
                runInAction(() => {
                    this.items.forEach(item => {
                        if (item.selected) {
                            item.selected = false;
                        }
                    });

                    selectedItem.selected = true;
                });
            }
        });
    }

    onDoubleClickCallback: ((object: EezObject) => void) | undefined;

    parentItem = new ListItem(this.object);

    @computed
    get items() {
        let items = asArray(this.object).map(object => new ListItem(object));

        if (this.sortDirection === "asc") {
            return items.sort((a, b) => stringCompare(a.object._label, b.object._label));
        }

        if (this.sortDirection === "desc") {
            return items.sort((a, b) => stringCompare(b.object._label, a.object._label));
        }

        return items;
    }

    get allRows() {
        return this.items;
    }

    maxLevel = 0;

    getItemId(item: ListItem) {
        return item.object._id;
    }

    getItemFromId(id: string) {
        return this.items.find(item => item.object._id === id);
    }

    getItemParent(item: ListItem) {
        return this.parentItem;
    }

    itemToString(item: ListItem) {
        return objectToString(item.object);
    }

    isAncestor(item: ListItem, ancestor: ListItem): boolean {
        return isAncestor(item.object, ancestor.object);
    }

    isSelected(item: ListItem): boolean {
        return item.selected;
    }

    @computed
    get selectedItem(): ListItem | undefined {
        const item = NavigationStore.getNavigationSelectedItem(this.object);

        if (item instanceof EezObject) {
            return this.getItemFromId(item._id);
        }

        if (this.items.length > 0) {
            return this.items[0];
        }

        return undefined;
    }

    @action
    selectItem(item: ListItem): void {
        let selectedItem = this.selectedItem;
        if (selectedItem) {
            selectedItem.selected = false;
        }

        NavigationStore.setNavigationSelectedItem(this.object, item.object);

        selectedItem = this.selectedItem;
        if (selectedItem) {
            selectedItem.selected = true;
        }
    }

    toggleSelected(item: ListItem): void {
        this.selectItem(item);
    }

    showSelectionContextMenu(position: IMenuAnchorPosition): void {
        showContextMenu(this.object, position);
    }

    cutSelection() {
        if (this.selectedItem) {
            cutItem(this.selectedItem.object);
        }
    }

    copySelection() {
        if (this.selectedItem) {
            copyItem(this.selectedItem.object);
        }
    }

    pasteSelection() {
        if (this.selectedItem) {
            pasteItem(this.selectedItem.object);
        }
    }

    deleteSelection() {
        if (this.selectedItem) {
            deleteItem(this.selectedItem.object);
        }
    }

    onDoubleClick(item: ListItem) {
        if (this.onDoubleClickCallback) {
            this.onDoubleClickCallback(item.object);
        }
    }

    collapsableAdapter = undefined;

    get draggableAdapter() {
        return this.sortDirection === undefined || this.sortDirection === "none" ? this : undefined;
    }

    get isDragging() {
        return !!DragAndDropManager.dragObject;
    }

    isDragSource(item: ListItem) {
        return DragAndDropManager.dragObject === item.object;
    }

    onDragStart(item: ListItem, event: any) {
        event.dataTransfer.effectAllowed = "copyMove";
        setClipboardData(event, objectToClipboardData(item.object));
        event.dataTransfer.setDragImage(DragAndDropManager.blankDragImage, 0, 0);
        // postpone render, otherwise we can receive onDragEnd immediatelly
        setTimeout(() => {
            DragAndDropManager.start(event, item.object);
        });
    }

    onDrag(event: any) {
        DragAndDropManager.drag(event);
    }

    onDragEnd(event: any) {
        DragAndDropManager.end(event);
    }

    onDragOver(dropItem: ListItem | undefined, event: any) {
        if (dropItem) {
            event.preventDefault();
            event.stopPropagation();
            DragAndDropManager.setDropEffect(event);
        }

        if (this.dropItem !== dropItem) {
            this.dropItem = dropItem;
        }
    }

    onDragLeave(event: any) {
        if (this.dropItem) {
            this.dropItem = undefined;
        }
    }

    onDrop(dropPosition: DropPosition, event: any) {
        DragAndDropManager.deleteDragItem();

        if (DragAndDropManager.dragObject) {
            let object = cloneObject(undefined, DragAndDropManager.dragObject);

            let dropItem = DragAndDropManager.dropObject as ListItem;

            if (dropPosition == DropPosition.DROP_POSITION_BEFORE) {
                DocumentStore.insertObjectBefore(dropItem.object, object);
            } else if (dropPosition == DropPosition.DROP_POSITION_AFTER) {
                DocumentStore.insertObjectAfter(dropItem.object, object);
            }
        }

        DragAndDropManager.end(event);
    }

    isAncestorOfDragObject(dropItem: ListItem) {
        return isAncestor(dropItem.object, DragAndDropManager.dragObject!);
    }

    canDrop(
        dropItem: ListItem,
        dropPosition: DropPosition,
        prevObjectId: string | undefined,
        nextObjectId: string | undefined
    ): boolean {
        const dragObject = DragAndDropManager.dragObject!;

        // check: can't drop object if parent can't accept it
        if (!isObjectInstanceOf(dragObject, this.object._classInfo)) {
            return false;
        }

        // check: it makes no sense to drop dragObject before or after itself
        if (dropItem.object === dragObject) {
            return false;
        }

        if (dropItem.object._parent === dragObject._parent) {
            if (dropPosition === DropPosition.DROP_POSITION_BEFORE) {
                if (prevObjectId !== dragObject._id) {
                    return true;
                }
            } else if (dropPosition === DropPosition.DROP_POSITION_AFTER) {
                if (nextObjectId !== dragObject._id) {
                    return true;
                }
            }
        } else {
            return true;
        }

        return false;
    }

    canDropInside(dropItem: ListItem) {
        return false;
    }

    get dropItem(): ListItem | undefined {
        return DragAndDropManager.dropObject as (ListItem | undefined);
    }

    set dropItem(value: ListItem | undefined) {
        if (value) {
            DragAndDropManager.setDropObject(value);
        } else {
            DragAndDropManager.unsetDropObject();
        }
    }
}
