import React from "react";
import { observable, computed, action } from "mobx";
import { observer } from "mobx-react";
import { bind } from "bind-decorator";

import { IconAction } from "eez-studio-ui/action";
import { Splitter } from "eez-studio-ui/splitter";

import { EditorComponent } from "eez-studio-shared/model/object";
import { NavigationStore } from "eez-studio-shared/model/store";

import { Panel } from "project-editor/components/Panel";
import { Tree } from "eez-studio-shared/model/components/Tree";

import { Page, PageTabState } from "project-editor/project/features/gui/page";
import { WidgetPalette } from "project-editor/project/features/gui/WidgetPalette";
import { WidgetContainerEditor } from "project-editor/project/features/gui/WidgetContainerEditor";
import { ExperimentalWidgetContainerEditor } from "project-editor/project/features/gui/experimental-page-editor/editor";

////////////////////////////////////////////////////////////////////////////////

@observer
export class PageEditor extends EditorComponent {
    get page() {
        return this.props.editor.object as Page;
    }

    @observable
    isExperimentalEditor: boolean =
        window.localStorage.getItem("isExperimentalEditor") === "1" ? true : false;

    @action.bound
    toggleExperimentalEditor() {
        this.isExperimentalEditor = !this.isExperimentalEditor;
        window.localStorage.setItem("isExperimentalEditor", this.isExperimentalEditor ? "1" : "0");
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

        let editor;
        if (this.isExperimentalEditor) {
            editor = (
                <ExperimentalWidgetContainerEditor
                    widgetContainer={pageTabState.widgetContainerDisplayItem}
                />
            );
        } else {
            editor = (
                <WidgetContainerEditor
                    displaySelection={pageTabState.widgetContainerDisplayItem}
                    pageWidth={pageTabState.page.width}
                    pageHeight={pageTabState.page.height}
                />
            );
        }

        const panel = (
            <Panel
                id="page-editor"
                title=""
                buttons={[
                    <IconAction
                        key="experiment"
                        title="Experiment"
                        icon="material:star"
                        iconSize={16}
                        onClick={this.toggleExperimentalEditor}
                        selected={this.isExperimentalEditor}
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
