// Generates the SCPI commands of a module (no libscpi needed):
//   BB3_MODULE_SCPI_DECL - handler prototypes
//   BB3_MODULE_SCPI_DEF  - command ids and the dispatch (parameter checks)
// The runtime (request reassembly, decoding, response encoding) is in
// bb3-module.c. The module implements one handler per command, BB3+ does all
// the SCPI text parsing and formatting. Wire format is described in
// eez-bb3plus-module-interface/docs/module_protocol.md.

import type { Project } from "project-editor/project/project";
import type { ScpiCommand } from "project-editor/features/scpi/scpi";
import { getCommandFuncName } from "project-editor/build/scpi";
import {
    SCPI_WIRE_TYPE_BLOCK,
    SCPI_WIRE_TYPE_BOOL,
    SCPI_WIRE_TYPE_CHANNEL_LIST,
    SCPI_WIRE_TYPE_CHOICE,
    SCPI_WIRE_TYPE_INT32,
    SCPI_WIRE_TYPE_NUMBER,
    SCPI_WIRE_TYPE_RAW,
    SCPI_WIRE_TYPE_STRING,
    ScpiAddressingInfo,
    getBB3ModuleScpiCommands,
    getScpiAddressing,
    getScpiCommandNumSuffixes,
    getScpiCommandPattern,
    getSpecialValuesMask,
    getWireTypeMask
} from "project-editor/features/scpi/scpi-wire";

const DEFAULT_SCPI_MAX_MESSAGE_SIZE = 1024;

const WIRE_TYPES: {
    [wireType: number]: { name: string; cType: string; field: string };
} = {
    [SCPI_WIRE_TYPE_INT32]: { name: "INT32", cType: "int32_t", field: "int32" },
    [SCPI_WIRE_TYPE_NUMBER]: {
        name: "NUMBER",
        cType: "bb3_scpi_number_t",
        field: "number"
    },
    [SCPI_WIRE_TYPE_BOOL]: { name: "BOOL", cType: "bool", field: "boolean" },
    [SCPI_WIRE_TYPE_CHOICE]: {
        name: "CHOICE",
        cType: "int32_t",
        field: "choice"
    },
    [SCPI_WIRE_TYPE_STRING]: {
        name: "STRING",
        cType: "bb3_scpi_string_t",
        field: "string"
    },
    [SCPI_WIRE_TYPE_BLOCK]: {
        name: "BLOCK",
        cType: "bb3_scpi_block_t",
        field: "block"
    },
    [SCPI_WIRE_TYPE_CHANNEL_LIST]: {
        name: "CHANNEL_LIST",
        cType: "bb3_scpi_channel_list_t",
        field: "channel_list"
    },
    [SCPI_WIRE_TYPE_RAW]: {
        name: "RAW",
        cType: "bb3_scpi_string_t",
        field: "string"
    }
};

const C_KEYWORDS = new Set([
    "auto", "break", "case", "char", "const", "continue", "default", "do",
    "double", "else", "enum", "extern", "float", "for", "goto", "if", "int",
    "long", "register", "return", "short", "signed", "sizeof", "static",
    "struct", "switch", "typedef", "union", "unsigned", "void", "volatile",
    "while", "bool", "inline", "restrict", "req", "channel"
]);

function getWireTypes(mask: number) {
    const wireTypes: number[] = [];
    for (let wireType = 1; wireType < 16; wireType++) {
        if (mask & (1 << wireType)) {
            wireTypes.push(wireType);
        }
    }
    return wireTypes;
}

function toCIdentifier(name: string, used: Set<string>) {
    let identifier = (name || "param")
        .trim()
        .replace(/[^A-Za-z0-9_]/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_|_$/g, "");
    if (!identifier) {
        identifier = "param";
    }
    if (/^[0-9]/.test(identifier)) {
        identifier = "p_" + identifier;
    }
    if (C_KEYWORDS.has(identifier)) {
        identifier = identifier + "_";
    }
    let unique = identifier;
    for (let i = 2; used.has(unique); i++) {
        unique = identifier + "_" + i;
    }
    used.add(unique);
    return unique;
}

function getCommandIdName(command: ScpiCommand) {
    const funcName = getCommandFuncName(command).replace(/^scpi_cmd_/, "");
    return (
        "MODULE_SCPI_CMD_" +
        funcName
            .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
            .replace(/[^A-Za-z0-9_]/g, "_")
            .toUpperCase()
    );
}

function hasChannelArg(addressing: ScpiAddressingInfo) {
    return (
        addressing.kind == "power-channel-param" ||
        addressing.kind == "power-channel-suffix" ||
        addressing.kind == "selected" ||
        addressing.kind == "internal"
    );
}

function isAddressingSuffix(addressing: ScpiAddressingInfo, index: number) {
    return (
        (addressing.kind == "power-channel-suffix" ||
            addressing.kind == "slot-suffix") &&
        addressing.index == index
    );
}

function isAddressingParam(addressing: ScpiAddressingInfo, index: number) {
    return addressing.kind == "power-channel-param" && addressing.index == index;
}

interface ParamInfo {
    // index of the parameter on the wire
    index: number;
    // C name, undefined if not passed to the handler
    cName?: string;
    wireTypes: number[];
    isOptional: boolean;
    isList: boolean;
}

interface CommandInfo {
    command: ScpiCommand;
    id: number;
    idName: string;
    funcName: string;
    pattern: string;
    addressing: ScpiAddressingInfo;
    suffixes: { index: number; cName: string }[];
    numWireSuffixes: number;
    params: ParamInfo[];
}

function getCommandInfo(command: ScpiCommand, id: number): CommandInfo {
    const addressing = getScpiAddressing(command);
    const used = new Set<string>();

    const suffixes: { index: number; cName: string }[] = [];
    const numSuffixes = getScpiCommandNumSuffixes(command);
    for (let i = 0; i < numSuffixes; i++) {
        if (!isAddressingSuffix(addressing, i)) {
            suffixes.push({ index: i, cName: toCIdentifier(`suffix${i + 1}`, used) });
        }
    }

    const params = (command.parameters || []).map((parameter, index) => {
        const specialMask = getSpecialValuesMask(parameter.specialValues);
        return {
            index,
            // the calibration password is checked by BB3+ and not sent
            cName:
                isAddressingParam(addressing, index) ||
                parameter.isCalibrationPassword
                    ? undefined
                    : toCIdentifier(parameter.name, used),
            wireTypes: getWireTypes(
                getWireTypeMask(parameter.type, specialMask != 0)
            ),
            isOptional: !!parameter.isOptional,
            isList: parameter.repeat == "list"
        };
    });

    return {
        command,
        id,
        idName: getCommandIdName(command),
        funcName: getCommandFuncName(command),
        pattern: getScpiCommandPattern(command),
        addressing,
        suffixes,
        numWireSuffixes: suffixes.length,
        params
    };
}

function getParamCType(param: ParamInfo) {
    if (param.isList) {
        return "bb3_scpi_list_t";
    }
    if (param.wireTypes.length != 1) {
        return "const bb3_scpi_value_t *";
    }
    const cType = WIRE_TYPES[param.wireTypes[0]].cType;
    return param.isOptional ? `const ${cType} *` : cType;
}

function getHandlerPrototype(info: CommandInfo) {
    const args = ["bb3_scpi_req_t *req"];
    if (hasChannelArg(info.addressing)) {
        args.push("uint8_t channel");
    }
    for (const suffix of info.suffixes) {
        args.push(`int32_t ${suffix.cName}`);
    }
    for (const param of info.params) {
        if (param.cName) {
            const cType = getParamCType(param);
            args.push(
                cType.endsWith("*")
                    ? `${cType}${param.cName}`
                    : `${cType} ${param.cName}`
            );
        }
    }
    return `int ${info.funcName}(${args.join(", ")})`;
}

function getHandlerComment(info: CommandInfo) {
    const lines = [`// ${info.pattern}`];
    if (hasChannelArg(info.addressing)) {
        lines.push(
            `//   channel: module channel index, BB3_SCPI_NO_CHANNEL if none`
        );
    }
    for (const param of info.params) {
        if (!param.cName) {
            continue;
        }
        const types = param.wireTypes
            .map(wireType => WIRE_TYPES[wireType].name)
            .join(" | ");
        let description = types;
        if (param.isList) {
            description = `list of ${types}`;
        } else if (param.wireTypes.length != 1) {
            description = `one of ${types}`;
        }
        if (param.isOptional) {
            description += param.isList
                ? ", optional (count 0 if not given)"
                : ", optional (NULL if not given)";
        }
        lines.push(`//   ${param.cName}: ${description}`);
    }
    return lines.join("\n");
}

////////////////////////////////////////////////////////////////////////////////

function buildDecl(project: Project, infos: CommandInfo[]) {
    const maxMessageSize =
        (project.bb3ModuleMetadata &&
            project.bb3ModuleMetadata.scpiMaxMessageSize) ||
        DEFAULT_SCPI_MAX_MESSAGE_SIZE;

    return `#define MODULE_SCPI_MAX_MESSAGE_SIZE ${maxMessageSize}

// Called by bb3_scpi_poll (bb3-module.c): reads the parameters of the command
// and calls its handler.
int module_scpi_dispatch(bb3_scpi_req_t *req, bb3_scpi_command_t *command);

// Command handlers, implemented by the module. Return BB3_SCPI_OK or
// BB3_SCPI_ERR (after bb3_scpi_error_push). Query handlers write the response
// with bb3_scpi_result_..., in the order of the response items.
${infos
    .map(info => `${getHandlerComment(info)}\n${getHandlerPrototype(info)};`)
    .join("\n\n")}
`;
}

////////////////////////////////////////////////////////////////////////////////

function buildDispatchCase(info: CommandInfo) {
    const lines: string[] = [];
    lines.push(`    case ${info.idName}: {`);
    lines.push(`        // ${info.pattern}`);
    lines.push(`        if (command->num_suffixes != ${info.numWireSuffixes}) {`);
    lines.push(`            return BB3_SCPI_DECODE_ERROR;`);
    lines.push(`        }`);

    const args = ["req"];
    if (hasChannelArg(info.addressing)) {
        args.push("command->channel");
    }
    info.suffixes.forEach((suffix, i) => args.push(`command->suffixes[${i}]`));

    for (const param of info.params) {
        const v = `v${param.index}`;
        lines.push(``);
        lines.push(`        bb3_scpi_value_t ${v} = { BB3_SCPI_WIRE_TYPE_NONE };`);
        lines.push(
            `        if (command->num_params > ${param.index} && !bb3_scpi_read_param(&command->params, &${v}, ${param.isList ? "true" : "false"})) {`
        );
        lines.push(`            return BB3_SCPI_DECODE_ERROR;`);
        lines.push(`        }`);

        if (!param.cName) {
            // addressing parameter or calibration password, BB3+ sends it
            // as NONE
            continue;
        }

        const isNone = `${v}.type == BB3_SCPI_WIRE_TYPE_NONE`;

        if (param.isList) {
            if (param.isOptional) {
                lines.push(`        if (${isNone}) {`);
                lines.push(`            ${v}.value.list.data = 0;`);
                lines.push(`            ${v}.value.list.length = 0;`);
                lines.push(`            ${v}.value.list.count = 0;`);
                lines.push(`        } else if (${v}.type != BB3_SCPI_WIRE_TYPE_LIST) {`);
            } else {
                lines.push(`        if (${v}.type != BB3_SCPI_WIRE_TYPE_LIST) {`);
            }
            lines.push(`            return BB3_SCPI_DECODE_ERROR;`);
            lines.push(`        }`);
            args.push(`${v}.value.list`);
            continue;
        }

        const typeCheck = param.wireTypes
            .map(wireType => `${v}.type != BB3_SCPI_WIRE_TYPE_${WIRE_TYPES[wireType].name}`)
            .join(" && ");

        if (param.isOptional) {
            lines.push(`        if (!(${isNone}) && ${typeCheck}) {`);
        } else {
            lines.push(`        if (${typeCheck}) {`);
        }
        lines.push(`            return BB3_SCPI_DECODE_ERROR;`);
        lines.push(`        }`);

        if (param.wireTypes.length != 1) {
            args.push(param.isOptional ? `${isNone} ? 0 : &${v}` : `&${v}`);
        } else {
            const field = `${v}.value.${WIRE_TYPES[param.wireTypes[0]].field}`;
            args.push(param.isOptional ? `${isNone} ? 0 : &${field}` : field);
        }
    }

    lines.push(``);
    lines.push(`        return ${info.funcName}(${args.join(", ")});`);
    lines.push(`    }`);

    return lines.join("\n");
}

function buildDef(infos: CommandInfo[]) {
    const cases = infos.map(buildDispatchCase).join("\n\n");

    return `enum ModuleScpiCommandId {
${infos.map(info => `    ${info.idName} = ${info.id}, // ${info.pattern}`).join("\n")}
    MODULE_SCPI_NUM_COMMANDS = ${infos.length}
};

int module_scpi_dispatch(bb3_scpi_req_t *req, bb3_scpi_command_t *command) {
    switch (command->id) {
${cases ? cases + "\n" : ""}    }
    (void)req;
    return BB3_SCPI_UNKNOWN_COMMAND;
}
`;
}

////////////////////////////////////////////////////////////////////////////////

export function buildBB3ModuleScpi(project: Project, sectionNames: string[] | undefined) {
    const result: { [sectionName: string]: string } = {};

    const wantDecl =
        !sectionNames || sectionNames.indexOf("BB3_MODULE_SCPI_DECL") !== -1;
    const wantDef = !sectionNames || sectionNames.indexOf("BB3_MODULE_SCPI_DEF") !== -1;

    if (!wantDecl && !wantDef) {
        return result;
    }

    const infos = getBB3ModuleScpiCommands(project).map((command, id) =>
        getCommandInfo(command, id)
    );

    if (wantDecl) {
        result.BB3_MODULE_SCPI_DECL = buildDecl(project, infos);
    }

    if (wantDef) {
        result.BB3_MODULE_SCPI_DEF = buildDef(infos);
    }

    return result;
}
