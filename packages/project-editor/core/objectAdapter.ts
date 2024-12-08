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
import { map, find, each, pickBy } from "lodash";

import { stringCompare } from "eez-studio-shared/string";
import { Point, Rect } from "eez-studio-shared/geometry";

import {
    getProperty,
    IEezObject,
    PropertyType,
    isAncestor,
    isPropertyEnumerable,
    PropertyInfo,
    getParent,
    getId,
    EezObject,
    setKey,
    getKey
} from "project-editor/core/object";

import {
    canDuplicate,
    canCut,
    canCopy,
    canDelete,
    extendContextMenu,
    cutItem,
    pasteItem,
    deleteItems,
    canContainChildren,
    getProjectStore,
    copyProjectEditorDataToClipboard,
    setClipboardData,
    objectToClipboardData,
    findPastePlaceInside,
    objectToString,
    isShowOnlyChildrenInTree,
    isArrayElement,
    isObjectInstanceOf,
    getClassInfo,
    getLabel,
    createObject,
    getClass,
    canAdd,
    addItem,
    isObjectReferencable,
    canContain,
    getProjectEditorDataFromClipboard,
    getAncestorOfType,
    getAddItemName
} from "project-editor/store";

import { DragAndDropManager } from "project-editor/core/dd";

import type { IResizeHandler } from "project-editor/flow/flow-interfaces";
import { onAfterPaste } from "project-editor/core/util";
import { ProjectEditor } from "project-editor/project-editor-interface";

import { isArray } from "eez-studio-shared/util";

////////////////////////////////////////////////////////////////////////////////

export class TreeObjectAdapter {
    protected transformer: (object: IEezObject) => TreeObjectAdapter;

    selected: boolean;
    expanded: boolean;

    constructor(
        public object: IEezObject,
        transformer?: (object: IEezObject) => TreeObjectAdapter,
        expanded?: boolean
    ) {
        this.expanded = expanded ?? false;

        makeObservable(this, {
            selected: observable,
            expanded: observable,
            children: computed({ keepAlive: true }),
            rect: computed,
            selectedItems: computed,
            selectedObject: computed,
            selectedObjects: computed,
            selectItem: action,
            deselectItem: action,
            selectItems: action,
            selectObjects: action,
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

    get children() {
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
            }, [] as TreeObjectAdapter[]);
        }

        return properties.reduce(
            (children, propertyInfo) => {
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
            },
            {} as {
                [key: string]: TreeObjectAdapter;
            }
        );
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

    get selectedItems(): TreeObjectAdapter[] {
        let items: TreeObjectAdapter[] = [];

        if (this.selected) {
            items.push(this);
        }

        each(this.children, (item: any) => {
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

    selectItem(item: TreeObjectAdapter) {
        item.selected = true;

        for (
            let parent = this.getParent(item);
            parent;
            parent = this.getParent(parent)
        ) {
            parent.expanded = true;
        }
    }

    deselectItem(item: TreeObjectAdapter) {
        item.selected = false;
    }

    selectItems(items: TreeObjectAdapter[]) {
        // deselect previously selected items
        this.selectedItems.forEach(item => (item.selected = false));

        // select items
        items.forEach(item => this.selectItem(item));
    }

    selectObjects(objects: IEezObject[]) {
        const items: TreeObjectAdapter[] = [];
        for (const object of objects) {
            const item = this.getAncestorObjectAdapter(object);
            if (item) {
                items.push(item);
            }
        }
        this.selectItems(items);
    }

    selectObject(object: IEezObject) {
        let objectAdapter = this.getAncestorObjectAdapter(object);
        if (objectAdapter) {
            this.selectItems([objectAdapter]);
        } else {
            this.selectItems([]);
        }
    }

    toggleSelected(item: TreeObjectAdapter) {
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

            each(state, (value: any, key: any) => {
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
                each(
                    pickBy(
                        treeObjectAdapter.children,
                        (childItem: TreeObjectAdapter) =>
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
        const map = new Map<string, TreeObjectAdapter>();

        function makeMap(objectAdapter: TreeObjectAdapter) {
            map.set(getId(objectAdapter.object), objectAdapter);
            each(objectAdapter.children, makeMap);
        }

        makeMap(this);

        return map;
    }

    getObjectAdapter(
        objectAdapterOrObjectOrObjectId: IEezObject | string
    ): TreeObjectAdapter | undefined {
        if (typeof objectAdapterOrObjectOrObjectId === "string") {
            return this.objectIdMap.get(objectAdapterOrObjectOrObjectId);
        }
        return this.objectIdMap.get(getId(objectAdapterOrObjectOrObjectId));
    }

    getAncestorObjectAdapter(object: IEezObject) {
        if (!isAncestor(object, this.object)) {
            return undefined;
        }

        let objectAdapter: TreeObjectAdapter = this;
        while (true) {
            let childObjectAdapter = find(
                objectAdapter.children,
                (treeObjectAdpterChild: any) => {
                    let child: TreeObjectAdapter = treeObjectAdpterChild;
                    return isAncestor(object, child.object);
                }
            );
            if (!childObjectAdapter) {
                return objectAdapter;
            }
            objectAdapter = childObjectAdapter as any;
        }
    }

    getParent(item: TreeObjectAdapter) {
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
                let cliboardText = getProjectStore(
                    this.object
                ).objectsToClipboardData(objects);

                deleteItems(objects, () => {
                    copyProjectEditorDataToClipboard(cliboardText);
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
            copyProjectEditorDataToClipboard(
                getProjectStore(this.object).objectsToClipboardData(objects)
            );
        }
    }

    canPaste() {
        return (
            getProjectEditorDataFromClipboard(
                ProjectEditor.getProjectStore(this.object)
            ) != undefined
        );
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
                if (isArray(newObject)) {
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
            add?: boolean;
            pasteSelection?: () => void;
            duplicateSelection?: () => void;
            atPoint?: Point;
        },
        editable?: boolean,
        additionalMenuItems?: Electron.MenuItem[]
    ) {
        let menuItems: Electron.MenuItem[] = [];

        if (editable == undefined) {
            editable = true;
        }

        const selectedObject = (() => {
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
                    return selectedObjects[0];
                }
            }
            return undefined;
        })();

        let parentObject: IEezObject | undefined;
        if (selectedObject) {
            parentObject = getParent(selectedObject);
        } else {
            parentObject = this.object;
        }

        if (
            editable &&
            parentObject &&
            !(parentObject instanceof ProjectEditor.FlowClass) &&
            canAdd(parentObject) &&
            !(actions?.add === false)
        ) {
            menuItems.push(
                new MenuItem({
                    label: `Add ${getAddItemName(parentObject)}...`,
                    click: async () => {
                        const aNewObject = await addItem(parentObject!);
                        if (aNewObject) {
                            ProjectEditor.navigateTo(aNewObject);
                        }
                    }
                })
            );
        }

        if (
            editable &&
            !(selectedObject instanceof ProjectEditor.ConnectionLineClass) &&
            this.canDuplicate()
        ) {
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

        if (
            selectedObject &&
            isArrayElement(selectedObject) &&
            isObjectReferencable(selectedObject)
        ) {
            if (menuItems.length > 0) {
                menuItems.push(
                    new MenuItem({
                        type: "separator"
                    })
                );
            }

            menuItems.push(
                new MenuItem({
                    label: "Find All References",
                    click: () => {
                        ProjectEditor.getProjectStore(
                            selectedObject
                        ).findAllReferences(selectedObject);
                    }
                })
            );
        }

        let clipboardMenuItems: Electron.MenuItem[] = [];

        if (
            editable &&
            !(selectedObject instanceof ProjectEditor.ConnectionLineClass) &&
            this.canCut()
        ) {
            clipboardMenuItems.push(
                new MenuItem({
                    label: "Cut",
                    click: () => {
                        this.cutSelection();
                    }
                })
            );
        }

        if (
            editable &&
            !(selectedObject instanceof ProjectEditor.ConnectionLineClass) &&
            this.canCopy()
        ) {
            clipboardMenuItems.push(
                new MenuItem({
                    label: "Copy",
                    click: () => {
                        this.copySelection();
                    }
                })
            );
        }

        if (
            editable &&
            !(selectedObject instanceof ProjectEditor.ConnectionLineClass) &&
            this.canPaste()
        ) {
            clipboardMenuItems.push(
                new MenuItem({
                    label: "Paste",
                    click: () => {
                        if (actions?.pasteSelection) {
                            actions.pasteSelection();
                        } else {
                            const projectStore = getProjectStore(this.object);
                            projectStore.paste();
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

        if (selectedObject) {
            extendContextMenu(
                this,
                selectedObject,
                this.selectedObjects,
                menuItems,
                editable
            );
        }

        if (additionalMenuItems) {
            if (menuItems.length > 0) {
                menuItems.push(
                    new MenuItem({
                        type: "separator"
                    })
                );
            }
            menuItems = menuItems.concat(additionalMenuItems);
        }

        if (
            editable &&
            getAncestorOfType(
                selectedObject || parentObject,
                ProjectEditor.FlowClass.classInfo
            ) &&
            getKey(parentObject) != "localVariables" &&
            getKey(parentObject) != "actions" &&
            getKey(parentObject) != "userPages" &&
            getKey(parentObject) != "userWidgets"
        ) {
            ProjectEditor.newComponentMenuItem(
                selectedObject || parentObject,
                menuItems,
                actions?.atPoint
            );
        }

        if (menuItems.length > 0) {
            // remove separator at the end
            if (menuItems[menuItems.length - 1].type == "separator") {
                menuItems.splice(menuItems.length - 1, 1);
            }

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
}

////////////////////////////////////////////////////////////////////////////////

export interface ITreeRow {
    item: TreeObjectAdapter;
    level: number;
    draggable: boolean;
    collapsable: boolean;
}

export type SortDirectionType = "asc" | "desc" | "none";

export enum DropPosition {
    DROP_POSITION_NONE,
    DROP_POSITION_BEFORE,
    DROP_POSITION_AFTER,
    DROP_POSITION_INSIDE
}

export class TreeAdapter {
    constructor(
        public rootItem: TreeObjectAdapter,
        protected selectedObject?: IObservableValue<IEezObject | undefined>,
        private filter?: (object: IEezObject) => boolean,
        private collapsable?: boolean,
        public sortDirection?: SortDirectionType,
        public maxLevel?: number,
        onClick?: (object: IEezObject) => void,
        onDoubleClick?: (object: IEezObject) => void,
        protected searchText?: string,
        protected editable?: boolean,
        protected hideRootItem?: boolean
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

    get draggable() {
        // return (
        //     (this.sortDirection === undefined ||
        //         this.sortDirection === "none") &&
        //     !this.searchText
        // );
        return true;
    }

    get allRows() {
        const { filter, collapsable, sortDirection, maxLevel, searchText } =
            this;

        const draggable = true;

        const children: ITreeRow[] = [];

        const getChildren = (
            item: TreeObjectAdapter,
            hideRootItem: boolean
        ): TreeObjectAdapter[] => {
            let itemChildren = map(
                item.children,
                childItem => childItem
            ) as TreeObjectAdapter[];

            itemChildren;

            if (filter) {
                itemChildren = itemChildren.filter(item => filter(item.object));
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

            if (itemChildren.length == 1 && hideRootItem) {
                return getChildren(itemChildren[0], false);
            }

            return itemChildren;
        };

        function enumChildren(childItems: TreeObjectAdapter[], level: number) {
            childItems.forEach(childItem => {
                const showOnlyChildren =
                    childItem.children.length == 1 &&
                    isArray(childItem.object) &&
                    isShowOnlyChildrenInTree(childItem.object);

                let childItems = getChildren(childItem, false);

                if (showOnlyChildren) {
                    enumChildren(childItems, level);
                } else {
                    const row = {
                        item: childItem,
                        level,
                        draggable,
                        collapsable: false
                    };

                    const savedIndex = children.length;

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

                    if (
                        savedIndex < children.length ||
                        !searchText ||
                        objectToString(row.item.object)
                            .toLowerCase()
                            .indexOf(searchText.toLowerCase()) != -1
                    ) {
                        children.splice(savedIndex, 0, row);
                    }
                }
            });
        }

        enumChildren(getChildren(this.rootItem, this.hideRootItem ?? false), 0);

        return children;
    }

    getShowTreeCollapseIcon(item: TreeObjectAdapter) {
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
        return (
            (isArray(item.children) && item.children.length > 0) ||
            Object.keys(item.children).length > 0
        );
    }

    getItemId(item: TreeObjectAdapter) {
        return getId(item.object);
    }

    getItemObject(item: TreeObjectAdapter) {
        return item.object;
    }

    getItemFromId(id: string): TreeObjectAdapter | undefined {
        return this.rootItem.getObjectAdapter(id);
    }

    getItemParent(item: TreeObjectAdapter): TreeObjectAdapter | undefined {
        return this.rootItem.getParent(item);
    }

    itemToString(item: TreeObjectAdapter) {
        const classInfo = getClassInfo(item.object);
        if (classInfo.listLabel) {
            return classInfo.listLabel(item.object, true);
        }

        return objectToString(item.object);
    }

    isAncestor(item: TreeObjectAdapter, ancestor: TreeObjectAdapter): boolean {
        return isAncestor(item.object, ancestor.object);
    }

    anySelected() {
        return this.rootItem.selectedItems.length > 0;
    }

    isSelected(item: TreeObjectAdapter) {
        return item.selected;
    }

    selectItem(item: TreeObjectAdapter) {
        runInAction(() => {
            if (this.selectedObject) {
                this.selectedObject.set(item.object);
            }

            ProjectEditor.selectObject(item.object);
        });

        this.rootItem.selectItems([item]);
    }

    selectItems(items: TreeObjectAdapter[]) {
        this.rootItem.selectItems(items);
    }

    expandItem(item: TreeObjectAdapter) {
        if (!item.expanded) {
            runInAction(() => {
                item.expanded = true;
            });
        }
        const parent = this.getItemParent(item);
        if (parent) {
            this.expandItem(parent);
        }
    }

    selectObject(object: IEezObject) {
        const item = this.getItemFromId(getId(object));
        if (item) {
            this.selectItem(item);

            const parent = this.getItemParent(item);
            if (parent) {
                this.expandItem(parent);
            }
        }
    }

    toggleSelected(item: TreeObjectAdapter): void {
        this.rootItem.toggleSelected(item);
    }

    showSelectionContextMenu() {
        this.rootItem.showSelectionContextMenu(this.editable ?? true);
    }

    canCut() {
        return this.rootItem.canCut();
    }

    cutSelection() {
        this.rootItem.cutSelection();
    }

    canCopy() {
        return this.rootItem.canCopy();
    }

    copySelection() {
        this.rootItem.copySelection();
    }

    canPaste() {
        return this.rootItem.canPaste();
    }

    pasteSelection() {
        this.rootItem.pasteSelection();
    }

    canDelete() {
        return this.rootItem.canDelete();
    }

    deleteSelection() {
        this.rootItem.deleteSelection();
    }

    get collapsableAdapter(): TreeAdapter | undefined {
        return this.collapsable ? this : undefined;
    }

    isExpanded(item: TreeObjectAdapter) {
        return item.expanded;
    }

    toggleExpanded(item: TreeObjectAdapter): void {
        item.toggleExpanded();
    }

    onClick(item: TreeObjectAdapter): void {
        if (this.onClickCallback) {
            this.onClickCallback(item.object);
        }
    }

    onDoubleClick(item: TreeObjectAdapter): void {
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

    isDragSource(item: TreeObjectAdapter) {
        return DragAndDropManager.dragObject === item.object;
    }

    onDragStart(item: TreeObjectAdapter, event: any) {
        const projectStore = getProjectStore(this.rootItem.object);

        event.dataTransfer.effectAllowed = "copyMove";
        setClipboardData(
            event,
            objectToClipboardData(projectStore, item.object)
        );
        event.dataTransfer.setDragImage(
            DragAndDropManager.blankDragImage,
            0,
            0
        );

        // postpone render, otherwise we can receive onDragEnd immediatelly
        setTimeout(() => {
            DragAndDropManager.start(event, item.object as any, projectStore);
        });
    }

    onDrag(row: TreeObjectAdapter, event: any) {
        DragAndDropManager.drag(event);
    }

    onDragEnd(event: any) {
        DragAndDropManager.end(event);
    }

    onDragOver(dropItem: TreeObjectAdapter | undefined, event: any) {
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
            const projectStore = getProjectStore(this.rootItem.object);

            const dragObjectClone =
                DragAndDropManager.dropEffect == "copy"
                    ? (createObject(
                          projectStore,
                          toJS(DragAndDropManager.dragObject) as any,
                          getClass(DragAndDropManager.dragObject),
                          undefined,
                          true
                      ) as EezObject)
                    : DragAndDropManager.dragObject;

            let dropItem = DragAndDropManager.dropObject as TreeObjectAdapter;

            let aNewObject: IEezObject | undefined;

            if (dropPosition == DropPosition.DROP_POSITION_BEFORE) {
                DragAndDropManager.deleteDragItem(true, {
                    dropPlace: getParent(dropItem.object)
                });
                aNewObject = projectStore.insertObjectBefore(
                    dropItem.object,
                    dragObjectClone
                );
            } else if (dropPosition == DropPosition.DROP_POSITION_AFTER) {
                DragAndDropManager.deleteDragItem(true, {
                    dropPlace: getParent(dropItem.object)
                });
                aNewObject = projectStore.insertObjectAfter(
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
                    DragAndDropManager.deleteDragItem(true, {
                        dropPlace
                    });

                    if (isArray(dropPlace as any)) {
                        aNewObject = projectStore.addObject(
                            dropPlace as any,
                            dragObjectClone
                        );
                    } else {
                        projectStore.updateObject(dropItem.object, {
                            [(dropPlace as PropertyInfo).name]: dragObjectClone
                        });
                        setKey(
                            dragObjectClone,
                            (dropPlace as PropertyInfo).name
                        );
                        aNewObject = dragObjectClone;
                    }
                }
            }

            if (aNewObject) {
                this.selectObject(aNewObject);
            }
        }

        DragAndDropManager.end(event);
    }

    isAncestorOfDragObject(dropItem: TreeObjectAdapter) {
        return isAncestor(dropItem.object, DragAndDropManager.dragObject!);
    }

    canDrop(
        dropItem: TreeObjectAdapter,
        dropPosition: DropPosition,
        prevObjectId: string | undefined,
        nextObjectId: string | undefined
    ): boolean {
        const dragObject = DragAndDropManager.dragObject;
        if (!dragObject) {
            return false;
        }

        if (!canContain(dropItem.object, dragObject)) {
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

    canDropInside(dropItem: TreeObjectAdapter) {
        if (!canContain(dropItem.object, DragAndDropManager.dragObject!)) {
            return false;
        }

        return !!findPastePlaceInside(
            dropItem.object,
            getClassInfo(DragAndDropManager.dragObject!),
            true
        );
    }

    get dropItem(): TreeObjectAdapter | undefined {
        return DragAndDropManager.dropObject as TreeObjectAdapter | undefined;
    }

    set dropItem(value: TreeObjectAdapter | undefined) {
        if (value) {
            DragAndDropManager.setDropObject(value);
        } else {
            DragAndDropManager.unsetDropObject();
        }
    }
}
