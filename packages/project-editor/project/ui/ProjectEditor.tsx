import React from "react";
import { observer } from "mobx-react";
import * as FlexLayout from "flexlayout-react";
import { Menu, MenuItem } from "@electron/remote";

import { Messages } from "project-editor/ui-components/Output";

import { ProjectContext } from "project-editor/project/context";
import { Toolbar } from "project-editor/project/ui/Toolbar";
import {
    PageEditor,
    PageTabState
} from "project-editor/features/page/PageEditor";

import { Editor, LayoutModels, Section } from "project-editor/store";
import { PropertiesPanel } from "./PropertiesPanel";
import { ComponentsPalette } from "project-editor/flow/editor/ComponentsPalette";
import { BreakpointsPanel } from "project-editor/flow/debugger/BreakpointsPanel";
import { ThemesSideView } from "project-editor/features/style/theme";
import { getEditorComponent } from "project-editor/project/ui/EditorComponentFactory";
import { Icon } from "eez-studio-ui/icon";
import { Loader } from "eez-studio-ui/loader";
import { QueuePanel } from "project-editor/flow/debugger/QueuePanel";
import { WatchPanel } from "project-editor/flow/debugger/WatchPanel";
import { ActiveFlowsPanel } from "project-editor/flow/debugger/ActiveFlowsPanel";
import { LogsPanel } from "project-editor/flow/debugger/LogsPanel";
import { ListNavigation } from "project-editor/ui-components/ListNavigation";
import { VariablesTab } from "project-editor/features/variable/VariablesNavigation";
import { FlowStructureTab } from "project-editor/flow/FlowStructureTab";
import { StylesTab } from "project-editor/features/style/StylesNavigation";
import { FontsTab } from "project-editor/features/font/FontsNavigation";
import { BitmapsTab } from "project-editor/features/bitmap/BitmapsNavigation";
import { TextsTab } from "project-editor/features/texts/navigation";
import { ScpiTab } from "project-editor/features/scpi/ScpiNavigation";
import { ExtensionDefinitionsTab } from "project-editor/features/extension-definitions/extension-definitions";
import { ChangesTab } from "project-editor/features/changes/navigation";
import classNames from "classnames";
import { runInAction } from "mobx";

////////////////////////////////////////////////////////////////////////////////

export const ProjectEditorView = observer(
    class ProjectEditorView extends React.Component<{
        onlyRuntime: boolean;
    }> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

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

        componentDidMount() {
            this.context.editorsStore.refresh(true);
        }

        factory = (node: FlexLayout.TabNode) => {
            var component = node.getComponent();

            if (component === "pages") {
                return (
                    <ListNavigation
                        id="pages"
                        navigationObject={this.context.project.pages}
                        selectedObject={
                            this.context.navigationStore.selectedPageObject
                        }
                        editable={!this.context.runtime}
                    />
                );
            }

            if (component === "actions") {
                return (
                    <ListNavigation
                        id="actions"
                        navigationObject={this.context.project.actions}
                        selectedObject={
                            this.context.navigationStore.selectedActionObject
                        }
                        editable={!this.context.runtime}
                    />
                );
            }

            if (component === "flow-structure") {
                return <FlowStructureTab />;
            }

            if (component === "variables") {
                return <VariablesTab />;
            }

            if (component === "styles") {
                return <StylesTab />;
            }

            if (component === "fonts") {
                return <FontsTab />;
            }

            if (component === "bitmaps") {
                return <BitmapsTab />;
            }

            if (component === "changes") {
                return <ChangesTab />;
            }

            if (component === "texts") {
                return <TextsTab />;
            }

            if (component === "scpi") {
                return <ScpiTab />;
            }

            if (component === "extension-definitions") {
                return <ExtensionDefinitionsTab />;
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
                        showObjectIcon={true}
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

            if (node.getComponent() == "editor") {
                const editor = this.context.editorsStore.tabIdToEditorMap.get(
                    node.getId()
                );
                renderValues.content = (
                    <div
                        className={classNames({
                            "fst-italic": !editor?.permanent
                        })}
                    >
                        {node.getName()}
                    </div>
                );
            }
        };

        onAuxMouseClick = (
            node:
                | FlexLayout.TabNode
                | FlexLayout.TabSetNode
                | FlexLayout.BorderNode,
            event: React.MouseEvent<HTMLElement, MouseEvent>
        ) => {
            if (
                node instanceof FlexLayout.TabNode &&
                node.getComponent() == "editor"
            ) {
                if (event.button == 1) {
                    // delete tab on mouse middle click
                    node.getModel().doAction(
                        FlexLayout.Actions.deleteTab(node.getId())
                    );
                }
            }
        };

        onContextMenu = (
            node:
                | FlexLayout.TabNode
                | FlexLayout.TabSetNode
                | FlexLayout.BorderNode,
            event: React.MouseEvent<HTMLElement, MouseEvent>
        ) => {
            event.preventDefault();
            event.stopPropagation();

            if (
                node instanceof FlexLayout.TabNode &&
                node.getComponent() == "editor"
            ) {
                const editor = this.context.editorsStore.tabIdToEditorMap.get(
                    node.getId()
                );
                if (editor && !editor.permanent) {
                    // open context menu
                    const menu = new Menu();
                    menu.append(
                        new MenuItem({
                            label: "Keep Tab Open",
                            click: () => {
                                runInAction(() => (editor.permanent = true));
                                this.context.layoutModels.root.doAction(
                                    FlexLayout.Actions.updateNodeAttributes(
                                        node.getId(),
                                        {
                                            config: editor.getConfig()
                                        }
                                    )
                                );
                            }
                        })
                    );
                    menu.popup();
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
                            iconFactory={LayoutModels.iconFactory}
                            onAuxMouseClick={this.onAuxMouseClick}
                            onContextMenu={this.onContextMenu}
                        />
                    </div>
                </div>
            );
        }
    }
);
