import { getUserDataPath } from "eez-studio-shared/util-electron";
import { EXTENSIONS_FOLDER_NAME } from "eez-studio-shared/conf";
import { sourceRootDir } from "eez-studio-shared/util";

export const preInstalledExtensionsFolderPath = sourceRootDir();

export const extensionsFolderPath = getUserDataPath(EXTENSIONS_FOLDER_NAME);

export function getExtensionFolderPath(extensionId: string) {
    return extensionsFolderPath + "/" + extensionId;
}
