import { Menu, MenuItem } from "@electron/remote";
import {
    observable,
    action,
    computed,
    runInAction,
    IObservableValue,
    makeObservable,
    toJS
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
import { Rect } from "eez-studio-shared/geometry";

import {
    getProperty,
    IEezObject,
    PropertyType,
    isAncestor,
    isPropertyEnumerable,
    PropertyInfo,
    getParent,
    getId,
    EezObject
} from "project-editor/core/object";

import {
    canDuplicate,
    canCut,
    canCopy,
    canPaste,
    canDelete,
    extendContextMenu,
    cutItem,
    pasteItem,
    deleteItems,
    canContainChildren,
    getProjectEditorStore,
    copyToClipboard,
    setClipboardData,
    objectToClipboardData,
    findPastePlaceInside,
    isArray,
    objectToString,
    isShowOnlyChildrenInTree,
    isArrayElement,
    isObjectInstanceOf,
    getClassInfo,
    getLabel,
    createObject,
    getClass
} from "project-editor/store";

import { DragAndDropManager } from "project-editor/core/dd";

import type { IResizeHandler } from "project-editor/flow/flow-interfaces";
import { IEditorState } from "project-editor/project/EditorComponent";
import { onAfterPaste } from "project-editor/core/util";

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

    showSelectionContextMenu(editable: boolean): void;
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
    deselectItem(item: ITreeObjectAdapter): void;
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
    canDuplicate(): boolean;
    duplicateSelection(): void;
    cutSelection(): void;
    canCut(): boolean;
    cutSelection(): void;
    canCopy(): boolean;
    copySelection(): void;
    canPaste(): boolean;
    pasteSelection(): void;
    canDelete(): boolean;
    deleteSelection(): void;
    createSelectionContextMenu(
        actions?: {
            pasteSelection: () => void;
            duplicateSelection: () => void;
        },
        editable?: boolean
    ): Electron.Menu | undefined;
    showSelectionContextMenu(editable: boolean): void;
}

export class TreeObjectAdapter implements ITreeObjectAdapter {
    protected transformer: (object: IEezObject) => ITreeObjectAdapter;

    selected: boolean;
    expanded: boolean;

    constructor(
        public object: IEezObject,
        transformer?: (object: IEezObject) => ITreeObjectAdapter,
        expanded?: boolean
    ) {
        this.expanded = expanded ?? false;

        makeObservable(this, {
            selected: observable,
            expanded: observable,
            children: computed({ keepAlive: true }),
            rect: computed,
            hasChildren: computed,
            selectedItems: computed,
            selectedObject: computed,
            selectedObjects: computed,
            selectedItem: computed,
            selectItem: action,
            deselectItem: action,
            selectItems: action,
            selectObjects: action,
            selectObjectIds: action,
            selectObject: action,
            toggleSelected: action,
            toggleExpanded: action,
            loadState: action,
            objectIdMap: computed
        });

        if (transformer) {
            this.transformer = transformer;
        } else {
            this.transformer = createTransformer((object: IEezObject) => {
                return new TreeObjectAdapter(
                    object,
                    this.transformer,
                    expanded
                );
            });
        }
    }

    get id() {
        return getId(this.object);
    }

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
                    this.transformer,
                    this.expanded
                );
            } else {
                children[propertyInfo.name] = this.transformer(childObject);
            }

            return children;
        }, {} as TreeObjectAdapterChildrenObject);
    }

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

    get hasChildren() {
        return _map(this.children).length > 0;
    }

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

    get selectedObject() {
        if (this.selectedItems.length == 1) {
            return this.selectedItems[0].object;
        }
        return undefined;
    }

    get selectedObjects() {
        return this.selectedItems.map(item => item.object);
    }

    get selectedItem() {
        if (this.selectedItems.length == 1) {
            return this.selectedItems[0];
        }
        return undefined;
    }

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

    deselectItem(item: ITreeObjectAdapter) {
        item.selected = false;
    }

    selectItems(items: ITreeObjectAdapter[]) {
        // deselect previously selected items
        this.selectedItems.forEach(item => (item.selected = false));

        // select items
        items.forEach(item => this.selectItem(item));
    }

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

    selectObjectIds(objectIds: string[]) {
        const currentlySelectedObjectIds = this.selectedItems.map(item =>
            getId(item.object)
        );
        if (_isEqual(objectIds.sort(), currentlySelectedObjectIds.sort())) {
            return;
        }

        const projectEditorStore = getProjectEditorStore(this.object);

        const objects: IEezObject[] = [];
        for (const objectId of objectIds) {
            const object = projectEditorStore.getObjectFromObjectId(objectId);
            if (object) {
                objects.push(object);
            }
        }

        this.selectObjects(objects);
    }

    selectObject(object: IEezObject) {
        let objectAdapter = this.getAncestorObjectAdapter(object);
        if (objectAdapter) {
            this.selectItems([objectAdapter]);
        } else {
            this.selectItems([]);
        }
    }

    toggleSelected(item: ITreeObjectAdapter) {
        if (item.selected) {
            item.selected = false;
        } else {
            this.selectItem(item);
        }
    }

    toggleExpanded() {
        this.expanded = !this.expanded;
    }

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

    get objectIdMap() {
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

    canDuplicate() {
        if (this.selectedItems.length == 0) {
            return false;
        }

        for (let i = 0; i < this.selectedItems.length; i++) {
            if (!canDuplicate(this.selectedItems[i].object)) {
                return false;
            }
        }

        return true;
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

    duplicateSelection() {
        if (this.canDuplicate()) {
            this.copySelection();
            this.pasteSelection();
        }
    }

    cutSelection() {
        if (this.canCut()) {
            let objects = this.selectedItems.map(
                item => item.object as EezObject
            );
            if (objects.length == 1) {
                cutItem(objects[0]);
            } else {
                let cliboardText = getProjectEditorStore(
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
            if (!canCopy(this.selectedItems[i].object)) {
                return false;
            }
        }

        return true;
    }

    copySelection() {
        if (this.canCopy()) {
            let objects = this.selectedItems.map(
                item => item.object as EezObject
            );
            copyToClipboard(
                getProjectEditorStore(this.object).objectsToClipboardData(
                    objects
                )
            );
        }
    }

    canPaste() {
        const projectEditorStore = getProjectEditorStore(this.object);

        if (this.selectedItems.length == 0) {
            if (canPaste(projectEditorStore, this.object)) {
                return true;
            }
            return false;
        }

        if (this.selectedItems.length == 1) {
            if (canPaste(projectEditorStore, this.selectedItems[0].object)) {
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
            if (canPaste(projectEditorStore, this.selectedItems[0].object)) {
                return true;
            }
        }

        return false;
    }

    pasteSelection() {
        if (this.canPaste()) {
            let newObject;

            let fromObject;
            if (this.selectedItems.length == 0) {
                fromObject = this.object;
            } else {
                fromObject = this.selectedItems[0].object;
            }

            newObject = pasteItem(fromObject);
            if (newObject) {
                onAfterPaste(newObject, fromObject);
                if (Array.isArray(newObject)) {
                    this.selectObjects(newObject);
                } else {
                    this.selectObject(newObject);
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

    createSelectionContextMenu(
        actions?: {
            pasteSelection: () => void;
            duplicateSelection: () => void;
        },
        editable?: boolean
    ) {
        let menuItems: Electron.MenuItem[] = [];

        if (editable == undefined) {
            editable = true;
        }

        if (editable && this.canDuplicate()) {
            menuItems.push(
                new MenuItem({
                    label: "Duplicate",
                    click: () => {
                        if (actions?.duplicateSelection) {
                            actions.duplicateSelection();
                        } else {
                            this.duplicateSelection();
                        }
                    }
                })
            );
        }

        let clipboardMenuItems: Electron.MenuItem[] = [];

        if (editable && this.canCut()) {
            clipboardMenuItems.push(
                new MenuItem({
                    label: "Cut",
                    click: () => {
                        this.cutSelection();
                    }
                })
            );
        }

        if (editable && this.canCopy()) {
            clipboardMenuItems.push(
                new MenuItem({
                    label: "Copy",
                    click: () => {
                        this.copySelection();
                    }
                })
            );
        }

        if (editable && this.canPaste()) {
            clipboardMenuItems.push(
                new MenuItem({
                    label: "Paste",
                    click: () => {
                        if (actions?.pasteSelection) {
                            actions.pasteSelection();
                        } else {
                            this.pasteSelection();
                        }
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

        if (editable && this.canDelete()) {
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
                    menuItems,
                    editable
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

    showSelectionContextMenu(editable: boolean) {
        let menu = this.createSelectionContextMenu(undefined, editable);

        if (menu) {
            menu.popup({});
        }
    }

    selectObjectsAndEnsureVisible(objects: IEezObject[]) {}
}

////////////////////////////////////////////////////////////////////////////////

export interface ITreeItem {}

export interface ITreeRow {
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

    getShowTreeCollapseIcon(item: ITreeItem): boolean;

    sortDirection?: SortDirectionType;

    getItemId(item: ITreeItem): string;
    getItemObject(item: ITreeItem): IEezObject;
    getItemFromId(id: string): ITreeItem | undefined;
    getItemParent(item: ITreeItem): ITreeItem | undefined;
    itemToString(item: ITreeItem): React.ReactNode;
    isAncestor(item: ITreeItem, ancestor: ITreeItem): boolean;

    anySelected(): boolean;

    isSelected(item: ITreeItem): boolean;
    selectItem(item: ITreeItem): void;
    selectItems(items: ITreeItem[]): void;
    toggleSelected(item: ITreeItem): void;
    showSelectionContextMenu(): void;
    cutSelection(): void;
    copySelection(): void;
    pasteSelection(): void;
    deleteSelection(): void;

    onClick(item: ITreeItem): void;
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
        protected selectedObject?: IObservableValue<IEezObject | undefined>,
        private filter?: (object: IEezObject) => boolean,
        private collapsable?: boolean,
        public sortDirection?: SortDirectionType,
        public maxLevel?: number,
        onClick?: (object: IEezObject) => void,
        onDoubleClick?: (object: IEezObject) => void,
        protected searchText?: string,
        protected editable?: boolean
    ) {
        this.onClickCallback = onClick;
        this.onDoubleClickCallback = onDoubleClick;

        if (this.selectedObject) {
            const object = this.selectedObject.get();
            if (object) {
                const childItem = this.rootItem.getObjectAdapter(object);
                if (childItem) {
                    this.rootItem.selectItem(childItem);
                }
            }
        }
    }

    onClickCallback: ((object: IEezObject) => void) | undefined;
    onDoubleClickCallback: ((object: IEezObject) => void) | undefined;

    get allRows() {
        const { filter, collapsable, sortDirection, maxLevel, searchText } =
            this;

        const draggable = true;

        const children: ITreeRow[] = [];

        function getChildren(item: ITreeObjectAdapter) {
            let itemChildren = _map(
                item.children,
                childItem => childItem
            ) as ITreeObjectAdapter[];

            itemChildren;

            if (filter) {
                itemChildren = itemChildren.filter(item => filter(item.object));
            }

            if (searchText) {
                itemChildren = itemChildren.filter(item => {
                    return (
                        objectToString(item.object)
                            .toLowerCase()
                            .indexOf(searchText.toLowerCase()) != -1
                    );
                });
            }

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
                const showOnlyChildren =
                    childItem.children.length == 1 &&
                    isArray(childItem.object) &&
                    isShowOnlyChildrenInTree(childItem.object);

                let childItems = getChildren(childItem);

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
            });
        }

        enumChildren(getChildren(this.rootItem), 0);

        return children;
    }

    getShowTreeCollapseIcon(item: ITreeObjectAdapter) {
        const classInfo = getClassInfo(item.object);
        if (
            !classInfo.showTreeCollapseIcon ||
            classInfo.showTreeCollapseIcon == "always"
        ) {
            return true;
        }
        if (classInfo.showTreeCollapseIcon == "never") {
            return false;
        }
        return item.children.length > 0;
    }

    getItemId(item: ITreeObjectAdapter) {
        return getId(item.object);
    }

    getItemObject(item: ITreeObjectAdapter) {
        return item.object;
    }

    getItemFromId(id: string): ITreeObjectAdapter | undefined {
        return this.rootItem.getObjectAdapter(id);
    }

    getItemParent(item: ITreeObjectAdapter): ITreeObjectAdapter | undefined {
        return this.rootItem.getParent(item);
    }

    itemToString(item: ITreeObjectAdapter) {
        const classInfo = getClassInfo(item.object);
        if (classInfo.listLabel) {
            return classInfo.listLabel(item.object, true);
        }

        return objectToString(item.object);
    }

    isAncestor(
        item: ITreeObjectAdapter,
        ancestor: ITreeObjectAdapter
    ): boolean {
        return isAncestor(item.object, ancestor.object);
    }

    anySelected() {
        return this.rootItem.selectedItems.length > 0;
    }

    isSelected(item: ITreeObjectAdapter) {
        return item.selected;
    }

    selectItem(item: ITreeObjectAdapter) {
        runInAction(() => {
            if (this.selectedObject) {
                this.selectedObject.set(item.object);
            }
        });

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
        this.rootItem.showSelectionContextMenu(this.editable ?? true);
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

    get collapsableAdapter(): TreeAdapter | undefined {
        return this.collapsable ? this : undefined;
    }

    isExpanded(item: ITreeObjectAdapter) {
        return item.expanded;
    }

    toggleExpanded(item: ITreeObjectAdapter): void {
        item.toggleExpanded();
    }

    onClick(item: ITreeObjectAdapter): void {
        if (this.onClickCallback) {
            this.onClickCallback(item.object);
        }
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
        const projectEditorStore = getProjectEditorStore(this.rootItem.object);

        event.dataTransfer.effectAllowed = "copyMove";
        setClipboardData(
            event,
            objectToClipboardData(projectEditorStore, item.object)
        );
        event.dataTransfer.setDragImage(
            DragAndDropManager.blankDragImage,
            0,
            0
        );

        // postpone render, otherwise we can receive onDragEnd immediatelly
        setTimeout(() => {
            DragAndDropManager.start(
                event,
                item.object as any,
                projectEditorStore
            );
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
        event.stopPropagation();
        event.preventDefault();

        if (DragAndDropManager.dragObject) {
            const projectEditorStore = getProjectEditorStore(
                this.rootItem.object
            );

            const dragObjectClone =
                DragAndDropManager.dropEffect == "copy"
                    ? (createObject(
                          projectEditorStore,
                          toJS(DragAndDropManager.dragObject) as any,
                          getClass(DragAndDropManager.dragObject),
                          undefined,
                          true
                      ) as EezObject)
                    : DragAndDropManager.dragObject;

            let dropItem = DragAndDropManager.dropObject as ITreeObjectAdapter;

            let aNewObject: IEezObject | undefined;

            if (dropPosition == DropPosition.DROP_POSITION_BEFORE) {
                DragAndDropManager.deleteDragItem({
                    dropPlace: getParent(dropItem.object)
                });
                aNewObject = projectEditorStore.insertObjectBefore(
                    dropItem.object,
                    dragObjectClone
                );
            } else if (dropPosition == DropPosition.DROP_POSITION_AFTER) {
                DragAndDropManager.deleteDragItem({
                    dropPlace: getParent(dropItem.object)
                });
                aNewObject = projectEditorStore.insertObjectAfter(
                    dropItem.object,
                    dragObjectClone
                );
            } else if (dropPosition == DropPosition.DROP_POSITION_INSIDE) {
                let dropPlace = findPastePlaceInside(
                    dropItem.object,
                    getClassInfo(dragObjectClone),
                    true
                );
                if (dropPlace) {
                    DragAndDropManager.deleteDragItem({
                        dropPlace
                    });

                    if (isArray(dropPlace as any)) {
                        aNewObject = projectEditorStore.addObject(
                            dropPlace as any,
                            dragObjectClone
                        );
                    } else {
                        projectEditorStore.updateObject(dropItem.object, {
                            [(dropPlace as PropertyInfo).name]: dragObjectClone
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
        if (!dragObject) {
            return false;
        }

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
