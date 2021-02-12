import {
    writeJsObjectToFile,
    getFileNameWithoutExtension,
    getFolderName,
    localPathToFileUrl
} from "eez-studio-shared/util-electron";
import { objectToJS } from "project-editor/core/serialization";
import { importExtensionToFolder } from "eez-studio-shared/extensions/extensions";
import { IExtension } from "eez-studio-shared/extensions/extension";

import * as notification from "eez-studio-ui/notification";

import { getNewProject } from "project-editor/project/project";
import { ExtensionDefinition } from "project-editor/features/extension-definitions/extension-definitions";
import { Scpi } from "project-editor/features/scpi/scpi";

import { loadCommandsFromExtensionFolder } from "instrument/import";
import { splitCommandToMnemonics } from "instrument/commands-tree";

function generateExtensionGuid(extensionName: string) {
    var sha256 = require("sha256");
    var hash = sha256(extensionName);
    let i = 0;
    return "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx".replace(/[x]/g, function(c) {
        return hash[i++ % hash.length];
    });
}

function createExtensionDefinitions(extension: IExtension, extensionName: string) {
    const extensionDefinition = new ExtensionDefinition();

    extensionDefinition.name = extensionName;
    extensionDefinition.description = extension.description || "";
    extensionDefinition.buildConfiguration = "Default";
    extensionDefinition.buildFolder = ".";
    extensionDefinition.extensionName = extensionDefinition.name;
    extensionDefinition.idn = "";
    extensionDefinition.properties = "";
    extensionDefinition.idfName = extension.name;
    extensionDefinition.idfShortName = extension.shortName || "";
    extensionDefinition.idfFirmwareVersion = "1.0";
    extensionDefinition.idfGuid = generateExtensionGuid(extensionName);
    extensionDefinition.idfRevisionNumber = extension.revisionNumber || "";
    extensionDefinition.idfSupportedModels = extension.supportedModels || "";
    extensionDefinition.idfRevisionComments = extension.revisionComments || "";
    extensionDefinition.idfAuthor = extension.author || "";
    extensionDefinition.sdlFriendlyName = "";

    return [extensionDefinition];
}

async function createScpi(extensionFolderPath: string) {
    const scpi: Scpi = new Scpi();

    const { commands, enums } = await loadCommandsFromExtensionFolder(extensionFolderPath);

    const extensionFolderPathUrl = localPathToFileUrl(extensionFolderPath);

    const subsystems = new Map<string, any>();

    commands.forEach(command => {
        let subsystemName = splitCommandToMnemonics(command.name)[0];
        if (subsystemName.startsWith("*")) {
            subsystemName = "Common commands";
        } else if (subsystemName.startsWith("[")) {
            subsystemName = subsystemName.substr(1, subsystemName.length - 2);
        }

        let scpiSubsystem = subsystems.get(subsystemName);
        if (!scpiSubsystem) {
            scpiSubsystem = {
                name: subsystemName,
                commands: []
            };
            subsystems.set(subsystemName, scpiSubsystem);
        }

        scpiSubsystem.commands.push(
            Object.assign({}, command, {
                helpLink: command.helpLink && command.helpLink.substr(extensionFolderPathUrl.length)
            })
        );
    });

    (scpi as any).enums = enums;
    (scpi as any).subsystems = Array.from(subsystems.values());

    return scpi;
}

export async function importInstrumentDefinitionAsProject(
    instrumentDefinitionFilePath: string,
    projectFilePath: string
) {
    const progressToastId = notification.info("Importing...", {
        autoClose: false
    });

    await new Promise(resolve => setTimeout(resolve));

    try {
        getFileNameWithoutExtension(projectFilePath);

        const extensionName = getFileNameWithoutExtension(projectFilePath);
        const extensionFolderPath = getFolderName(projectFilePath) + "/" + extensionName;

        const extension = await importExtensionToFolder(
            instrumentDefinitionFilePath,
            extensionFolderPath
        );
        if (!extension) {
            notification.update(progressToastId, {
                render: "Failed to import instrument definition",
                type: notification.ERROR,
                autoClose: 5000
            });
            return;
        }

        const project = getNewProject();

        project.settings.general.scpiDocFolder = extensionName;
        project.settings.build.destinationFolder = ".";

        (project as any).extensionDefinitions = createExtensionDefinitions(
            extension,
            extensionName
        );

        (project as any).scpi = await createScpi(extensionFolderPath);

        await writeJsObjectToFile(projectFilePath, objectToJS(project));

        EEZStudio.electron.ipcRenderer.send(
            "openWindow",
            projectFilePath
        );

        await new Promise(resolve => setTimeout(resolve));

        notification.update(progressToastId, {
            render: "Instrument definition imported",
            type: notification.SUCCESS,
            autoClose: 1000
        });
    } catch (err) {
        notification.update(progressToastId, {
            render: err.toString(),
            type: notification.ERROR,
            autoClose: 5000
        });
    }
}
