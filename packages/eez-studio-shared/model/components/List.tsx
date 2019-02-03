import React from "react";
import { observable, computed, action } from "mobx";
import { observer } from "mobx-react";

import { _each, _find, _pickBy, _isEqual, _map } from "eez-studio-shared/algorithm";

import { EezObject, EezArrayObject, asArray } from "eez-studio-shared/model/object";
import {
    ITreeObjectAdapter,
    TreeObjectAdapterChildren
} from "eez-studio-shared/model/objectAdapter";
import {
    NavigationStore,
    IMenuAnchorPosition,
    createContextMenu,
    showContextMenu,
    canCut,
    cutItem,
    canCopy,
    copyItem,
    canPaste,
    pasteItem,
    canDelete,
    deleteItem
} from "eez-studio-shared/model/store";

import { Tree, SortDirectionType } from "eez-studio-shared/model/components/Tree";

export { SortDirectionType } from "eez-studio-shared/model/components/Tree";

////////////////////////////////////////////////////////////////////////////////

class ListParentTreeObjectAdapter implements ITreeObjectAdapter {
    constructor(public object: EezObject) {
        setTimeout(
            action(() => {
                if (this.selectedItem) {
                    this.selectedItem.selected = true;
                }
            })
        );
    }

    selected = false;
    expanded = true;

    @computed
    get children(): TreeObjectAdapterChildren {
        const array = asArray(this.object);
        if (array) {
            return array.map(object => new ListChildTreeObjectAdapter(object, this));
        }

        return [];
    }

    @computed
    get hasChildren() {
        return this.children.length > 0;
    }

    @computed
    get selectedItems(): ITreeObjectAdapter[] {
        return this.selectedItem ? [this.selectedItem] : [];
    }

    @computed
    get selectedObject(): EezObject | undefined {
        const item = NavigationStore.getNavigationSelectedItem(this.object);

        if (item instanceof EezObject) {
            return item;
        }

        if (this.children.length > 0) {
            return (this.children as ITreeObjectAdapter[])[0].object;
        }

        return undefined;
    }

    @computed
    get selectedObjects(): EezObject[] {
        return this.selectedObject ? [this.selectedObject] : [];
    }

    @computed
    get selectedItem(): ITreeObjectAdapter | undefined {
        if (this.selectedObject) {
            return this.getObjectAdapter(this.selectedObject);
        }
        return undefined;
    }

    selectItem(item: ITreeObjectAdapter) {
        this.selectObject(item.object);
    }

    selectItems(items: ITreeObjectAdapter[]) {
        if (items.length === 1) {
            this.selectObject(items[0].object);
        }
    }

    selectObjects(objects: EezObject[]) {
        if (objects.length === 1) {
            this.selectObject(objects[0]);
        }
    }

    selectObjectIds(objectIds: string[]) {
        if (objectIds.length === 1) {
            const item = this.getObjectAdapter(objectIds[0]);
            if (item) {
                this.selectObject(item.object);
            }
        }
    }

    @action
    selectObject(object: EezObject) {
        let selectedItem = this.selectedItem;
        if (selectedItem) {
            selectedItem.selected = false;
        }

        NavigationStore.setNavigationSelectedItem(this.object, object);

        selectedItem = this.selectedItem;
        if (selectedItem) {
            selectedItem.selected = true;
        }
    }

    toggleSelected(item: ITreeObjectAdapter) {}

    toggleExpanded() {}

    loadState(state: any) {}

    saveState() {}

    getObjectAdapter(
        objectAdapterOrObjectOrObjectId:
            | ITreeObjectAdapter
            | EezObject
            | EezArrayObject<EezObject>
            | string
    ): ITreeObjectAdapter | undefined {
        if (typeof objectAdapterOrObjectOrObjectId === "string") {
            if (this.object._id === objectAdapterOrObjectOrObjectId) {
                return this;
            }

            return (this.children as ITreeObjectAdapter[]).find(
                child => child.object._id === objectAdapterOrObjectOrObjectId
            );
        }

        if (
            objectAdapterOrObjectOrObjectId instanceof EezArrayObject ||
            objectAdapterOrObjectOrObjectId instanceof EezObject
        ) {
            return this.getObjectAdapter(objectAdapterOrObjectOrObjectId._id);
        }

        return this.getObjectAdapter(objectAdapterOrObjectOrObjectId.object._id);
    }

    getAncestorObjectAdapter(object: EezObject): ITreeObjectAdapter | undefined {
        if (object._parent === this.object) {
            return this;
        }
        return undefined;
    }

    getParent(item: ITreeObjectAdapter): ITreeObjectAdapter | undefined {
        if (item.object._parent === this.object) {
            return this;
        }
        return undefined;
    }

    getAncestors(item: ITreeObjectAdapter): ITreeObjectAdapter[] {
        if (item.object._parent === this.object) {
            return [this];
        }
        return [];
    }

    canCut(): boolean {
        return false;
    }

    cutSelection() {}

    canCopy(): boolean {
        return false;
    }

    copySelection() {}

    canPaste(): boolean {
        return false;
    }

    pasteSelection() {}

    canDelete(): boolean {
        return false;
    }

    deleteSelection(): void {}

    createSelectionContextMenu() {
        return undefined;
    }

    showSelectionContextMenu(position: IMenuAnchorPosition) {}
}

class ListChildTreeObjectAdapter implements ITreeObjectAdapter {
    constructor(public object: EezObject, private parent: ListParentTreeObjectAdapter) {}

    @observable selected: boolean;
    expanded: boolean = false;

    children = [];

    hasChildren = false;

    get selectedItems(): ITreeObjectAdapter[] {
        return this.parent.selectedItems;
    }

    get selectedObject(): EezObject | undefined {
        return this.parent.selectedObject;
    }

    get selectedObjects(): EezObject[] {
        return this.parent.selectedObjects;
    }

    get selectedItem(): ITreeObjectAdapter | undefined {
        return this.parent.selectedItem;
    }

    selectItem(item: ITreeObjectAdapter) {
        this.parent.selectItem(item);
    }

    selectItems(items: ITreeObjectAdapter[]) {
        this.parent.selectItems(items);
    }

    selectObjects(objects: EezObject[]) {
        this.parent.selectObjects(objects);
    }

    selectObjectIds(objectIds: string[]) {
        this.parent.selectObjectIds(objectIds);
    }

    selectObject(object: EezObject) {
        this.parent.selectObject(object);
    }

    toggleSelected(item: ITreeObjectAdapter) {
        this.parent.toggleSelected(item);
    }

    toggleExpanded() {}

    loadState(state: any) {}

    saveState() {}

    getObjectAdapter(
        objectAdapterOrObjectOrObjectId:
            | ITreeObjectAdapter
            | EezObject
            | EezArrayObject<EezObject>
            | string
    ): ITreeObjectAdapter | undefined {
        return this.parent.getObjectAdapter(objectAdapterOrObjectOrObjectId);
    }

    getAncestorObjectAdapter(object: EezObject): ITreeObjectAdapter | undefined {
        return this.parent.getAncestorObjectAdapter(object);
    }

    getParent(item: ITreeObjectAdapter): ITreeObjectAdapter | undefined {
        return this.parent.getParent(item);
    }

    getAncestors(item: ITreeObjectAdapter): ITreeObjectAdapter[] {
        return this.parent.getAncestors(item);
    }

    canCut(): boolean {
        return !!canCut(this.object);
    }

    cutSelection() {
        cutItem(this.object);
    }

    canCopy(): boolean {
        return !!canCopy(this.object);
    }

    copySelection() {
        copyItem(this.object);
    }

    canPaste(): boolean {
        return !!canPaste(this.object);
    }

    pasteSelection() {
        pasteItem(this.object);
    }

    canDelete(): boolean {
        return !!canDelete(this.object);
    }

    deleteSelection(): void {
        deleteItem(this.object);
    }

    createSelectionContextMenu() {
        return createContextMenu(this.object);
    }

    showSelectionContextMenu(position: IMenuAnchorPosition) {
        showContextMenu(this.object, position);
    }
}

////////////////////////////////////////////////////////////////////////////////

interface ListProps {
    navigationObject: EezObject;
    onDoubleClick?: (object: EezObject) => void;
    tabIndex?: number;
    onFocus?: () => void;
    sortDirection?: SortDirectionType;
}

@observer
export class List extends React.Component<ListProps, {}> {
    @computed
    get rootItem() {
        return new ListParentTreeObjectAdapter(this.props.navigationObject);
    }

    render() {
        const { onDoubleClick, tabIndex, onFocus, sortDirection } = this.props;
        return (
            <Tree
                rootItem={this.rootItem}
                maxLevel={0}
                onDoubleClick={onDoubleClick}
                tabIndex={tabIndex}
                onFocus={onFocus}
                sortDirection={sortDirection}
            />
        );
    }
}
