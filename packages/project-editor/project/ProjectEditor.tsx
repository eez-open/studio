import React from "react";
import { IObservableValue, action } from "mobx";
import { observer } from "mobx-react";
import * as FlexLayout from "flexlayout-react";
import classNames from "classnames";

import { Messages } from "project-editor/components/Output";

import { ProjectContext } from "project-editor/project/context";
import { CommandPalette } from "project-editor/project/command-palette";
import { Toolbar } from "project-editor/project/Toolbar";
import { DebuggerPanel } from "project-editor/flow/debugger/DebuggerPanel";
import {
    PageEditor,
    PageTabState
} from "project-editor/features/page/PageEditor";

import { LineMarkers } from "project-editor/flow/editor/ConnectionLineComponent";
import {
    getChildren,
    getClassInfo,
    LayoutModel,
    objectToString,
    Section
} from "project-editor/core/store";
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

////////////////////////////////////////////////////////////////////////////////

@observer
export class ProjectEditor extends React.Component<{}, {}> {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    render() {
        if (!this.context.project || !this.context.project._fullyLoaded) {
            return <div className="EezStudio_ProjectEditorWrapper" />;
        }

        return (
            <div className="EezStudio_ProjectEditorWrapper">
                <div className="EezStudio_ProjectEditorMainContentWrapper">
                    <Toolbar />
                    <Content />
                </div>
                {this.context.uiStateStore.showCommandPalette &&
                    !this.context.runtime && <CommandPalette />}
                <LineMarkers />
            </div>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
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

        if (component === "sub") {
            var model = node.getExtraData().model;
            if (model == null) {
                node.getExtraData().model = FlexLayout.Model.fromJson(
                    node.getConfig().model
                );
                model = node.getExtraData().model;

                // save submodel on save event
                node.setEventListener("save", (p: any) => {
                    this.context.layoutModel.model.doAction(
                        FlexLayout.Actions.updateNodeAttributes(node.getId(), {
                            config: {
                                model: node.getExtraData().model.toJson()
                            }
                        })
                    );
                });

                this.context.editorsStore.refresh();
            }

            return (
                <FlexLayout.Layout
                    model={model}
                    factory={this.factory}
                    realtimeResize={true}
                    font={LayoutModel.FONT_SUB}
                    onAuxMouseClick={this.onAuxMouseClick}
                />
            );
        }

        if (component === "editor") {
            node.setEventListener("visibility", (p: any) => {
                this.context.editorsStore.refresh();
            });

            node.setEventListener("close", (p: any) => {
                this.context.editorsStore.refresh();
            });

            const editor = this.context.editorsStore.tabIdToEditorMap.get(
                node.getId()
            );
            if (editor) {
                let EditorComponent = getEditorComponent(editor.object);
                if (EditorComponent) {
                    return <EditorComponent editor={editor} />;
                }
            }

            return null;
        }

        if (component === "debuggerPanel") {
            return this.context.runtime ? (
                <DebuggerPanel runtime={this.context.runtime} />
            ) : (
                <div />
            );
        }

        if (component === "propertiesPanel") {
            return <PropertiesPanel readOnly={!!this.context.runtime} />;
        }

        if (component === "componentsPalette") {
            return <ComponentsPalette showOnlyActions={false} />;
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
                this.context.editorsStore.refresh();
            }
        }
    };

    render() {
        if (this.context.runtime && !this.context.runtime.isDebuggerActive) {
            return (
                <PageEditor
                    editor={{
                        object: this.context.runtime.selectedPage,
                        state: new PageTabState(
                            this.context.runtime.selectedPage
                        )
                    }}
                ></PageEditor>
            );
        }

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
                        model={this.context.layoutModel.model}
                        factory={this.factory}
                        realtimeResize={true}
                        font={LayoutModel.FONT}
                    />
                </div>
            </div>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
export class SubNavigation extends React.Component<
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
            let NavigationComponent = getNavigationComponent(selectedObject);
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

////////////////////////////////////////////////////////////////////////////////

@observer
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

////////////////////////////////////////////////////////////////////////////////

@observer
class NavigationMenuObject extends React.Component<{
    selectedObject: IObservableValue<IEezObject | undefined>;
    object: IEezObject;
}> {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    onClick = action(() => {
        this.props.selectedObject.set(this.props.object);
        if (getEditorComponent(this.props.object)) {
            this.context.editorsStore.openEditor(this.props.object);
        }
    });

    render() {
        let className = classNames("EezStudio_NavigationMenuItemContainer", {
            selected: this.props.object == this.props.selectedObject.get()
        });

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
