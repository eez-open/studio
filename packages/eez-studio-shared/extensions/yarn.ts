import path from "path";
import { BrowserWindow } from "@electron/remote";

import {
    fileExists,
    readJsObjectFromFile,
    makeFolder
} from "eez-studio-shared/util-electron";
import { _difference } from "eez-studio-shared/algorithm";

import { confirm } from "eez-studio-ui/dialog-electron";
import { sourceRootDir } from "eez-studio-shared/util";

import { extensionsFolderPath } from "eez-studio-shared/extensions/extension-folder";
import {
    CONF_EEZ_STUDIO_PROPERTY_NAME,
    extensions
} from "eez-studio-shared/extensions/extensions";

function yarnFn(args: string[]) {
    const yarn = sourceRootDir() + "/../libs/yarn-1.22.10.js";
    const cp = require("child_process");

    return new Promise<void>((resolve, reject) => {
        const env = {
            NODE_ENV: "production",
            ELECTRON_RUN_AS_NODE: "true"
        };

        const cmd = [process.execPath, yarn].concat(args).join(" ");

        console.log("Launching yarn:", cmd);

        cp.execFile(
            process.execPath,
            [yarn].concat(args),
            {
                cwd: extensionsFolderPath,
                env,
                timeout: 10 * 1000, // 10 seconds
                maxBuffer: 1024 * 1024
            },
            (err: any, stdout: any, stderr: any) => {
                if (err) {
                    reject(stderr);
                } else {
                    console.log("yarn", stdout);
                    resolve();
                }
            }
        );
    });
}

export async function yarnInstall() {
    const cacheFolderPath = `${extensionsFolderPath}/cache`;
    await makeFolder(cacheFolderPath);

    try {
        await yarnFn([
            "install",
            "--no-emoji",
            "--no-lockfile",
            "--cache-folder",
            cacheFolderPath
        ]);

        const packageJsonPath = `${extensionsFolderPath}/package.json`;
        const packageJson = require(packageJsonPath);

        const folders = Object.keys(packageJson.dependencies ?? []).map(
            plugin =>
                path.resolve(
                    extensionsFolderPath,
                    "node_modules",
                    plugin.split("#")[0]
                )
        );

        const newExtensions = [];

        for (let i = 0; i < folders.length; i++) {
            const folder = folders[i];
            let packageJsonFilePath = folder + "/" + "package.json";
            if (await fileExists(packageJsonFilePath)) {
                try {
                    const packageJson = await readJsObjectFromFile(
                        packageJsonFilePath
                    );
                    const packageJsonEezStudio =
                        packageJson[CONF_EEZ_STUDIO_PROPERTY_NAME];
                    if (packageJsonEezStudio) {
                        const extension = extensions.get(packageJson.name);
                        if (
                            !extension ||
                            packageJson.version != extension.version
                        ) {
                            newExtensions.push(path.basename(folder));
                        }
                    }
                } catch (err) {
                    console.log(err);
                }
            }
        }

        if (newExtensions.length > 0) {
            confirm(
                "New extensions detected. Reload?",
                newExtensions.join(", "),
                () => {
                    BrowserWindow.getAllWindows().forEach(window => {
                        window.webContents.send("reload");
                    });
                }
            );
        }
    } catch (err) {
        console.log("yarn", err);
    }
}

export async function getNodeModuleFolders() {
    const packageJsonPath = `${extensionsFolderPath}/package.json`;
    if (!(await fileExists(packageJsonPath))) {
        try {
            await yarnFn(["init", "-y"]);
        } catch (err) {
            console.log("yarn", err);
        }
    }

    const packageJson = require(packageJsonPath);

    return Object.keys(packageJson.dependencies).map(plugin =>
        path.resolve(extensionsFolderPath, "node_modules", plugin.split("#")[0])
    );
}
