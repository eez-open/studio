import React from "react";
import {
    computed,
    observable,
    action,
    reaction,
    IReactionDisposer,
    IObservableValue,
    makeObservable
} from "mobx";
import { observer } from "mobx-react";

import { IconAction } from "eez-studio-ui/action";
import { SearchInput } from "eez-studio-ui/search-input";

import { getId, IEezObject } from "project-editor/core/object";
import {
    SortDirectionType,
    TreeAdapter,
    TreeObjectAdapter
} from "project-editor/core/objectAdapter";
import {
    addItem,
    canAdd,
    getAddItemName,
    IPanel,
    isPartOfNavigation
} from "project-editor/store";
import { DragAndDropManagerClass } from "project-editor/core/dd";
import { List } from "project-editor/ui-components/List";

import { ProjectContext } from "project-editor/project/context";
import classNames from "classnames";
import { ProjectEditor } from "project-editor/project-editor-interface";

////////////////////////////////////////////////////////////////////////////////

export const SortControl = observer(
    class SortControl extends React.Component<{
        direction: SortDirectionType;
        onDirectionChanged: (direction: SortDirectionType) => void;
    }> {
        onClicked = () => {
            if (this.props.direction === "asc") {
                this.props.onDirectionChanged("desc");
            } else if (this.props.direction === "desc") {
                this.props.onDirectionChanged("none");
            } else {
                this.props.onDirectionChanged("asc");
            }
        };

        render() {
            const { direction } = this.props;

            return (
                <div
                    className={classNames(
                        "EezStudio_SortControl",
                        "sort-" + direction
                    )}
                    onClick={this.onClicked}
                ></div>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

const AddButton = observer(
    class AddButton extends React.Component<{
        listAdapter: TreeAdapter;
        navigationObject: IEezObject | undefined;
        onAdd: () => void;
    }> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        onAdd = async () => {
            if (this.props.navigationObject) {
                const aNewItem = await addItem(this.props.navigationObject);
                if (aNewItem) {
                    this.props.listAdapter.selectItem(
                        this.props.listAdapter.getItemFromId(getId(aNewItem))!
                    );

                    const result = ProjectEditor.getEditorComponent(
                        aNewItem,
                        undefined
                    );
                    if (result) {
                        this.context.editorsStore.openEditor(
                            result.object,
                            result.subObject
                        );
                    } else {
                        this.props.onAdd();
                    }
                }
            }
        };

        render() {
            return (
                <IconAction
                    title={`Add ${
                        this.props.navigationObject
                            ? getAddItemName(this.props.navigationObject)
                            : "Item"
                    }...`}
                    icon="material:add"
                    iconSize={16}
                    onClick={this.onAdd}
                    enabled={
                        this.props.navigationObject &&
                        canAdd(this.props.navigationObject)
                    }
                />
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

const DeleteButton = observer(
    class DeleteButton extends React.Component<{
        listAdapter: TreeAdapter;
    }> {
        onDelete = () => {
            this.props.listAdapter.deleteSelection();
        };

        render() {
            return (
                <IconAction
                    title="Delete Selected Item"
                    icon="material:delete"
                    iconSize={16}
                    onClick={this.onDelete}
                    enabled={this.props.listAdapter.anySelected()}
                />
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

interface ListNavigationProps {
    id: string;
    title?: string;
    navigationObject: IEezObject;
    selectedObject: IObservableValue<IEezObject | undefined>;
    onClickItem?: (item: IEezObject) => void;
    onDoubleClickItem?: (item: IEezObject) => void;
    additionalButtons?: JSX.Element[];
    onEditItem?: (itemId: string) => void;
    renderItem?: (itemId: string) => React.ReactNode;
    dragAndDropManager?: DragAndDropManagerClass;
    searchInput?: boolean;
    editable?: boolean;
    onFilesDrop?: (files: File[]) => void;
}

export const ListNavigation = observer(
    class ListNavigation
        extends React.Component<ListNavigationProps>
        implements IPanel
    {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        sortDirection: SortDirectionType = "none";
        searchText: string = "";

        dispose: IReactionDisposer;

        divRef = React.createRef<HTMLDivElement>();

        constructor(props: ListNavigationProps) {
            super(props);

            this.readFromLocalStorage();

            makeObservable(this, {
                sortDirection: observable,
                searchText: observable,
                editable: computed,
                selectedObject: computed,
                onSearchChange: action.bound,
                listAdapter: computed,
                readFromLocalStorage: action
            });

            this.dispose = reaction(
                () => ({
                    sortDirection: this.sortDirection,
                    searchText: this.searchText
                }),
                arg => {
                    localStorage.setItem(
                        "ListNavigationSortDirection" + this.props.id,
                        arg.sortDirection
                    );
                    localStorage.setItem(
                        "ListNavigationSearchText" + this.props.id,
                        arg.searchText
                    );
                }
            );
        }

        readFromLocalStorage() {
            const sortDirectionStr = localStorage.getItem(
                "ListNavigationSortDirection" + this.props.id
            );
            if (sortDirectionStr) {
                this.sortDirection = sortDirectionStr as SortDirectionType;
            }

            this.searchText =
                localStorage.getItem(
                    "ListNavigationSearchText" + this.props.id
                ) || "";
        }

        componentDidMount() {
            this.context.navigationStore.mountPanel(this);
        }

        componentDidUpdate() {
            this.readFromLocalStorage();
        }

        componentWillUnmount() {
            this.dispose();
            this.context.navigationStore.unmountPanel(this);
        }

        get listAdapter() {
            return new TreeAdapter(
                new TreeObjectAdapter(this.props.navigationObject),
                this.props.selectedObject,
                undefined,
                undefined,
                this.sortDirection,
                0,
                this.onClickItem,
                this.onDoubleClickItem,
                this.searchText,
                this.props.editable ?? true
            );
        }

        get editable() {
            const navigationStore = this.context.navigationStore;
            return this.props.editable != false && navigationStore.editable;
        }

        onClickItem = (object: IEezObject) => {
            if (this.props.onClickItem) {
                this.props.onClickItem(object);
                return;
            }

            const result = ProjectEditor.getEditorComponent(object, undefined);
            if (result) {
                this.context.editorsStore.openEditor(
                    result.object,
                    result.subObject
                );
            }
        };

        onDoubleClickItem = (object: IEezObject) => {
            if (this.props.onDoubleClickItem) {
                this.props.onDoubleClickItem(object);
                return;
            }

            const result = ProjectEditor.getEditorComponent(object, undefined);
            if (result) {
                this.context.editorsStore.openPermanentEditor(
                    result.object,
                    result.subObject
                );
            }
        };

        // interface IPanel implementation
        get selectedObject() {
            return this.props.selectedObject.get();
        }
        get selectedObjects() {
            return this.listAdapter.rootItem.selectedObjects;
        }
        canCut() {
            return this.listAdapter.canCut();
        }
        cutSelection() {
            if (this.editable) {
                this.listAdapter.cutSelection();
            }
        }
        canCopy() {
            return this.listAdapter.canCopy();
        }
        copySelection() {
            this.listAdapter.copySelection();
        }
        canPaste() {
            return this.listAdapter.canPaste();
        }
        pasteSelection() {
            if (this.editable) {
                this.listAdapter.pasteSelection();
            }
        }
        canDelete() {
            return this.listAdapter.canDelete();
        }
        deleteSelection() {
            if (this.editable) {
                this.listAdapter.deleteSelection();
            }
        }
        selectAll() {
            this.listAdapter.selectItems(
                this.listAdapter.allRows.map(row => row.item)
            );
        }
        onFocus = () => {
            const navigationStore = this.context.navigationStore;
            if (isPartOfNavigation(this.props.navigationObject)) {
                navigationStore.setSelectedPanel(this);
            }
        };

        onSearchChange(event: any) {
            this.searchText = ($(event.target).val() as string).trim();
        }

        render() {
            const { onEditItem, renderItem } = this.props;

            const buttons: JSX.Element[] = [];

            if (this.props.additionalButtons) {
                buttons.push(...this.props.additionalButtons);
            }

            if (this.editable) {
                buttons.push(
                    <AddButton
                        key="add"
                        listAdapter={this.listAdapter}
                        navigationObject={this.props.navigationObject}
                        onAdd={() => {
                            const treeElement:
                                | HTMLDivElement
                                | undefined
                                | null =
                                this.divRef.current?.querySelector(
                                    ".EezStudio_Tree"
                                );
                            if (treeElement) {
                                treeElement.focus();
                            }
                        }}
                    />
                );

                buttons.push(
                    <DeleteButton key="delete" listAdapter={this.listAdapter} />
                );
            }

            return (
                <div
                    ref={this.divRef}
                    className="EezStudio_ProjectEditor_ListNavigation"
                >
                    <div className="EezStudio_Title">
                        <SortControl
                            direction={this.sortDirection}
                            onDirectionChanged={action(
                                (direction: SortDirectionType) =>
                                    (this.sortDirection = direction)
                            )}
                        />
                        {(this.props.searchInput == undefined ||
                            this.props.searchInput) && (
                            <SearchInput
                                searchText={this.searchText}
                                onClear={action(() => {
                                    this.searchText = "";
                                })}
                                onChange={this.onSearchChange}
                                onKeyDown={this.onSearchChange}
                            />
                        )}
                        <div className="btn-toolbar">{buttons}</div>
                    </div>
                    <List
                        listAdapter={this.listAdapter}
                        tabIndex={0}
                        onFocus={this.onFocus}
                        onEditItem={this.editable ? onEditItem : undefined}
                        renderItem={renderItem}
                        onFilesDrop={this.props.onFilesDrop}
                    />
                </div>
            );
        }
    }
);
