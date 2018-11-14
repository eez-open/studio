import { getUserDataPath } from "eez-studio-shared/util";
import { EXTENSIONS_FOLDER_NAME } from "eez-studio-shared/conf";

export const preInstalledExtensionsFolderPath = __dirname + "/../..";

export const extensionsFolderPath = getUserDataPath(EXTENSIONS_FOLDER_NAME);

export function getExtensionFolderPath(extensionId: string) {
    return extensionsFolderPath + "/" + extensionId;
}
