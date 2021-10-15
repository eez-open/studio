import { getFileNameWithoutExtension } from "eez-studio-shared/util-electron";
import { IExtension } from "eez-studio-shared/extensions/extension";
import { installExtension } from "eez-studio-shared/extensions/extensions";

import { confirmWithButtons } from "eez-studio-ui/dialog-electron";
import { showGenericDialog } from "eez-studio-ui/generic-dialog";
import * as notification from "eez-studio-ui/notification";

import { importInstrumentDefinitionAsProject } from "instrument/import-instrument-definition-as-project";

function confirmMessage(extension: IExtension) {
    return `You are about to install version ${extension.version} of the '${
        extension.displayName || extension.name
    }' instrument definition extension.`;
}

const BUTTON_INSTRUCTIONS = `
Click 'OK' to replace the installed version.
Click 'Cancel' to stop the installation.`;

const BUTTONS = ["OK", "Cancel"];

export async function importInstrumentDefinitionAsExtension(filePath: string) {
    const progressToastId = notification.info("Importing...", {
        autoClose: false
    });

    try {
        const extension = await installExtension(filePath, {
            checkExtensionType(type: string) {
                if (type !== "instrument") {
                    notification.update(progressToastId, {
                        render: "This is not an instrument definition file.",
                        type: notification.ERROR,
                        autoClose: 5000
                    });
                    return false;
                }
                return true;
            },
            notFound() {
                notification.update(progressToastId, {
                    render: "This is not a valid instrument definition file.",
                    type: notification.ERROR,
                    autoClose: 5000
                });
            },
            async confirmReplaceNewerVersion(
                newExtension: IExtension,
                existingExtension: IExtension
            ) {
                return (
                    (await confirmWithButtons(
                        confirmMessage(newExtension),
                        `The newer version ${existingExtension.version} is already installed.${BUTTON_INSTRUCTIONS}`,
                        BUTTONS
                    )) === 0
                );
            },
            async confirmReplaceOlderVersion(
                newExtension: IExtension,
                existingExtension: IExtension
            ) {
                return (
                    (await confirmWithButtons(
                        confirmMessage(newExtension),
                        `The older version ${existingExtension.version} is already installed.${BUTTON_INSTRUCTIONS}`,
                        BUTTONS
                    )) === 0
                );
            },
            async confirmReplaceTheSameVersion(
                newExtension: IExtension,
                existingExtension: IExtension
            ) {
                return (
                    (await confirmWithButtons(
                        confirmMessage(newExtension),
                        `That version is already installed.${BUTTON_INSTRUCTIONS}`,
                        BUTTONS
                    )) === 0
                );
            }
        });

        if (extension) {
            notification.update(progressToastId, {
                render: `Instrument definition "${
                    extension.displayName || extension.name
                }" imported`,
                type: notification.SUCCESS,
                autoClose: 5000
            });
        } else {
            notification.update(progressToastId, {
                render: `Import canceled`,
                type: notification.INFO,
                autoClose: 500
            });
        }
    } catch (err) {
        notification.update(progressToastId, {
            render: err.toString(),
            type: notification.ERROR,
            autoClose: 5000
        });
    }
}

export function importInstrumentDefinition(
    instrumentDefinitionFilePath: string
) {
    showGenericDialog({
        dialogDefinition: {
            fields: [
                {
                    name: "importAs",
                    type: "enum",
                    enumItems: [
                        {
                            id: "extension",
                            label: "Workbench extension"
                        },
                        {
                            id: "project",
                            label: "Project"
                        }
                    ]
                }
            ]
        },

        values: {
            sessionName: name
        }
    })
        .then(async result => {
            if (result.values.importAs === "extension") {
                importInstrumentDefinitionAsExtension(
                    instrumentDefinitionFilePath
                );
            } else {
                const result = await EEZStudio.remote.dialog.showSaveDialog(
                    EEZStudio.remote.getCurrentWindow(),
                    {
                        defaultPath:
                            getFileNameWithoutExtension(
                                instrumentDefinitionFilePath
                            ) + ".eez-project",
                        filters: [
                            {
                                name: "EEZ Project",
                                extensions: ["eez-project"]
                            },
                            { name: "All Files", extensions: ["*"] }
                        ]
                    }
                );
                let projectFilePath = result.filePath;
                if (projectFilePath) {
                    if (
                        !projectFilePath.toLowerCase().endsWith(".eez-project")
                    ) {
                        projectFilePath += ".eez-project";
                    }

                    importInstrumentDefinitionAsProject(
                        instrumentDefinitionFilePath,
                        projectFilePath
                    );
                }
            }
        })
        .catch(() => {});
}
