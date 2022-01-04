import React from "react";
import { computed } from "mobx";
import { observer } from "mobx-react";
import * as FlexLayout from "flexlayout-react";

import { _find } from "eez-studio-shared/algorithm";

import { IEezObject } from "project-editor/core/object";
import { TreeAdapter } from "project-editor/core/objectAdapter";
import { IPanel, LayoutModel } from "project-editor/core/store";

import { ListNavigation } from "project-editor/components/ListNavigation";
import { Tree } from "project-editor/components/Tree";

import { ProjectContext } from "project-editor/project/context";

import { ProjectEditor } from "project-editor/project-editor-interface";
import { NavigationComponent } from "project-editor/project/NavigationComponent";
import { PageTabState } from "project-editor/features/page/PageEditor";
import { Page } from "project-editor/features/page/page";

////////////////////////////////////////////////////////////////////////////////

@observer
export class PagesNavigation extends NavigationComponent {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    get model() {
        return FlexLayout.Model.fromJson({
            global: LayoutModel.GLOBAL_OPTIONS,
            borders: [],
            layout: {
                type: "row",
                children: [
                    {
                        type: "row",
                        children: [
                            {
                                type: "tabset",
                                children: [
                                    {
                                        type: "tab",
                                        enableClose: false,
                                        name: "Pages",
                                        component: "pages"
                                    }
                                ]
                            },
                            {
                                type: "tabset",
                                children: [
                                    {
                                        type: "tab",
                                        enableClose: false,
                                        name: "Page Structure",
                                        component: "page-structure"
                                    }
                                ]
                            }
                        ]
                    }
                ]
            }
        });
    }

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

        return null;
    };

    render() {
        return (
            <FlexLayout.Layout
                model={this.model}
                factory={this.factory}
                realtimeResize={true}
                font={LayoutModel.FONT_SUB}
            />
        );
    }
}

@observer
export class PageStructure extends React.Component implements IPanel {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    @computed
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

    @computed
    get componentContainerDisplayItem() {
        if (!this.pageTabState) {
            return undefined;
        }

        return this.pageTabState.widgetContainer;
    }

    @computed
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

    onFocus = () => {
        this.context.navigationStore.setSelectedPanel(this);
    };

    render() {
        return this.treeAdapter ? (
            <Tree
                treeAdapter={this.treeAdapter}
                tabIndex={0}
                onFocus={this.onFocus}
            />
        ) : null;
    }
}
