const fs = EEZStudio.electron.remote.require("fs");
const archiver = EEZStudio.electron.remote.require("archiver");
const xmlFormatter = require("xml-formatter");

import { ScpiCommandTreeNode, addCommandToTree } from "instrument/commands-tree";

////////////////////////////////////////////////////////////////////////////////

const MODULE_DOCS_FOLDER = "docs";

////////////////////////////////////////////////////////////////////////////////

export interface IInstrumentProperties {
    connection?: {
        ethernet?: {
            port: number;
        };
        serial?: {
            baudRates: number[];
            defaultBaudRate: number;
        };
    };
    channels?: {
        maxVoltage?: number;
        maxCurrent?: number;
        maxPower?: number;
    }[];
    lists?: {
        maxPoints?: number;
        minDwell?: number;
        maxDwell?: number;
        dwellDigits?: number;
        voltageDigits?: number;
        currentDigits?: number;
    };
    fileDownload?: {
        shortFileName?: boolean;
        startCommand?: string;
        fileSizeCommand?: string;
        sendChunkCommand?: string;
        finishCommand?: string;
        abortCommand?: string;
        chunkSize?: number;
    };
}

export interface IdfProperties {
    buildConfiguration: string;
    extensionName: string;
    image: string;
    idn: string;
    idfName: string;
    idfShortName: string;
    idfFirmwareVersion: string;
    idfGuid: string;
    idfRevisionNumber: string;
    idfDescription: string;
    idfSupportedModels: string;
    idfRevisionComments: string;
    idfAuthor: string;
    sdlFriendlyName: string;
    //properties: IInstrumentProperties;
}

interface ICommand {
    name: string;
    description?: string;
    helpLink?: string;
    usedIn?: string[] | undefined;
}

interface ISubsystem {
    commands: ICommand[];
}

interface Command {
    name: string;

    description?: string;

    commandSyntax?: {
        name: string;
        url?: string;
    };

    querySyntax?: {
        name: string;
        url?: string;
    };
}

////////////////////////////////////////////////////////////////////////////////

function buildPackageJson(idf: IdfProperties, properties: any) {
    return JSON.stringify(
        {
            name: idf.extensionName,
            version: idf.idfRevisionNumber,
            id: idf.idfGuid,
            "eez-studio": properties
        },
        undefined,
        2
    );
}

function quoteAttr(str: string) {
    return (str || "")
        .replace(/&/g, "&amp;")
        .replace(/'/g, "&apos;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\r\n/g, "&#13;")
        .replace(/[\r\n]/g, "&#13;");
}

function buildIdf(idf: IdfProperties) {
    let extensionName = quoteAttr(idf.extensionName);
    let name = quoteAttr(idf.idfName);
    let shortName = quoteAttr(idf.idfShortName);
    let firmwareVersion = quoteAttr(idf.idfFirmwareVersion);
    let guid = quoteAttr(idf.idfGuid);
    let revisionNumber = quoteAttr(idf.idfRevisionNumber);
    let description = quoteAttr(idf.idfDescription);
    let supportedModels = quoteAttr(idf.idfSupportedModels);
    let revisionComments = quoteAttr(idf.idfRevisionComments);
    let author = quoteAttr(idf.idfAuthor);

    return `<?xml version="1.0" encoding="utf-8"?>
        <ScpiConfigurations
            name="${name}"
            shortName="${shortName}"
            firmwareVersion="${firmwareVersion}"
            guid="${guid}"
            revisionNumber="${revisionNumber}"
            schemaVersion="2.1"
            sdlSchemaVersion="1.3"
            xmlns="http://www.Agilent.com/schemas/SCD/2008"
            description="${description}"
            supportedModels="${supportedModels}"
            revisionComment="${revisionComments}"
            author="${author}"
        >
            <ErrorHandling>
                <ErrorQuery command=":SYST:ERR?" />
            </ErrorHandling>
            <File name="${extensionName}.sdl" type="sdl" />
        </ScpiConfigurations>`;
}

function buildCommand(command: Command) {
    const description = quoteAttr(command.description || "");

    let helpLinks = "";
    let commandSyntaxes = "";
    let querySyntaxes = "";

    if (command.commandSyntax) {
        if (command.commandSyntax.url) {
            helpLinks += `<HelpLink name="${quoteAttr(
                command.commandSyntax.name
            )}" url="${quoteAttr(command.commandSyntax.url)}" />`;
        }

        commandSyntaxes = `<CommandSyntaxes><CommandSyntax></CommandSyntax></CommandSyntaxes>`;
    }

    if (command.querySyntax) {
        if (command.querySyntax.url) {
            if (helpLinks) {
                helpLinks += "\n";
            }
            helpLinks += `<HelpLink name="${quoteAttr(command.querySyntax.name)}" url="${quoteAttr(
                command.querySyntax.url
            )}" />`;
        }

        querySyntaxes = `
            <QuerySyntaxes>
                <QuerySyntax>
                    <Responses>
                        <Response name="result" semanticType="Integer" description="Result ...">
                            <ResponseType>
                                <NR1Numeric />
                            </ResponseType>
                        </Response>
                    </Responses>
                </QuerySyntax>
            </QuerySyntaxes>
            `;
    }

    return `<Synopsis>${description}</Synopsis><HelpLinks>${helpLinks}</HelpLinks>${commandSyntaxes}${querySyntaxes}`;
}

function buildCommonCommand(command: Command) {
    const name = quoteAttr(command.name);
    const commmand = buildCommand(command);
    return `<CommonCommand mnemonic="${name}">${commmand}</CommonCommand>`;
}

function filterSubsystemCommands(idf: IdfProperties, subsystem: ISubsystem) {
    return subsystem.commands.filter(
        command => !command.usedIn || command.usedIn.indexOf(idf.buildConfiguration) !== -1
    );
}

function buildCommonCommands(idf: IdfProperties, subsystems: ISubsystem[]) {
    let commands = new Map<string, Command>();
    subsystems.forEach(subsystem => {
        filterSubsystemCommands(idf, subsystem).forEach(subsystemCommand => {
            if (subsystemCommand.name.startsWith("*")) {
                let name = subsystemCommand.name.slice(1);

                let query = false;
                if (name.endsWith("?")) {
                    name = name.slice(0, -1);
                    query = true;
                }

                let command = commands.get(name);
                if (!command) {
                    command = {
                        name: name,
                        description: subsystemCommand.description
                    };
                    commands.set(name, command);
                }

                let url = subsystemCommand.helpLink;

                if (query) {
                    command.querySyntax = {
                        name: "*" + name + "?",
                        url: url
                    };
                } else {
                    command.commandSyntax = {
                        name: "*" + name,
                        url: url
                    };
                }
            }
        });
    });

    let commonCommands = "";

    commands.forEach((command, name) => {
        commonCommands += buildCommonCommand(command);
    });

    return commonCommands;
}

function getAliases(mnemonic: string) {
    let i;

    for (i = 0; i < mnemonic.length; ++i) {
        if (mnemonic[i] != mnemonic[i].toUpperCase()) {
            break;
        }
    }

    return mnemonic.slice(0, i);
}

function buildNode(node: ScpiCommandTreeNode) {
    if (node.command) {
        return `<SubsystemCommand>${buildCommand(node.command)}</SubsystemCommand>`;
    } else if (node.nodes) {
        let nodes = node.nodes as ScpiCommandTreeNode[];

        let result = "";

        let tagName = !node.mnemonic ? "RootNode" : "Node";

        nodes.forEach(node => {
            let aliases = quoteAttr(getAliases(node.mnemonic));
            let mnemonic = quoteAttr(node.mnemonic);
            let content = buildNode(node);

            result += `<${tagName} aliases="${aliases}"${node.optional ? ' default="true"' : ""}${
                node.numericSuffix ? ` numericSuffix="${node.numericSuffix}"` : ""
            } mnemonic="${mnemonic}">${content}</${tagName}>`;
        });

        return result;
    } else {
        return "";
    }
}

function buildSubsystemCommands(idf: IdfProperties, subsystems: ISubsystem[]) {
    let tree: ScpiCommandTreeNode = {
        mnemonic: ""
    };

    subsystems.forEach(subsystem => {
        filterSubsystemCommands(idf, subsystem).forEach(subsystemCommand => {
            if (subsystemCommand.name[0] !== "*") {
                addCommandToTree(subsystemCommand, tree);
            }
        });
    });

    return buildNode(tree);
}

function buildSdl(idf: IdfProperties, subsystems: ISubsystem[]) {
    const friendlyName = quoteAttr(idf.sdlFriendlyName);
    const commonCommands = buildCommonCommands(idf, subsystems);
    const subsystemCommands = buildSubsystemCommands(idf, subsystems);

    return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
        <ScpiDefinition
            xmlns="http://www.agilent.com/schemas/SCPIDL/2008"
            documentVersion="1.0"
            friendlyName="${friendlyName}"
            schemaVersion="1.2"
            xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
            xsi:schemaLocation="http://www.agilent.com/schemas/SCPIDL/2008 ScpiDefinitionLanguage.xsd"
        >
            <GlobalDefinitions>
            </GlobalDefinitions>

            <CommonCommands>
                ${commonCommands}
            </CommonCommands>

            <SubsystemCommands>
                ${subsystemCommands}
            </SubsystemCommands>
        </ScpiDefinition>`;
}

export function buildInstrumentExtension(
    idf: IdfProperties,
    subsystems: ISubsystem[],
    moduleFilePath: string | undefined,
    imageFilePath: string | undefined,
    scpiHelpFolderPath: string | undefined,
    properties: any
) {
    return new Promise((resolve, reject) => {
        let extensionName = idf.extensionName;
        var output = fs.createWriteStream(moduleFilePath);

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

        const packageJson = buildPackageJson(idf, properties);
        archive.append(packageJson, { name: "package.json" });

        const idfStr = buildIdf(idf);
        archive.append(xmlFormatter(idfStr), { name: extensionName + ".idf" });

        const sdl = buildSdl(idf, subsystems);
        archive.append(xmlFormatter(sdl), { name: extensionName + ".sdl" });

        if (imageFilePath) {
            archive.file(imageFilePath, { name: "image.png" });
        }

        if (scpiHelpFolderPath) {
            archive.directory(scpiHelpFolderPath, MODULE_DOCS_FOLDER);
        }

        archive.finalize();
    });
}
