import * as React from "react";
import { observable, computed, action } from "mobx";
import { observer } from "mobx-react";
import { bind } from "bind-decorator";

import { IconAction } from "eez-studio-shared/ui/action";

import { NavigationStore } from "project-editor/core/store";
import { EditorComponent } from "project-editor/core/metaData";

import * as Layout from "project-editor/components/Layout";
import { Panel } from "project-editor/components/Panel";
import { Tree } from "project-editor/components/Tree";

import { PageProperties, PageTabState } from "project-editor/project/features/gui/page";
import { WidgetPalette } from "project-editor/project/features/gui/WidgetPalette";
import { WidgetContainerEditor } from "project-editor/project/features/gui/WidgetContainerEditor";
import { ExperimentalWidgetContainerEditor } from "project-editor/project/features/gui/experimental-page-editor/editor";

////////////////////////////////////////////////////////////////////////////////

@observer
export class PageEditor extends EditorComponent {
    get page() {
        return this.props.editor.object as PageProperties;
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
                    container={pageTabState.selectedPageResolution}
                />
            );
        } else {
            editor = (
                <WidgetContainerEditor
                    displaySelection={
                        pageTabState.selectedPageResolutionState.widgetContainerDisplayItem
                    }
                    pageWidth={pageTabState.selectedPageResolution.width}
                    pageHeight={pageTabState.selectedPageResolution.height}
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

        if (this.isExperimentalEditor) {
            return panel;
        } else {
            let pageStructure = (
                <Tree
                    rootItem={pageTabState.selectedPageResolutionState.widgetContainerDisplayItem}
                    tabIndex={0}
                    collapsable={true}
                />
            );

            return (
                <Layout.Split
                    orientation="horizontal"
                    splitId="page-editor-horizontal"
                    splitPosition="0.7"
                    className="EezStudio_ProjectEditor_page-editor"
                    tabIndex={0}
                    onFocus={this.focusHandler}
                >
                    {panel}
                    <Layout.Split
                        orientation="vertical"
                        splitId="page-editor-vertical"
                        splitPosition="0.7"
                    >
                        <Panel id="page-structure" title="Page Structure" body={pageStructure} />
                        <Panel id="widgets" title="Widget Palette" body={<WidgetPalette />} />
                    </Layout.Split>
                </Layout.Split>
            );
        }
    }
}
