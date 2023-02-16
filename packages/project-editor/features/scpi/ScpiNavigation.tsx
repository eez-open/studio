import React from "react";
import { observer } from "mobx-react";
import * as FlexLayout from "flexlayout-react";

import { IconAction } from "eez-studio-ui/action";

import { IEezObject } from "project-editor/core/object";
import { ProjectContext } from "project-editor/project/context";
import { LayoutModels } from "project-editor/store";
import { ListNavigation } from "project-editor/ui-components/ListNavigation";
import { ScpiSubsystem, ScpiCommand } from "project-editor/features/scpi/scpi";
import { showImportScpiDocDialog } from "project-editor/features/scpi/importScpiDoc";
import { computed, makeObservable } from "mobx";
import { NavigationComponent } from "project-editor/project/ui/NavigationComponent";
import { EditorComponent } from "project-editor/project/ui/EditorComponent";

////////////////////////////////////////////////////////////////////////////////

export const ScpiNavigation = observer(
    class ScpiNavigation extends NavigationComponent {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        factory = (node: FlexLayout.TabNode) => {
            var component = node.getComponent();

            if (component === "subsystems") {
                return <SubsystemsList />;
            }

            if (component === "commands") {
                return <CommandsList />;
            }

            if (component === "enums") {
                return (
                    <ListNavigation
                        id={this.props.id}
                        navigationObject={this.context.project.scpi.enums}
                        selectedObject={
                            this.context.navigationStore.selectedScpiEnumObject
                        }
                    />
                );
            }

            return null;
        };

        render() {
            return (
                <FlexLayout.Layout
                    model={this.context.layoutModels.scpi}
                    factory={this.factory}
                    realtimeResize={true}
                    font={LayoutModels.FONT_SUB}
                />
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

export const SubsystemsList = observer(
    class SubsystemsList extends React.Component {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        handleRefresh = () => {
            showImportScpiDocDialog(this.context);
        };

        onClickItem = (object: IEezObject) => {
            this.context.editorsStore.openEditor(
                this.context.project.scpi,
                object
            );
        };

        render() {
            let additionalButtons;
            if (this.context.project.settings.general.scpiDocFolder) {
                additionalButtons = [
                    <IconAction
                        key="refresh"
                        title="Refresh with content from SCPI help folder"
                        icon="material:refresh"
                        iconSize={16}
                        onClick={this.handleRefresh}
                    />
                ];
            }

            return (
                <ListNavigation
                    id={"scpi-subsystems"}
                    navigationObject={this.context.project.scpi.subsystems}
                    selectedObject={
                        this.context.navigationStore.selectedScpiSubsystemObject
                    }
                    onClickItem={this.onClickItem}
                    additionalButtons={additionalButtons}
                />
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

export const CommandsList = observer(
    class CommandsList extends React.Component {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        constructor(props: any) {
            super(props);

            makeObservable(this, {
                selectedScpiSubsystem: computed
            });
        }

        get selectedScpiSubsystem() {
            return this.context.navigationStore.selectedScpiSubsystemObject.get() as ScpiSubsystem;
        }

        onClickItem = (object: IEezObject) => {
            this.context.editorsStore.openEditor(
                this.context.project.scpi,
                object
            );
        };

        render() {
            return this.selectedScpiSubsystem ? (
                <ListNavigation
                    id="scpi-subsystem-commands"
                    navigationObject={this.selectedScpiSubsystem.commands}
                    selectedObject={
                        this.context.navigationStore.selectedScpiCommandObject
                    }
                    onClickItem={this.onClickItem}
                />
            ) : null;
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

export const ScpiHelpPreview = observer(
    class ScpiHelpPreview extends EditorComponent {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        render() {
            let object = this.props.editor.subObject as
                | ScpiSubsystem
                | ScpiCommand
                | undefined;

            if (!object) {
                object =
                    this.context.navigationStore.selectedScpiCommandObject.get() as ScpiCommand;
                if (!object) {
                    object =
                        this.context.navigationStore.selectedScpiSubsystemObject.get() as ScpiSubsystem;
                }
            }

            if (
                object &&
                object.helpLink &&
                this.context.project.settings.general.scpiDocFolder
            ) {
                let scpiHelpFolderPath = this.context.getAbsoluteFilePath(
                    this.context.project.settings.general.scpiDocFolder
                );

                let src;
                if (
                    object.helpLink.trim().startsWith("http://") ||
                    object.helpLink.trim().startsWith("https://") ||
                    object.helpLink.trim().startsWith("//")
                ) {
                    src = object.helpLink;
                } else {
                    src = scpiHelpFolderPath + "/" + object.helpLink;
                }

                return (
                    <iframe
                        src={src}
                        style={{
                            position: "absolute",
                            width: "100%",
                            height: "100%",
                            border: "none"
                        }}
                    />
                );
            } else {
                return <div>No help page defined!</div>;
            }
        }
    }
);
