import React from "react";
import { observer } from "mobx-react";

import { IconAction } from "eez-studio-ui/action";

import { IEezObject } from "project-editor/core/object";
import { ProjectContext } from "project-editor/project/context";
import { ListNavigation } from "project-editor/ui-components/ListNavigation";
import { EditorComponent } from "project-editor/project/ui/EditorComponent";
import { InstrumentCommand } from "./instrument-commands";
import { showImportCommandsDocDialog } from "./importCommandDoc";

////////////////////////////////////////////////////////////////////////////////

export const InstrumentCommandsList = observer(
    class InstrumentCommandsTab extends React.Component {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        handleRefresh = () => {
            showImportCommandsDocDialog(this.context);
        };

        onClickItem = (object: IEezObject) => {
            this.context.editorsStore.openEditor(
                this.context.project.instrumentCommands,
                object
            );
        };

        render() {
            let additionalButtons;
            if (this.context.project.settings.general.commandsDocFolder) {
                additionalButtons = [
                    <IconAction
                        key="refresh"
                        title="Refresh with content from commands help folder"
                        icon="material:refresh"
                        iconSize={16}
                        onClick={this.handleRefresh}
                    />
                ];
            }

            return (
                <ListNavigation
                    id={"instrument-commands"}
                    navigationObject={
                        this.context.project.instrumentCommands.commands
                    }
                    selectedObject={
                        this.context.navigationStore
                            .selectedInstrumentCommandsObject
                    }
                    onClickItem={this.onClickItem}
                    additionalButtons={additionalButtons}
                />
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

export const InstrumentCommandHelpPreview = observer(
    class InstrumentCommandHelpPreview extends EditorComponent {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        render() {
            let object = this.props.editor.subObject as
                | InstrumentCommand
                | undefined;

            if (!object) {
                object =
                    this.context.navigationStore.selectedInstrumentCommandsObject.get() as InstrumentCommand;
            }

            if (
                object &&
                object.helpLink &&
                this.context.project.settings.general.commandsDocFolder
            ) {
                let commandHelpFolderPath = this.context.getAbsoluteFilePath(
                    this.context.project.settings.general.commandsDocFolder
                );

                let src;
                if (
                    object.helpLink.trim().startsWith("http://") ||
                    object.helpLink.trim().startsWith("https://") ||
                    object.helpLink.trim().startsWith("//")
                ) {
                    src = object.helpLink;
                } else {
                    src = commandHelpFolderPath + "/" + object.helpLink;
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
