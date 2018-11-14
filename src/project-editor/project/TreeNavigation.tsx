import * as React from "react";
import { observer } from "mobx-react";

import { IconAction } from "eez-studio-shared/ui/action";

import {
    EditorsStore,
    NavigationStore,
    UIStateStore,
    objectToString,
    addItem,
    canAdd,
    getMetaData
} from "project-editor/core/store";
import { EezObject, NavigationComponent } from "project-editor/core/metaData";
import { TreeObjectAdapter } from "project-editor/core/objectAdapter";

import * as Layout from "project-editor/components/Layout";
import { Panel } from "project-editor/components/Panel";
import { Tree } from "project-editor/components/Tree";

////////////////////////////////////////////////////////////////////////////////

@observer
export class AddButton extends React.Component<
    {
        objectAdapter: TreeObjectAdapter;
    },
    {}
> {
    onAdd() {
        if (this.props.objectAdapter.selectedObject) {
            addItem(this.props.objectAdapter.selectedObject);
        }
    }

    render() {
        return (
            <IconAction
                title="Add Item"
                icon="material:add"
                iconSize={16}
                onClick={this.onAdd.bind(this)}
                enabled={
                    this.props.objectAdapter.selectedObject &&
                    canAdd(this.props.objectAdapter.selectedObject)
                }
            />
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
export class DeleteButton extends React.Component<
    {
        objectAdapter: TreeObjectAdapter;
    },
    {}
> {
    onDelete() {
        this.props.objectAdapter.deleteSelection();
    }

    render() {
        return (
            <IconAction
                title="Delete Selected Item"
                icon="material:delete"
                iconSize={16}
                onClick={this.onDelete.bind(this)}
                enabled={this.props.objectAdapter.canDelete()}
            />
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

interface TreeNavigationPanelProps {
    navigationObject: EezObject;
}

@observer
export class TreeNavigationPanel extends React.Component<TreeNavigationPanelProps, {}> {
    static navigationTreeFilter(object: EezObject) {
        const metaData = getMetaData(object);
        return (
            metaData.showInNavigation ||
            !!metaData.navigationComponent ||
            !!metaData.editorComponent
        );
    }

    onTreeDoubleClick(object: EezObject) {
        if (EditorsStore.activeEditor && EditorsStore.activeEditor.object == object) {
            EditorsStore.activeEditor.makePermanent();
        }
    }

    onFocus() {
        NavigationStore.setSelectedPanel(undefined);
    }

    render() {
        let navigationObjectAdapter = NavigationStore.getNavigationSelectedItemAsObjectAdapter(
            this.props.navigationObject
        );

        if (!navigationObjectAdapter) {
            const newNavigationObjectAdapter = new TreeObjectAdapter(this.props.navigationObject);

            setTimeout(() => {
                NavigationStore.setNavigationSelectedItem(
                    this.props.navigationObject,
                    newNavigationObjectAdapter
                );
            }, 0);

            navigationObjectAdapter = newNavigationObjectAdapter;
        }

        let objectAdapter = navigationObjectAdapter.getObjectAdapter(this.props.navigationObject);
        if (!objectAdapter) {
            return null;
        }

        return (
            <Panel
                id="navigation"
                title={objectToString(this.props.navigationObject)}
                buttons={[
                    <AddButton key="add" objectAdapter={navigationObjectAdapter} />,
                    <DeleteButton key="delete" objectAdapter={navigationObjectAdapter} />
                ]}
                body={
                    <Tree
                        item={objectAdapter}
                        rootItem={navigationObjectAdapter}
                        onDoubleClick={this.onTreeDoubleClick.bind(this)}
                        tabIndex={0}
                        filter={TreeNavigationPanel.navigationTreeFilter}
                        collapsable={true}
                        onFocus={this.onFocus.bind(this)}
                    />
                }
            />
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
export class TreeNavigation extends NavigationComponent {
    render() {
        if (UIStateStore.viewOptions.navigationVisible) {
            return (
                <Layout.Split
                    orientation="horizontal"
                    splitId={`navigation-${this.props.id}`}
                    splitPosition="0.25"
                >
                    <TreeNavigationPanel navigationObject={this.props.navigationObject} />
                    {this.props.content}
                </Layout.Split>
            );
        } else {
            return this.props.content;
        }
    }
}
