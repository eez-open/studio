import { computed, action } from "mobx";

import { _find } from "eez-studio-shared/algorithm";

import { EezObject, IEditorState } from "eez-studio-shared/model/object";
import { TreeObjectAdapter } from "eez-studio-shared/model/objectAdapter";

import { Page } from "eez-studio-page-editor/page";

import { ListNavigationWithContent } from "project-editor/project/ui/ListNavigation";

import { PageEditor } from "project-editor/project/features/gui/PageEditor";

////////////////////////////////////////////////////////////////////////////////

export { Page } from "eez-studio-page-editor/page";

////////////////////////////////////////////////////////////////////////////////

Page.classInfo.editorComponent = PageEditor;
Page.classInfo.navigationComponent = ListNavigationWithContent;

////////////////////////////////////////////////////////////////////////////////

export class PageTabState implements IEditorState {
    page: Page;
    widgetContainerDisplayItem: TreeObjectAdapter;

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
