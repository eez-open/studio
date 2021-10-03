import React from "react";
import { computed } from "mobx";
import { observer } from "mobx-react";

import { isWebStudio } from "eez-studio-shared/util-electron";

import { Splitter } from "eez-studio-ui/splitter";

import { Output } from "project-editor/components/Output";

import { MenuNavigation } from "project-editor/components/MenuNavigation";
import { ProjectContext } from "project-editor/project/context";
import { CommandPalette } from "project-editor/project/command-palette";
import { Toolbar } from "project-editor/project/Toolbar";
import { StatusBar } from "project-editor/project/StatusBar";
import { Editors } from "./Editors";
import { getClassInfo } from "project-editor/core/object";
import { DebuggerPanel } from "project-editor/flow/debugger/DebuggerPanel";
import {
    PageEditor,
    PageTabState
} from "project-editor/features/page/PagesNavigation";

import { LineMarkers } from "project-editor/flow/flow-editor/ConnectionLineComponent";

////////////////////////////////////////////////////////////////////////////////

@observer
class Content extends React.Component {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    @computed
    get object() {
        if (this.context.navigationStore.selectedPanel) {
            return this.context.navigationStore.selectedPanel.selectedObject;
        }
        return this.context.navigationStore.selectedObject;
    }

    render() {
        if (
            this.context.runtimeStore.isRuntimeMode &&
            !this.context.runtimeStore.isDebuggerActive
        ) {
            return (
                <PageEditor
                    editor={{
                        object: this.context.runtimeStore.selectedPage,
                        state: new PageTabState(
                            this.context.runtimeStore.selectedPage
                        )
                    }}
                ></PageEditor>
            );
        }

        const menuNavigation = (
            <MenuNavigation
                id="project"
                navigationObject={this.context.project}
                filter={object => {
                    if (this.context.runtimeStore.isRuntimeMode) {
                        // if runtime onde only show pages and actions
                        return (
                            object == this.context.project.pages ||
                            object == this.context.project.actions
                        );
                    }
                    return true;
                }}
            />
        );

        let editors;

        let selectedObject =
            this.context.navigationStore.getNavigationSelectedObject(
                this.context.project
            );
        if (selectedObject) {
            if (getClassInfo(selectedObject).editorComponent) {
                editors = <Editors />;
            }
        }

        if (editors) {
            if (this.context.runtimeStore.isRuntimeMode) {
                return (
                    <Splitter
                        type="horizontal"
                        persistId={`project-editor/content-runtime-with-debug"`}
                        sizes={"240px|100%|400px"}
                        childrenOverflow={`hidden|hidden|hidden`}
                    >
                        {menuNavigation}
                        {editors}
                        {<DebuggerPanel />}
                    </Splitter>
                );
            } else {
                return (
                    <Splitter
                        type="horizontal"
                        persistId={`project-editor/content"`}
                        sizes={"240px|100%"}
                        childrenOverflow={`hidden|hidden`}
                    >
                        {menuNavigation}
                        {editors}
                    </Splitter>
                );
            }
        } else {
            return menuNavigation;
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
export class ProjectEditor extends React.Component<{}, {}> {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    render() {
        if (!this.context.project || !this.context.project.fullyLoaded) {
            return <div className="EezStudio_ProjectEditorWrapper" />;
        }

        let statusBar: JSX.Element | undefined;
        let outputPanel: JSX.Element | undefined;
        if (this.context.uiStateStore.viewOptions.outputVisible) {
            outputPanel = <Output />;
        } else {
            statusBar = <StatusBar />;
        }

        let mainContent;

        if (isWebStudio()) {
            mainContent = (
                <>
                    <Toolbar />
                    <Content />
                </>
            );
        } else if (
            this.context.runtimeStore.isRuntimeMode &&
            (this.context.isDashboardProject || this.context.isAppletProject)
        ) {
            mainContent = (
                <>
                    <Toolbar />
                    <Content />
                </>
            );
        } else {
            mainContent = (
                <>
                    <Toolbar />
                    <Splitter
                        type="vertical"
                        persistId={
                            outputPanel
                                ? "project-editor/with-output"
                                : "project-editor/without-output"
                        }
                        sizes={outputPanel ? "100%|240px" : "100%"}
                        childrenOverflow="hidden|hidden"
                    >
                        <Content />
                        {outputPanel}
                    </Splitter>
                    {statusBar}
                </>
            );
        }

        return (
            <div className="EezStudio_ProjectEditorWrapper">
                <div className="EezStudio_ProjectEditorMainContentWrapper">
                    {mainContent}
                </div>
                {this.context.uiStateStore.showCommandPalette &&
                    !this.context.runtimeStore.isRuntimeMode && (
                        <CommandPalette />
                    )}
                <LineMarkers />
            </div>
        );
    }
}
