import { observable } from "mobx";
import { map } from "lodash";
import fs from "fs";

import { sourceRootDir, parseXmlString } from "eez-studio-shared/util";
import {
    localPathToFileUrl,
    fileExists,
    readTextFile,
    readJsObjectFromFile,
    readFolder,
    isRenderer,
    writeBinaryData,
    writeJsObjectToFile
} from "eez-studio-shared/util-electron";

import type {
    CommandLineEnding,
    CommandsProtocolType,
    IExtension
} from "eez-studio-shared/extensions/extension";
import { getExtensionFolderPath } from "eez-studio-shared/extensions/extension-folder";

import type { IInstrumentExtensionProperties } from "instrument/instrument-extension";
import type * as PropertiesComponentModule from "instrument/properties-component";
import type {
    IEnum,
    IEnumMember,
    ICommand,
    IParameter,
    IParameterType,
    IResponse,
    IResponseTypeType
} from "instrument/scpi";

////////////////////////////////////////////////////////////////////////////////

const INSTRUMENT_NO_IMAGE = "../instrument/_images/instrument-no-image.png";

export const EMPTY_INSTRUMENT_PROPERTIES: IInstrumentExtensionProperties = {
    properties: {}
};

////////////////////////////////////////////////////////////////////////////////

export type NumericSuffix = "optional" | "mandatory" | "none";

////////////////////////////////////////////////////////////////////////////////

async function findIdfFile(extensionFolderPath: string) {
    try {
        if (!fs.lstatSync(extensionFolderPath).isDirectory()) {
            return undefined;
        }
    } catch (err) {
        return undefined;
    }

    let files;
    try {
        files = await readFolder(extensionFolderPath);
    } catch (err) {
        if (err.code == "ENOTDIR") {
            return undefined;
        }
        throw err;
    }
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

function buildEnums(sdl: JQuery<any>): IEnum[] {
    return map(
        sdl.find("GlobalDefinitions>Enum"),
        (element: HTMLElement, index: number) => {
            const name = $(element).attr("name") || "";

            const members: IEnumMember[] = map(
                $(element).find("Member"),
                (element: HTMLElement, index: number) => {
                    const name = $(element).attr("mnemonic") || "";
                    const value = $(element).attr("value") || "";
                    return {
                        name,
                        value
                    };
                }
            );

            return {
                name,
                members
            };
        }
    );
}

function buildParameters(dom: JQuery): IParameter[] {
    return map(
        dom.find("Parameters>Parameter"),
        (element: HTMLElement, index: number) => {
            const name = element.getAttribute("name") || index.toString();

            let isOptional;
            try {
                isOptional = !!JSON.parse(
                    element.getAttribute("optional") || "false"
                );
            } catch (err) {
                console.error(err);
                isOptional = false;
            }

            let type: IParameterType[] = [];

            if ($(element).find("Any").length) {
                type.push({
                    type: "any"
                });
            } else {
                if ($(element).find("NonDecimalNumeric").length) {
                    type.push({
                        type: "nr1"
                    });
                } else if ($(element).find("DecimalNumeric").length) {
                    type.push({
                        type: "nr2"
                    });
                }

                if ($(element).find("String").length) {
                    type.push({
                        type: "quoted-string"
                    });
                }

                if ($(element).find("DataBlock").length) {
                    type.push({
                        type: "data-block"
                    });
                }

                if ($(element).find("Character>EnumRef").length) {
                    type.push({
                        type: "discrete",
                        enumeration: $(element)
                            .find("Character>EnumRef")
                            .attr("name")
                    });
                }

                if ($(element).find("Expression>ChannelList").length) {
                    type.push({
                        type: "channel-list"
                    });
                }

                if ($(element).find("ArbitraryBlock").length) {
                    type.push({
                        type: "data-block"
                    });
                }
            }

            const description = element.getAttribute("description") || "";

            return {
                name,
                type,
                isOptional,
                description
            };
        }
    );
}

function buildResponse(dom: JQuery): IResponse {
    let type: IResponseTypeType;

    let enumeration;

    if (dom.find("Responses>Response>ResponseType>Any").length) {
        type = "any";
    } else if (dom.find("Responses>Response>ResponseType>NR1Numeric").length) {
        type = "nr1";
    } else if (dom.find("Responses>Response>ResponseType>NR2Numeric").length) {
        type = "nr2";
    } else if (dom.find("Responses>Response>ResponseType>NR3Numeric").length) {
        type = "nr3";
    } else if (dom.find("Responses>Response>ResponseType>String").length) {
        type = "quoted-string";
    } else if (
        dom.find("Responses>Response>ResponseType>ArbitraryAscii").length
    ) {
        type = "arbitrary-ascii";
    } else if (
        dom.find("Responses>Response>ResponseType>ListOfQuotedString").length
    ) {
        type = "list-of-quoted-string";
    } else if (dom.find("Responses>Response>ResponseType>DataBlock").length) {
        type = "data-block";
    } else if (
        dom.find("Responses>Response>ResponseType>DefiniteLengthArbitraryBlock")
            .length
    ) {
        type = "data-block";
    } else if (
        dom.find("Responses>Response>ResponseType>NonStandardDataBlock").length
    ) {
        type = "non-standard-data-block";
    } else if (
        dom.find("Responses>Response>ResponseType>Character>EnumRef").length
    ) {
        type = "discrete";
        enumeration = dom
            .find("Responses>Response>ResponseType>Character>EnumRef")
            .attr("name");
    } else {
        type = undefined as any;
    }

    const description = dom.find("Responses>Response").attr("description");

    return {
        type: [{ type, enumeration }],
        description
    };
}

function buildCommand(
    name: string,
    sdlCommand: JQuery,
    docPath: string,
    commands: ICommand[]
) {
    const description = sdlCommand.find(">Synopsis").text() || "";

    let command: ICommand | undefined;
    const commandSyntax = sdlCommand.find(
        ">CommandSyntaxes>CommandSyntax:first-child"
    );
    if (commandSyntax.length) {
        command = {
            name: name,
            description,
            parameters: buildParameters(commandSyntax),
            response: undefined as any,
            sendsBackDataBlock: !!parseInt(
                commandSyntax.attr("sendsBackDataBlock") || "0"
            )
        };
    }

    let query: ICommand | undefined;
    const querySyntax = sdlCommand.find(
        ">QuerySyntaxes>QuerySyntax:first-child"
    );
    if (querySyntax.length) {
        query = {
            name: name + "?",
            description,
            parameters: buildParameters(querySyntax),
            response: buildResponse(querySyntax),
            sendsBackDataBlock: false
        };
    }

    sdlCommand.find(">HelpLinks>HelpLink").each((i, child) => {
        let helpLink = $(child).attr("name");
        if (helpLink) {
            if (command && compareName(command.name, helpLink)) {
                command.helpLink = localPathToFileUrl(
                    docPath + "/" + $(child).attr("url")
                );
            }

            if (query && compareName(query.name, helpLink)) {
                query.helpLink = localPathToFileUrl(
                    docPath + "/" + $(child).attr("url")
                );
            }
        }
    });

    sdlCommand.find(">HelpLinks>HelpLink").each((i, child) => {
        let helpLink = $(child).attr("name");
        if (helpLink) {
            if (command && !command.helpLink) {
                command.helpLink = localPathToFileUrl(
                    docPath + "/" + $(child).attr("url")
                );
            }

            if (query && !query.helpLink) {
                query.helpLink = localPathToFileUrl(
                    docPath + "/" + $(child).attr("url")
                );
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

function buildCommonCommands(
    commonCommands: JQuery,
    docPath: string,
    commands: ICommand[]
) {
    commonCommands.find(">CommonCommand").each((i, child) => {
        let mnemonic = $(child).attr("mnemonic");
        if (mnemonic) {
            buildCommand("*" + mnemonic, $(child), docPath, commands);
        }
    });
}

function buildNode(
    path: string,
    sdlNode: JQuery,
    docPath: string,
    commands: ICommand[]
) {
    buildNodes(path, sdlNode.find(">Node"), docPath, commands);

    sdlNode.find(">SubsystemCommand").each((i, child) => {
        buildCommand(path, $(child), docPath, commands);
    });
}

function buildNodes(
    path: string,
    sdlNodes: JQuery,
    docPath: string,
    commands: ICommand[]
) {
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
        buildCommonCommands(
            ScpiDefinition.find(">CommonCommands"),
            docPath,
            commands
        );

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
        image: `${sourceRootDir()}/eez-studio-ui/_images/object-implementation-not-found.svg`
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
        if (isRenderer()) {
            // JSON
            let packageJson;

            let packageJsonFilePath = extensionFolderPath + "/package.json";
            if (await fileExists(packageJsonFilePath)) {
                packageJson = await readPackageJson(packageJsonFilePath);
            }

            // IDF (SCPI)
            let ScpiConfiguration: JQuery<HTMLElement> | undefined;
            let idfFilePath = await findIdfFile(extensionFolderPath);
            if (idfFilePath) {
                let idfXmlAsString = await readTextFile(idfFilePath);
                let idf = parseXmlString(idfXmlAsString);
                ScpiConfiguration = $(idf).find(">ScpiConfigurations");
            } else {
                ScpiConfiguration = undefined;
            }

            if (
                packageJson ||
                (ScpiConfiguration &&
                    ScpiConfiguration.length &&
                    ScpiConfiguration.attr("guid"))
            ) {
                let id = ScpiConfiguration
                    ? ScpiConfiguration.attr("guid")!
                    : packageJson.id;

                let name = ScpiConfiguration
                    ? ScpiConfiguration.attr("name") || "Unknown name"
                    : packageJson.name;

                let version = ScpiConfiguration
                    ? ScpiConfiguration.attr("firmwareVersion") ||
                      "Unknown version"
                    : packageJson.version;

                let properties: IInstrumentExtensionProperties;
                let isEditable: boolean;
                let downloadUrl: string | undefined;
                let sha256: string | undefined;
                let moreDescription: string | undefined;

                if (packageJson) {
                    version = packageJson.version;
                    properties = packageJson["eez-studio"];
                    if (!properties) {
                        return undefined;
                    }

                    isEditable = await fileExists(
                        extensionFolderPath + "/.editable"
                    );
                    downloadUrl = packageJson.download;
                    sha256 = packageJson.sha256;
                    moreDescription = properties.moreDescription;
                } else {
                    properties = EMPTY_INSTRUMENT_PROPERTIES;
                    isEditable = true;

                    await writeBinaryData(
                        extensionFolderPath + "/.editable",
                        ""
                    );

                    await writeJsObjectToFile(packageJsonFilePath, {
                        name,
                        version,
                        "eez-studio": properties
                    });

                    downloadUrl = undefined;
                }

                const isDirty =
                    isEditable &&
                    ((await fileExists(
                        extensionFolderPath + "/package.json"
                    )) ||
                        (await fileExists(extensionFolderPath + "/image.png")));

                const description = ScpiConfiguration
                    ? ScpiConfiguration.attr("description") ||
                      "Unknown description."
                    : packageJson.description;

                const author = ScpiConfiguration
                    ? ScpiConfiguration.attr("author") || "Unknown author"
                    : packageJson.author;

                const shortName = ScpiConfiguration
                    ? ScpiConfiguration.attr("shortName") || ""
                    : packageJson.name;

                const revisionNumber = ScpiConfiguration
                    ? ScpiConfiguration.attr("revisionNumber") || ""
                    : "";

                const supportedModels = ScpiConfiguration
                    ? ScpiConfiguration.attr("supportedModels") || ""
                    : "";

                const revisionComments = ScpiConfiguration
                    ? ScpiConfiguration.attr("revisionComments") || ""
                    : "";

                const commandsProtocol: CommandsProtocolType = ScpiConfiguration
                    ? "SCPI"
                    : "PROPRIETARY";

                let commandLineEnding: CommandLineEnding;
                const temp = properties.properties?.commandLineEnding;
                if (
                    temp == "no-line-ending" ||
                    temp == "newline" ||
                    temp == "carriage-return" ||
                    temp == "both-nl-and-cr"
                ) {
                    commandLineEnding = temp;
                } else {
                    commandLineEnding = ScpiConfiguration
                        ? "newline"
                        : "no-line-ending";
                }

                const extension: IExtension = observable(
                    {
                        id,
                        preInstalled: false,
                        extensionType: "iext",
                        name,
                        description,
                        moreDescription,
                        version,
                        author,
                        image: "",
                        renderPropertiesComponent: () => {
                            const { renderPropertiesComponent } =
                                require("instrument/properties-component") as typeof PropertiesComponentModule;

                            return renderPropertiesComponent(extension);
                        },
                        properties,
                        isEditable,
                        isDirty,

                        shortName,
                        revisionNumber,
                        supportedModels,
                        revisionComments,

                        commandsProtocol,
                        commandLineEnding
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
                extension.sha256 = sha256;

                extension.installationFolderPath = extensionFolderPath;

                return extension;
            }
        } else {
            let packageJSON = await readPackageJson(
                extensionFolderPath + "/package.json"
            );

            const extension: IExtension = {
                id: packageJSON["id"],
                preInstalled: false,
                extensionType: "iext",
                name: "",
                description: "",
                version: "",
                author: "",
                image: "",
                properties: packageJSON["eez-studio"],
                commandsProtocol: "SCPI",
                commandLineEnding: "newline"
            };

            return extension;
        }
    } catch (err) {
        console.error(err);
    }

    throw "Unknown extension type!";
}

export async function loadCommandsFromExtensionFolder(
    extensionFolderPath: string
) {
    try {
        // load scpi commands
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
            let enums = buildEnums($(sdl));
            let commands = buildCommands($(sdl), docPath);
            return {
                commands,
                enums
            };
        }

        throw "SDL file not found";
    } catch (err) {
        try {
            // load proprietary commands
            const jsonStr = await readTextFile(
                extensionFolderPath + "/package.json"
            );
            const json = JSON.parse(jsonStr);
            const instrumentCommands: {
                command: string;
                helpLink?: string;
            }[] = json["eez-studio"].instrumentCommands;
            return {
                commands: instrumentCommands.map(
                    instrumentCommand =>
                        ({
                            name: instrumentCommand.command,
                            helpLink: localPathToFileUrl(
                                extensionFolderPath +
                                    "/docs/" +
                                    instrumentCommand.helpLink
                            ),
                            parameters: [],
                            response: {
                                type: ["any" as IResponseTypeType]
                            },
                            sendsBackDataBlock: false
                        } as unknown as ICommand)
                ),
                enums: []
            };
        } catch (err) {
            throw err;
        }
    }
}

export function loadCommands(instrumentExtensionId: string) {
    let extensionFolderPath = getExtensionFolderPath(instrumentExtensionId);
    return loadCommandsFromExtensionFolder(extensionFolderPath);
}
