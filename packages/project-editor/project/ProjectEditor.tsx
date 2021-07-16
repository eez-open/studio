import React from "react";
import { computed } from "mobx";
import { observer } from "mobx-react";

import { isWebStudio } from "eez-studio-shared/util-electron";

import styled from "eez-studio-ui/styled-components";
import { Splitter } from "eez-studio-ui/splitter";

import { Output } from "project-editor/components/Output";

import { MenuNavigation } from "project-editor/components/MenuNavigation";
import { ProjectContext } from "project-editor/project/context";
import { CommandPalette } from "project-editor/project/command-palette";
import { Toolbar } from "project-editor/project/Toolbar";
import { StatusBar } from "project-editor/project/StatusBar";
import { Editors } from "./Editors";
import { getClassInfo } from "project-editor/core/object";

////////////////////////////////////////////////////////////////////////////////

@observer
class Content extends React.Component {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    @computed
    get object() {
        if (this.context.NavigationStore.selectedPanel) {
            return this.context.NavigationStore.selectedPanel.selectedObject;
        }
        return this.context.NavigationStore.selectedObject;
    }

    render() {
        if (!this.context.project) {
            return <div />;
        }

        if (
            this.context.RuntimeStore.isRuntimeMode &&
            !this.context.UIStateStore.showDebugInfo
        ) {
            return this.context.RuntimeStore.selectedPageElement;
        }

        const menuNavigation = (
            <MenuNavigation
                id="project"
                navigationObject={this.context.project}
            />
        );

        let editors;

        let selectedItem =
            this.context.NavigationStore.getNavigationSelectedItemAsObject(
                this.context.project
            );
        if (selectedItem) {
            if (getClassInfo(selectedItem).editorComponent) {
                editors = <Editors />;
            }
        }

        if (editors) {
            if (this.context.RuntimeStore.isRuntimeMode) {
                return (
                    <Splitter
                        type="horizontal"
                        persistId={`project-editor/content-runtime-with-debug"`}
                        sizes={"240px|100%|400px"}
                        childrenOverflow={`hidden|hidden|hidden`}
                    >
                        {menuNavigation}
                        {editors}
                        {this.context.RuntimeStore.renderRuntimePanel()}
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

const ProjectEditorWrapper = styled.div`
    position: absolute;
    width: 100%;
    height: 100%;
    overflow: hidden;
    border-top: 1px solid ${props => props.theme.borderColor};
    display: flex;

    .error {
        color: red;
    }

    .warning {
        color: orange;
    }

    .btn-toolbar > button,
    .btn-toolbar > .btn-group {
        margin-right: 5px;
    }

    .btn-group > button {
        margin-right: 2px !important;
    }
`;

const MainContentWrapper = styled.div`
    flex-grow: 1;
    display: flex;
    flex-direction: column;
`;

@observer
export class ProjectEditor extends React.Component<{}, {}> {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    render() {
        if (!this.context.project) {
            return null;
        }

        let statusBar: JSX.Element | undefined;
        if (!this.context.UIStateStore.viewOptions.outputVisible) {
            statusBar = <StatusBar />;
        }

        let outputPanel: JSX.Element | undefined;
        if (this.context.UIStateStore.viewOptions.outputVisible) {
            outputPanel = <Output />;
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
            this.context.RuntimeStore.isRuntimeMode &&
            this.context.isDashboardProject
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
            <ProjectEditorWrapper>
                <MainContentWrapper>{mainContent}</MainContentWrapper>
                {this.context.UIStateStore.showCommandPalette &&
                    !this.context.RuntimeStore.isRuntimeMode && (
                        <CommandPalette />
                    )}
            </ProjectEditorWrapper>
        );
    }
}
