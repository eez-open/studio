import {
    observable,
    action,
    computed,
    runInAction,
    autorun,
    IReactionDisposer
} from "mobx";
import { createTransformer } from "mobx-utils";

import {
    _each,
    _find,
    _pickBy,
    _isEqual,
    _map
} from "eez-studio-shared/algorithm";

import { stringCompare } from "eez-studio-shared/string";

import {
    isArray,
    getProperty,
    IEezObject,
    PropertyType,
    isAncestor,
    IEditorState,
    isPropertyEnumerable,
    objectToString,
    isShowOnlyChildrenInTree,
    PropertyInfo,
    isArrayElement,
    isObjectInstanceOf,
    isPartOfNavigation,
    getParent,
    getId,
    getClassInfo,
    getLabel
} from "project-editor/core/object";
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
    canContainChildren,
    INavigationStore,
    createObjectNavigationItem,
    isObjectNavigationItem,
    getDocumentStore
} from "project-editor/core/store";
import {
    objectToClipboardData,
    setClipboardData,
    findPastePlaceInside,
    copyToClipboard
} from "project-editor/core/clipboard";
import {
    DragAndDropManagerClass,
    DragAndDropManager
} from "project-editor/core/dd";
import { objectToJson } from "project-editor/core/serialization";
import { Rect } from "eez-studio-shared/geometry";
import type { IResizeHandler } from "project-editor/flow/flow-interfaces";

const { Menu, MenuItem } = EEZStudio.remote || {};

////////////////////////////////////////////////////////////////////////////////

export function getPropertyNames(obj: any) {
    var allPropertyNames: string[] = [];

    do {
        allPropertyNames = allPropertyNames.concat(
            Object.getOwnPropertyNames(obj)
        );
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
export type DisplayItemChildren =
    | DisplayItemChildrenArray
    | DisplayItemChildrenObject;

export interface DisplayItem {
    object: IEezObject;
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

    showSelectionContextMenu(position: Electron.PopupOptions): void;
}

////////////////////////////////////////////////////////////////////////////////

export type TreeObjectAdapterChildrenArray = ITreeObjectAdapter[];
export type TreeObjectAdapterChildrenObject = {
    [key: string]: ITreeObjectAdapter;
};
export type TreeObjectAdapterChildren =
    | TreeObjectAdapterChildrenArray
    | TreeObjectAdapterChildrenObject;

export interface ITreeObjectAdapter
    extends DisplayItem,
        DisplayItemSelection,
        IEditorState {
    id: string;
    object: IEezObject;
    rect: Rect;
    isMoveable: boolean;
    isSelectable: boolean;
    showSelectedObjectsParent: boolean;
    getResizeHandlers?: () => IResizeHandler[] | undefined | false;
    open(): void;
    selected: boolean;
    expanded: boolean;
    children: TreeObjectAdapterChildren;
    hasChildren: boolean;
    selectedItems: ITreeObjectAdapter[];
    selectedObject: IEezObject | undefined;
    selectedObjects: IEezObject[];
    selectedItem: ITreeObjectAdapter | undefined;
    selectItem(item: ITreeObjectAdapter): void;
    selectItems(items: ITreeObjectAdapter[]): void;
    selectObjects(objects: IEezObject[]): void;
    selectObjectIds(objectIds: string[]): void;
    selectObject(object: IEezObject): void;
    toggleSelected(item: ITreeObjectAdapter): void;
    toggleExpanded(): void;
    loadState(state: any): void;
    saveState(): void;
    getObjectAdapter(
        objectAdapterOrObjectOrObjectId: IEezObject | string
    ): ITreeObjectAdapter | undefined;
    getAncestorObjectAdapter(
        object: IEezObject
    ): ITreeObjectAdapter | undefined;
    getParent(item: ITreeObjectAdapter): ITreeObjectAdapter | undefined;
    canCut(): boolean;
    cutSelection(): void;
    canCopy(): boolean;
    copySelection(): void;
    canPaste(): boolean;
    pasteSelection(): void;
    canDelete(): boolean;
    deleteSelection(): void;
    createSelectionContextMenu(): Electron.Menu | undefined;
    showSelectionContextMenu(): void;
}

export class TreeObjectAdapter implements ITreeObjectAdapter {
    protected transformer: (object: IEezObject) => ITreeObjectAdapter;

    @observable selected: boolean;
    @observable expanded: boolean;

    constructor(
        public object: IEezObject,
        transformer?: (object: IEezObject) => ITreeObjectAdapter,
        expanded?: boolean
    ) {
        if (transformer) {
            this.transformer = transformer;
        } else {
            this.transformer = createTransformer((object: IEezObject) => {
                return new TreeObjectAdapter(object, this.transformer);
            });
        }
        this.expanded = expanded || false;
    }

    get id() {
        return getId(this.object);
    }

    @computed({
        keepAlive: true
    })
    get children(): TreeObjectAdapterChildren {
        if (isArray(this.object)) {
            return this.object.map(child => this.transformer(child));
        }

        let properties = getClassInfo(this.object).properties.filter(
            propertyInfo =>
                (propertyInfo.type === PropertyType.Object ||
                    propertyInfo.type === PropertyType.Array) &&
                isPropertyEnumerable(this.object, propertyInfo) &&
                getProperty(this.object, propertyInfo.name)
        );

        if (
            properties.every(
                propertyInfo =>
                    propertyInfo.type === PropertyType.Array &&
                    !(propertyInfo.showOnlyChildrenInTree === false)
            )
        ) {
            return properties.reduce((children, propertyInfo) => {
                const childObject = getProperty(this.object, propertyInfo.name);

                return children.concat(
                    (childObject as IEezObject[]).map(child =>
                        this.transformer(child)
                    )
                );
            }, [] as TreeObjectAdapterChildrenArray);
        }

        return properties.reduce((children, propertyInfo) => {
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
        }, {} as TreeObjectAdapterChildrenObject);
    }

    @computed
    get rect() {
        const classInfo = getClassInfo(this.object);
        if (classInfo.getRect) {
            return classInfo.getRect(this.object);
        }
        return {
            left: 0,
            top: 0,
            width: 0,
            height: 0
        };
    }

    set rect(value: Rect) {
        const classInfo = getClassInfo(this.object);
        if (classInfo.setRect) {
            classInfo.setRect(this.object, value);
        }
    }

    get isMoveable() {
        const classInfo = getClassInfo(this.object);
        if (classInfo.isMoveable) {
            return classInfo.isMoveable(this.object);
        }
        return false;
    }

    get isSelectable() {
        const classInfo = getClassInfo(this.object);
        if (classInfo.isSelectable) {
            return classInfo.isSelectable(this.object);
        }
        return false;
    }

    get showSelectedObjectsParent() {
        const classInfo = getClassInfo(this.object);
        if (classInfo.showSelectedObjectsParent) {
            return classInfo.showSelectedObjectsParent(this.object);
        }
        return false;
    }

    getResizeHandlers(): IResizeHandler[] | undefined | false {
        const classInfo = getClassInfo(this.object);
        if (classInfo.getResizeHandlers) {
            return classInfo.getResizeHandlers(this.object);
        }
        return undefined;
    }

    open() {
        const classInfo = getClassInfo(this.object);
        if (classInfo.open) {
            classInfo.open(this.object);
        }
        return undefined;
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

        for (
            let parent = this.getParent(item);
            parent;
            parent = this.getParent(parent)
        ) {
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
    selectObjects(objects: IEezObject[]) {
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
        const currentlySelectedObjectIds = this.selectedItems.map(item =>
            getId(item.object)
        );
        if (_isEqual(objectIds.sort(), currentlySelectedObjectIds.sort())) {
            return;
        }

        const DocumentStore = getDocumentStore(this.object);

        const objects: IEezObject[] = [];
        for (const objectId of objectIds) {
            const object = DocumentStore.getObjectFromObjectId(objectId);
            if (object) {
                objects.push(object);
            }
        }

        this.selectObjects(objects);
    }

    @action
    selectObject(object: IEezObject) {
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
        function loadState(treeObjectAdapter: TreeObjectAdapter, state: any) {
            if (!state) {
                return;
            }

            treeObjectAdapter.expanded = true;
            treeObjectAdapter.selected = state.$selected;

            _each(state, (value: any, key: any) => {
                if (typeof key == "string" && key.startsWith("$")) {
                    return;
                }

                let child = (treeObjectAdapter.children as any)[key];
                if (child) {
                    loadState(child, value);
                }
            });
        }

        loadState(this, state);
    }

    saveState() {
        function saveState(treeObjectAdapter: TreeObjectAdapter) {
            let state: any = {};

            if (treeObjectAdapter.selected) {
                state.$selected = true;
            }

            if (treeObjectAdapter.expanded) {
                _each(
                    _pickBy(
                        treeObjectAdapter.children,
                        (childItem: ITreeObjectAdapter) =>
                            childItem.selected || childItem.expanded
                    ),
                    (childItem: any, i: any) => {
                        state[i] = saveState(childItem);
                    }
                );
            }

            return state;
        }

        return saveState(this);
    }

    @computed get objectIdMap() {
        const map = new Map<string, ITreeObjectAdapter>();

        function makeMap(objectAdapter: ITreeObjectAdapter) {
            map.set(getId(objectAdapter.object), objectAdapter);
            _each(objectAdapter.children, makeMap);
        }

        makeMap(this);

        return map;
    }

    getObjectAdapter(
        objectAdapterOrObjectOrObjectId: IEezObject | string
    ): ITreeObjectAdapter | undefined {
        if (typeof objectAdapterOrObjectOrObjectId === "string") {
            return this.objectIdMap.get(objectAdapterOrObjectOrObjectId);
        }
        return this.objectIdMap.get(getId(objectAdapterOrObjectOrObjectId));
    }

    getAncestorObjectAdapter(object: IEezObject) {
        if (!isAncestor(object, this.object)) {
            return undefined;
        }

        let objectAdapter: ITreeObjectAdapter = this;
        while (true) {
            let childObjectAdapter = _find(
                objectAdapter.children,
                (treeObjectAdpterChild: any) => {
                    let child: ITreeObjectAdapter = treeObjectAdpterChild;
                    return isAncestor(object, child.object);
                }
            );
            if (!childObjectAdapter) {
                return objectAdapter;
            }
            objectAdapter = childObjectAdapter as any;
        }
    }

    getParent(item: ITreeObjectAdapter) {
        for (
            let parent = getParent(item.object);
            parent;
            parent = getParent(parent)
        ) {
            let parentObjectAdapter = this.getObjectAdapter(parent);
            if (parentObjectAdapter) {
                return parentObjectAdapter;
            }
        }
        return undefined;
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
            let objects = this.selectedItems.map(item => item.object);
            if (objects.length == 1) {
                cutItem(objects[0]);
            } else {
                let cliboardText = getDocumentStore(
                    this.object
                ).objectsToClipboardData(objects);

                deleteItems(objects, () => {
                    copyToClipboard(cliboardText);
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
            let objects = this.selectedItems.map(item => item.object);
            if (objects.length == 1) {
                copyItem(objects[0]);
            } else {
                copyToClipboard(
                    getDocumentStore(this.object).objectsToClipboardData(
                        objects
                    )
                );
            }
        }
    }

    canPaste() {
        const DocumentStore = getDocumentStore(this.object);

        if (this.selectedItems.length == 0) {
            if (canPaste(DocumentStore, this.object)) {
                return true;
            }
            return false;
        }

        if (this.selectedItems.length == 1) {
            if (canPaste(DocumentStore, this.selectedItems[0].object)) {
                return true;
            }
            return false;
        }

        const allObjectsAreFromTheSameParent = !this.selectedItems.find(
            selectedItem =>
                getParent(selectedItem.object) !==
                getParent(this.selectedItems[0].object)
        );
        if (allObjectsAreFromTheSameParent) {
            if (canPaste(DocumentStore, this.selectedItems[0].object)) {
                return true;
            }
        }

        return false;
    }

    pasteSelection() {
        if (this.canPaste()) {
            let aNewObject;

            if (this.selectedItems.length == 0) {
                aNewObject = pasteItem(this.object);
            } else {
                aNewObject = pasteItem(this.selectedItems[0].object);
            }

            if (aNewObject) {
                if (Array.isArray(aNewObject)) {
                    this.selectObjects(aNewObject);
                } else {
                    this.selectObject(aNewObject);
                }
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
            this.selectItems([]);
            deleteItems(objects);
        }
    }

    createSelectionContextMenu() {
        if (this.selectedItems.length == 1) {
            return createContextMenu(this, this.selectedItems[0].object);
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
                if (
                    getParent(selectedObjects[i]) !==
                    getParent(selectedObjects[0])
                ) {
                    break;
                }
            }
            if (i == selectedObjects.length) {
                extendContextMenu(
                    this,
                    selectedObjects[0],
                    selectedObjects,
                    menuItems
                );
            }
        }

        if (menuItems.length > 0) {
            const menu = new Menu();
            menuItems.forEach(menuItem => menu.append(menuItem));
            return menu;
        }

        return undefined;
    }

    showSelectionContextMenu() {
        let menu = this.createSelectionContextMenu();

        if (menu) {
            menu.popup({});
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

    sortDirection?: SortDirectionType;

    getItemId(item: ITreeItem): string;
    getItemFromId(id: string): ITreeItem | undefined;
    getItemParent(item: ITreeItem): ITreeItem | undefined;
    itemToString(item: ITreeItem): string;
    isAncestor(item: ITreeItem, ancestor: ITreeItem): boolean;

    isSelected(item: ITreeItem): boolean;
    selectItem(item: ITreeItem): void;
    selectItems(items: ITreeItem[]): void;
    toggleSelected(item: ITreeItem): void;
    showSelectionContextMenu(): void;
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
        private filter?: (object: IEezObject) => boolean,
        private collapsable?: boolean,
        public sortDirection?: SortDirectionType,
        public maxLevel?: number,
        onDoubleClick?: (object: IEezObject) => void
    ) {
        this.onDoubleClickCallback = onDoubleClick;
    }

    onDoubleClickCallback: ((object: IEezObject) => void) | undefined;

    get allRows() {
        const { filter, collapsable, sortDirection, maxLevel } = this;

        const draggable = true;

        const children: ITreeRow[] = [];

        function getChildren(item: ITreeObjectAdapter) {
            let itemChildren = _map(
                item.children,
                childItem => childItem
            ) as ITreeObjectAdapter[];

            if (sortDirection === "asc") {
                itemChildren = itemChildren.sort((a, b) =>
                    stringCompare(getLabel(a.object), getLabel(b.object))
                );
            } else if (sortDirection === "desc") {
                itemChildren = itemChildren.sort((a, b) =>
                    stringCompare(getLabel(b.object), getLabel(a.object))
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

                        const maxLevelReached =
                            maxLevel !== undefined && level === maxLevel;

                        if (
                            !maxLevelReached &&
                            childItem.expanded &&
                            childItems.length > 0
                        ) {
                            enumChildren(childItems, level + 1);
                        }

                        row.collapsable =
                            collapsable! &&
                            !maxLevelReached &&
                            (childItems.length > 0 ||
                                canContainChildren(childItem.object));
                    }
                }
            });
        }

        enumChildren(getChildren(this.item || this.rootItem), 0);

        return children;
    }

    getItemId(item: ITreeObjectAdapter) {
        return getId(item.object);
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

    isAncestor(
        item: ITreeObjectAdapter,
        ancestor: ITreeObjectAdapter
    ): boolean {
        return isAncestor(item.object, ancestor.object);
    }

    isSelected(item: ITreeObjectAdapter) {
        return item.selected;
    }

    selectItem(item: ITreeObjectAdapter) {
        this.rootItem.selectItems([item]);
    }

    selectItems(items: ITreeObjectAdapter[]) {
        this.rootItem.selectItems(items);
    }

    selectObject(object: IEezObject) {
        const item = this.getItemFromId(getId(object));
        if (item) {
            this.selectItem(item);
        }
    }

    selectObjects(objects: IEezObject[]) {
        objects.forEach(object => {
            const item = this.getItemFromId(getId(object));
            if (item) {
                this.selectItem(item);
            }
        });
    }

    toggleSelected(item: ITreeObjectAdapter): void {
        this.rootItem.toggleSelected(item);
    }

    showSelectionContextMenu() {
        this.rootItem.showSelectionContextMenu();
    }

    cutSelection() {
        this.rootItem.cutSelection();
    }

    copySelection() {
        this.rootItem.copySelection();
    }

    pasteSelection() {
        this.rootItem.pasteSelection();
    }

    deleteSelection() {
        this.rootItem.deleteSelection();
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
        return this;
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
        event.dataTransfer.setDragImage(
            DragAndDropManager.blankDragImage,
            0,
            0
        );
        // postpone render, otherwise we can receive onDragEnd immediatelly
        const DocumentStore = getDocumentStore(this.rootItem.object);
        setTimeout(() => {
            DragAndDropManager.start(event, item.object, DocumentStore);
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
            let object = JSON.parse(
                objectToJson(DragAndDropManager.dragObject)
            );

            let dropItem = DragAndDropManager.dropObject as ITreeObjectAdapter;

            let aNewObject: IEezObject | undefined;

            const DocumentStore = getDocumentStore(this.rootItem.object);

            if (dropPosition == DropPosition.DROP_POSITION_BEFORE) {
                aNewObject = DocumentStore.insertObjectBefore(
                    dropItem.object,
                    object
                );
            } else if (dropPosition == DropPosition.DROP_POSITION_AFTER) {
                aNewObject = DocumentStore.insertObjectAfter(
                    dropItem.object,
                    object
                );
            } else if (dropPosition == DropPosition.DROP_POSITION_INSIDE) {
                let dropPlace = findPastePlaceInside(
                    dropItem.object,
                    getClassInfo(DragAndDropManager.dragObject),
                    true
                );
                if (dropPlace) {
                    if (isArray(dropPlace as IEezObject)) {
                        aNewObject = DocumentStore.addObject(
                            dropPlace as IEezObject,
                            object
                        );
                    } else {
                        DocumentStore.updateObject(dropItem.object, {
                            [(dropPlace as PropertyInfo).name]: object
                        });
                    }
                }
            }

            if (aNewObject) {
                this.selectObject(aNewObject);
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
                isObjectInstanceOf(
                    dragObject,
                    getClassInfo(getParent(dropItem.object))
                )
            )
        ) {
            return false;
        }

        // check: it makes no sense to drop dragObject before or after itself
        if (dropItem.object === dragObject) {
            return false;
        }

        if (getParent(dropItem.object) === getParent(dragObject)) {
            if (dropPosition === DropPosition.DROP_POSITION_BEFORE) {
                if (prevObjectId !== getId(dragObject)) {
                    return true;
                }
            } else if (dropPosition === DropPosition.DROP_POSITION_AFTER) {
                if (nextObjectId !== getId(dragObject)) {
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
            getClassInfo(DragAndDropManager.dragObject!),
            true
        );
    }

    get dropItem(): ITreeObjectAdapter | undefined {
        return DragAndDropManager.dropObject as ITreeObjectAdapter | undefined;
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
    constructor(public object: IEezObject) {}

    @observable selected: boolean = false;

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
    navigationStore: INavigationStore;
    dragAndDropManager: DragAndDropManagerClass;

    dispose: IReactionDisposer;

    constructor(
        private object: IEezObject,
        public sortDirection?: SortDirectionType,
        onDoubleClick?: (object: IEezObject) => void,
        navigationStore?: INavigationStore,
        dragAndDropManager?: DragAndDropManagerClass,
        private searchText?: string,
        private filter?: (object: IEezObject) => boolean
    ) {
        this.onDoubleClickCallback = onDoubleClick;

        const DocumentStore = getDocumentStore(this.object);

        this.navigationStore = navigationStore || DocumentStore.NavigationStore;
        this.dragAndDropManager = dragAndDropManager || DragAndDropManager;

        this.dispose = autorun(() => {
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

    unmount() {
        this.dispose();
    }

    onDoubleClickCallback: ((object: IEezObject) => void) | undefined;

    parentItem = new ListItem(this.object);

    @computed
    get items() {
        let objects = this.object as IEezObject[];

        const filter = this.filter;
        if (filter) {
            objects = objects.filter(object => filter(object));
        }

        if (this.searchText) {
            const searchText = this.searchText.toLowerCase();
            objects = objects.filter(object => {
                return (
                    objectToString(object).toLowerCase().indexOf(searchText) !=
                    -1
                );
            });
        }

        let items = objects.map(object => new ListItem(object));

        if (this.sortDirection === "asc") {
            return items.sort((a, b) =>
                stringCompare(getLabel(a.object), getLabel(b.object))
            );
        }

        if (this.sortDirection === "desc") {
            return items.sort((a, b) =>
                stringCompare(getLabel(b.object), getLabel(a.object))
            );
        }

        return items;
    }

    get allRows() {
        return this.items;
    }

    maxLevel = 0;

    getItemId(item: ListItem) {
        return getId(item.object);
    }

    getItemFromId(id: string) {
        return this.items.find(item => getId(item.object) === id);
    }

    getItemParent(item: ListItem) {
        if (item === this.parentItem) {
            return undefined;
        }
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
        const item = this.navigationStore.getNavigationSelectedItem(
            this.object
        );

        if (item && isObjectNavigationItem(item)) {
            return this.getItemFromId(getId(item.object));
        }

        return undefined;
    }

    @action
    selectItem(item: ListItem): void {
        if (
            getParent(item.object) &&
            !isPartOfNavigation(getParent(item.object))
        ) {
            this.navigationStore.setNavigationSelectedItem(
                this.object,
                createObjectNavigationItem(item.object)!
            );
            return;
        }

        let selectedItem = this.selectedItem;
        if (selectedItem) {
            selectedItem.selected = false;
        }

        this.navigationStore.setNavigationSelectedItem(
            this.object,
            createObjectNavigationItem(item.object)!
        );

        selectedItem = this.selectedItem;
        if (selectedItem) {
            selectedItem.selected = true;
        }
    }

    @action
    selectItems(items: ListItem[]): void {
        if (items[0]) {
            this.selectItem(items[0]);
        }
    }

    selectObject(object: IEezObject): void {
        const item = this.getItemFromId(getId(object));
        if (item) {
            this.selectItem(item);
        }
    }

    selectObjects(objects: IEezObject[]): void {
        objects.forEach(object => {
            const item = this.getItemFromId(getId(object));
            if (item) {
                this.selectItem(item);
            }
        });
    }

    toggleSelected(item: ListItem): void {
        this.selectItem(item);
    }

    showSelectionContextMenu(): void {
        showContextMenu(
            this,
            this.selectedItem ? this.selectedItem.object : this.object
        );
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
        const aNewObject = pasteItem(this.selectedItem?.object ?? this.object);
        if (aNewObject) {
            if (Array.isArray(aNewObject)) {
                this.selectObjects(aNewObject);
            } else {
                this.selectObject(aNewObject);
            }
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
        return this;
    }

    get isDragging() {
        return !!this.dragAndDropManager.dragObject;
    }

    isDragSource(item: ListItem) {
        return this.dragAndDropManager.dragObject === item.object;
    }

    onDragStart(item: ListItem, event: any) {
        event.dataTransfer.effectAllowed = "copyMove";
        setClipboardData(event, objectToClipboardData(item.object));
        event.dataTransfer.setDragImage(
            this.dragAndDropManager.blankDragImage,
            0,
            0
        );
        // postpone render, otherwise we can receive onDragEnd immediatelly
        const DocumentStore = getDocumentStore(this.object);
        setTimeout(() => {
            this.dragAndDropManager.start(event, item.object, DocumentStore);
        });
    }

    onDrag(event: any) {
        this.dragAndDropManager.drag(event);
    }

    onDragEnd(event: any) {
        this.dragAndDropManager.end(event);
    }

    onDragOver(dropItem: ListItem | undefined, event: any) {
        if (dropItem) {
            event.preventDefault();
            event.stopPropagation();
            this.dragAndDropManager.setDropEffect(event);
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
        this.dragAndDropManager.deleteDragItem();

        if (this.dragAndDropManager.dragObject) {
            let object = objectToJson(this.dragAndDropManager.dragObject);

            let dropItem = this.dragAndDropManager.dropObject as ListItem;

            const DocumentStore = getDocumentStore(this.object);

            if (dropPosition == DropPosition.DROP_POSITION_BEFORE) {
                DocumentStore.insertObjectBefore(dropItem.object, object);
            } else if (dropPosition == DropPosition.DROP_POSITION_AFTER) {
                DocumentStore.insertObjectAfter(dropItem.object, object);
            }
        }

        this.dragAndDropManager.end(event);
    }

    isAncestorOfDragObject(dropItem: ListItem) {
        return isAncestor(dropItem.object, this.dragAndDropManager.dragObject!);
    }

    canDrop(
        dropItem: ListItem,
        dropPosition: DropPosition,
        prevObjectId: string | undefined,
        nextObjectId: string | undefined
    ): boolean {
        if (!this.navigationStore.editable) {
            return false;
        }

        const dragObject = this.dragAndDropManager.dragObject!;

        // check: can't drop object if parent can't accept it
        if (!isObjectInstanceOf(dragObject, getClassInfo(this.object))) {
            return false;
        }

        // check: it makes no sense to drop dragObject before or after itself
        if (dropItem.object === dragObject) {
            return false;
        }

        if (getParent(dropItem.object) === getParent(dragObject)) {
            if (dropPosition === DropPosition.DROP_POSITION_BEFORE) {
                if (prevObjectId !== getId(dragObject)) {
                    return true;
                }
            } else if (dropPosition === DropPosition.DROP_POSITION_AFTER) {
                if (nextObjectId !== getId(dragObject)) {
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
        return this.dragAndDropManager.dropObject as ListItem | undefined;
    }

    set dropItem(value: ListItem | undefined) {
        if (value) {
            this.dragAndDropManager.setDropObject(value);
        } else {
            this.dragAndDropManager.unsetDropObject();
        }
    }
}
