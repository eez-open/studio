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
import { DropFile, Tree } from "project-editor/ui-components/Tree";

////////////////////////////////////////////////////////////////////////////////

const AddButton = observer(
    class AddButton extends React.Component<{
        treeAdapter: TreeAdapter;
        navigationObject: IEezObject | undefined;
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

interface LVGLStylesTreeNavigationProps {
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
    onFilesDrop?: (files: DropFile[]) => void;
}

export const LVGLStylesTreeNavigation = observer(
    class LVGLStylesTreeNavigation
        extends React.Component<LVGLStylesTreeNavigationProps>
        implements IPanel
    {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        searchText: string = "";

        dispose1: IReactionDisposer;
        dispose2: IReactionDisposer;

        constructor(props: LVGLStylesTreeNavigationProps) {
            super(props);

            this.readFromLocalStorage();

            makeObservable(this, {
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
                    searchText: this.searchText
                }),
                arg => {
                    localStorage.setItem(
                        "TreeNavigationSearchText" + this.props.id,
                        arg.searchText
                    );
                }
            );
        }

        readFromLocalStorage() {
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

            this.context.navigationStore.setInitialSelectedPanel(this);
        }

        componentDidUpdate() {
            this.readFromLocalStorage();
        }

        componentWillUnmount() {
            this.dispose1();
            this.dispose2();
            if (this.context.navigationStore.selectedPanel === this) {
                this.context.navigationStore.setSelectedPanel(undefined);
            }
        }

        get treeObjectAdapter() {
            const treeObjectAdapter = new TreeObjectAdapter(
                this.props.navigationObject
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
                true,
                undefined,
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
        cutSelection() {
            if (this.editable) {
                this.treeAdapter.cutSelection();
            }
        }
        copySelection() {
            this.treeAdapter.copySelection();
        }
        pasteSelection() {
            if (this.editable) {
                this.treeAdapter.pasteSelection();
            }
        }
        deleteSelection() {
            if (this.editable) {
                this.treeAdapter.deleteSelection();
            }
        }
        onFocus() {
            const navigationStore = this.context.navigationStore;
            if (isPartOfNavigation(this.props.navigationObject)) {
                navigationStore.setSelectedPanel(this);
            }
        }

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
                    />
                );

                buttons.push(
                    <DeleteButton key="delete" treeAdapter={this.treeAdapter} />
                );
            }

            return (
                <div className="EezStudio_ProjectEditor_LVGLStylesTreeNavigation">
                    <div className="EezStudio_Title">
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
                        onFocus={this.onFocus.bind(this)}
                        onEditItem={this.editable ? onEditItem : undefined}
                        renderItem={renderItem}
                        onFilesDrop={this.props.onFilesDrop}
                    />
                </div>
            );
        }
    }
);
