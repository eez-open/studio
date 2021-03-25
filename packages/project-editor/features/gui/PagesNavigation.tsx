import React from "react";
import { computed, action } from "mobx";
import { observer } from "mobx-react";
import { bind } from "bind-decorator";

import { _find } from "eez-studio-shared/algorithm";

import { Splitter } from "eez-studio-ui/splitter";
import { IconAction } from "eez-studio-ui/action";

import {
    IEezObject,
    IEditorState,
    EditorComponent,
    NavigationComponent,
    getParent
} from "project-editor/core/object";
import {
    TreeObjectAdapter,
    ITreeObjectAdapter,
    TreeAdapter
} from "project-editor/core/objectAdapter";
import type { IPanel } from "project-editor/core/store";

import { ListNavigation } from "project-editor/components/ListNavigation";
import { Tree } from "project-editor/components/Tree";
import { Panel } from "project-editor/components/Panel";

import { PageEditor as StudioPageEditor } from "project-editor/features/gui/page-editor/editor";
import { ComponentsPalette } from "project-editor/features/gui/page-editor/ComponentsPalette";

import { Editors, PropertiesPanel } from "project-editor/project/ProjectEditor";

import { ThemesSideView } from "project-editor/features/gui/theme";
import { ProjectContext } from "project-editor/project/context";

import { Page } from "project-editor/features/gui/page";

////////////////////////////////////////////////////////////////////////////////

@observer
export class PageEditor extends EditorComponent implements IPanel {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    @bind
    focusHandler() {
        this.context.NavigationStore.setSelectedPanel(this);
    }

    @computed
    get treeAdapter() {
        let pageTabState = this.props.editor.state as PageTabState;
        return new TreeAdapter(
            pageTabState.widgetContainerDisplayItem,
            undefined,
            undefined,
            true
        );
    }

    @computed
    get selectedObject() {
        let pageTabState = this.props.editor.state as PageTabState;
        return pageTabState.selectedObject;
    }

    @computed
    get selectedObjects() {
        let pageTabState = this.props.editor.state as PageTabState;
        return pageTabState.selectedObjects;
    }

    cutSelection() {
        this.treeAdapter.cutSelection();
    }

    copySelection() {
        this.treeAdapter.copySelection();
    }

    pasteSelection() {
        this.treeAdapter.pasteSelection();
    }

    deleteSelection() {
        this.treeAdapter.deleteSelection();
    }

    render() {
        let pageTabState = this.props.editor.state as PageTabState;
        return (
            <StudioPageEditor
                widgetContainer={pageTabState.widgetContainerDisplayItem}
            />
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

export class PageTabState implements IEditorState {
    page: Page;
    widgetContainerDisplayItem: ITreeObjectAdapter;

    constructor(object: IEezObject) {
        this.page = object as Page;
        this.widgetContainerDisplayItem = new TreeObjectAdapter(this.page);
    }

    @computed
    get selectedObject(): IEezObject | undefined {
        return this.widgetContainerDisplayItem.selectedObject || this.page;
    }

    @computed
    get selectedObjects() {
        return this.widgetContainerDisplayItem.selectedObjects;
    }

    loadState(state: any) {
        this.widgetContainerDisplayItem.loadState(state);
    }

    saveState() {
        return this.widgetContainerDisplayItem.saveState();
    }

    @action
    selectObject(object: IEezObject) {
        let ancestor: IEezObject | undefined;
        for (ancestor = object; ancestor; ancestor = getParent(ancestor)) {
            let item = this.widgetContainerDisplayItem.getObjectAdapter(
                ancestor
            );
            if (item) {
                this.widgetContainerDisplayItem.selectItems([item]);
                return;
            }
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
export class PagesNavigation extends NavigationComponent {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    @computed
    get object() {
        if (this.context.NavigationStore.selectedPanel) {
            return this.context.NavigationStore.selectedPanel.selectedObject;
        }
        return this.context.NavigationStore.selectedObject;
    }

    @computed
    get widgetContainerDisplayItem() {
        if (!this.context.EditorsStore.activeEditor) {
            return undefined;
        }
        let pageTabState = this.context.EditorsStore.activeEditor
            .state as PageTabState;
        if (!pageTabState) {
            return undefined;
        }
        return pageTabState.widgetContainerDisplayItem;
    }

    @computed
    get treeAdapter() {
        if (!this.widgetContainerDisplayItem) {
            return null;
        }
        return new TreeAdapter(
            this.widgetContainerDisplayItem,
            undefined,
            undefined,
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
            this.widgetContainerDisplayItem &&
            this.widgetContainerDisplayItem.selectedObjects;
        if (selectedObjects && selectedObjects.length > 0) {
            return selectedObjects;
        }

        if (this.context.EditorsStore.activeEditor) {
            let pageTabState = this.context.EditorsStore.activeEditor
                .state as PageTabState;
            return [pageTabState.page];
        }

        return [];
    }

    @bind
    onFocus() {
        this.context.NavigationStore.setSelectedPanel(this);
    }

    render() {
        const navigation = (
            <Splitter
                type="vertical"
                persistId="page-editor/navigation-structure"
                sizes={`50%|50%`}
                childrenOverflow="hidden|hidden"
            >
                <ListNavigation
                    id={this.props.id}
                    navigationObject={this.props.navigationObject}
                />
                <Panel
                    id="page-structure"
                    title="Page Structure"
                    body={
                        this.treeAdapter ? (
                            <Tree
                                treeAdapter={this.treeAdapter}
                                tabIndex={0}
                                onFocus={this.onFocus}
                            />
                        ) : (
                            <div />
                        )
                    }
                />
            </Splitter>
        );

        const buttons: JSX.Element[] = [];

        if (!this.context.UIStateStore.viewOptions.themesVisible) {
            buttons.push(
                <IconAction
                    key="show-themes"
                    icon="material:palette"
                    iconSize={16}
                    onClick={action(
                        () =>
                            (this.context.UIStateStore.viewOptions.themesVisible = true)
                    )}
                    title="Show themes panel"
                ></IconAction>
            );
        }

        const properties = (
            <Splitter
                type="vertical"
                persistId="page-editor/properties-widgets-palette"
                sizes={`100%|200px`}
                childrenOverflow="hidden|hidden"
            >
                <PropertiesPanel
                    object={this.selectedObject}
                    buttons={buttons}
                />
                <ComponentsPalette />
            </Splitter>
        );

        return (
            <Splitter
                type="horizontal"
                persistId={`project-editor/pages${
                    this.context.UIStateStore.viewOptions.themesVisible
                        ? ""
                        : "-without-themes"
                }`}
                sizes={`240px|100%|400px${
                    this.context.UIStateStore.viewOptions.themesVisible
                        ? "|240px"
                        : ""
                }`}
                childrenOverflow={`hidden|hidden|hidden${
                    this.context.UIStateStore.viewOptions.themesVisible
                        ? "|hidden"
                        : ""
                }`}
            >
                {navigation}
                <Editors />
                {properties}
                {this.context.UIStateStore.viewOptions.themesVisible && (
                    <ThemesSideView hasCloseButton={true} />
                )}
            </Splitter>
        );
    }
}
