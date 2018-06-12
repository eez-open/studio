import * as React from "react";
import { observable, action } from "mobx";
import { observer } from "mobx-react";

import { IconAction } from "shared/ui/action";

import { EditorComponent, EditorComponentProps } from "project-editor/core/metaData";
import { NavigationStore, objectToString } from "project-editor/core/store";

import * as Layout from "project-editor/components/Layout";
import { Panel } from "project-editor/components/Panel";
import { Tree } from "project-editor/components/Tree";

import { WidgetPalette } from "project-editor/project/features/gui/WidgetPalette";
import { WidgetContainerEditor } from "project-editor/project/features/gui/WidgetContainerEditor";
import {
    WidgetTypeTabState,
    WidgetTypeProperties
} from "project-editor/project/features/gui/widgetType";
import { ExperimentalWidgetContainerEditor } from "project-editor/project/features/gui/experimental-page-editor/editor";

@observer
export class WidgetTypeEditor extends EditorComponent {
    constructor(props: EditorComponentProps) {
        super(props);
    }

    @observable
    isExperimentalEditor: boolean =
        window.localStorage.getItem("isExperimentalEditor") === "1" ? true : false;

    @action.bound
    toggleExperimentalEditor() {
        this.isExperimentalEditor = !this.isExperimentalEditor;
        window.localStorage.setItem("isExperimentalEditor", this.isExperimentalEditor ? "1" : "0");
    }

    focusHander() {
        NavigationStore.setSelectedPanel(this.props.editor.state as WidgetTypeTabState);
    }

    render() {
        let widgetTypeTabState = this.props.editor.state as WidgetTypeTabState;

        let editor;
        if (this.isExperimentalEditor) {
            editor = (
                <ExperimentalWidgetContainerEditor
                    container={
                        widgetTypeTabState.widgetContainerDisplayItem.object as WidgetTypeProperties
                    }
                />
            );
        } else {
            editor = (
                <WidgetContainerEditor
                    displaySelection={widgetTypeTabState.widgetContainerDisplayItem}
                />
            );
        }

        const panel = (
            <Panel
                id="page-editor"
                title={"Widget: " + objectToString(this.props.editor.object)}
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
            let widgetStructure = (
                <Tree
                    rootItem={widgetTypeTabState.widgetContainerDisplayItem}
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
                    onFocus={this.focusHander.bind(this)}
                >
                    {panel}
                    <Layout.Split orientation="vertical" splitId="page-editor-vertical">
                        <Panel
                            id="page-structure"
                            title="Widget Structure"
                            body={widgetStructure}
                        />
                        <Panel id="widgets" title="Widget Palette" body={<WidgetPalette />} />
                    </Layout.Split>
                </Layout.Split>
            );
        }
    }
}
