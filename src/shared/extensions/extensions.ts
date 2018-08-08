import { observable, computed, action, runInAction, values } from "mobx";
const EventEmitter = require("events");
const fs = require("fs");

import {
    guid,
    localPathToFileUrl,
    zipExtract,
    fileExists,
    copyFile,
    readJsObjectFromFile,
    removeFolder,
    renameFile,
    readFolder,
    writeJsObjectToFile,
    delay
} from "shared/util";

import { registerSource, sendMessage, watch } from "shared/notify";

import { IActivityLogEntry } from "shared/activity-log";

import * as notification from "shared/ui/notification";
import { IToolboxGroup, IToolbarButton } from "shared/ui/designer/designer-interfaces";

import {
    IExtension,
    IObject,
    IExtensionProperties,
    IMeasurementFunction
} from "shared/extensions/extension";

import {
    preInstalledExtensionsFolderPath,
    extensionsFolderPath,
    getExtensionFolderPath
} from "shared/extensions/extension-folder";

import * as ShortcutsStoreModule from "shortcuts/shortcuts-store";
import * as ShortcutsModule from "shortcuts/shortcuts";

////////////////////////////////////////////////////////////////////////////////

export const measurementFunctions = new Map<string, IMeasurementFunction>();

function loadMeasurementFunctions(extensionFolderPath: string, functions: IMeasurementFunction[]) {
    functions.forEach((extensionMeasurementFunction: any) => {
        if (!measurementFunctions.has(extensionMeasurementFunction.id)) {
            measurementFunctions.set(extensionMeasurementFunction.id, {
                id: extensionMeasurementFunction.id,
                name: extensionMeasurementFunction.name,
                script: extensionFolderPath + "/" + extensionMeasurementFunction.script
            });
        }
    });
}

////////////////////////////////////////////////////////////////////////////////

async function loadExtension(extensionFolderPath: string): Promise<IExtension | undefined> {
    let packageJsonFilePath = extensionFolderPath + "/" + "package.json";
    if (await fileExists(packageJsonFilePath)) {
        try {
            const packageJson = await readJsObjectFromFile(packageJsonFilePath);
            const packageJsonEezStudio = packageJson["eez-studio"];
            if (packageJsonEezStudio) {
                const mainScript = packageJsonEezStudio.main;
                if (mainScript) {
                    const extension: IExtension = require(extensionFolderPath + "/" + mainScript)
                        .default;

                    extension.id = packageJson.id || packageJson.name;
                    extension.name = packageJson.name;
                    extension.version = packageJson.version;
                    extension.author = packageJson.author;
                    extension.description = packageJson.description;

                    extension.image = packageJson.image;
                    if (extension.image) {
                        const imageFilePath = extensionFolderPath + "/" + extension.image;
                        if (await fileExists(imageFilePath)) {
                            extension.image = localPathToFileUrl(imageFilePath);
                        }
                    }

                    if (extension.measurementFunctions) {
                        loadMeasurementFunctions(
                            extensionFolderPath,
                            extension.measurementFunctions
                        );
                    }

                    return extension;
                }
            }
        } catch (err) {
            console.error(err);
            return undefined;
        }
    }

    if (extensionFolderPath.startsWith(preInstalledExtensionsFolderPath)) {
        return undefined;
    }

    for (let extension of extensions.values()) {
        if (extension.loadExtension) {
            let loadedExtension = extension.loadExtension(extensionFolderPath);
            if (loadedExtension) {
                return loadedExtension;
            }
        }
    }

    return undefined;
}

export function registerExtension(extension: IExtension) {
    if (extension.init) {
        extension.init();
    }

    action(() => extensions.set(extension.id, extension))();

    return extensions.get(extension.id);
}

class LoadExtensionTask extends EventEmitter {
    isFinished: boolean = false;
    extension: IExtension | undefined;
}

const loadExtensionTasks = new Map<string, LoadExtensionTask>();

async function loadAndRegisterExtension(folder: string) {
    const loadExtensionTask = loadExtensionTasks.get(folder);
    if (loadExtensionTask) {
        if (loadExtensionTask.isFinished) {
            return loadExtensionTask.extension;
        }

        return await new Promise<IExtension>(resolve => {
            loadExtensionTask.on("finished", resolve);
        });
    }

    const newLoadExtensionTask = new LoadExtensionTask();
    loadExtensionTasks.set(folder, newLoadExtensionTask);

    let extension = await loadExtension(folder);
    if (extension) {
        extension = registerExtension(extension);
    }

    newLoadExtensionTask.isFinished = true;
    newLoadExtensionTask.extension = extension;
    newLoadExtensionTask.emit("finished", extension);

    return extension;
}

export async function loadExtensions() {
    let preinstalledExtensionFolders = await readFolder(preInstalledExtensionsFolderPath);

    let installedExtensionFolders: string[];
    try {
        installedExtensionFolders = await readFolder(extensionsFolderPath);
    } catch (err) {
        console.info(`Extensions folder "${extensionsFolderPath}" doesn't exists.`);
        installedExtensionFolders = [];
    }

    for (let folder of [...preinstalledExtensionFolders, ...installedExtensionFolders]) {
        try {
            await loadAndRegisterExtension(folder);
        } catch (err) {
            console.error(err);
        }
    }
}

export async function loadPreinstalledExtension(name: string) {
    let extensionFolderPath = preInstalledExtensionsFolderPath + "/" + name;
    let extension = await loadAndRegisterExtension(extensionFolderPath);
    return extension;
}

export async function loadExtensionById(id: string) {
    let extensionFolderPath = getExtensionFolderPath(id);
    let extension = await loadAndRegisterExtension(extensionFolderPath);
    return extension;
}

async function importExtensionToTempFolder(extensionFilePath: string) {
    let tmpExtensionFolderPath = extensionsFolderPath + "/" + guid() + "_tmp";

    // extract extension zip file to the temp folder
    try {
        await zipExtract(extensionFilePath, tmpExtensionFolderPath);
    } catch (err) {
        await removeFolder(tmpExtensionFolderPath);
        throw err;
    }

    try {
        // load extension from the temp folder
        let extension = await loadExtension(tmpExtensionFolderPath);
        if (extension) {
            return {
                tmpExtensionFolderPath,
                extension
            };
        } else {
            await removeFolder(tmpExtensionFolderPath);
            return undefined;
        }
    } catch (err) {
        await removeFolder(tmpExtensionFolderPath);
        throw err;
    }
}

async function finishImportExtensionFromTempFolder({
    tmpExtensionFolderPath,
    extension
}: {
    tmpExtensionFolderPath: string;
    extension: IExtension;
}) {
    try {
        // uninstall extension if already exist
        await uninstallExtension(extension.id);

        // rename temp folder to extension folder
        let extensionFolderPath = getExtensionFolderPath(extension.id);

        try {
            await renameFile(tmpExtensionFolderPath, extensionFolderPath);
        } catch (err) {
            // try again
            await delay(100);
            await renameFile(tmpExtensionFolderPath, extensionFolderPath);
        }

        // fix image url from temp folder to extension folder
        let tmpUrl = localPathToFileUrl(tmpExtensionFolderPath);
        if (extension.image && extension.image.startsWith(tmpUrl)) {
            extension.image = localPathToFileUrl(
                extensionFolderPath + extension.image.slice(tmpUrl.length)
            );
        }

        return registerExtension(extension);
    } catch (err) {
        await removeFolder(tmpExtensionFolderPath);
        throw err;
    }
}

export function destroyExtensions() {
    extensions.forEach(extension => {
        if (extension.destroy) {
            extension.destroy();
        }
    });
}

////////////////////////////////////////////////////////////////////////////////

function compareVersions(versionString1: string, versionString2: string) {
    let parts1 = versionString1.split(".");
    let parts2 = versionString2.split(".");
    for (let i = 0; i < parts1.length && i < parts2.length; i++) {
        let v1 = parseInt(parts1[i]);
        let v2 = parseInt(parts2[i]);
        if (isNaN(v1) || isNaN(v2)) {
            if (parts1[i] < parts2[i]) {
                return -1;
            }
            if (parts1[i] > parts2[i]) {
                return 1;
            }
        } else {
            if (v1 < v2) {
                return -1;
            } else if (v1 > v2) {
                return 1;
            }
        }
    }

    if (versionString1.length < versionString2.length) {
        return -1;
    }

    if (versionString1.length > versionString2.length) {
        return 1;
    }

    return 0;
}

export async function installExtension(
    extensionFilePath: string,
    {
        checkExtensionType,
        notFound,
        confirmReplaceNewerVersion,
        confirmReplaceOlderVersion,
        confirmReplaceTheSameVersion
    }: {
        checkExtensionType?: (type: string) => boolean;
        notFound(): void;
        confirmReplaceNewerVersion(
            newExtension: IExtension,
            existingExtension: IExtension
        ): Promise<boolean>;
        confirmReplaceOlderVersion(
            newExtension: IExtension,
            existingExtension: IExtension
        ): Promise<boolean>;
        confirmReplaceTheSameVersion(
            newExtension: IExtension,
            existingExtension: IExtension
        ): Promise<boolean>;
    }
) {
    const result = await importExtensionToTempFolder(extensionFilePath);
    if (!result) {
        notFound();
        return undefined;
    }

    if (
        checkExtensionType &&
        (!result.extension.type || !checkExtensionType(result.extension.type))
    ) {
        await removeFolder(result.tmpExtensionFolderPath);
        return undefined;
    }

    const existingExtension = extensions.get(result.extension.id);
    if (existingExtension) {
        const compareVersionResult = compareVersions(
            result.extension.version,
            existingExtension.version
        );
        let confirmed;
        if (compareVersionResult < 0) {
            confirmed = await confirmReplaceNewerVersion(result.extension, existingExtension);
        } else if (compareVersionResult > 0) {
            confirmed = await confirmReplaceOlderVersion(result.extension, existingExtension);
        } else {
            confirmed = await confirmReplaceTheSameVersion(result.extension, existingExtension);
        }

        if (!confirmed) {
            await removeFolder(result.tmpExtensionFolderPath);
            return undefined;
        }
    }

    await finishImportExtensionFromTempFolder(result);

    if (result.extension.properties && result.extension.properties.shortcuts) {
        result.extension.properties.shortcuts.forEach(shortcut => {
            const {
                addShortcut
            } = require("shortcuts/shortcuts-store") as typeof ShortcutsStoreModule;
            const {
                SHORTCUTS_GROUP_NAME_FOR_EXTENSION_PREFIX
            } = require("shortcuts/shortcuts") as typeof ShortcutsModule;

            addShortcut(
                Object.assign({}, shortcut, {
                    id: undefined,
                    groupName: SHORTCUTS_GROUP_NAME_FOR_EXTENSION_PREFIX + result.extension.id,
                    originalId: shortcut.id
                })
            );
        });
    }

    return result.extension;
}

////////////////////////////////////////////////////////////////////////////////

export async function uninstallExtension(extensionId: string) {
    if (extensions.has(extensionId)) {
        let extensionFolderPath = getExtensionFolderPath(extensionId);

        try {
            await removeFolder(extensionFolderPath);
        } catch (err) {
            console.error(err);
        }

        action(() => extensions.delete(extensionId))();
        loadExtensionTasks.delete(extensionFolderPath);

        const {
            deleteGroupInShortcuts
        } = require("shortcuts/shortcuts-store") as typeof ShortcutsStoreModule;
        const {
            SHORTCUTS_GROUP_NAME_FOR_EXTENSION_PREFIX
        } = require("shortcuts/shortcuts") as typeof ShortcutsModule;
        deleteGroupInShortcuts(SHORTCUTS_GROUP_NAME_FOR_EXTENSION_PREFIX + extensionId);
    }
}

////////////////////////////////////////////////////////////////////////////////

export function getObject(type: string, oid: string): IObject {
    let object;

    let getObject = objectTypes.get().get(type);
    if (getObject) {
        object = getObject(oid);
    }

    if (!object) {
        object = {
            id: oid,
            name: "",
            content: null,
            activityLogEntryInfo(logEntry: IActivityLogEntry) {
                return null;
            },
            details: null,
            isResizable: false,
            isEditable: false
        };
    }

    return object;
}

export function getObjectTypeFromLogEntry(logEntry: IActivityLogEntry) {
    if (logEntry.type === "activity-log/note") {
        return "instrument";
    }
    let i = logEntry.type.indexOf("/");
    if (i !== -1) {
        return logEntry.type.substring(0, i);
    }
    return logEntry.type;
}

export function findObjectByActivityLogEntry(logEntry: IActivityLogEntry) {
    return getObject(getObjectTypeFromLogEntry(logEntry), logEntry.oid);
}

////////////////////////////////////////////////////////////////////////////////

let notifySource = {
    id: "shared/extension"
};
registerSource(notifySource);

interface ExtensionChangeEvent {
    id: string;
    image?: string;
    properties?: IExtensionProperties;
}

watch(notifySource.id, undefined, (extensionChange: ExtensionChangeEvent) => {
    const extension = extensions.get(extensionChange.id);
    if (extension) {
        action(() => {
            if (extensionChange.image !== undefined) {
                extension.image = extensionChange.image;
            }

            if (extensionChange.properties !== undefined) {
                extension.properties = extensionChange.properties;
            }

            extension.isDirty = true;
        })();
    }
});

export async function changeExtensionImage(extension: IExtension, srcImageFilePath: string) {
    let extensionFolderPath = getExtensionFolderPath(extension.id);

    let destImageFilePath = extensionFolderPath + "/image.png";

    await copyFile(srcImageFilePath, destImageFilePath);

    let image = destImageFilePath + "?" + guid();

    action(() => {
        extension.image = image;
        extension.isDirty = true;
    })();

    let extensionChange: ExtensionChangeEvent = {
        id: extension.id,
        image: image
    };
    sendMessage(notifySource, extensionChange);
}

export async function changeExtensionProperties(
    extension: IExtension,
    properties: IExtensionProperties
) {
    let extensionFolderPath = getExtensionFolderPath(extension.id);

    let packageJsonFilePath = extensionFolderPath + "/package.json";

    try {
        let packageJs = await readJsObjectFromFile(packageJsonFilePath);
        packageJs["eez-studio"] = properties;
        await writeJsObjectToFile(packageJsonFilePath, packageJs);
    } catch (err) {
        notification.error(err);
        return;
    }

    runInAction(() => {
        extension.properties = properties;
        extension.isDirty = true;
    });

    let extensionChange: ExtensionChangeEvent = {
        id: extension.id,
        properties: properties
    };
    sendMessage(notifySource, extensionChange);
}

////////////////////////////////////////////////////////////////////////////////

export function exportExtension(extension: IExtension, destFilePath: string) {
    return new Promise((resolve, reject) => {
        let extensionFolderPath = getExtensionFolderPath(extension.id);
        var output = fs.createWriteStream(destFilePath);

        const archiver = require("archiver");

        var archive = archiver("zip", {
            zlib: {
                level: 9
            }
        });

        output.on("close", function() {
            resolve();
        });

        archive.on("warning", function(err: any) {
            reject(err);
        });

        archive.on("error", function(err: any) {
            reject(err);
        });

        archive.pipe(output);

        archive.glob(
            "**/*",
            {
                cwd: extensionFolderPath,
                ignore: [".editable"]
            },
            {}
        );

        archive.finalize();
    });
}

////////////////////////////////////////////////////////////////////////////////

export const extensions = observable(new Map<string, IExtension>());

export const installedExtensions = computed(() => {
    return Array.from(extensions.values()).filter(extension => !extension.preInstalled);
});

export const objectTypes = computed(() => {
    let objectTypes = new Map<string, (oid: string) => IObject | undefined>();
    values(extensions).forEach(extension => {
        if (extension.objectTypes) {
            for (let key of Object.keys(extension.objectTypes)) {
                objectTypes.set(key, extension.objectTypes![key]);
            }
        }
    });
    return objectTypes;
});

export const extensionsToolbarButtons = computed(() => {
    let buttons: IToolbarButton[] = [];

    values(extensions).forEach(extension => {
        if (extension.toolbarButtons) {
            buttons.push(...extension.toolbarButtons);
        }
    });

    return buttons;
});

export const extensionsToolboxGroups = computed(() => {
    let groups: IToolboxGroup[] = [];

    values(extensions).forEach(extension => {
        if (extension.toolboxGroups) {
            groups.push(...extension.toolboxGroups);
        }
    });

    return groups;
});
