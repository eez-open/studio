import React from "react";
import { observer } from "mobx-react";
import { bind } from "bind-decorator";

import { IconAction } from "eez-studio-ui/action";

import {
    IEezObject,
    objectToString,
    getClassInfo
} from "project-editor/core/object";
import { addItem, canAdd } from "project-editor/core/store";
import {
    TreeObjectAdapter,
    ITreeObjectAdapter,
    TreeAdapter
} from "project-editor/core/objectAdapter";

import { Panel } from "project-editor/components/Panel";
import { Tree } from "project-editor/components/Tree";
import { ProjectContext } from "project-editor/project/context";

////////////////////////////////////////////////////////////////////////////////

@observer
class AddButton extends React.Component<
    {
        objectAdapter: ITreeObjectAdapter;
    },
    {}
> {
    async onAdd() {
        if (this.props.objectAdapter.selectedObject) {
            const aNewItem = await addItem(
                this.props.objectAdapter.selectedObject
            );
            if (aNewItem) {
                this.props.objectAdapter.selectObject(aNewItem);
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
class DeleteButton extends React.Component<
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

@observer
export class TreeNavigationPanel extends React.Component<
    {
        navigationObjectAdapter: TreeObjectAdapter;
    },
    {}
> {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    static navigationTreeFilter(object: IEezObject) {
        const classInfo = getClassInfo(object);
        return (
            classInfo.showInNavigation ||
            !!classInfo.navigationComponent ||
            !!classInfo.editorComponent
        );
    }

    @bind
    onTreeDoubleClick(object: IEezObject) {
        if (
            this.context.editorsStore.activeEditor &&
            this.context.editorsStore.activeEditor.object == object
        ) {
            this.context.editorsStore.activeEditor.makePermanent();
        }
    }

    onFocus() {
        this.context.navigationStore.setSelectedPanel(undefined);
    }

    render() {
        const navigationObjectAdapter = this.props.navigationObjectAdapter;

        return (
            <Panel
                id="navigation"
                title={objectToString(
                    this.props.navigationObjectAdapter.object
                )}
                buttons={[
                    <AddButton
                        key="add"
                        objectAdapter={navigationObjectAdapter}
                    />,
                    <DeleteButton
                        key="delete"
                        objectAdapter={navigationObjectAdapter}
                    />
                ]}
                body={
                    <Tree
                        treeAdapter={
                            new TreeAdapter(
                                navigationObjectAdapter,
                                navigationObjectAdapter,
                                TreeNavigationPanel.navigationTreeFilter,
                                true,
                                "none",
                                undefined,
                                this.onTreeDoubleClick
                            )
                        }
                        tabIndex={0}
                        onFocus={this.onFocus.bind(this)}
                    />
                }
            />
        );
    }
}
