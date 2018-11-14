import * as React from "react";
import { computed } from "mobx";
import { observer } from "mobx-react";

import { IconAction } from "eez-studio-ui/action";
import { Splitter } from "eez-studio-ui/splitter";

import {
    NavigationStore,
    EditorsStore,
    UIStateStore,
    objectToString,
    addItem,
    deleteItem,
    canAdd,
    canDelete
} from "project-editor/core/store";
import { EezObject, NavigationComponentProps } from "project-editor/core/metaData";

import { Panel } from "project-editor/components/Panel";
import { List } from "project-editor/components/List";

////////////////////////////////////////////////////////////////////////////////

@observer
export class AddButton extends React.Component<
    {
        navigationObject: EezObject | undefined;
    },
    {}
> {
    onAdd() {
        if (this.props.navigationObject) {
            addItem(this.props.navigationObject);
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
export class DeleteButton extends React.Component<
    {
        navigationObject: EezObject | undefined;
    },
    {}
> {
    onDelete() {
        let selectedItem =
            this.props.navigationObject &&
            NavigationStore.getNavigationSelectedItemAsObject(this.props.navigationObject);
        if (selectedItem) {
            deleteItem(selectedItem);
        }
    }

    render() {
        let selectedItem =
            this.props.navigationObject &&
            NavigationStore.getNavigationSelectedItemAsObject(this.props.navigationObject);

        return (
            <IconAction
                title="Delete Selected Item"
                icon="material:remove"
                iconSize={16}
                onClick={this.onDelete.bind(this)}
                enabled={selectedItem && canDelete(selectedItem)}
            />
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

interface ListNavigationProps {
    title?: string;
    navigationObject: EezObject;
    onDoubleClickItem?: (item: EezObject) => void;
    additionalButtons?: JSX.Element[];
}

@observer
export class ListNavigation extends React.Component<ListNavigationProps, {}> {
    onDoubleClickItem(object: EezObject) {
        if (this.props.onDoubleClickItem) {
            this.props.onDoubleClickItem(object);
        } else if (EditorsStore.activeEditor && EditorsStore.activeEditor.object == object) {
            EditorsStore.activeEditor.makePermanent();
        }
    }

    @computed
    get selectedObject() {
        let selectedItem = NavigationStore.getNavigationSelectedItem(
            this.props.navigationObject
        ) as EezObject;
        return selectedItem || NavigationStore.selectedObject;
    }

    onFocus() {
        NavigationStore.setSelectedPanel(this);
    }

    render() {
        return (
            <Panel
                id="navigation"
                title={this.props.title || objectToString(this.props.navigationObject)}
                buttons={(this.props.additionalButtons || []).concat([
                    <AddButton key="add" navigationObject={this.props.navigationObject} />,
                    <DeleteButton key="delete" navigationObject={this.props.navigationObject} />
                ])}
                body={
                    <List
                        navigationObject={this.props.navigationObject}
                        onDoubleClick={this.onDoubleClickItem.bind(this)}
                        tabIndex={0}
                        onFocus={this.onFocus.bind(this)}
                    />
                }
            />
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

interface ListNavigationWithContentProps extends NavigationComponentProps {
    title?: string;
    onDoubleClickItem?: (item: EezObject) => void;
    additionalButtons?: JSX.Element[];
}

@observer
export class ListNavigationWithContent extends React.Component<ListNavigationWithContentProps, {}> {
    render() {
        if (UIStateStore.viewOptions.navigationVisible) {
            return (
                <Splitter
                    type="horizontal"
                    persistId={`project-editor/navigation-${this.props.id}`}
                    sizes={`240px|100%`}
                    childrenOverflow="hidden"
                >
                    <ListNavigation
                        title={this.props.title}
                        navigationObject={this.props.navigationObject}
                        onDoubleClickItem={this.props.onDoubleClickItem}
                        additionalButtons={this.props.additionalButtons}
                    />
                    {this.props.content}
                </Splitter>
            );
        } else {
            return this.props.content;
        }
    }
}
