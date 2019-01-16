import React from "react";
import { observable, computed, action } from "mobx";
import { observer } from "mobx-react";
import { bind } from "bind-decorator";

import { IconAction } from "eez-studio-ui/action";
import { Splitter } from "eez-studio-ui/splitter";

import { EditorComponent } from "eez-studio-shared/model/object";
import { NavigationStore } from "eez-studio-shared/model/store";

import { Tree } from "eez-studio-shared/model/components/Tree";
import { Panel } from "eez-studio-shared/model/components/Panel";

import { WidgetPalette } from "eez-studio-page-editor/components/WidgetPalette";
import { PageEditor as StudioPageEditor } from "eez-studio-page-editor/editor";

import { Page, PageTabState } from "project-editor/project/features/gui/page";

////////////////////////////////////////////////////////////////////////////////

@observer
export class PageEditor extends EditorComponent {
    get page() {
        return this.props.editor.object as Page;
    }

    @observable
    showStructure: boolean =
        window.localStorage.getItem("showStructureInPageEditor") === "1" ? true : false;

    @action.bound
    toggleShowStructure() {
        this.showStructure = !this.showStructure;
        window.localStorage.setItem("showStructureInPageEditor", this.showStructure ? "1" : "0");
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
                showStructure={this.showStructure}
            />
        );

        const panel = (
            <Panel
                id="page-editor"
                title=""
                buttons={[
                    <IconAction
                        key="showDeepStructure"
                        title="Show structure"
                        icon="_images/diagram.png"
                        iconSize={24}
                        onClick={this.toggleShowStructure}
                        selected={this.showStructure}
                    />
                ]}
                body={editor}
            />
        );

        let pageStructure = (
            <Tree
                rootItem={pageTabState.widgetContainerDisplayItem}
                tabIndex={0}
                collapsable={true}
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
                {panel}
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
