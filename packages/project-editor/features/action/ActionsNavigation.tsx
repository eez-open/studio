import React from "react";
import { observer } from "mobx-react";
import * as FlexLayout from "flexlayout-react";
import { computed, makeObservable } from "mobx";

import { ProjectContext } from "project-editor/project/context";
import { ListNavigation } from "project-editor/ui-components/ListNavigation";
import { NavigationComponent } from "project-editor/project/NavigationComponent";
import { LocalVariables } from "../variable/VariablesNavigation";
import { LayoutModels } from "project-editor/store";
import { IEezObject } from "project-editor/core/object";
import { TreeAdapter } from "project-editor/core/objectAdapter";
import { IPanel } from "project-editor/store";
import { Tree } from "project-editor/ui-components/Tree";
import { ProjectEditor } from "project-editor/project-editor-interface";
import type { ActionFlowTabState } from "../action/ActionEditor";

export const ActionsNavigation = observer(
    class ActionsNavigation extends NavigationComponent {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        factory = (node: FlexLayout.TabNode) => {
            var component = node.getComponent();

            if (component === "actions") {
                return (
                    <ListNavigation
                        id={this.props.id}
                        navigationObject={this.props.navigationObject}
                        selectedObject={
                            this.context.navigationStore.selectedActionObject
                        }
                        editable={!this.context.runtime}
                        onDoubleClickItem={this.props.onDoubleClickItem}
                    />
                );
            }

            if (component === "action-components") {
                return <ActionComponents />;
            }

            if (component === "locals") {
                return <LocalVariables />;
            }

            return null;
        };

        render() {
            return (
                <FlexLayout.Layout
                    model={this.context.layoutModels.actions}
                    factory={this.factory}
                    realtimeResize={true}
                    font={LayoutModels.FONT_SUB}
                />
            );
        }
    }
);

export const ActionComponents = observer(
    class ActionComponents extends React.Component implements IPanel {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        constructor(props: any) {
            super(props);

            makeObservable(this, {
                actionFlowTabState: computed,
                componentContainerDisplayItem: computed,
                treeAdapter: computed
            });
        }

        componentDidMount() {
            this.context.navigationStore.setInitialSelectedPanel(this);
        }

        get actionFlowTabState() {
            const editor = this.context.editorsStore.activeEditor;
            if (!editor) {
                return undefined;
            }

            const object = editor.object;
            if (!(object instanceof ProjectEditor.ActionClass)) {
                return undefined;
            }

            return editor.state as ActionFlowTabState;
        }

        get componentContainerDisplayItem() {
            if (!this.actionFlowTabState) {
                return undefined;
            }

            return this.actionFlowTabState.widgetContainer;
        }

        get treeAdapter() {
            if (!this.componentContainerDisplayItem) {
                return null;
            }
            return new TreeAdapter(
                this.componentContainerDisplayItem,
                undefined,
                (object: IEezObject) => {
                    return object instanceof ProjectEditor.ActionComponentClass;
                },
                true
            );
        }

        // interface IPanel implementation
        get selectedObject() {
            return this.selectedObjects[0];
        }

        get selectedObjects() {
            const selectedObjects =
                this.componentContainerDisplayItem &&
                this.componentContainerDisplayItem.selectedObjects;
            if (selectedObjects && selectedObjects.length > 0) {
                return selectedObjects;
            }

            if (this.actionFlowTabState) {
                return [this.actionFlowTabState.flow];
            }

            return [];
        }
        cutSelection() {
            this.treeAdapter!.cutSelection();
        }
        copySelection() {
            this.treeAdapter!.copySelection();
        }
        pasteSelection() {
            this.treeAdapter!.pasteSelection();
        }
        deleteSelection() {
            this.treeAdapter!.deleteSelection();
        }
        onFocus = () => {
            this.context.navigationStore.setSelectedPanel(this);
        };

        renderItem = (itemId: string) => {
            if (!this.treeAdapter) {
                return null;
            }
            const item = this.treeAdapter.getItemFromId(itemId);
            if (!item) {
                return null;
            }

            return (
                <span className="EezStudio_ActionComponentTreeTrow">
                    <span>{this.treeAdapter.itemToString(item)}</span>
                </span>
            );
        };

        render() {
            return this.treeAdapter ? (
                <Tree
                    treeAdapter={this.treeAdapter}
                    onFocus={this.onFocus}
                    tabIndex={0}
                    renderItem={this.renderItem}
                />
            ) : null;
        }
    }
);
