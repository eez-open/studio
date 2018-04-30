import * as React from "react";

import { EditorComponent, EditorComponentProps } from "project-editor/core/metaData";
import { NavigationStore, objectToString } from "project-editor/core/store";

import * as Layout from "project-editor/components/Layout";
import { Panel } from "project-editor/components/Panel";
import { Tree } from "project-editor/components/Tree";

import { WidgetPalette } from "project-editor/project/features/gui/WidgetPalette";
import { WidgetContainerEditor } from "project-editor/project/features/gui/WidgetContainerEditor";
import { WidgetTypeTabState } from "project-editor/project/features/gui/widgetType";

export class WidgetTypeEditor extends EditorComponent {
    constructor(props: EditorComponentProps) {
        super(props);
    }

    focusHander() {
        NavigationStore.setSelectedPanel(this.props.editor.state as WidgetTypeTabState);
    }

    render() {
        let widgetTypeTabState = this.props.editor.state as WidgetTypeTabState;

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
                <Panel
                    id="page-editor"
                    title={"Widget: " + objectToString(this.props.editor.object)}
                    buttons={[]}
                    body={
                        <WidgetContainerEditor
                            displaySelection={widgetTypeTabState.widgetContainerDisplayItem}
                        />
                    }
                />
                <Layout.Split orientation="vertical" splitId="page-editor-vertical">
                    <Panel id="page-structure" title="Widget Structure" body={widgetStructure} />
                    <Panel id="widgets" title="Widget Palette" body={<WidgetPalette />} />
                </Layout.Split>
            </Layout.Split>
        );
    }
}
