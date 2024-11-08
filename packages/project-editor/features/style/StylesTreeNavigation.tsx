import React from "react";
import {
    computed,
    observable,
    action,
    reaction,
    IReactionDisposer,
    IObservableValue,
    makeObservable,
    runInAction
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
    IPanel,
    isPartOfNavigation
} from "project-editor/store";
import { DragAndDropManagerClass } from "project-editor/core/dd";

import { ProjectContext } from "project-editor/project/context";
import { ProjectEditor } from "project-editor/project-editor-interface";
import { Tree } from "project-editor/ui-components/Tree";
import { SortControl } from "project-editor/ui-components/ListNavigation";

////////////////////////////////////////////////////////////////////////////////

const AddButton = observer(
    class AddButton extends React.Component<{
        treeAdapter: TreeAdapter;
        navigationObject: IEezObject | undefined;
        onAdd: () => void;
    }> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        onAdd = async () => {
            if (this.props.navigationObject) {
                const aNewItem = await addItem(this.props.navigationObject);
                if (aNewItem) {
                    this.props.treeAdapter.selectItem(
                        this.props.treeAdapter.getItemFromId(getId(aNewItem))!
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
                    title="Add Item"
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
        treeAdapter: TreeAdapter;
    }> {
        onDelete = () => {
            this.props.treeAdapter.deleteSelection();
        };

        render() {
            return (
                <IconAction
                    title="Delete Selected Item"
                    icon="material:delete"
                    iconSize={16}
                    onClick={this.onDelete}
                    enabled={this.props.treeAdapter.anySelected()}
                />
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

interface StylesTreeNavigationProps {
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

export const StylesTreeNavigation = observer(
    class StylesTreeNavigation
        extends React.Component<StylesTreeNavigationProps>
        implements IPanel
    {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        sortDirection: SortDirectionType = "none";
        searchText: string = "";

        dispose1: IReactionDisposer;
        dispose2: IReactionDisposer;

        divRef = React.createRef<HTMLDivElement>();

        constructor(props: StylesTreeNavigationProps) {
            super(props);

            this.readFromLocalStorage();

            makeObservable(this, {
                sortDirection: observable,
                searchText: observable,
                editable: computed,
                selectedObject: computed,
                onSearchChange: action.bound,
                treeObjectAdapter: computed,
                treeAdapter: computed,
                readFromLocalStorage: action
            });

            this.dispose1 = reaction(
                () => ({
                    sortDirection: this.sortDirection,
                    searchText: this.searchText
                }),
                arg => {
                    localStorage.setItem(
                        "TreeNavigationSortDirection" + this.props.id,
                        arg.sortDirection
                    );

                    localStorage.setItem(
                        "TreeNavigationSearchText" + this.props.id,
                        arg.searchText
                    );
                }
            );
        }

        readFromLocalStorage() {
            const sortDirectionStr = localStorage.getItem(
                "TreeNavigationSortDirection" + this.props.id
            );
            if (sortDirectionStr) {
                this.sortDirection = sortDirectionStr as SortDirectionType;
            }

            this.searchText =
                localStorage.getItem(
                    "TreeNavigationSearchText" + this.props.id
                ) || "";
        }

        componentDidMount() {
            this.dispose2 = reaction(
                () => this.treeObjectAdapter.saveState(),
                treeState => {
                    this.context.uiStateStore.updateObjectUIState(
                        this.props.navigationObject,
                        "tree-state",
                        treeState
                    );
                }
            );

            this.context.navigationStore.mountPanel(this);
        }

        componentDidUpdate() {
            this.readFromLocalStorage();
        }

        componentWillUnmount() {
            this.dispose1();
            this.dispose2();
            this.context.navigationStore.unmountPanel(this);
        }

        get treeObjectAdapter() {
            const treeObjectAdapter = new TreeObjectAdapter(
                this.props.navigationObject,
                undefined,
                true
            );

            const state = this.context.uiStateStore.getObjectUIState(
                this.props.navigationObject,
                "tree-state"
            );

            if (state) {
                treeObjectAdapter.loadState(state);
            }

            return treeObjectAdapter;
        }

        get treeAdapter() {
            return new TreeAdapter(
                this.treeObjectAdapter,
                undefined,
                undefined,
                true,
                this.sortDirection,
                undefined,
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
                return;
            }

            runInAction(() => {
                this.context.navigationStore.selectedStyleObject.set(object);
            });
        };

        onDoubleClickItem = (object: IEezObject) => {
            if (this.props.onDoubleClickItem) {
                this.props.onDoubleClickItem(object);
            }
        };

        // interface IPanel implementation
        get selectedObject() {
            return this.treeAdapter.rootItem.selectedObject;
        }
        get selectedObjects() {
            return this.treeAdapter.rootItem.selectedObjects;
        }
        canCut() {
            return this.treeAdapter.canCut();
        }
        cutSelection() {
            if (this.editable) {
                this.treeAdapter.cutSelection();
            }
        }
        canCopy() {
            return this.treeAdapter.canCopy();
        }
        copySelection() {
            this.treeAdapter.copySelection();
        }
        canPaste() {
            return this.treeAdapter.canPaste();
        }
        pasteSelection() {
            if (this.editable) {
                this.treeAdapter.pasteSelection();
            }
        }
        canDelete() {
            return this.treeAdapter.canDelete();
        }
        deleteSelection() {
            if (this.editable) {
                this.treeAdapter.deleteSelection();
            }
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
                        treeAdapter={this.treeAdapter}
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
                    <DeleteButton key="delete" treeAdapter={this.treeAdapter} />
                );
            }

            return (
                <div
                    className="EezStudio_ProjectEditor_StylesTreeNavigation"
                    ref={this.divRef}
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
                    <Tree
                        treeAdapter={this.treeAdapter}
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
