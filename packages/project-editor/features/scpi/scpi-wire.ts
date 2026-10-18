// Mapping of the SCPI command definitions to the wire format used between
// BB3+ and the DIB modules (see BB3+ docs, "Modular SCPI"). Studio types are
// normalized to the wire types, which the BB3+ parser, the BB3+ serializer and
// the code generated for the DIB module all agree on.

import type {
    ScpiCommand,
    ScpiParameter,
    ScpiParameterType,
    ScpiResponseType
} from "project-editor/features/scpi/scpi";
import type { ScpiEnum } from "project-editor/features/scpi/enum";
import type { Project } from "project-editor/project/project";

////////////////////////////////////////////////////////////////////////////////

export const SCPI_WIRE_TYPE_NONE = 0;
export const SCPI_WIRE_TYPE_INT32 = 1;
export const SCPI_WIRE_TYPE_NUMBER = 2;
export const SCPI_WIRE_TYPE_BOOL = 3;
export const SCPI_WIRE_TYPE_CHOICE = 4;
export const SCPI_WIRE_TYPE_STRING = 5;
export const SCPI_WIRE_TYPE_BLOCK = 6;
export const SCPI_WIRE_TYPE_CHANNEL_LIST = 7;
export const SCPI_WIRE_TYPE_RAW = 8;

export const SCPI_PARAM_FLAG_OPTIONAL = 1 << 0;
export const SCPI_PARAM_FLAG_LIST = 1 << 1;
// BB3+ checks the parameter against its calibration password (error 102 if
// it doesn't match) and doesn't send it to the module
export const SCPI_PARAM_FLAG_CALIBRATION_PASSWORD = 1 << 2;

export const SCPI_RESPONSE_ITEM_FLAG_LIST = 1 << 0;

export const SCPI_COMMAND_FLAG_QUERY = 1 << 0;
// BB3+ sends DIB SYNC after the command is executed by all the target modules,
// so they apply it (e.g. output enable) at the same time
export const SCPI_COMMAND_FLAG_APPLY_ON_DIB_SYNC = 1 << 1;

// custom field (DIB field) flags in the metadata
// BB3+ saves the field in the profile and restores it on recall
export const DIB_FIELD_FLAG_PERSISTENT = 1 << 0;
// the module streams the field samples (YT graphs, data logging), see
// BB3P_FIELD_TAG_FIELD_STREAM in bb3p-dib-module.h
export const DIB_FIELD_FLAG_SAMPLED = 1 << 1;

export const SCPI_ENUM_INDEX_NONE = 0xffff;

export const SCPI_DEFAULT_TIMEOUT_MS = 1000;

// values are scpi_unit_t from libscpi (types.h)
export const SCPI_UNITS = [
    { id: "none", label: "None", value: 0, cName: "NONE" },
    { id: "volt", label: "Volt (V)", value: 1, cName: "VOLT" },
    { id: "amper", label: "Ampere (A)", value: 2, cName: "AMPER" },
    { id: "ohm", label: "Ohm", value: 3, cName: "OHM" },
    { id: "hertz", label: "Hertz (Hz)", value: 4, cName: "HERTZ" },
    { id: "celsius", label: "Celsius", value: 5, cName: "CELSIUS" },
    { id: "second", label: "Second (s)", value: 6, cName: "SECOND" },
    { id: "farad", label: "Farad (F)", value: 17, cName: "FARAD" },
    { id: "siemens", label: "Siemens (S)", value: 19, cName: "SIEMENS" },
    { id: "joule", label: "Joule (J)", value: 21, cName: "JOULE" },
    { id: "watt", label: "Watt (W)", value: 37, cName: "WATT" },
    { id: "dbm", label: "dBm", value: 38, cName: "DBM" },
    { id: "decibel", label: "Decibel (dB)", value: 45, cName: "DECIBEL" }
];

// bit n of the special values mask is scpi_special_number_t n from libscpi
export const SCPI_SPECIAL_VALUES = [
    { id: "MIN", value: 1 },
    { id: "MAX", value: 2 },
    { id: "DEF", value: 3 },
    { id: "UP", value: 4 },
    { id: "DOWN", value: 5 },
    { id: "NAN", value: 6 },
    { id: "INF", value: 7 },
    { id: "NINF", value: 8 },
    { id: "AUTO", value: 9 }
];

export type ScpiAddressingKind =
    | "auto"
    | "bb3"
    | "channel-list-param"
    | "power-channel-param"
    | "power-channel-suffix"
    | "slot-suffix"
    | "selected"
    | "module";

export const SCPI_ADDRESSING_KINDS: {
    id: ScpiAddressingKind;
    label: string;
    value: number;
}[] = [
    { id: "auto", label: "Auto (inferred)", value: -1 },
    { id: "bb3", label: "BB3+ only", value: 0 },
    { id: "channel-list-param", label: "Channel list parameter", value: 1 },
    { id: "power-channel-param", label: "Power channel parameter", value: 2 },
    { id: "power-channel-suffix", label: "Power channel header suffix", value: 3 },
    { id: "slot-suffix", label: "Slot header suffix", value: 4 },
    { id: "selected", label: "Selected channel", value: 5 },
    { id: "module", label: "Module", value: 6 }
];

const CHANNEL_ENUMS = ["Channel", "ChannelWithAll"];

////////////////////////////////////////////////////////////////////////////////

// libscpi form of the command pattern: '[<n>]' and '<n>' become '#'
export function getScpiCommandPattern(command: ScpiCommand) {
    return command.name
        .trim()
        .replace(/\[\<n\>\]/g, "<n>")
        .replace(/\<n\>/g, "#");
}

export function getScpiCommandNumSuffixes(command: ScpiCommand) {
    return (getScpiCommandPattern(command).match(/#/g) || []).length;
}

function normalizeTypeName(type: string | undefined) {
    // legacy "numeric" type is NR3
    return type == "numeric" ? "nr3" : type;
}

function getTypes(types: (ScpiParameterType | ScpiResponseType)[] | undefined) {
    return (types || []).filter(type => !!normalizeTypeName(type.type));
}

function typeToWireType(
    type: ScpiParameterType | ScpiResponseType,
    hasSpecialValues: boolean
) {
    switch (normalizeTypeName(type.type)) {
        case "nr1":
            return hasSpecialValues
                ? SCPI_WIRE_TYPE_NUMBER
                : SCPI_WIRE_TYPE_INT32;
        case "nr2":
        case "nr3":
            return SCPI_WIRE_TYPE_NUMBER;
        case "boolean":
            return SCPI_WIRE_TYPE_BOOL;
        case "discrete":
            return SCPI_WIRE_TYPE_CHOICE;
        case "quoted-string":
        case "list-of-quoted-string":
            return SCPI_WIRE_TYPE_STRING;
        case "data-block":
        case "non-standard-data-block":
            return SCPI_WIRE_TYPE_BLOCK;
        case "channel-list":
            return SCPI_WIRE_TYPE_CHANNEL_LIST;
        case "any":
        case "arbitrary-ascii":
            return SCPI_WIRE_TYPE_RAW;
    }
    return SCPI_WIRE_TYPE_NONE;
}

export function getWireTypeMask(
    types: (ScpiParameterType | ScpiResponseType)[] | undefined,
    hasSpecialValues: boolean
) {
    let mask = 0;
    for (const type of getTypes(types)) {
        const wireType = typeToWireType(type, hasSpecialValues);
        if (wireType != SCPI_WIRE_TYPE_NONE) {
            mask |= 1 << wireType;
        }
    }
    return mask;
}

export function getEnumeration(
    types: (ScpiParameterType | ScpiResponseType)[] | undefined
) {
    const discrete = getTypes(types).find(type => type.type == "discrete");
    return discrete ? discrete.enumeration : undefined;
}

export function getEnumIndex(enums: ScpiEnum[], enumName: string | undefined) {
    if (!enumName) {
        return SCPI_ENUM_INDEX_NONE;
    }
    const index = enums.findIndex(scpiEnum => scpiEnum.name == enumName);
    return index != -1 ? index : SCPI_ENUM_INDEX_NONE;
}

export function getUnitValue(unit: string | undefined) {
    const scpiUnit = SCPI_UNITS.find(scpiUnit => scpiUnit.id == unit);
    return scpiUnit ? scpiUnit.value : 0;
}

export function parseSpecialValues(specialValues: string | undefined) {
    const result: string[] = [];
    const invalid: string[] = [];
    for (const item of (specialValues || "").split(",")) {
        const value = item.trim().toUpperCase();
        if (!value) {
            continue;
        }
        if (SCPI_SPECIAL_VALUES.find(special => special.id == value)) {
            if (result.indexOf(value) == -1) {
                result.push(value);
            }
        } else {
            invalid.push(item.trim());
        }
    }
    return { result, invalid };
}

export function getSpecialValuesMask(specialValues: string | undefined) {
    let mask = 0;
    for (const value of parseSpecialValues(specialValues).result) {
        const special = SCPI_SPECIAL_VALUES.find(
            special => special.id == value
        )!;
        mask |= 1 << special.value;
    }
    return mask;
}

////////////////////////////////////////////////////////////////////////////////

export interface ScpiResponseItemInfo {
    name: string;
    types: ScpiResponseType[];
    unit?: string;
    repeat?: "once" | "list";
}

// Response items: explicit items list or, as the one item shorthand, the
// response type. Empty list means no response.
export function getScpiResponseItems(
    command: ScpiCommand
): ScpiResponseItemInfo[] {
    const response = command.response;
    if (!response) {
        return [];
    }

    if (response.items && response.items.length > 0) {
        return response.items.map(item => ({
            name: item.name,
            types: item.type,
            unit: item.unit,
            repeat: item.repeat
        }));
    }

    const types = getTypes(response.type) as ScpiResponseType[];
    if (types.length == 0) {
        return [];
    }

    return [
        {
            name: "result",
            types,
            unit: response.unit,
            repeat: types.find(type => type.type == "list-of-quoted-string")
                ? "list"
                : response.repeat
        }
    ];
}

////////////////////////////////////////////////////////////////////////////////

export interface ScpiAddressingInfo {
    kind: Exclude<ScpiAddressingKind, "auto">;
    // parameter index or header suffix index, depends on kind
    index: number;
}

function isChannelEnumParameter(parameter: ScpiParameter) {
    const enumeration = getEnumeration(parameter.type);
    return !!enumeration && CHANNEL_ENUMS.indexOf(enumeration) != -1;
}

function isChannelListParameter(parameter: ScpiParameter) {
    return getTypes(parameter.type).some(
        type => type.type == "channel-list"
    );
}

// Default addressing rule when it is not set in the project
export function inferScpiAddressing(command: ScpiCommand): ScpiAddressingInfo {
    const parameters = command.parameters || [];

    let index = parameters.findIndex(isChannelListParameter);
    if (index != -1) {
        return { kind: "channel-list-param", index };
    }

    index = parameters.findIndex(isChannelEnumParameter);
    if (index != -1) {
        return { kind: "power-channel-param", index };
    }

    if (getScpiCommandNumSuffixes(command) > 0) {
        return { kind: "power-channel-suffix", index: 0 };
    }

    return { kind: "selected", index: 0 };
}

export function getScpiAddressing(command: ScpiCommand): ScpiAddressingInfo {
    const addressing = command.addressing;
    if (!addressing || !addressing.kind || addressing.kind == "auto") {
        return inferScpiAddressing(command);
    }

    let index = 0;
    if (
        addressing.kind == "channel-list-param" ||
        addressing.kind == "power-channel-param"
    ) {
        index = (command.parameters || []).findIndex(
            parameter => parameter.name == addressing.parameter
        );
    } else if (
        addressing.kind == "power-channel-suffix" ||
        addressing.kind == "slot-suffix"
    ) {
        index = addressing.suffixIndex || 0;
    }

    return { kind: addressing.kind, index };
}

export function getScpiAddressingKindValue(kind: ScpiAddressingKind) {
    return SCPI_ADDRESSING_KINDS.find(item => item.id == kind)!.value;
}

export function getScpiAddressingLabel(addressing: ScpiAddressingInfo) {
    const label = SCPI_ADDRESSING_KINDS.find(
        item => item.id == addressing.kind
    )!.label;
    if (
        addressing.kind == "channel-list-param" ||
        addressing.kind == "power-channel-param"
    ) {
        return `${label} #${addressing.index + 1}`;
    }
    if (
        addressing.kind == "power-channel-suffix" ||
        addressing.kind == "slot-suffix"
    ) {
        return `${label} #${addressing.index + 1}`;
    }
    return label;
}

////////////////////////////////////////////////////////////////////////////////

// Commands forwarded to the module, in the order written to the metadata:
// the index in this list is the command id on the wire.
export function getModuleScpiCommands(project: Project) {
    const commands: ScpiCommand[] = [];
    if (project.scpi) {
        for (const subsystem of project.scpi.subsystems) {
            for (const command of subsystem.commands) {
                if (getScpiAddressing(command).kind != "bb3") {
                    commands.push(command);
                }
            }
        }
    }
    return commands;
}

export function getModuleScpiEnums(project: Project): ScpiEnum[] {
    return project.scpi ? project.scpi.enums : [];
}
