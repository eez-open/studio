import React from "react";
import { computed, makeObservable } from "mobx";
import { observer } from "mobx-react";
import * as FlexLayout from "flexlayout-react";

import { _find } from "eez-studio-shared/algorithm";

import { IEezObject } from "project-editor/core/object";
import { TreeAdapter } from "project-editor/core/objectAdapter";
import { IPanel, LayoutModels } from "project-editor/store";

import { ListNavigation } from "project-editor/components/ListNavigation";
import { Tree } from "project-editor/components/Tree";

import { ProjectContext } from "project-editor/project/context";

import { ProjectEditor } from "project-editor/project-editor-interface";
import { NavigationComponent } from "project-editor/project/NavigationComponent";
import { PageTabState } from "project-editor/features/page/PageEditor";
import { Page } from "project-editor/features/page/page";
import { LocalVariables } from "../variable/VariablesNavigation";

////////////////////////////////////////////////////////////////////////////////

export const PagesNavigation = observer(
    class PagesNavigation extends NavigationComponent {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        factory = (node: FlexLayout.TabNode) => {
            var component = node.getComponent();

            if (component === "pages") {
                return (
                    <ListNavigation
                        id={this.props.id}
                        navigationObject={this.props.navigationObject}
                        selectedObject={
                            this.context.navigationStore.selectedPageObject
                        }
                        editable={!this.context.runtime}
                    />
                );
            }

            if (component === "page-structure") {
                return <PageStructure />;
            }

            if (component === "local-vars") {
                return <LocalVariables />;
            }

            return null;
        };

        render() {
            return (
                <FlexLayout.Layout
                    model={this.context.layoutModels.pages}
                    factory={this.factory}
                    realtimeResize={true}
                    font={LayoutModels.FONT_SUB}
                />
            );
        }
    }
);

export const PageStructure = observer(
    class PageStructure extends React.Component implements IPanel {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        constructor(props: any) {
            super(props);

            makeObservable(this, {
                pageTabState: computed,
                componentContainerDisplayItem: computed,
                treeAdapter: computed
            });
        }

        get pageTabState() {
            const editor = this.context.editorsStore.activeEditor;
            if (!editor) {
                return undefined;
            }

            const object = editor.object;
            if (!(object instanceof Page)) {
                return undefined;
            }

            return editor.state as PageTabState;
        }

        get componentContainerDisplayItem() {
            if (!this.pageTabState) {
                return undefined;
            }

            return this.pageTabState.widgetContainer;
        }

        get treeAdapter() {
            if (!this.componentContainerDisplayItem) {
                return null;
            }
            return new TreeAdapter(
                this.componentContainerDisplayItem,
                undefined,
                (object: IEezObject) => {
                    return object instanceof ProjectEditor.WidgetClass;
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

            if (this.pageTabState) {
                return [this.pageTabState.page];
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

        render() {
            return this.treeAdapter ? (
                <Tree
                    treeAdapter={this.treeAdapter}
                    onFocus={this.onFocus}
                    tabIndex={0}
                />
            ) : null;
        }
    }
);
