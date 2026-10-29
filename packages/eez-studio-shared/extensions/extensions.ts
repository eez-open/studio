import { observable, action } from "mobx";
import { EventEmitter } from "events";
import fs from "fs";

import { delay } from "eez-studio-shared/util";
import {
    localPathToFileUrl,
    zipExtract,
    fileExists,
    copyFile,
    readJsObjectFromFile,
    removeFolder,
    renameFile,
    readFolder,
    isRenderer
} from "eez-studio-shared/util-electron";
import { guid } from "eez-studio-shared/guid";
import { firstWord } from "eez-studio-shared/string";

import { registerSource, sendMessage, watch } from "eez-studio-shared/notify";

import {
    IExtension,
    IExtensionProperties,
    ExtensionType,
    IExtensionApi
} from "eez-studio-shared/extensions/extension";

import {
    preInstalledExtensionsFolderPath,
    extensionsFolderPath,
    getExtensionFolderPath
} from "eez-studio-shared/extensions/extension-folder";

import type * as ShortcutsStoreModule from "shortcuts/shortcuts-store";
import path from "path";

import { yarnUninstall } from "eez-studio-shared/extensions/yarn";

export const CONF_EEZ_STUDIO_PROPERTY_NAME = "eez-studio";
export const CONF_MAIN_SCRIPT_PROPERTY_NAME = "main";
export const CONF_NODE_MODULE_PROPERTY_NAME = "node-module";

////////////////////////////////////////////////////////////////////////////////

async function loadExtension(
    extensionFolderPath: string
): Promise<IExtension | undefined> {
    let packageJsonFilePath = extensionFolderPath + "/" + "package.json";
    if (await fileExists(packageJsonFilePath)) {
        try {
            const packageJson = await readJsObjectFromFile(packageJsonFilePath);
            const packageJsonEezStudio =
                packageJson[CONF_EEZ_STUDIO_PROPERTY_NAME];
            if (packageJsonEezStudio) {
                const mainScript =
                    packageJsonEezStudio[CONF_MAIN_SCRIPT_PROPERTY_NAME];

                let extension: IExtension | undefined;
                let extensionType: ExtensionType | undefined;
                try {
                    if (mainScript) {
                        // this is measurement functions extension
                        extensionType = "measurement-functions";
                        extension = require(
                            extensionFolderPath + "/" + mainScript
                        ).default;
                    } else if (
                        packageJsonEezStudio[CONF_NODE_MODULE_PROPERTY_NAME]
                    ) {
                        // this is project editor extension
                        extensionType = "pext";
                        extension = require(extensionFolderPath).default;
                    }
                } catch (err) {
                    console.log(err);
                    return undefined;
                }

                if (extension && extensionType) {
                    extension.id = packageJson.id || packageJson.name;
                    extension.extensionType = extensionType;
                    extension.name = packageJson.name;
                    extension.displayName = packageJson.displayName;
                    extension.version = packageJson.version;
                    extension.author = packageJson.author;
                    extension.description = packageJson.description;
                    extension.moreDescription =
                        packageJsonEezStudio.moreDescription;

                    extension.download = packageJson.download;
                    extension.sha256 = packageJson.sha256;
                    extension.installationFolderPath = extensionFolderPath;

                    extension.image = packageJson.image;
                    if (extension.image) {
                        const imageFilePath =
                            extensionFolderPath + "/" + extension.image;
                        if (await fileExists(imageFilePath)) {
                            extension.image = localPathToFileUrl(imageFilePath);
                        }
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

let extensionApi: IExtensionApi | undefined;

function getExtensionApi(): IExtensionApi {
    if (!extensionApi) {
        if (isRenderer()) {
            extensionApi = {
                renderer: {
                    requireModule: (name: string) => {
                        if (name == "mobx") {
                            return require("mobx");
                        } else {
                            throw new Error(
                                `module not exported to extensions: ${name}`
                            );
                        }
                    },
                    // The tabs-store singleton is created lazily by loadTabs()
                    // (after loadExtensions), so the module has to be required
                    // inside the calls — capturing its exports at
                    // extension-registration time would freeze `tabs` at
                    // undefined.
                    getOpenProjects: () => {
                        const { tabs, ProjectEditorTab } =
                            require("home/tabs-store") as typeof import("home/tabs-store");
                        return tabs.tabs
                            .filter(tab => tab instanceof ProjectEditorTab)
                            .map(tab => ({
                                name: path.basename(tab.filePath ?? ""),
                                filePath: tab.filePath,
                                active: tab === tabs.activeTab
                            }));
                    },
                    getActiveProjectStore: () => {
                        const { tabs, ProjectEditorTab } =
                            require("home/tabs-store") as typeof import("home/tabs-store");
                        return tabs.activeTab instanceof ProjectEditorTab
                            ? tabs.activeTab.projectStore
                            : undefined;
                    },
                    activateProjectTab: (filePath: string) => {
                        const { tabs, ProjectEditorTab } =
                            require("home/tabs-store") as typeof import("home/tabs-store");
                        const normalize = (p?: string) =>
                            p?.replace(/\\/g, "/").toLowerCase();
                        const tab = tabs.tabs.find(
                            tab =>
                                tab instanceof ProjectEditorTab &&
                                normalize(tab.filePath) ===
                                    normalize(filePath)
                        );
                        if (!tab) {
                            throw new Error(
                                `no open project tab for ${filePath}`
                            );
                        }
                        if (tabs.activeTab !== tab) {
                            tab.makeActive();
                        }
                    },
                    openProject: (filePath: string, runMode?: boolean) => {
                        const { openProject } =
                            require("home/tabs-store") as typeof import("home/tabs-store");
                        return openProject(filePath, !!runMode);
                    },
                    // Toolkits below re-export project-editor symbols the
                    // same lazy way — required at call time, so nothing is
                    // frozen at extension-registration time.
                    // 下述 toolkit 同样在调用时才 require，避免注册期冻结导出。
                    getEditorObjectToolkit: () => {
                        const store =
                            require("project-editor/store") as typeof import("project-editor/store");
                        const object =
                            require("project-editor/core/object") as typeof import("project-editor/core/object");
                        const search =
                            require("project-editor/core/search") as typeof import("project-editor/core/search");
                        return {
                            createObject: store.createObject,
                            getClassByName: object.getClassByName,
                            getClassesDerivedFrom: object.getClassesDerivedFrom,
                            getDefaultValue: object.getDefaultValue,
                            setParent: object.setParent,
                            visitObjects: search.visitObjects,
                            getObjectPath: store.getObjectPath,
                            getObjectPathAsString: store.getObjectPathAsString
                        };
                    },
                    getLvglToolkit: () => ({
                        LVGLWidget:
                            require("project-editor/lvgl/widgets/Base").LVGLWidget,
                        LVGLStyle: require("project-editor/lvgl/style").LVGLStyle,
                        Page: require("project-editor/features/page/page").Page,
                        Color:
                            require("project-editor/features/style/theme").Color,
                        BUILT_IN_FONTS:
                            require("project-editor/lvgl/style-catalog")
                                .BUILT_IN_FONTS
                    }),
                    getAssetToolkit: () => {
                        const font =
                            require("project-editor/features/font/font") as any;
                        const fontExtract =
                            require("project-editor/features/font/font-extract") as any;
                        const bitmap =
                            require("project-editor/features/bitmap/bitmap") as any;
                        return {
                            Font: font.Font,
                            extractFont: fontExtract.extractFont,
                            getLvglEncodingsAndSymbols:
                                font.getLvglEncodingsAndSymbols,
                            Bitmap: bitmap.Bitmap,
                            createBitmap: bitmap.createBitmap
                        };
                    }
                }
            };
        } else {
            extensionApi = {
                main: {}
            };
        }
    }

    return extensionApi;
}

export function registerExtension(extension: IExtension) {
    if (extension.init) {
        extension.init(getExtensionApi());
    }

    action(() => extensions.set(extension.id, extension))();

    return extensions.get(extension.id);
}

export function loadLocalExtension(
    extensionFolderPath: string
): IExtension | undefined {
    try {
        const packageJsonFilePath = extensionFolderPath + "/" + "package.json";
        if (!fs.existsSync(packageJsonFilePath)) {
            return undefined;
        }

        const packageJson = JSON.parse(
            fs.readFileSync(packageJsonFilePath, "utf8")
        );
        const packageJsonEezStudio = packageJson[CONF_EEZ_STUDIO_PROPERTY_NAME];
        if (
            !packageJsonEezStudio ||
            !packageJsonEezStudio[CONF_NODE_MODULE_PROPERTY_NAME]
        ) {
            return undefined;
        }

        const extension: IExtension | undefined =
            require(extensionFolderPath).default;
        if (!extension) {
            return undefined;
        }

        extension.id = packageJson.id || packageJson.name;
        extension.extensionType = "pext";
        extension.name = packageJson.name;
        extension.displayName = packageJson.displayName;
        extension.version = packageJson.version;
        extension.author = packageJson.author;
        extension.description = packageJson.description;
        extension.installationFolderPath = extensionFolderPath;

        return extension;
    } catch (err) {
        console.error(err);
        return undefined;
    }
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

        return await new Promise<IExtension>((resolve, reject) => {
            loadExtensionTask.on("finished", resolve);
            loadExtensionTask.on("error", reject);
        });
    }

    const newLoadExtensionTask = new LoadExtensionTask();
    loadExtensionTasks.set(folder, newLoadExtensionTask);

    try {
        let extension = await loadExtension(folder);
        if (extension) {
            extension = registerExtension(extension);
        }

        newLoadExtensionTask.isFinished = true;
        newLoadExtensionTask.extension = extension;
        newLoadExtensionTask.emit("finished", extension);

        return extension;
    } catch (err) {
        newLoadExtensionTask.emit("error", err);
        throw err;
    }
}

///////////////////////////////////////////////////////////////////////////////

export async function reloadExtension(folder: string) {
    let extension = await loadExtension(folder);
    if (extension) {
        extension = registerExtension(extension);
    }
    return extension;
}

///////////////////////////////////////////////////////////////////////////////

export async function loadExtensions(nodeModuleFolders: string[]) {
    let preinstalledExtensionFolders = await readFolder(
        preInstalledExtensionsFolderPath
    );

    let installedExtensionFolders: string[];
    try {
        installedExtensionFolders = await readFolder(extensionsFolderPath);

        installedExtensionFolders = installedExtensionFolders.filter(
            extensionFolderPath => {
                if (fs.lstatSync(extensionFolderPath).isFile()) {
                    return false;
                }
                const basename = path.basename(extensionFolderPath);
                if (basename == "node_modules" || basename == "cache") {
                    return false;
                }
                return true;
            }
        );
    } catch (err) {
        console.info(
            `Extensions folder "${extensionsFolderPath}" doesn't exists.`
        );
        installedExtensionFolders = [];
    }

    for (let folder of [
        ...preinstalledExtensionFolders,
        ...installedExtensionFolders,
        ...nodeModuleFolders
    ]) {
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

export async function importExtensionToFolder(
    extensionFilePath: string,
    extensionFolderPath: string
) {
    // extract extension zip file to the temp folder
    await zipExtract(extensionFilePath, extensionFolderPath);

    // load extension from the temp folder
    return await loadExtension(extensionFolderPath);
}

export async function importExtensionToTempFolder(extensionFilePath: string) {
    const tmpExtensionFolderPath =
        extensionsFolderPath + path.sep + guid() + "_tmp";
    try {
        const extension = await importExtensionToFolder(
            extensionFilePath,
            tmpExtensionFolderPath
        );

        if (!extension) {
            await removeFolder(tmpExtensionFolderPath);
            return undefined;
        }

        return {
            tmpExtensionFolderPath,
            extension
        };
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

        // reload extension from real folder
        const reloadedExtension = await loadExtension(extensionFolderPath);
        if (!reloadedExtension) {
            await removeFolder(extensionFolderPath);
            throw "Import failed";
        }

        loadExtensionTasks.delete(extensionFolderPath);

        return registerExtension(reloadedExtension);
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
        checkExtensionType(result.extension.extensionType)
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
            confirmed = await confirmReplaceNewerVersion(
                result.extension,
                existingExtension
            );
        } else if (compareVersionResult > 0) {
            confirmed = await confirmReplaceOlderVersion(
                result.extension,
                existingExtension
            );
        } else {
            confirmed = await confirmReplaceTheSameVersion(
                result.extension,
                existingExtension
            );
        }

        if (!confirmed) {
            await removeFolder(result.tmpExtensionFolderPath);
            return undefined;
        }
    }

    await finishImportExtensionFromTempFolder(result);

    if (result.extension.properties && result.extension.properties.shortcuts) {
        result.extension.properties.shortcuts.forEach(shortcut => {
            const { addShortcut, SHORTCUTS_GROUP_NAME_FOR_EXTENSION_PREFIX } =
                require("shortcuts/shortcuts-store") as typeof ShortcutsStoreModule;

            addShortcut(
                Object.assign({}, shortcut, {
                    id: undefined,
                    groupName:
                        SHORTCUTS_GROUP_NAME_FOR_EXTENSION_PREFIX +
                        result.extension.id,
                    originalId: shortcut.id
                })
            );
        });
    }

    return result.extension;
}

////////////////////////////////////////////////////////////////////////////////

export async function uninstallExtension(extensionId: string) {
    const extension = extensions.get(extensionId);
    if (extension) {
        if (extension.extensionType === "pext") {
            await yarnUninstall(extension.name);
            action(() => extensions.delete(extensionId))();
        } else {
            let extensionFolderPath = getExtensionFolderPath(extensionId);

            try {
                await removeFolder(extensionFolderPath);
            } catch (err) {
                console.error(err);
            }

            action(() => extensions.delete(extensionId))();
            loadExtensionTasks.delete(extensionFolderPath);

            const {
                deleteGroupInShortcuts,
                SHORTCUTS_GROUP_NAME_FOR_EXTENSION_PREFIX
            } =
                require("shortcuts/shortcuts-store") as typeof ShortcutsStoreModule;
            deleteGroupInShortcuts(
                SHORTCUTS_GROUP_NAME_FOR_EXTENSION_PREFIX + extensionId
            );
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

export let notifySource = {
    id: "shared/extension"
};
registerSource(notifySource);

export interface ExtensionChangeEvent {
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

export async function changeExtensionImage(
    extension: IExtension,
    srcImageFilePath: string
) {
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

////////////////////////////////////////////////////////////////////////////////

export async function exportExtension(
    extension: IExtension,
    destFilePath: string
) {
    const archiver = await import("archiver");

    return new Promise<void>((resolve, reject) => {
        let extensionFolderPath = getExtensionFolderPath(extension.id);
        var output = fs.createWriteStream(destFilePath);

        var archive = archiver.default("zip", {
            zlib: {
                level: 9
            }
        });

        output.on("close", function () {
            resolve();
        });

        archive.on("warning", function (err: any) {
            reject(err);
        });

        archive.on("error", function (err: any) {
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

export function getManufacturer(extension: IExtension) {
    return firstWord(extension.displayName || extension.name);
}

export function isInstrumentExtension(extension: IExtension) {
    const eezStudioProperties = (extension as any)[
        CONF_EEZ_STUDIO_PROPERTY_NAME
    ];
    if (eezStudioProperties) {
        return !eezStudioProperties[CONF_MAIN_SCRIPT_PROPERTY_NAME];
    }
    return !!extension.properties;
}

////////////////////////////////////////////////////////////////////////////////

export const extensions = observable(new Map<string, IExtension>());
