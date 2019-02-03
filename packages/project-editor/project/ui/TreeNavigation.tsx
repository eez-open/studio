import React from "react";
import { observer } from "mobx-react";

import { IconAction } from "eez-studio-ui/action";
import { Splitter } from "eez-studio-ui/splitter";

import { EezObject, NavigationComponent, objectToString } from "eez-studio-shared/model/object";
import {
    EditorsStore,
    NavigationStore,
    UIStateStore,
    addItem,
    canAdd
} from "eez-studio-shared/model/store";
import { TreeObjectAdapter, ITreeObjectAdapter } from "eez-studio-shared/model/objectAdapter";

import { Panel } from "eez-studio-shared/model/components/Panel";
import { Tree } from "eez-studio-shared/model/components/Tree";

////////////////////////////////////////////////////////////////////////////////

@observer
export class AddButton extends React.Component<
    {
        objectAdapter: ITreeObjectAdapter;
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
        objectAdapter: ITreeObjectAdapter;
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
        const classInfo = object._classInfo;
        return (
            classInfo.showInNavigation ||
            !!classInfo.navigationComponent ||
            !!classInfo.editorComponent
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
                <Splitter
                    type="horizontal"
                    persistId={`project-editor/navigation-${this.props.id}`}
                    sizes={`240px|100%`}
                    childrenOverflow="hidden"
                >
                    <TreeNavigationPanel navigationObject={this.props.navigationObject} />
                    {this.props.content}
                </Splitter>
            );
        } else {
            return this.props.content;
        }
    }
}
