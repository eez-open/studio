import React from "react";
import { observer } from "mobx-react";
import { action, computed, makeObservable, observable } from "mobx";
import classNames from "classnames";

import { Dialog, showDialog } from "eez-studio-ui/dialog";
import { Icon } from "eez-studio-ui/icon";
import { SearchInput } from "eez-studio-ui/search-input";

import type { EezObject } from "project-editor/core/object";
import type { ProjectStore } from "project-editor/store";
import type { Style } from "project-editor/features/style/style";
import { ProjectEditor } from "project-editor/project-editor-interface";
import { USER_WIDGET_ICON } from "project-editor/ui-components/icons";

////////////////////////////////////////////////////////////////////////////////

// Object with the "id" property. If "id" is defined then object is exported,
// i.e. it can be used in the project for which this project is set as master.
type ExportableObject = EezObject & {
    id: number | undefined;
    name: string;
};

// IDs must be unique inside ID space. Different groups can share the same
// ID space, for example pages and user widgets (both are in project.pages).
interface IdSpace {
    minId: number;
    maxId: number | undefined;
}

////////////////////////////////////////////////////////////////////////////////

class ExportedItem {
    idText: string;

    // ID used for sorting, it is taken from the edited ID only when
    // sorting is requested, so the rows are not reordered while typing
    sortId: number | undefined;

    constructor(
        public group: ExportedItemsGroup,
        public object: ExportableObject,
        public level: number
    ) {
        this.idText = object.id != undefined ? object.id.toString() : "";
        this.sortId = object.id;

        makeObservable(this, {
            idText: observable,
            sortId: observable,
            newId: computed,
            isModified: computed,
            error: computed
        });
    }

    // undefined if ID is not set (i.e. item is not exported), NaN if invalid
    get newId() {
        const text = this.idText.trim();
        if (text == "") {
            return undefined;
        }
        if (!/^\d+$/.test(text)) {
            return NaN;
        }
        return parseInt(text);
    }

    get isModified() {
        return this.newId !== this.object.id;
    }

    get error() {
        const newId = this.newId;
        if (newId == undefined) {
            return undefined;
        }

        const { minId, maxId } = this.group.idSpace;

        if (
            isNaN(newId) ||
            newId < minId ||
            (maxId != undefined && newId > maxId)
        ) {
            return maxId != undefined
                ? `ID must be an integer between ${minId} and ${maxId}`
                : `ID must be an integer greater than or equal to ${minId}`;
        }

        const itemsWithSameId = this.group.model.itemsById
            .get(this.group.idSpace)
            ?.get(newId);
        const otherItem = itemsWithSameId?.find(item => item != this);
        if (otherItem) {
            return `ID already used by ${otherItem.group.itemTypeName} "${otherItem.object.name}"`;
        }

        return undefined;
    }
}

////////////////////////////////////////////////////////////////////////////////

class ExportedItemsGroup {
    items: ExportedItem[] = [];

    constructor(
        public model: ExportedItemsModel,
        public name: string,
        public itemTypeName: string,
        public icon: React.ReactNode,
        public idSpace: IdSpace
    ) {
        makeObservable(this, {
            visibleItems: computed,
            numExported: computed,
            numModified: computed,
            hasErrors: computed,
            nextFreeId: computed
        });
    }

    get visibleItems() {
        const items = this.items.filter(item =>
            this.model.isItemVisible(item)
        );

        const idSortOrder = this.model.idSortOrder;
        if (idSortOrder != "none") {
            // items without ID are always at the end
            items.sort((a, b) => {
                if (a.sortId == undefined) {
                    return b.sortId == undefined ? 0 : 1;
                }
                if (b.sortId == undefined) {
                    return -1;
                }
                return idSortOrder == "asc"
                    ? a.sortId - b.sortId
                    : b.sortId - a.sortId;
            });
        }

        return items;
    }

    get numExported() {
        return this.items.filter(item => item.newId != undefined).length;
    }

    get numModified() {
        return this.items.filter(item => item.isModified).length;
    }

    get hasErrors() {
        return this.items.some(item => item.error);
    }

    get nextFreeId() {
        const itemsById = this.model.itemsById.get(this.idSpace);
        let id = this.idSpace.minId;
        while (itemsById?.has(id)) {
            id++;
        }
        return id;
    }
}

////////////////////////////////////////////////////////////////////////////////

class ExportedItemsModel {
    groups: ExportedItemsGroup[] = [];

    activeGroup: ExportedItemsGroup | undefined;

    searchText = "";
    showOnlyExported = false;

    // "none" is the order of the items in the project
    idSortOrder: "none" | "asc" | "desc" = "none";

    constructor(public projectStore: ProjectStore) {
        this.createGroups();

        this.activeGroup = this.groups[0];

        makeObservable(this, {
            activeGroup: observable.ref,
            searchText: observable,
            showOnlyExported: observable,
            idSortOrder: observable,
            setActiveGroup: action,
            toggleIdSortOrder: action,
            itemsById: computed,
            modifiedItems: computed,
            canApply: computed
        });
    }

    createGroups() {
        const project = this.projectStore.project;

        const addGroup = (
            name: string,
            itemTypeName: string,
            icon: React.ReactNode,
            idSpace: IdSpace,
            objects: { object: ExportableObject; level: number }[]
        ) => {
            if (objects.length == 0) {
                return;
            }

            const group = new ExportedItemsGroup(
                this,
                name,
                itemTypeName,
                icon,
                idSpace
            );

            group.items = objects.map(
                ({ object, level }) => new ExportedItem(group, object, level)
            );

            this.groups.push(group);
        };

        const topLevel = (objects: ExportableObject[] | undefined) =>
            (objects ?? []).map(object => ({ object, level: 0 }));

        addGroup(
            "Global Variables",
            "global variable",
            ProjectEditor.VariableClass.classInfo.icon,
            { minId: 1, maxId: undefined },
            topLevel(project.variables?.globalVariables)
        );

        addGroup(
            "User Actions",
            "user action",
            ProjectEditor.ActionClass.classInfo.icon,
            { minId: 1, maxId: undefined },
            topLevel(project.actions)
        );

        const pagesIdSpace = { minId: 1, maxId: undefined };

        addGroup(
            "Pages",
            "page",
            ProjectEditor.PageClass.classInfo.icon,
            pagesIdSpace,
            topLevel(project.userPages)
        );

        addGroup(
            "User Widgets",
            "user widget",
            USER_WIDGET_ICON,
            pagesIdSpace,
            topLevel(project.userWidgets)
        );

        const styles: { object: ExportableObject; level: number }[] = [];
        const addStyles = (childStyles: Style[], level: number) => {
            for (const style of childStyles) {
                styles.push({ object: style, level });
                addStyles(style.childStyles, level + 1);
            }
        };
        addStyles(project.styles ?? [], 0);

        addGroup(
            "Styles",
            "style",
            ProjectEditor.StyleClass.classInfo.icon,
            { minId: 1, maxId: undefined },
            styles
        );

        addGroup(
            "Fonts",
            "font",
            ProjectEditor.FontClass.classInfo.icon,
            { minId: 1, maxId: undefined },
            topLevel(project.fonts)
        );

        addGroup(
            "Bitmaps",
            "bitmap",
            ProjectEditor.BitmapClass.classInfo.icon,
            { minId: 1, maxId: undefined },
            topLevel(project.bitmaps)
        );

        // color ID is index (0-based) of the color in the build
        addGroup(
            "Colors",
            "color",
            ProjectEditor.ColorClass.classInfo.icon,
            { minId: 0, maxId: 1000 },
            topLevel(project.colors)
        );
    }

    get itemsById() {
        const itemsById = new Map<IdSpace, Map<number, ExportedItem[]>>();

        for (const group of this.groups) {
            let idSpaceItems = itemsById.get(group.idSpace);
            if (!idSpaceItems) {
                idSpaceItems = new Map();
                itemsById.set(group.idSpace, idSpaceItems);
            }

            for (const item of group.items) {
                const id = item.newId;
                if (id != undefined && !isNaN(id)) {
                    let items = idSpaceItems.get(id);
                    if (!items) {
                        items = [];
                        idSpaceItems.set(id, items);
                    }
                    items.push(item);
                }
            }
        }

        return itemsById;
    }

    setActiveGroup(group: ExportedItemsGroup) {
        this.activeGroup = group;
        this.updateSortIds();
    }

    // none -> ascending -> descending -> none
    toggleIdSortOrder() {
        this.idSortOrder =
            this.idSortOrder == "none"
                ? "asc"
                : this.idSortOrder == "asc"
                ? "desc"
                : "none";
        this.updateSortIds();
    }

    updateSortIds() {
        for (const group of this.groups) {
            for (const item of group.items) {
                const id = item.newId;
                item.sortId = id != undefined && !isNaN(id) ? id : undefined;
            }
        }
    }

    isItemVisible(item: ExportedItem) {
        // item which was exported or is about to be exported is still visible
        // while its ID is edited
        if (
            this.showOnlyExported &&
            item.object.id == undefined &&
            item.newId == undefined
        ) {
            return false;
        }

        const searchText = this.searchText.trim().toLowerCase();
        if (
            searchText &&
            !item.object.name.toLowerCase().includes(searchText)
        ) {
            return false;
        }

        return true;
    }

    get modifiedItems() {
        const modifiedItems: ExportedItem[] = [];
        for (const group of this.groups) {
            modifiedItems.push(...group.items.filter(item => item.isModified));
        }
        return modifiedItems;
    }

    // Errors of the items not modified in this dialog (e.g. duplicate IDs
    // already in the project) are only shown, they do not block the Apply.
    get canApply() {
        return (
            this.modifiedItems.length > 0 &&
            !this.modifiedItems.find(item => item.error)
        );
    }

    apply() {
        const modifiedItems = this.modifiedItems;
        if (modifiedItems.length == 0) {
            return;
        }

        this.projectStore.undoManager.setCombineCommands(true);

        for (const item of modifiedItems) {
            this.projectStore.updateObject(item.object, {
                id: item.newId
            });
        }

        this.projectStore.undoManager.setCombineCommands(false);
    }
}

////////////////////////////////////////////////////////////////////////////////

const ExportedItemsDialog = observer(
    class ExportedItemsDialog extends React.Component<{
        model: ExportedItemsModel;
        onOk: () => void;
        onCancel: () => void;
    }> {
        render() {
            const { model } = this.props;

            const activeGroup = model.activeGroup;

            const numModifiedItems = model.modifiedItems.length;

            return (
                <Dialog
                    modal={false}
                    okButtonText="Apply"
                    okEnabled={() => model.canApply}
                    onOk={this.props.onOk}
                    onCancel={this.props.onCancel}
                    additionalFooterControl={
                        numModifiedItems > 0 && (
                            <span className="EezStudio_ExportedItemsDialog_Changes">
                                {numModifiedItems == 1
                                    ? "1 ID changed"
                                    : `${numModifiedItems} IDs changed`}
                            </span>
                        )
                    }
                >
                    <div className="EezStudio_ExportedItemsDialog">
                        {activeGroup ? (
                            <>
                                <ul className="nav nav-tabs">
                                    {model.groups.map(group => (
                                        <ExportedItemsGroupTab
                                            key={group.name}
                                            group={group}
                                        />
                                    ))}
                                </ul>
                                <div className="EezStudio_ExportedItemsDialog_Toolbar">
                                    <SearchInput
                                        searchText={model.searchText}
                                        onChange={action(
                                            event =>
                                                (model.searchText =
                                                    event.target.value)
                                        )}
                                        onClear={action(
                                            () => (model.searchText = "")
                                        )}
                                    />
                                    <div className="form-check">
                                        <input
                                            id="EezStudio_ExportedItemsDialog_ShowOnlyExported"
                                            className="form-check-input"
                                            type="checkbox"
                                            checked={model.showOnlyExported}
                                            onChange={action(
                                                event =>
                                                    (model.showOnlyExported =
                                                        event.target.checked)
                                            )}
                                        />
                                        <label
                                            className="form-check-label"
                                            htmlFor="EezStudio_ExportedItemsDialog_ShowOnlyExported"
                                        >
                                            Show only exported items
                                        </label>
                                    </div>
                                    <span className="EezStudio_ExportedItemsDialog_GroupInfo">
                                        {activeGroup.numExported} of{" "}
                                        {activeGroup.items.length} exported,
                                        next free ID: {activeGroup.nextFreeId}
                                    </span>
                                </div>
                                <div className="EezStudio_ExportedItemsDialog_Body">
                                    <ExportedItemsGroupView
                                        group={activeGroup}
                                    />
                                </div>
                            </>
                        ) : (
                            <div className="EezStudio_ExportedItemsDialog_NoItems">
                                This project has no items that can be exported.
                            </div>
                        )}
                    </div>
                </Dialog>
            );
        }
    }
);

const ExportedItemsGroupTab = observer(
    class ExportedItemsGroupTab extends React.Component<{
        group: ExportedItemsGroup;
    }> {
        render() {
            const { group } = this.props;
            const { model } = group;

            return (
                <li className="nav-item">
                    <a
                        className={classNames("nav-link", {
                            active: group == model.activeGroup
                        })}
                        href="#"
                        onClick={(event: React.MouseEvent) => {
                            event.preventDefault();
                            model.setActiveGroup(group);
                        }}
                    >
                        <Icon icon={group.icon} size={16} />
                        <span>{group.name}</span>
                        {group.hasErrors ? (
                            <Icon
                                icon="material:error"
                                size={16}
                                className="text-danger"
                                title="Contains invalid IDs"
                            />
                        ) : group.numModified > 0 ? (
                            <span
                                className="badge rounded-pill text-bg-primary"
                                title="Number of changed IDs"
                            >
                                {group.numModified}
                            </span>
                        ) : null}
                    </a>
                </li>
            );
        }
    }
);

const ExportedItemsGroupView = observer(
    class ExportedItemsGroupView extends React.Component<{
        group: ExportedItemsGroup;
    }> {
        render() {
            const { model } = this.props.group;

            const visibleItems = this.props.group.visibleItems;

            if (visibleItems.length == 0) {
                return (
                    <div className="EezStudio_ExportedItemsDialog_NoItems">
                        No items found.
                    </div>
                );
            }

            return (
                <table>
                    <thead>
                        <tr>
                            <th className="EezStudio_ExportedItemsDialog_NameColumn">
                                Name
                            </th>
                            <th
                                className="EezStudio_ExportedItemsDialog_IdColumn EezStudio_ExportedItemsDialog_Sortable"
                                title="Sort by ID"
                                onClick={() => model.toggleIdSortOrder()}
                            >
                                ID
                                <Icon
                                    icon={
                                        model.idSortOrder == "asc"
                                            ? "material:arrow_upward"
                                            : model.idSortOrder == "desc"
                                            ? "material:arrow_downward"
                                            : "material:unfold_more"
                                    }
                                    size={14}
                                    className={classNames({
                                        "text-body-secondary":
                                            model.idSortOrder == "none"
                                    })}
                                />
                            </th>
                            <th className="EezStudio_ExportedItemsDialog_StatusColumn"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {visibleItems.map(item => (
                            <ExportedItemRow
                                key={item.object.objID}
                                item={item}
                            />
                        ))}
                    </tbody>
                </table>
            );
        }
    }
);

const ExportedItemRow = observer(
    class ExportedItemRow extends React.Component<{
        item: ExportedItem;
    }> {
        render() {
            const { item } = this.props;

            const error = item.error;

            // hierarchy (child styles) is shown only in the project order
            const level =
                item.group.model.idSortOrder == "none" ? item.level : 0;

            return (
                <tr className={classNames({ modified: item.isModified })}>
                    <td
                        className="EezStudio_ExportedItemsDialog_NameColumn"
                        style={{ paddingLeft: 8 + level * 16 }}
                    >
                        {item.object.name}
                    </td>
                    <td className="EezStudio_ExportedItemsDialog_IdColumn">
                        <input
                            type="text"
                            className={classNames(
                                "form-control form-control-sm",
                                { "is-invalid": !!error }
                            )}
                            value={item.idText}
                            onChange={action(
                                event => (item.idText = event.target.value)
                            )}
                        />
                    </td>
                    <td className="EezStudio_ExportedItemsDialog_StatusColumn">
                        {error ? (
                            <span className="text-danger">{error}</span>
                        ) : item.isModified ? (
                            <span className="text-body-secondary">
                                {item.object.id != undefined
                                    ? `Was ${item.object.id}`
                                    : "Was not exported"}
                            </span>
                        ) : null}
                    </td>
                </tr>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

export function showExportedItemsDialog(projectStore: ProjectStore) {
    const model = new ExportedItemsModel(projectStore);

    const onOk = () => {
        model.apply();
        modalDialog.close();
    };

    const onCancel = () => {
        modalDialog.close();
    };

    const [modalDialog] = showDialog(
        <ExportedItemsDialog model={model} onOk={onOk} onCancel={onCancel} />,
        {
            jsPanel: {
                id: "exported-items-dialog",
                title: "Exported Items",
                width: 960,
                height: 800
            }
        }
    );
}
