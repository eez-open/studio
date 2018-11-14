import { IExtension } from "eez-studio-shared/extensions/extension";
import { installExtension } from "eez-studio-shared/extensions/extensions";
import { confirmWithButtons, info } from "eez-studio-shared/ui/dialog";
import * as notification from "eez-studio-shared/ui/notification";

function confirmMessage(extension: IExtension) {
    return `You are about to install version ${extension.version} of the '${extension.displayName ||
        extension.name}' instrument definition extension.`;
}

const BUTTON_INSTRUCTIONS = `
Click 'OK' to replace the installed version.
Click 'Cancel' to stop the installation.`;

const BUTTONS = ["OK", "Cancel"];

export async function importInstrumentDefinition(filePath: string) {
    try {
        const extension = await installExtension(filePath, {
            checkExtensionType(type: string) {
                if (type !== "instrument") {
                    info("This is not an instrument definition file.", undefined);
                    return false;
                }
                return true;
            },
            notFound() {
                info("This is not a valid instrument definition file.", undefined);
            },
            async confirmReplaceNewerVersion(
                newExtension: IExtension,
                existingExtension: IExtension
            ) {
                return (
                    (await confirmWithButtons(
                        confirmMessage(newExtension),
                        `The newer version ${
                            existingExtension.version
                        } is already installed.${BUTTON_INSTRUCTIONS}`,
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
                        `The older version ${
                            existingExtension.version
                        } is already installed.${BUTTON_INSTRUCTIONS}`,
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
            notification.success(
                `Instrument definition "${extension.displayName || extension.name}" imported`
            );
        }
    } catch (err) {
        notification.error(err.toString());
    }
}
