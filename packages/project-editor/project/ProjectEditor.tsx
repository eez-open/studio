import React from "react";
import { computed, action } from "mobx";
import { observer } from "mobx-react";

// import DevTools from "mobx-react-devtools";
// import { isDev } from "eez-studio-shared/util";

import styled from "eez-studio-ui/styled-components";
import { TabsView } from "eez-studio-ui/tabs";
import * as notification from "eez-studio-ui/notification";
import { Splitter } from "eez-studio-ui/splitter";

import {
    EezObject,
    isArray,
    objectToString,
    findPropertyByChildObject,
    isValue,
    getProperty
} from "project-editor/model/object";
import {
    UndoManager,
    DocumentStore,
    UIStateStore,
    EditorsStore,
    NavigationStore,
    OutputSectionsStore
} from "project-editor/model/store";
import { startSearch } from "project-editor/model/search";
import { Section } from "project-editor/model/output";

import { ProjectStore } from "project-editor/core/store";
import { Debug } from "project-editor/core/debug";

import { IconAction } from "eez-studio-ui/action";
import { Panel } from "project-editor/model/components/Panel";
import { PropertyGrid } from "project-editor/model/components/PropertyGrid";
import { Output } from "project-editor/model/components/Output";

import { MenuNavigation } from "project-editor/ui/MenuNavigation";
import { BuildConfiguration } from "project-editor/project/project";

import { ThemesSideView } from "project-editor/features/gui/theme";

////////////////////////////////////////////////////////////////////////////////

const ToolbarNav = styled.nav`
    padding: 5px;
    background-color: ${props => props.theme.panelHeaderColor};
    border-bottom: 1px solid ${props => props.theme.borderColor};

    .btn-group:not(:last-child) {
        margin-right: 10px;
    }

    select {
        height: 36px;
    }
`;

@observer
class Toolbar extends React.Component<
    {},
    {
        searchPattern: string;
    }
> {
    constructor(props: {}) {
        super(props);

        this.state = {
            searchPattern: ""
        };
    }

    onSearchPatternChange(event: any) {
        this.setState({
            searchPattern: event.target.value
        });
        startSearch(event.target.value);
    }

    onSelectedBuildConfigurationChange(event: any) {
        UIStateStore.setSelectedBuildConfiguration(event.target.value);
    }

    get isBuildConfigurationSelectorVisible() {
        return (
            (ProjectStore.project as any).gui ||
            ProjectStore.project.actions ||
            ProjectStore.project.data
        );
    }

    render() {
        let configurations = ProjectStore.project.settings.build.configurations._array.map(
            (item: BuildConfiguration) => {
                return (
                    <option key={item.name} value={item.name}>
                        {objectToString(item)}
                    </option>
                );
            }
        );

        return (
            <ToolbarNav className="navbar justify-content-between">
                <div>
                    <div className="btn-group" role="group">
                        <IconAction
                            title="Save"
                            icon="material:save"
                            onClick={() => ProjectStore.save()}
                            enabled={DocumentStore.isModified}
                        />
                    </div>

                    <div className="btn-group" role="group">
                        <IconAction
                            title={
                                UndoManager.canUndo ? `Undo "${UndoManager.undoDescription}"` : ""
                            }
                            icon="material:undo"
                            onClick={() => UndoManager.undo()}
                            enabled={UndoManager.canUndo}
                        />
                        <IconAction
                            title={
                                UndoManager.canRedo ? `Redo "${UndoManager.redoDescription}"` : ""
                            }
                            icon="material:redo"
                            onClick={() => UndoManager.redo()}
                            enabled={UndoManager.canRedo}
                        />
                    </div>

                    {this.isBuildConfigurationSelectorVisible && (
                        <div className="btn-group">
                            <select
                                title="Configuration"
                                id="btn-toolbar-configuration"
                                className="form-control"
                                value={UIStateStore.selectedBuildConfiguration}
                                onChange={this.onSelectedBuildConfigurationChange.bind(this)}
                            >
                                {configurations}
                            </select>
                        </div>
                    )}

                    <div className="btn-group" role="group">
                        <IconAction
                            title="Check"
                            icon="material:check"
                            onClick={() => ProjectStore.check()}
                        />
                        <IconAction
                            title="Build"
                            icon="material:build"
                            onClick={() => ProjectStore.build()}
                        />
                    </div>

                    {NavigationStore.getNavigationSelectedItem(ProjectStore.project) ===
                        getProperty(ProjectStore.project, "gui") && (
                        <div className="btn-group" role="group">
                            <IconAction
                                title={
                                    UIStateStore.viewOptions.themesVisible
                                        ? "Hide Themes Side View"
                                        : "Show Themes Side View"
                                }
                                icon="material:palette"
                                onClick={action(
                                    () =>
                                        (UIStateStore.viewOptions.themesVisible = !UIStateStore
                                            .viewOptions.themesVisible)
                                )}
                                selected={UIStateStore.viewOptions.themesVisible}
                            />
                        </div>
                    )}
                </div>

                <div>
                    <div className="btn-group">
                        <input
                            className="form-control"
                            type="text"
                            placeholder="search"
                            value={this.state.searchPattern}
                            onChange={this.onSearchPatternChange.bind(this)}
                        />
                    </div>
                </div>
            </ToolbarNav>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
class Editor extends React.Component<{}, {}> {
    render() {
        let editor: JSX.Element | undefined;

        let activeEditor = EditorsStore.activeEditor;
        if (activeEditor) {
            let EditorComponent = activeEditor.object.editorComponent;
            if (EditorComponent) {
                editor = <EditorComponent editor={activeEditor} />;
            }
        }

        return editor || <div />;
    }
}

////////////////////////////////////////////////////////////////////////////////

const EditorsDiv = styled.div`
    flex-grow: 1;
    display: flex;
    flex-direction: column;
`;

@observer
class Editors extends React.Component<{}, {}> {
    render() {
        return (
            <EditorsDiv>
                <div>
                    <TabsView tabs={EditorsStore.editors} />
                </div>
                <Editor />
            </EditorsDiv>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
class Properties extends React.Component<{ object: EezObject | undefined }, {}> {
    render() {
        let propertyGrid: JSX.Element | undefined;

        let object = this.props.object;
        if (object) {
            if (isValue(object)) {
                const childObject = object._parent!;
                const parent = childObject._parent;
                if (parent) {
                    const propertyInfo = findPropertyByChildObject(parent, childObject);
                    if (propertyInfo && !propertyInfo.hideInPropertyGrid) {
                        object = parent;
                    }
                }
            }

            propertyGrid = <PropertyGrid object={object} />;
        }

        return <Panel id="properties" title="Properties" body={propertyGrid} />;
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
class Content extends React.Component<{}, {}> {
    @computed
    get object() {
        if (NavigationStore.selectedPanel) {
            return NavigationStore.selectedPanel.selectedObject;
        }
        return NavigationStore.selectedObject;
    }

    @computed
    get hideInProperties() {
        for (let object: EezObject | undefined = this.object; object; object = object._parent) {
            if (!isArray(object) && object.editorComponent) {
                return object._classInfo.hideInProperties;
            }
        }
        return false;
    }

    render() {
        if (!ProjectStore.project) {
            return <div />;
        }

        let properties: JSX.Element | undefined;
        if (UIStateStore.viewOptions.propertiesVisible) {
            properties = <Properties object={this.object} />;
        }

        let content = (
            <Splitter
                type="horizontal"
                persistId="project-editor/content"
                sizes={`100%|400px`}
                childrenOverflow="hidden"
            >
                <Editors />
                {properties}
            </Splitter>
        );

        if (UIStateStore.viewOptions.themesVisible) {
            content = (
                <Splitter
                    type="horizontal"
                    persistId="project-editor/main-content-themes"
                    sizes={`100%|240px`}
                    childrenOverflow="hidden"
                >
                    {content}
                    <ThemesSideView />
                </Splitter>
            );
        }

        if (UIStateStore.viewOptions.navigationVisible) {
            return (
                <MenuNavigation
                    id="project"
                    navigationObject={ProjectStore.project}
                    content={content}
                />
            );
        } else {
            return content;
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

const StatusBarItemSpan = styled.span`
    display: inline-block;
    padding: 4px 8px;
    cursor: pointer;
    border-top: 1px solid ${props => props.theme.borderColor};
`;

@observer
class StatusBarItem extends React.Component<
    {
        body: JSX.Element | string;
        onClick: () => void;
    },
    {}
> {
    render() {
        return (
            <StatusBarItemSpan onClick={this.props.onClick}>{this.props.body}</StatusBarItemSpan>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

const StatusBarDiv = styled.div`
    background-color: ${props => props.theme.panelHeaderColor};
`;

@observer
class StatusBar extends React.Component<{}, {}> {
    @action
    onChecksClicked() {
        UIStateStore.viewOptions.outputVisible = !UIStateStore.viewOptions.outputVisible;
        OutputSectionsStore.setActiveSection(Section.CHECKS);
    }

    render() {
        return (
            <StatusBarDiv>
                <StatusBarItem
                    key="checks"
                    body={OutputSectionsStore.getSection(Section.CHECKS).title}
                    onClick={this.onChecksClicked}
                />
            </StatusBarDiv>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

const ProjectEditorContainer = styled.div`
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

const MainContent = styled.div`
    flex-grow: 1;
    display: flex;
    flex-direction: column;
`;

@observer
export class ProjectEditor extends React.Component<{}, {}> {
    render() {
        if (!ProjectStore.project) {
            return null;
        }

        let statusBar: JSX.Element | undefined;
        if (!UIStateStore.viewOptions.outputVisible) {
            statusBar = <StatusBar />;
        }

        let outputPanel: JSX.Element | undefined;
        if (UIStateStore.viewOptions.outputVisible) {
            outputPanel = <Output />;
        }

        let mainContent = (
            <MainContent>
                <Toolbar />
                <Splitter
                    type="vertical"
                    persistId={
                        outputPanel ? "project-editor/with-output" : "project-editor/without-output"
                    }
                    sizes={outputPanel ? "100%|240px" : "100%"}
                    childrenOverflow="hidden"
                >
                    <Content />
                    {outputPanel}
                </Splitter>
                {statusBar}
            </MainContent>
        );

        if (UIStateStore.viewOptions.debugVisible) {
            mainContent = (
                <Splitter
                    type="horizontal"
                    persistId="project-editor/debug"
                    sizes={`100%|240px`}
                    childrenOverflow="hidden"
                >
                    {mainContent}
                    <Debug key="debugPanel" />
                </Splitter>
            );
        }

        let devTools: JSX.Element | undefined;
        // if (isDev) {
        //     devTools = <DevTools />;
        // }

        return (
            <ProjectEditorContainer>
                {mainContent}
                {notification.container}
                {devTools}
            </ProjectEditorContainer>
        );
    }
}
