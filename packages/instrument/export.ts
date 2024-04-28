import fs from "fs";
import path from "path";
import xmlFormatter from "xml-formatter";

import {
    ScpiCommand,
    ScpiCommandTreeNode,
    addCommandToTree
} from "instrument/commands-tree";
import {
    IEnum,
    ISubsystem,
    IParameter,
    IResponse,
    getSdlSemanticTypeForParameter,
    getSdlParameterType,
    getSdlSemanticTypeForResponse,
    getSdlResponseType
} from "instrument/scpi";
import { readTextFile } from "eez-studio-shared/util-electron";
import { CommandLineEnding } from "eez-studio-shared/extensions/extension";

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
            defaultDataBits: 8 | 7 | 6 | 5;
            defaultStopBits: 1 | 2;
            defaultParity: "none" | "even" | "mark" | "odd" | "space";
            defaultFlowControl: "none" | "xon/xoff" | "rts/cts";
        };
        usbtmc?: {
            idVendor: number | string | undefined;
            idProduct: number | string | undefined;
        };
        webSimulator?: {
            src: string;
            width: number;
            height: number;
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
        favoriteDestinationPaths?: {
            ext?: string;
            path: string;
        }[];
    };
    commandLineEnding?: CommandLineEnding;
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
    useDashboardProjects: string[];
    instrumentCommands?: {
        command: string;
        helpLink: string | undefined;
    }[];
}

////////////////////////////////////////////////////////////////////////////////

async function buildPackageJson(idf: IdfProperties, properties: any) {
    // remove objID
    properties = JSON.parse(
        JSON.stringify(
            properties,
            (key: string | number, value: any) => {
                if (key === "objID") {
                    return undefined;
                }
                return value;
            },
            2
        )
    );

    properties.dashboards = [];

    for (const useDashboardProject of idf.useDashboardProjects) {
        const data = await readTextFile(useDashboardProject);
        const json = JSON.parse(data);
        properties.dashboards.push({
            title:
                json.settings.general.title ||
                path.basename(useDashboardProject),
            icon: json.settings.general.icon
        });
    }

    properties.instrumentCommands = idf.instrumentCommands;

    return JSON.stringify(
        {
            id: idf.idfGuid,
            name: idf.extensionName,
            description: idf.idfDescription,
            displayName: idf.idfName || idf.extensionName,
            version: idf.idfRevisionNumber,
            author: idf.idfAuthor,
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

function buildEnumDefinitions(enums: IEnum[]) {
    return enums
        .map(
            enumeration =>
                `<Enum name="${enumeration.name}">
                    ${enumeration.members
                        .map(
                            member =>
                                `<Member mnemonic="${member.name}" value="${member.value}" />`
                        )
                        .join("")}
                </Enum>`
        )
        .join("");
}

function buildParameters(parameters: IParameter[]) {
    if (parameters.length === 0) {
        return "";
    }

    return `<Parameters>
            ${parameters
                .map(
                    parameter => `
                        <Parameter
                            name="${quoteAttr(parameter.name)}"
                            optional="${
                                parameter.isOptional ? "true" : "false"
                            }"
                            semanticType="${getSdlSemanticTypeForParameter(
                                parameter
                            )}"
                            description="${quoteAttr(
                                parameter.description || ""
                            )}"
                        >
                            <ParameterType>
                                ${parameter.type
                                    .map(parameterType =>
                                        getSdlParameterType(parameterType)
                                    )
                                    .join("")}
                            </ParameterType>
                        </Parameter>
                    `
                )
                .join("")}
        </Parameters>`;
}

function buildResponse(response: IResponse) {
    return `<Response
                name="result"
                semanticType="${getSdlSemanticTypeForResponse(response)}"
                description="${quoteAttr(response.description || "")}"
            >
            <ResponseType>
                ${response.type
                    .map(responseType => getSdlResponseType(responseType))
                    .join("")}
            </ResponseType>
        </Response>`;
}

function buildCommand(command: ScpiCommand) {
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

        let sendsBackDataBlockAttr;
        if (command.commandSyntax.sendsBackDataBlock) {
            sendsBackDataBlockAttr = ' sendsBackDataBlock="1"';
        } else {
            sendsBackDataBlockAttr = "";
        }

        commandSyntaxes = `<CommandSyntaxes><CommandSyntax${sendsBackDataBlockAttr}>${buildParameters(
            command.commandSyntax.parameters
        )}</CommandSyntax></CommandSyntaxes>`;
    }

    if (command.querySyntax) {
        if (command.querySyntax.url) {
            if (helpLinks) {
                helpLinks += "\n";
            }
            helpLinks += `<HelpLink name="${quoteAttr(
                command.querySyntax.name
            )}" url="${quoteAttr(command.querySyntax.url)}" />`;
        }

        querySyntaxes = `
            <QuerySyntaxes>
                <QuerySyntax>
                    ${buildParameters(command.querySyntax.parameters)}
                    <Responses>${buildResponse(
                        command.querySyntax.response
                    )}</Responses>
                </QuerySyntax>
            </QuerySyntaxes>
            `;
    }

    return `<Synopsis>${description}</Synopsis><HelpLinks>${helpLinks}</HelpLinks>${commandSyntaxes}${querySyntaxes}`;
}

function buildCommonCommand(command: ScpiCommand) {
    const name = quoteAttr(command.name);
    const commmand = buildCommand(command);
    return `<CommonCommand mnemonic="${name}">${commmand}</CommonCommand>`;
}

function filterSubsystemCommands(idf: IdfProperties, subsystem: ISubsystem) {
    return subsystem.commands.filter(
        command =>
            !command.usedIn ||
            command.usedIn.indexOf(idf.buildConfiguration) !== -1
    );
}

function buildCommonCommands(idf: IdfProperties, subsystems: ISubsystem[]) {
    let commands = new Map<string, ScpiCommand>();
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
                        url: url,
                        parameters: subsystemCommand.parameters,
                        response: subsystemCommand.response
                    };
                } else {
                    command.commandSyntax = {
                        name: "*" + name,
                        url: url,
                        parameters: subsystemCommand.parameters,
                        sendsBackDataBlock: subsystemCommand.sendsBackDataBlock
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

    for (i = 0; i < mnemonic.length; i++) {
        if (mnemonic[i] != mnemonic[i].toUpperCase()) {
            break;
        }
    }

    return mnemonic.slice(0, i);
}

function buildNode(node: ScpiCommandTreeNode) {
    let result = "";

    if (node.command) {
        result += `<SubsystemCommand>${buildCommand(
            node.command
        )}</SubsystemCommand>`;
    }

    if (node.nodes) {
        let nodes = node.nodes as ScpiCommandTreeNode[];

        let tagName = !node.mnemonic ? "RootNode" : "Node";

        nodes.forEach(node => {
            let aliases = quoteAttr(getAliases(node.mnemonic));
            let mnemonic = quoteAttr(node.mnemonic);
            let content = buildNode(node);

            result += `<${tagName} aliases="${aliases}"${
                node.optional ? ' default="true"' : ""
            }${
                node.numericSuffix
                    ? ` numericSuffix="${node.numericSuffix}"`
                    : ""
            } mnemonic="${mnemonic}">${content}</${tagName}>`;
        });
    }

    return result;
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

function buildSdl(
    idf: IdfProperties,
    enums: IEnum[],
    subsystems: ISubsystem[]
) {
    const friendlyName = quoteAttr(idf.sdlFriendlyName);
    const enumDefinitions = buildEnumDefinitions(enums);
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
                ${enumDefinitions}
            </GlobalDefinitions>
            <CommonCommands>
                ${commonCommands}
            </CommonCommands>
            <SubsystemCommands>
                ${subsystemCommands}
            </SubsystemCommands>
        </ScpiDefinition>`;
}

export async function buildInstrumentExtension(
    idf: IdfProperties,
    subsystems: ISubsystem[],
    enums: IEnum[],
    moduleFilePath: string,
    imageFilePath: string | undefined,
    commandsDocFolderPath: string | undefined,
    projectFilePath: string,
    properties: any,
    isScpiInstrument: boolean
) {
    const archiver = await import("archiver");

    return new Promise<void>(async (resolve, reject) => {
        let extensionName = idf.extensionName;
        var output = fs.createWriteStream(moduleFilePath);

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

        let webSimulatorFiles;
        const webSimulator = properties?.properties?.connection?.webSimulator;
        if (webSimulator) {
            webSimulatorFiles = webSimulator.files;
            delete webSimulator.files;
        }

        const packageJson = await buildPackageJson(idf, properties);
        archive.append(packageJson, { name: "package.json" });

        if (isScpiInstrument) {
            const idfStr = buildIdf(idf);
            archive.append(xmlFormatter(idfStr), {
                name: extensionName + ".idf"
            });
        }

        if (isScpiInstrument) {
            const sdl = buildSdl(idf, enums, subsystems);
            archive.append(xmlFormatter(sdl), { name: extensionName + ".sdl" });
        }

        if (imageFilePath) {
            if (imageFilePath.startsWith("data:image")) {
                let i = imageFilePath.indexOf(",");
                archive.append(
                    Buffer.from(imageFilePath.slice(i + 1), "base64"),
                    { name: "image.png" }
                );
            } else {
                archive.file(imageFilePath, { name: "image.png" });
            }
        }

        if (commandsDocFolderPath) {
            archive.glob(
                "**/*",
                {
                    cwd: commandsDocFolderPath,
                    ignore: [".*"]
                },
                {
                    prefix: MODULE_DOCS_FOLDER
                }
            );
        }

        if (webSimulatorFiles) {
            for (const file of webSimulatorFiles) {
                const srcFilePath = projectFilePath + "/" + file[0];
                archive.file(srcFilePath, {
                    name: file[1]
                });
            }
        }

        for (let i = 0; i < idf.useDashboardProjects.length; i++) {
            archive.file(idf.useDashboardProjects[i], {
                name: `d${i}.eez-project`
            });
        }

        archive.finalize();
    });
}
