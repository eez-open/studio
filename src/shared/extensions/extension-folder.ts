import { getUserDataPath } from "shared/util";
import { EXTENSIONS_FOLDER_NAME } from "shared/conf";

export const preInstalledExtensionsFolderPath = __dirname + "/../..";

export const extensionsFolderPath = getUserDataPath(EXTENSIONS_FOLDER_NAME);

export function getExtensionFolderPath(extensionId: string) {
    return extensionsFolderPath + "/" + extensionId;
}
