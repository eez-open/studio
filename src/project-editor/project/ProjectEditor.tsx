import * as React from "react";
import { computed, action } from "mobx";
import { observer } from "mobx-react";

//import DevTools from 'mobx-react-devtools';
//import { isDev } from 'shared/util';

import { TabsView } from "shared/ui/tabs";
import * as notification from "shared/ui/notification";

import {
    UndoManager,
    ProjectStore,
    UIStateStore,
    EditorsStore,
    NavigationStore,
    OutputSectionsStore,
    objectToString,
    isArray,
    getParent,
    getMetaData
} from "project-editor/core/store";
import { EezObject } from "project-editor/core/metaData";
import { startSearch } from "project-editor/core/search";
import { Debug } from "project-editor/core/debug";
import { Section } from "project-editor/core/output";

import { IconAction } from "shared/ui/action";
import { Panel } from "project-editor/components/Panel";
import { PropertyGrid } from "project-editor/components/PropertyGrid";
import { Output } from "project-editor/components/Output";
import * as Layout from "project-editor/components/Layout";

import { MenuNavigation } from "project-editor/project/MenuNavigation";
import { BuildConfigurationProperties } from "project-editor/project/project";
import { Notification } from "project-editor/project/Notification";

////////////////////////////////////////////////////////////////////////////////

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

    render() {
        let configurations = ProjectStore.projectProperties.settings.build.configurations.map(
            (item: BuildConfigurationProperties) => {
                return (
                    <option key={item.name} value={item.name}>
                        {objectToString(item)}
                    </option>
                );
            }
        );

        return (
            <nav className="navbar justify-content-between layoutTop EezStudio_ProjectEditor_toolbar">
                <div>
                    <div className="btn-group" role="group">
                        <IconAction
                            title="Save"
                            icon="material:save"
                            onClick={() => ProjectStore.save()}
                            enabled={ProjectStore.isModified}
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
            </nav>
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
            let EditorComponent = getMetaData(activeEditor.object).editorComponent;
            if (EditorComponent) {
                editor = <EditorComponent editor={activeEditor} />;
            }
        }

        return editor || <div />;
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
class Editors extends React.Component<{}, {}> {
    render() {
        return (
            <div id="EezStudio_ProjectEditor_editors" className="layoutCenter">
                <div className="layoutTop EezStudio_ProjectEditor_BorderRight">
                    <TabsView tabs={EditorsStore.editors} />
                </div>
                <div className="layoutCenter">
                    <Editor />
                </div>
            </div>
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
            propertyGrid = <PropertyGrid object={object} className="layoutCenter" />;
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
        for (let object: EezObject | undefined = this.object; object; object = getParent(object)) {
            if (!isArray(object) && getMetaData(object).editorComponent) {
                return getMetaData(object).hideInProperties;
            }
        }
        return false;
    }

    render() {
        if (!ProjectStore.projectProperties) {
            return <div />;
        }

        let properties: JSX.Element | undefined;
        if (UIStateStore.viewOptions.propertiesVisible) {
            properties = <Properties object={this.object} />;
        }

        let content = (
            <Layout.Split orientation="horizontal" splitId="project-content" splitPosition="0.75">
                <Editors />
                <Layout.SplitPanel>{properties}</Layout.SplitPanel>
            </Layout.Split>
        );

        if (UIStateStore.viewOptions.navigationVisible) {
            return (
                <MenuNavigation
                    id="project"
                    navigationObject={ProjectStore.projectProperties}
                    content={content}
                />
            );
        } else {
            return content;
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

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
            <span className="EezStudio_ProjectEditor_status-bar__item" onClick={this.props.onClick}>
                {this.props.body}
            </span>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
class StatusBar extends React.Component<{}, {}> {
    @action
    onChecksClicked() {
        UIStateStore.viewOptions.outputVisible = !UIStateStore.viewOptions.outputVisible;
        OutputSectionsStore.setActiveSection(Section.CHECKS);
    }

    render() {
        return (
            <div className="EezStudio_ProjectEditor_status-bar">
                <StatusBarItem
                    key="checks"
                    body={OutputSectionsStore.getSection(Section.CHECKS).title}
                    onClick={this.onChecksClicked}
                />
            </div>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
export class ProjectEditor extends React.Component<{}, {}> {
    render() {
        if (!ProjectStore.isOpen) {
            return null;
        }

        let debugPanel: JSX.Element | undefined;
        if (UIStateStore.viewOptions.debugVisible) {
            debugPanel = <Debug key="debugPanel" />;
        }

        let statusBar: JSX.Element | undefined;
        if (!UIStateStore.viewOptions.outputVisible) {
            statusBar = (
                <div className="layoutBottom">
                    <StatusBar />
                </div>
            );
        }

        let outputPanel: JSX.Element | undefined;
        if (UIStateStore.viewOptions.outputVisible) {
            outputPanel = <Output />;
        }

        let devTools: JSX.Element | undefined;
        // if (isDev) {
        //     devTools = <DevTools />;
        // }

        return (
            <div className="layoutCenter">
                <Layout.Split orientation="horizontal" splitId="project-debug" splitPosition="0.8">
                    <Layout.SplitPanel>
                        <Toolbar />
                        <Layout.Split
                            orientation="vertical"
                            splitId="project-output"
                            splitPosition="0.75"
                        >
                            <Content />
                            <Layout.SplitPanel>{outputPanel}</Layout.SplitPanel>
                        </Layout.Split>
                        {statusBar}
                    </Layout.SplitPanel>
                    <Layout.SplitPanel>{debugPanel}</Layout.SplitPanel>
                </Layout.Split>
                {notification.container.get()}
                {devTools}
                <Notification />
            </div>
        );
    }
}
