import React from "react";
import { computed, observable, action, reaction } from "mobx";
import { observer } from "mobx-react";
import { bind } from "bind-decorator";

import { IconAction } from "eez-studio-ui/action";
import { Splitter } from "eez-studio-ui/splitter";
import { styled } from "eez-studio-ui/styled-components";
import { SearchInput } from "eez-studio-ui/search-input";

import {
    EezObject,
    NavigationComponentProps,
    objectToString,
    isPartOfNavigation,
    NavigationComponent
} from "project-editor/core/object";
import { ListAdapter, SortDirectionType } from "project-editor/core/objectAdapter";
import {
    NavigationStore,
    INavigationStore,
    EditorsStore,
    addItem,
    deleteItem,
    canAdd,
    canDelete,
    IPanel
} from "project-editor/core/store";
import { DragAndDropManagerClass } from "project-editor/core/dd";
import { List } from "project-editor/components/List";
import { Panel } from "project-editor/components/Panel";

import { PropertiesPanel } from "project-editor/project/ProjectEditor";

////////////////////////////////////////////////////////////////////////////////

const SortableTitleDiv = styled.div`
    flex-grow: 1;
    margin-top: 5px;
    margin-left: 5px;
    font-weight: 600;
    color: ${props => props.theme.darkTextColor};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;

    background-repeat: no-repeat;
    background-position: center left;
    padding-left: 20px;
    cursor: pointer;

    &.sort-asc {
        background-image: url("../eez-studio-ui/_images/col_sort_asc.png");
    }

    &.sort-desc {
        background-image: url("../eez-studio-ui/_images/col_sort_desc.png");
    }

    &.sort-none {
        background-image: url("../eez-studio-ui/_images/col_sort_enabled.png");
    }
`;

@observer
export class SortableTitle extends React.Component<{
    title: string;
    direction: SortDirectionType;
    onDirectionChanged: (direction: SortDirectionType) => void;
}> {
    @bind
    onClicked() {
        if (this.props.direction === "asc") {
            this.props.onDirectionChanged("desc");
        } else if (this.props.direction === "desc") {
            this.props.onDirectionChanged("none");
        } else {
            this.props.onDirectionChanged("asc");
        }
    }

    render() {
        const { title, direction } = this.props;

        return (
            <SortableTitleDiv className={"sort-" + direction} onClick={this.onClicked}>
                {title}
            </SortableTitleDiv>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
class AddButton extends React.Component<{
    listAdapter: ListAdapter;
    navigationObject: EezObject | undefined;
}> {
    async onAdd() {
        if (this.props.navigationObject) {
            const aNewItem = await addItem(this.props.navigationObject);
            if (aNewItem) {
                this.props.listAdapter.selectObject(aNewItem);
            }
        }
    }

    render() {
        return (
            <IconAction
                title="Add Item"
                icon="material:add"
                iconSize={16}
                onClick={this.onAdd.bind(this)}
                enabled={this.props.navigationObject && canAdd(this.props.navigationObject)}
            />
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
class DeleteButton extends React.Component<{
    navigationObject: EezObject | undefined;
    navigationStore?: INavigationStore;
}> {
    onDelete() {
        const navigationStore = this.props.navigationStore || NavigationStore;
        let selectedItem =
            this.props.navigationObject &&
            navigationStore.getNavigationSelectedItemAsObject(this.props.navigationObject);
        if (selectedItem) {
            deleteItem(selectedItem);
        }
    }

    render() {
        const navigationStore = this.props.navigationStore || NavigationStore;
        let selectedItem =
            this.props.navigationObject &&
            navigationStore.getNavigationSelectedItemAsObject(this.props.navigationObject);

        return (
            <IconAction
                title="Delete Selected Item"
                icon="material:delete"
                iconSize={16}
                onClick={this.onDelete.bind(this)}
                enabled={selectedItem != undefined && canDelete(selectedItem)}
            />
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

const ListWithSearchInputContainer = styled.div`
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    & > :first-child {
        border-bottom: 1px solid ${props => props.theme.borderColor};
    }
`;

interface ListNavigationProps {
    id: string;
    title?: string;
    navigationObject: EezObject;
    onDoubleClickItem?: (item: EezObject) => void;
    additionalButtons?: JSX.Element[];
    onEditItem?: (itemId: string) => void;
    renderItem?: (itemId: string) => React.ReactNode;
    navigationStore?: INavigationStore;
    dragAndDropManager?: DragAndDropManagerClass;
    searchInput?: boolean;
    editable?: boolean;
    filter?: (object: EezObject) => boolean;
}

@observer
export class ListNavigation extends React.Component<ListNavigationProps> implements IPanel {
    @observable sortDirection: SortDirectionType = "none";
    @observable searchText: string = "";

    constructor(props: any) {
        super(props);

        const sortDirectionStr = localStorage.getItem(
            "ListNavigationSortDirection" + this.props.id
        );
        if (sortDirectionStr) {
            this.sortDirection = sortDirectionStr as SortDirectionType;
        }

        reaction(
            () => this.sortDirection,
            sortDirection =>
                localStorage.setItem("ListNavigationSortDirection" + this.props.id, sortDirection)
        );
    }

    @bind
    onDoubleClickItem(object: EezObject) {
        if (this.props.onDoubleClickItem) {
            this.props.onDoubleClickItem(object);
        } else if (EditorsStore.activeEditor && EditorsStore.activeEditor.object == object) {
            EditorsStore.activeEditor.makePermanent();
        }
    }

    @computed
    get selectedObject() {
        const navigationStore = this.props.navigationStore || NavigationStore;
        let selectedItem = navigationStore.getNavigationSelectedItem(
            this.props.navigationObject
        ) as EezObject;
        return selectedItem || navigationStore.selectedObject;
    }

    cutSelection() {
        this.listAdapter.cutSelection();
    }

    copySelection() {
        this.listAdapter.copySelection();
    }

    pasteSelection() {
        this.listAdapter.pasteSelection();
    }

    deleteSelection() {
        this.listAdapter.deleteSelection();
    }

    @computed
    get listAdapter() {
        return new ListAdapter(
            this.props.navigationObject,
            this.sortDirection,
            this.onDoubleClickItem,
            this.props.navigationStore,
            this.props.dragAndDropManager,
            this.searchText,
            this.props.filter
        );
    }

    onFocus() {
        const navigationStore = this.props.navigationStore || NavigationStore;
        if (isPartOfNavigation(this.props.navigationObject)) {
            navigationStore.setSelectedPanel(this);
        }
    }

    @action.bound
    onSearchChange(event: any) {
        this.searchText = ($(event.target).val() as string).trim();
    }

    render() {
        const { onEditItem, renderItem, editable } = this.props;
        const title = (
            <SortableTitle
                title={this.props.title || objectToString(this.props.navigationObject)}
                direction={this.sortDirection}
                onDirectionChanged={action(
                    (direction: SortDirectionType) => (this.sortDirection = direction)
                )}
            />
        );

        const buttons: JSX.Element[] = [];

        if (this.props.additionalButtons) {
            buttons.push(...this.props.additionalButtons);
        }

        if (editable !== false) {
            buttons.push(
                <AddButton
                    key="add"
                    listAdapter={this.listAdapter}
                    navigationObject={this.props.navigationObject}
                />
            );

            buttons.push(
                <DeleteButton
                    key="delete"
                    navigationObject={this.props.navigationObject}
                    navigationStore={this.props.navigationStore}
                />
            );
        }

        let body = (
            <List
                listAdapter={this.listAdapter}
                tabIndex={0}
                onFocus={this.onFocus.bind(this)}
                onEditItem={editable === false ? undefined : onEditItem}
                renderItem={renderItem}
            />
        );

        if (this.props.searchInput == undefined || this.props.searchInput) {
            body = (
                <ListWithSearchInputContainer>
                    <SearchInput
                        searchText={this.searchText}
                        onChange={this.onSearchChange}
                        onKeyDown={this.onSearchChange}
                    />
                    {body}
                </ListWithSearchInputContainer>
            );
        }

        return <Panel id="navigation" title={title} buttons={buttons} body={body} />;
    }
}

////////////////////////////////////////////////////////////////////////////////

interface ListNavigationWithContentProps extends NavigationComponentProps {
    content: React.ReactNode;
    title?: string;
    onDoubleClickItem?: (item: EezObject) => void;
    additionalButtons?: JSX.Element[];
    orientation?: "horizontal" | "vertical";
    onEditItem?: (itemId: string) => void;
    renderItem?: (itemId: string) => React.ReactNode;
    navigantionStore?: INavigationStore;
}

@observer
export class ListNavigationWithContent extends React.Component<ListNavigationWithContentProps, {}> {
    render() {
        const { onEditItem, renderItem } = this.props;
        return (
            <Splitter
                type={this.props.orientation || "horizontal"}
                persistId={`project-editor/navigation-${this.props.id}`}
                sizes={`240px|100%`}
                childrenOverflow="hidden"
            >
                <ListNavigation
                    id={this.props.id}
                    title={this.props.title}
                    navigationObject={this.props.navigationObject}
                    onDoubleClickItem={this.props.onDoubleClickItem}
                    additionalButtons={this.props.additionalButtons}
                    onEditItem={onEditItem}
                    renderItem={renderItem}
                    navigationStore={this.props.navigationStore}
                />
                {this.props.content}
            </Splitter>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
export class ListNavigationWithProperties extends NavigationComponent {
    @computed
    get object() {
        const navigationStore = this.props.navigationStore || NavigationStore;
        return (
            (navigationStore.selectedPanel && navigationStore.selectedPanel.selectedObject) ||
            navigationStore.selectedObject
        );
    }

    render() {
        return (
            <Splitter
                type="horizontal"
                persistId={
                    `project-editor/navigation-${this.props.id}` +
                    (this.props.navigationStore ? "-dialog" : "")
                }
                sizes={`240px|100%`}
                childrenOverflow="hidden"
            >
                <ListNavigation
                    id={this.props.id}
                    navigationObject={this.props.navigationObject}
                    navigationStore={this.props.navigationStore}
                    dragAndDropManager={this.props.dragAndDropManager}
                    onDoubleClickItem={this.props.onDoubleClickItem}
                />
                <PropertiesPanel
                    object={this.object}
                    navigationStore={this.props.navigationStore}
                />
            </Splitter>
        );
    }
}
