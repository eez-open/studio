import React from "react";
import { computed, action } from "mobx";
import { observer } from "mobx-react";
import { bind } from "bind-decorator";

import { _find } from "eez-studio-shared/algorithm";

import {
    EezObject,
    IEditorState,
    hidePropertiesInPropertyGrid,
    EditorComponent
} from "project-editor/model/object";
import {
    TreeObjectAdapter,
    ITreeObjectAdapter,
    TreeAdapter
} from "project-editor/model/objectAdapter";
import { NavigationStore } from "project-editor/model/store";
import { Tree } from "project-editor/model/components/Tree";
import { Panel } from "project-editor/model/components/Panel";

import { Splitter } from "eez-studio-ui/splitter";

import { WidgetPalette } from "project-editor/project/features/gui/page-editor/components/WidgetPalette";
import { PageEditor as StudioPageEditor } from "project-editor/project/features/gui/page-editor/editor";
import { getPageContext } from "project-editor/project/features/gui/page-editor/page-context";

import { Page } from "project-editor/project/features/gui/page";

import { ListNavigationWithContent } from "project-editor/project/ui/ListNavigation";

////////////////////////////////////////////////////////////////////////////////

export { Page } from "project-editor/project/features/gui/page-editor/page";

////////////////////////////////////////////////////////////////////////////////

@observer
export class PageEditor extends EditorComponent {
    get page() {
        return this.props.editor.object as Page;
    }

    @bind
    focusHandler() {
        NavigationStore.setSelectedPanel(this);
    }

    @computed
    get selectedObject() {
        let pageTabState = this.props.editor.state as PageTabState;
        return pageTabState.selectedObject;
    }

    render() {
        let pageTabState = this.props.editor.state as PageTabState;

        let editor = (
            <StudioPageEditor
                widgetContainer={pageTabState.widgetContainerDisplayItem}
                dataContext={getPageContext().rootDataContext}
            />
        );

        let pageStructure = (
            <Tree
                treeAdapter={
                    new TreeAdapter(
                        pageTabState.widgetContainerDisplayItem,
                        undefined,
                        undefined,
                        true
                    )
                }
                tabIndex={0}
            />
        );

        return (
            <Splitter
                type="horizontal"
                persistId="page-editor/horizontal"
                sizes={`100%|240px`}
                tabIndex={0}
                onFocus={this.focusHandler}
                childrenOverflow="hidden"
            >
                {editor}
                <Splitter
                    type="vertical"
                    persistId="page-editor/vertical"
                    sizes={`100%|240px`}
                    childrenOverflow="hidden"
                >
                    <Panel id="page-structure" title="Page Structure" body={pageStructure} />
                    <Panel id="widgets" title="Widget Palette" body={<WidgetPalette />} />
                </Splitter>
            </Splitter>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

Page.classInfo.editorComponent = PageEditor;
Page.classInfo.navigationComponent = ListNavigationWithContent;

hidePropertiesInPropertyGrid(Page, [
    "display",
    "position",
    "right",
    "bottom",
    "windowWidth",
    "windowHeight",
    "scrollable",
    "css",
    "className"
]);

////////////////////////////////////////////////////////////////////////////////

export class PageTabState implements IEditorState {
    page: Page;
    widgetContainerDisplayItem: ITreeObjectAdapter;

    constructor(object: EezObject) {
        this.page = object as Page;
        this.widgetContainerDisplayItem = new TreeObjectAdapter(this.page);
    }

    @computed
    get selectedObject(): EezObject | undefined {
        return this.widgetContainerDisplayItem.selectedObject || this.page;
    }

    loadState(state: any) {
        this.widgetContainerDisplayItem.loadState(state);
    }

    saveState() {
        return this.widgetContainerDisplayItem.saveState();
    }

    @action
    selectObject(object: EezObject) {
        let item = this.widgetContainerDisplayItem.getObjectAdapter(object);
        if (item) {
            this.widgetContainerDisplayItem.selectItems([item]);
        }
    }
}
