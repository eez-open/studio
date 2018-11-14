import { observable } from "mobx";

import {
    localPathToFileUrl,
    fileExists,
    readTextFile,
    readJsObjectFromFile,
    readFolder,
    parseXmlString,
    isRenderer,
    writeBinaryData,
    writeJsObjectToFile
} from "eez-studio-shared/util";
import { getExtensionFolderPath } from "eez-studio-shared/extensions/extension-folder";
import { IExtension } from "eez-studio-shared/extensions/extension";

import { IInstrumentExtensionProperties } from "instrument/instrument-extension";
import * as PropertiesComponentModule from "instrument/properties-component";

////////////////////////////////////////////////////////////////////////////////

const INSTRUMENT_NO_IMAGE = "../instrument/_images/instrument-no-image.png";

export const DEFAULT_INSTRUMENT_PROPERTIES: IInstrumentExtensionProperties = {
    properties: {
        connection: {
            ethernet: {
                port: 5025
            },
            serial: {
                baudRates: [4800, 9600, 19200, 38400, 57600, 74880, 115200],
                defaultBaudRate: 9600
            }
        },
        channels: [
            {
                maxVoltage: 40,
                maxCurrent: 5
            },
            {
                maxVoltage: 40,
                maxCurrent: 5
            }
        ]
    }
};

export const EMPTY_INSTRUMENT_PROPERTIES: IInstrumentExtensionProperties = {
    properties: {}
};

////////////////////////////////////////////////////////////////////////////////

export type NumericSuffix = "optional" | "mandatory" | "none";

export interface ICommand {
    name: string;
    description?: string;
    helpLink?: string;
}

////////////////////////////////////////////////////////////////////////////////

async function findIdfFile(extensionFolderPath: string) {
    let files = await readFolder(extensionFolderPath);
    return files.find(file => file.toLowerCase().endsWith(".idf"));
}

function compareName(name1: string, name2: string) {
    if (name1 === name2) {
        return true;
    }

    // following cases are also considered equal:

    if (name1.startsWith("[")) {
        // [SUBSYSTEM]... === [:SUBSYSTEM]...
        if ("[:" + name1.slice(1) === name2) {
            return true;
        }
    } else {
        // SUBSYSTEM... === :SUBSYSTEM...
        if (":" + name1 === name2) {
            return true;
        }
    }

    if (name2.startsWith("[")) {
        // [:SUBSYSTEM]... === [SUBSYSTEM]...
        if (name1 === "[:" + name2.slice(1)) {
            return true;
        }
    } else {
        // :SUBSYSTEM... === SUBSYSTEM...
        if (name1 === ":" + name2) {
            return true;
        }
    }

    return false;
}

function buildCommand(name: string, sdlCommand: JQuery, docPath: string, commands: ICommand[]) {
    let command: ICommand | undefined;

    if (sdlCommand.find(">CommandSyntaxes").length) {
        command = {
            name: name
        };
    }

    let query: ICommand | undefined;
    if (sdlCommand.find(">QuerySyntaxes").length) {
        query = {
            name: name + "?"
        };
    }

    sdlCommand.find(">HelpLinks>HelpLink").each((i, child) => {
        let helpLink = $(child).attr("name");
        if (helpLink) {
            if (command && compareName(command.name, helpLink)) {
                command.helpLink = localPathToFileUrl(docPath + "/" + $(child).attr("url"));
            }

            if (query && compareName(query.name, helpLink)) {
                query.helpLink = localPathToFileUrl(docPath + "/" + $(child).attr("url"));
            }
        }
    });

    sdlCommand.find(">HelpLinks>HelpLink").each((i, child) => {
        let helpLink = $(child).attr("name");
        if (helpLink) {
            if (command && !command.helpLink) {
                command.helpLink = localPathToFileUrl(docPath + "/" + $(child).attr("url"));
            }

            if (query && !query.helpLink) {
                query.helpLink = localPathToFileUrl(docPath + "/" + $(child).attr("url"));
            }
        }
    });

    if (command) {
        commands.push(command);
    }

    if (query) {
        commands.push(query);
    }
}

function buildCommonCommands(commonCommands: JQuery, docPath: string, commands: ICommand[]) {
    commonCommands.find(">CommonCommand").each((i, child) => {
        let mnemonic = $(child).attr("mnemonic");
        if (mnemonic) {
            buildCommand("*" + mnemonic, $(child), docPath, commands);
        }
    });
}

function buildNode(path: string, sdlNode: JQuery, docPath: string, commands: ICommand[]) {
    buildNodes(path, sdlNode.find(">Node"), docPath, commands);

    sdlNode.find(">SubsystemCommand").each((i, child) => {
        buildCommand(path, $(child), docPath, commands);
    });
}

function buildNodes(path: string, sdlNodes: JQuery, docPath: string, commands: ICommand[]) {
    sdlNodes.each((i, child) => {
        let sdlNode = $(child);

        let mnemonic = sdlNode.attr("mnemonic");
        if (mnemonic) {
            let numericSuffix = sdlNode.attr("numericSuffix");
            if (numericSuffix === "mandatory") {
                mnemonic += "<n>";
            } else if (numericSuffix === "optional") {
                mnemonic += "[<n>]";
            }

            let newPath;

            if (sdlNode.attr("default") === "true") {
                if (path) {
                    newPath = path + "[:" + mnemonic + "]";
                } else {
                    newPath = "[" + mnemonic + "]";
                }
            } else {
                if (path) {
                    newPath = path + ":" + mnemonic;
                } else {
                    newPath = mnemonic;
                }
            }

            buildNode(newPath, sdlNode, docPath, commands);
        }
    });
}

function buildCommands(sdl: JQuery<any>, docPath: string) {
    let commands: ICommand[] = [];

    let ScpiDefinition = sdl.find(">ScpiDefinition");
    if (ScpiDefinition.length) {
        buildCommonCommands(ScpiDefinition.find(">CommonCommands"), docPath, commands);

        ScpiDefinition.find(">SubsystemCommands>RootNode").each((i, child) => {
            buildNodes("", $(child), docPath, commands);
        });
    }

    return commands;
}

export function getNotFoundInstrumentExtension(instrumentExtensionId: string) {
    return {
        id: instrumentExtensionId,
        name: "no name",
        version: "no version",
        author: "no author",
        image: `${__dirname}/../eez-studio-ui/_images/object-implementation-not-found.svg`
    };
}

async function readPackageJson(packageJsonFilePath: string) {
    if (await fileExists(packageJsonFilePath)) {
        try {
            return await readJsObjectFromFile(packageJsonFilePath);
        } catch (err) {
            console.error(err);
        }
    }

    return {
        id: "",
        "eez-studio": EMPTY_INSTRUMENT_PROPERTIES
    };
}

export async function loadInstrumentExtension(extensionFolderPath: string) {
    try {
        let idfFilePath = await findIdfFile(extensionFolderPath);
        if (!idfFilePath) {
            throw "IDF file not found";
        }

        if (isRenderer()) {
            let idfXmlAsString = await readTextFile(idfFilePath);
            let idf = parseXmlString(idfXmlAsString);
            let ScpiConfiguration = $(idf).find(">ScpiConfigurations");
            if (ScpiConfiguration.length && ScpiConfiguration.attr("guid")) {
                let id = ScpiConfiguration.attr("guid")!;

                let name = ScpiConfiguration.attr("name") || "Unknown name";
                let version = ScpiConfiguration.attr("firmwareVersion") || "Unknown version";

                let properties: IInstrumentExtensionProperties;
                let isEditable: boolean;
                let downloadUrl: string | undefined;

                let packageJsonFilePath = extensionFolderPath + "/package.json";
                if (await fileExists(packageJsonFilePath)) {
                    const packageJson = await readPackageJson(packageJsonFilePath);
                    version = packageJson.version;
                    properties = packageJson["eez-studio"];
                    isEditable = await fileExists(extensionFolderPath + "/.editable");
                    downloadUrl = packageJson.download;
                } else {
                    properties = EMPTY_INSTRUMENT_PROPERTIES;
                    isEditable = true;

                    await writeBinaryData(extensionFolderPath + "/.editable", "");

                    await writeJsObjectToFile(packageJsonFilePath, {
                        name,
                        version,
                        "eez-studio": properties
                    });

                    downloadUrl = undefined;
                }

                const isDirty =
                    isEditable &&
                    ((await fileExists(extensionFolderPath + "/package.json")) ||
                        (await fileExists(extensionFolderPath + "/image.png")));

                const extension: IExtension = observable(
                    {
                        id,
                        type: "instrument",
                        name,
                        description:
                            ScpiConfiguration.attr("description") || "Unknown description.",
                        version,
                        author: ScpiConfiguration.attr("author") || "Unknown author",
                        image: "",
                        renderPropertiesComponent: () => {
                            const {
                                renderPropertiesComponent
                            } = require("instrument/properties-component") as typeof PropertiesComponentModule;

                            return new Promise<JSX.Element>(resolve => {
                                resolve(renderPropertiesComponent(extension));
                            });
                        },
                        properties,
                        isEditable,
                        isDirty
                    },
                    {
                        properties: observable.shallow
                    }
                );

                const imageFilePath = extensionFolderPath + "/" + "image.png";
                if (await fileExists(imageFilePath)) {
                    extension.image = localPathToFileUrl(imageFilePath);
                } else {
                    extension.image = INSTRUMENT_NO_IMAGE;
                }

                extension.download = downloadUrl;

                extension.installationFolderPath = extensionFolderPath;

                return extension;
            }
        } else {
            let packageJSON = await readPackageJson(extensionFolderPath + "/package.json");

            const extension: IExtension = {
                id: packageJSON["id"],
                type: "instrument",
                name: "",
                description: "",
                version: "",
                author: "",
                image: "",
                properties: packageJSON["eez-studio"]
            };

            return extension;
        }
    } catch (err) {
        console.error(err);
    }

    throw "Unknown extension type!";
}

export async function loadCommands(instrumentExtensionId: string) {
    let extensionFolderPath = getExtensionFolderPath(instrumentExtensionId);

    try {
        let idfFilePath = await findIdfFile(extensionFolderPath);
        if (!idfFilePath) {
            throw "IDF file not found";
        }

        let idfXmlAsString = await readTextFile(idfFilePath);
        let idf = parseXmlString(idfXmlAsString);
        let SdlFile = $(idf).find(">ScpiConfigurations>File[type=sdl]");
        if (SdlFile.length) {
            let docPath = extensionFolderPath + "/" + "docs";

            let sdlFilePath = extensionFolderPath + "/" + SdlFile.attr("name");
            let sdlXmlAsString = await readTextFile(sdlFilePath);
            let sdl = parseXmlString(sdlXmlAsString);
            let commands = buildCommands($(sdl), docPath);
            return commands;
        }

        throw "SDL file not found";
    } catch (err) {
        throw err;
    }
}
