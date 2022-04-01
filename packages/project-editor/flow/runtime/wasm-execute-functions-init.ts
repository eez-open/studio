import fs from "fs";

import type { IDashboardComponentContext } from "eez-studio-types";
import { registerExecuteFunction } from "project-editor/flow/runtime/wasm-execute-functions";

import "project-editor/flow/components/actions/runtime";
import "project-editor/flow/components/widgets/runtime";

const CONF_EEZ_STUDIO_PROPERTY_NAME = "eez-studio";
const CONF_NODE_MODULE_PROPERTY_NAME = "node-module";
const CONF_RUNTIME_PROPERTY_NAME = "runtime";

function fileExists(filePath: string) {
    return new Promise<boolean>((resolve, reject) => {
        fs.exists(filePath, (exists: boolean) => {
            resolve(exists);
        });
    });
}

function readTextFile(filePath: string) {
    return new Promise<string>((resolve, reject) => {
        fs.readFile(filePath, "utf8", (err: any, data: string) => {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        });
    });
}

async function readJsObjectFromFile(filePath: string) {
    let data = await readTextFile(filePath);
    return JSON.parse(data);
}

async function loadExtension(nodeModuleFolder: string) {
    let packageJsonFilePath = nodeModuleFolder + "/" + "package.json";
    if (await fileExists(packageJsonFilePath)) {
        try {
            const packageJson = await readJsObjectFromFile(packageJsonFilePath);
            const packageJsonEezStudio =
                packageJson[CONF_EEZ_STUDIO_PROPERTY_NAME];
            const runtimeScriptPath =
                packageJsonEezStudio[CONF_NODE_MODULE_PROPERTY_NAME] &&
                packageJsonEezStudio[CONF_RUNTIME_PROPERTY_NAME];
            if (runtimeScriptPath) {
                const extension = require(nodeModuleFolder +
                    "/" +
                    runtimeScriptPath).default;

                if (extension.eezFlowExtensionInit) {
                    extension.eezFlowExtensionInit({
                        registerExecuteFunction: (
                            name: string,
                            func: (context: IDashboardComponentContext) => void
                        ) => {
                            registerExecuteFunction(
                                packageJson.name + "/" + name,
                                func
                            );
                        }
                    });
                }
            }
        } catch (err) {
            console.error(err);
        }
    }
}

export async function init(nodeModuleFolders: string[]) {
    for (const nodeModuleFolder of nodeModuleFolders) {
        await loadExtension(nodeModuleFolder);
    }
}
