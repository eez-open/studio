import { observer } from "mobx-react";
import * as React from "react";

import { IconAction } from "shared/ui/action";

import { NavigationStore } from "project-editor/core/store";
import { EditorComponent } from "project-editor/core/metaData";

import * as Layout from "project-editor/components/Layout";
import { Panel } from "project-editor/components/Panel";
import { Tree } from "project-editor/components/Tree";

import { PageProperties, PageTabState } from "project-editor/project/features/gui/page";
import { WidgetPalette } from "project-editor/project/features/gui/WidgetPalette";
import { WidgetContainerEditor } from "project-editor/project/features/gui/WidgetContainerEditor";

////////////////////////////////////////////////////////////////////////////////

@observer
export class PageEditor extends EditorComponent {
    get page() {
        return this.props.editor.object as PageProperties;
    }

    onPortrait() {
        let pageTabState = this.props.editor.state as PageTabState;
        pageTabState.selectPortrait();
    }

    onLandscape() {
        let pageTabState = this.props.editor.state as PageTabState;
        pageTabState.selectLandscape();
    }

    focusHander() {
        NavigationStore.setSelectedPanel(this.props.editor.state as PageTabState);
    }

    render() {
        let pageTabState = this.props.editor.state as PageTabState;

        let pageStructure = (
            <Tree
                rootItem={pageTabState.selectedPageOrientationState.widgetContainerDisplayItem}
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
                onFocus={this.focusHander.bind(this)}
            >
                <Panel
                    id="page-editor"
                    title=""
                    buttons={[
                        <IconAction
                            key="portrait"
                            title="Portrait"
                            icon="material:crop_portrait"
                            iconSize={16}
                            onClick={this.onPortrait.bind(this)}
                            selected={pageTabState.selectedScreenOrientation == "portrait"}
                        />,
                        <IconAction
                            key="landscape"
                            title="Landscape"
                            icon="material:crop_landscape"
                            iconSize={16}
                            onClick={this.onLandscape.bind(this)}
                            selected={pageTabState.selectedScreenOrientation == "landscape"}
                        />
                    ]}
                    body={
                        <WidgetContainerEditor
                            displaySelection={
                                pageTabState.selectedPageOrientationState.widgetContainerDisplayItem
                            }
                        />
                    }
                />
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
