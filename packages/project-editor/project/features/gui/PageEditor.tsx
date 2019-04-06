import React from "react";
import { computed } from "mobx";
import { observer } from "mobx-react";
import { bind } from "bind-decorator";

import { Splitter } from "eez-studio-ui/splitter";

import { EditorComponent } from "eez-studio-shared/model/object";
import { TreeAdapter } from "eez-studio-shared/model/objectAdapter";
import { NavigationStore } from "eez-studio-shared/model/store";

import { Tree } from "eez-studio-shared/model/components/Tree";
import { Panel } from "eez-studio-shared/model/components/Panel";

import { WidgetPalette } from "eez-studio-page-editor/components/WidgetPalette";
import { PageEditor as StudioPageEditor } from "eez-studio-page-editor/editor";
import { getPageContext } from "eez-studio-page-editor/page-context";

import { Page, PageTabState } from "project-editor/project/features/gui/page";

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
