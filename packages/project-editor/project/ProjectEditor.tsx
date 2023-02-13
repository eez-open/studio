import React from "react";
import { IObservableValue, action } from "mobx";
import { observer } from "mobx-react";
import * as FlexLayout from "flexlayout-react";
import classNames from "classnames";

import { Messages } from "project-editor/ui-components/Output";

import { ProjectContext } from "project-editor/project/context";
import { Toolbar } from "project-editor/project/Toolbar";
import {
    PageEditor,
    PageTabState
} from "project-editor/features/page/PageEditor";

import {
    Editor,
    getChildren,
    getClassInfo,
    LayoutModels,
    objectToString,
    Section
} from "project-editor/store";
import { PropertiesPanel } from "./PropertiesPanel";
import { ComponentsPalette } from "project-editor/flow/editor/ComponentsPalette";
import { BreakpointsPanel } from "project-editor/flow/debugger/BreakpointsPanel";
import { ThemesSideView } from "project-editor/features/style/theme";
import { getId, IEezObject } from "project-editor/core/object";
import {
    getNavigationComponent,
    getNavigationComponentId
} from "project-editor/project/NavigationComponentFactory";
import { getEditorComponent } from "project-editor/project/EditorComponentFactory";
import { Icon } from "eez-studio-ui/icon";
import { Loader } from "eez-studio-ui/loader";
import { SingleStepMode } from "project-editor/flow/runtime";
import { ProjectEditor } from "project-editor/project-editor-interface";
import { QueuePanel } from "project-editor/flow/debugger/QueuePanel";
import { WatchPanel } from "project-editor/flow/debugger/WatchPanel";
import { ActiveFlowsPanel } from "project-editor/flow/debugger/ActiveFlowsPanel";
import { LogsPanel } from "project-editor/flow/debugger/LogsPanel";

////////////////////////////////////////////////////////////////////////////////

export const ProjectEditorView = observer(
    class ProjectEditorView extends React.Component<{
        onlyRuntime: boolean;
    }> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        onKeyDown = (e: KeyboardEvent) => {
            const activeTab = ProjectEditor.homeTabs.activeTab;
            if (
                activeTab instanceof ProjectEditor.ProjectEditorTabClass &&
                activeTab.projectEditorStore == this.context &&
                this.context.runtime &&
                this.context.runtime.isDebuggerActive &&
                this.context.runtime.isPaused
            ) {
                let singleStepMode: SingleStepMode | undefined;
                if (e.key == "F10") {
                    singleStepMode = "step-over";
                } else if (e.key == "F11") {
                    if (e.shiftKey) {
                        singleStepMode = "step-out";
                    } else {
                        singleStepMode = "step-into";
                    }
                }

                if (singleStepMode) {
                    e.preventDefault();
                    e.stopPropagation();

                    this.context.runtime.runSingleStep(singleStepMode);
                }
            }
        };

        componentDidMount() {
            document.addEventListener("keydown", this.onKeyDown);
        }

        componentWillUnmount() {
            document.removeEventListener("keydown", this.onKeyDown);
        }

        render() {
            if (!this.context.project || !this.context.project._fullyLoaded) {
                return <div className="EezStudio_ProjectEditorWrapper" />;
            }

            return (
                <div className="EezStudio_ProjectEditorWrapper">
                    <div className="EezStudio_ProjectEditorMainContentWrapper">
                        {!this.props.onlyRuntime && <Toolbar />}
                        <Content />
                    </div>
                </div>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

const Content = observer(
    class Content extends React.Component {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        factory = (node: FlexLayout.TabNode) => {
            var component = node.getComponent();

            if (component === "navigation") {
                return (
                    <SubNavigation
                        id="project"
                        navigationObject={this.context.project}
                        selectedObject={
                            this.context.navigationStore.selectedRootObject
                        }
                    />
                );
            }

            if (component === "editors") {
                return <Editors />;
            }

            if (this.context.runtime) {
                if (component === "queue") {
                    return <QueuePanel runtime={this.context.runtime} />;
                }

                if (component === "watch") {
                    return <WatchPanel runtime={this.context.runtime} />;
                }

                if (component === "active-flows") {
                    return <ActiveFlowsPanel runtime={this.context.runtime} />;
                }

                if (component === "logs") {
                    return <LogsPanel runtime={this.context.runtime} />;
                }
            }

            if (component === "propertiesPanel") {
                return <PropertiesPanel readOnly={!!this.context.runtime} />;
            }

            if (component === "componentsPalette") {
                return <ComponentsPalette />;
            }

            if (component === "breakpointsPanel") {
                return <BreakpointsPanel />;
            }

            if (component === "themesSideView") {
                return <ThemesSideView />;
            }

            if (component === "checksMessages") {
                return (
                    <Messages
                        section={this.context.outputSectionsStore.getSection(
                            Section.CHECKS
                        )}
                    />
                );
            }

            if (component === "outputMessages") {
                return (
                    <Messages
                        section={this.context.outputSectionsStore.getSection(
                            Section.OUTPUT
                        )}
                    />
                );
            }

            if (component === "searchResultsMessages") {
                return (
                    <Messages
                        section={this.context.outputSectionsStore.getSection(
                            Section.SEARCH
                        )}
                    />
                );
            }

            return null;
        };

        onRenderTab = (
            node: FlexLayout.TabNode,
            renderValues: FlexLayout.ITabRenderValues
        ) => {
            if (
                node.getId() == LayoutModels.CHECKS_TAB_ID ||
                node.getId() == LayoutModels.OUTPUT_TAB_ID
            ) {
                const section = this.context.outputSectionsStore.getSection(
                    node.getId() == LayoutModels.CHECKS_TAB_ID
                        ? Section.CHECKS
                        : Section.OUTPUT
                );

                let icon;
                let numMessages;
                if (section.numErrors > 0) {
                    icon = <Icon icon="material:error" className="error" />;
                    numMessages = section.numErrors;
                } else if (section.numWarnings > 0) {
                    icon = <Icon icon="material:warning" className="warning" />;
                    numMessages = section.numWarnings;
                } else {
                    icon = <Icon icon="material:check" className="info" />;
                    numMessages = 0;
                }

                renderValues.leading = section.loading ? (
                    <Loader size={20} />
                ) : (
                    icon
                );

                renderValues.content =
                    section.name + (numMessages > 0 ? ` (${numMessages})` : "");
            } else if (node.getId() == LayoutModels.SEARCH_RESULTS_TAB_ID) {
                const section = this.context.outputSectionsStore.getSection(
                    Section.SEARCH
                );

                renderValues.leading = section.loading ? (
                    <Loader size={20} />
                ) : null;

                renderValues.content =
                    section.name +
                    (section.messages.length > 0
                        ? ` (${section.messages.length})`
                        : "");
            } else if (node.getId() == LayoutModels.DEBUGGER_LOGS_TAB_ID) {
                if (this.context.runtime && this.context.runtime.error) {
                    renderValues.leading = (
                        <div className="EezStudio_AttentionContainer">
                            <span></span>
                            <div className="EezStudio_AttentionDiv" />
                        </div>
                    );
                }
            }
        };

        render() {
            if (
                this.context.runtime &&
                !this.context.runtime.isDebuggerActive
            ) {
                return (
                    <PageEditor
                        editor={
                            new Editor(
                                this.context,
                                this.context.runtime.selectedPage,
                                undefined,
                                undefined,
                                new PageTabState(
                                    this.context.runtime.selectedPage
                                )
                            )
                        }
                    ></PageEditor>
                );
            }

            // to make sure onRenderTab is observable
            const checksSection = this.context.outputSectionsStore.getSection(
                Section.CHECKS
            );
            checksSection.numErrors;
            checksSection.numWarnings;
            checksSection.messages.length;
            checksSection.loading;

            const sectionOutput = this.context.outputSectionsStore.getSection(
                Section.OUTPUT
            );
            sectionOutput.numErrors;
            sectionOutput.numWarnings;
            sectionOutput.messages.length;
            sectionOutput.loading;

            const sectionSearch = this.context.outputSectionsStore.getSection(
                Section.SEARCH
            );
            sectionSearch.messages.length;
            sectionSearch.loading;

            this.context.runtime && this.context.runtime.error;

            return (
                <div
                    style={{
                        flexGrow: 1,
                        display: "flex",
                        flexDirection: "row"
                    }}
                >
                    <Menu
                        selectedObject={
                            this.context.navigationStore.selectedRootObject
                        }
                    />
                    <div
                        style={{
                            position: "relative",
                            flexGrow: 1
                        }}
                    >
                        <FlexLayout.Layout
                            model={this.context.layoutModels.root}
                            factory={this.factory}
                            realtimeResize={true}
                            font={LayoutModels.FONT}
                            onRenderTab={this.onRenderTab}
                        />
                    </div>
                </div>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

export const SubNavigation = observer(
    class SubNavigation extends React.Component<
        {
            id: string;
            navigationObject: IEezObject;
            selectedObject: IObservableValue<IEezObject | undefined>;
        },
        {}
    > {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        render() {
            let subNavigation: React.ReactNode = null;

            let selectedObject = this.props.selectedObject.get();

            if (selectedObject) {
                let NavigationComponent =
                    getNavigationComponent(selectedObject);
                if (NavigationComponent) {
                    subNavigation = (
                        <NavigationComponent
                            id={
                                getNavigationComponentId(selectedObject) ||
                                this.props.id
                            }
                            navigationObject={selectedObject}
                        />
                    );
                }
            }

            return subNavigation;
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

const Editors = observer(
    class Editors extends React.Component {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        factory = (node: FlexLayout.TabNode) => {
            var component = node.getComponent();

            if (component === "sub") {
                var model = node.getExtraData().model;
                if (model == null) {
                    node.getExtraData().model = FlexLayout.Model.fromJson(
                        node.getConfig().model
                    );
                    model = node.getExtraData().model;

                    // save submodel on save event
                    node.setEventListener("save", (p: any) => {
                        this.context.layoutModels.editors.doAction(
                            FlexLayout.Actions.updateNodeAttributes(
                                node.getId(),
                                {
                                    config: {
                                        model: node
                                            .getExtraData()
                                            .model.toJson()
                                    }
                                }
                            )
                        );
                    });

                    this.context.editorsStore.refresh(false);
                }

                return (
                    <FlexLayout.Layout
                        model={model}
                        factory={this.factory}
                        realtimeResize={true}
                        font={LayoutModels.FONT_SUB}
                        onAuxMouseClick={this.onAuxMouseClick}
                    />
                );
            }

            if (component === "editor") {
                const editor = this.context.editorsStore.tabIdToEditorMap.get(
                    node.getId()
                );

                node.setEventListener("visibility", (p: any) => {
                    this.context.editorsStore.refresh(true);
                });

                node.setEventListener("close", (p: any) => {
                    this.context.editorsStore.refresh(true);
                });

                if (editor) {
                    let result = getEditorComponent(
                        editor.object,
                        editor.params
                    );
                    if (result) {
                        return <result.EditorComponent editor={editor} />;
                    }
                }

                return null;
            }

            return null;
        };

        onAuxMouseClick = (
            node:
                | FlexLayout.TabNode
                | FlexLayout.TabSetNode
                | FlexLayout.BorderNode,
            event: React.MouseEvent<HTMLElement, MouseEvent>
        ) => {
            if (event.button == 1) {
                // delete tab on mouse middle click
                if (node instanceof FlexLayout.TabNode) {
                    node.getModel().doAction(
                        FlexLayout.Actions.deleteTab(node.getId())
                    );
                }
            }
        };

        render() {
            return (
                <FlexLayout.Layout
                    model={this.context.layoutModels.editors}
                    factory={this.factory}
                    realtimeResize={true}
                    font={LayoutModels.FONT}
                />
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

const Menu = observer(
    class Menu extends React.Component<{
        selectedObject: IObservableValue<IEezObject | undefined>;
    }> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        onFocus() {
            this.context.navigationStore.setSelectedPanel(undefined);
        }

        render() {
            let items = getChildren(this.context.project)
                .filter(object => getClassInfo(object).icon)
                .filter(object => {
                    if (this.context.runtime) {
                        // if runtime then only show pages and actions
                        return (
                            object == this.context.project.pages ||
                            object == this.context.project.actions
                        );
                    }
                    return true;
                });

            // push Settings to the end
            const settingsIndex = items.findIndex(
                item => item == this.context.project.settings
            );
            if (settingsIndex != -1) {
                items.splice(settingsIndex, 1);
                items.push(this.context.project.settings);
            }

            const navigationItems = items.map(item => (
                <NavigationMenuObject
                    key={getId(item)}
                    selectedObject={this.props.selectedObject}
                    object={item}
                />
            ));

            return (
                <div
                    className="EezStudio_MenuContainer"
                    tabIndex={0}
                    onFocus={this.onFocus.bind(this)}
                >
                    {navigationItems}
                </div>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

const NavigationMenuObject = observer(
    class NavigationMenuObject extends React.Component<{
        selectedObject: IObservableValue<IEezObject | undefined>;
        object: IEezObject;
    }> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        onClick = action(() => {
            this.props.selectedObject.set(this.props.object);
            const result = getEditorComponent(this.props.object, undefined);
            if (result) {
                this.context.editorsStore.openEditor(
                    result.object,
                    result.subObject
                );
            }

            if (this.props.object != this.context.project.settings) {
                this.context.editorsStore.closeEditorForObject(
                    this.context.project.settings
                );
            }

            if (this.props.object != this.context.project.shortcuts) {
                this.context.editorsStore.closeEditorForObject(
                    this.context.project.shortcuts
                );
            }

            if (this.props.object != this.context.project.scpi) {
                this.context.editorsStore.closeEditorForObject(
                    this.context.project.scpi
                );
            }

            if (this.props.object != this.context.project.readme) {
                this.context.editorsStore.closeEditorForObject(
                    this.context.project.readme
                );
            }

            if (this.props.object != this.context.project.lvglStyles) {
                this.context.editorsStore.closeEditorForObject(
                    this.context.project.lvglStyles
                );
            }
        });

        render() {
            let className = classNames(
                "EezStudio_NavigationMenuItemContainer",
                {
                    selected:
                        this.props.object == this.props.selectedObject.get()
                }
            );

            let icon = getClassInfo(this.props.object).icon || "extension";

            return (
                <div
                    className={className}
                    title={objectToString(this.props.object)}
                    onClick={this.onClick}
                >
                    {typeof icon == "string" ? (
                        <i className="material-icons md-24">{icon}</i>
                    ) : (
                        icon
                    )}
                    <span>{objectToString(this.props.object)}</span>
                </div>
            );
        }
    }
);
