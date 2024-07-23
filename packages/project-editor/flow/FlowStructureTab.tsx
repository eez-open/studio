import React from "react";
import { computed, observable, makeObservable } from "mobx";
import { observer } from "mobx-react";

import { ProjectContext } from "project-editor/project/context";
import { Page } from "project-editor/features/page/page";
import { Action } from "project-editor/features/action/action";
import { IEezObject } from "project-editor/core/object";
import { PageStructure } from "project-editor/features/page/PagesNavigation";

////////////////////////////////////////////////////////////////////////////////

export const FlowStructureTab = observer(
    class FlowStructureTab extends React.Component {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        selectedLocalVariable = observable.box<IEezObject>();

        constructor(props: any) {
            super(props);

            makeObservable(this, {
                localVariables: computed
            });
        }

        get localVariables() {
            const editor = this.context.editorsStore.activeEditor;
            if (editor) {
                const object = editor.object;
                if (object instanceof Page || object instanceof Action) {
                    return object.localVariables;
                }
            }

            return undefined;
        }

        render() {
            return <PageStructure />;
            // if (!this.context.projectTypeTraits.hasFlowSupport) {
            //     return <PageStructure />;
            // }

            // return (
            //     <SubNavigation
            //         id={NavigationStore.FLOW_STRUCTURE_SUB_NAVIGATION_ID}
            //         items={[
            //             {
            //                 name: NavigationStore.FLOW_STRUCTURE_SUB_NAVIGATION_ITEM_WIDGETS,
            //                 component: <PageStructure />
            //             },
            //             {
            //                 name: NavigationStore.FLOW_STRUCTURE_SUB_NAVIGATION_ITEM_ACTIONS,
            //                 component: <ActionComponents />
            //             }
            //         ]}
            //     />
            // );
        }
    }
);

/*
const ActionComponents = observer(
    class ActionComponents extends React.Component implements IPanel {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        constructor(props: any) {
            super(props);

            makeObservable(this, {
                flowTabState: computed,
                componentContainerDisplayItem: computed,
                treeAdapter: computed
            });
        }

        componentDidMount() {
            this.context.navigationStore.mountPanel(this);
        }

        componentWillUnmount() {
            this.context.navigationStore.unmountPanel(this);
        }

        get flowTabState() {
            const editor = this.context.editorsStore.activeEditor;
            if (!editor) {
                return undefined;
            }

            const object = editor.object;
            if (
                object instanceof ProjectEditor.PageClass ||
                object instanceof ProjectEditor.ActionClass
            ) {
                return editor.state as FlowTabState;
            }

            return undefined;
        }

        get componentContainerDisplayItem() {
            if (!this.flowTabState) {
                return undefined;
            }

            return this.flowTabState.widgetContainer;
        }

        get treeAdapter() {
            if (!this.componentContainerDisplayItem) {
                return null;
            }
            return new TreeAdapter(
                this.componentContainerDisplayItem,
                (object: IEezObject) => {
                    return (
                        object instanceof ProjectEditor.ActionComponentClass &&
                        !(object instanceof CommentActionComponent)
                    );
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

            if (this.flowTabState) {
                return [this.flowTabState.flow];
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
*/
