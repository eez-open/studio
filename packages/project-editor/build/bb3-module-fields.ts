// Generates the BB3 module fields of a BB3 module: the global variables of the
// project with the "Module field" switch on, exchanged with BB3+ as module fields (tag
// BB3_MODULE_FIELD_TAG_START + index). The module firmware includes the
// generic runtime bb3-module.c (eez-bb3plus-cm5-firmware/eez-bb3plus-module-
// interface), which uses these definitions by their fixed names.
//   BB3_MODULE_FIELDS_DECL - identity of the module (for the description of the
//                     firmware), index enum, module_fields_t (one member per
//                     field) and the declarations of module_fields and
//                     module_field_defs
//   BB3_MODULE_FIELDS_DEF  - module_fields with the default values of the variables
//                     and module_field_defs (type, direction, flags, offset,
//                     update period, min, max of each field)

import type { Project } from "project-editor/project/project";
import type { Variable } from "project-editor/features/variable/variable";
import { TAB, NamingConvention, getName } from "project-editor/build/helper";
import { BB3_MODULE_FIELD_TYPES } from "project-editor/features/variable/value-type";
import { evalConstantExpression } from "project-editor/flow/expression";
import { BB3_MODULE_METADATA_VERSION } from "project-editor/features/bb3-module-metadata";
import { isBB3ModuleFieldSampled } from "project-editor/features/variable/bb3-module-field-unit";

function getFieldIndexName(variable: Variable) {
    return getName("MODULE_FIELD_", variable, NamingConvention.UnderscoreUpperCase);
}

function getDirectionName(variable: Variable) {
    return variable.bb3ModuleFieldDirection == "input"
        ? "INPUT"
        : variable.bb3ModuleFieldDirection == "output"
        ? "OUTPUT"
        : "INPUT_OUTPUT";
}

// C literal of the value in the type of the field
function getCLiteral(type: string, value: any) {
    if (type == "boolean") {
        return value ? "true" : "false";
    }

    let number = typeof value == "boolean" ? (value ? 1 : 0) : Number(value);
    if (!Number.isFinite(number)) {
        number = 0;
    }

    if (type == "float") {
        return Number.isInteger(number) ? `${number}.0f` : `${number}f`;
    }

    if (type == "double") {
        return Number.isInteger(number) ? `${number}.0` : `${number}`;
    }

    const integer = Math.trunc(number);
    if (type == "int64") {
        return `INT64_C(${integer})`;
    }
    if (type == "uint64") {
        return `UINT64_C(${integer})`;
    }
    if (type == "uint32") {
        return `${integer}U`;
    }
    if (integer == -2147483648) {
        return "INT32_MIN";
    }
    return `${integer}`;
}

function getDefaultValue(project: Project, variable: Variable) {
    try {
        const { value } = evalConstantExpression(
            project,
            variable.defaultValue
        );
        return value;
    } catch (err) {
        return 0;
    }
}

function getFieldComment(variable: Variable) {
    const parts: string[] = [];
    parts.push(variable.bb3ModuleFieldDirection ?? "input-output");
    if (variable.persistent) {
        parts.push("persistent");
    }
    let type = variable.type;
    if (variable.bb3ModuleFieldUnit) {
        type += ` [${variable.bb3ModuleFieldUnit}]`;
    }
    parts.push(type);
    if (variable.bb3ModuleFieldMin != undefined || variable.bb3ModuleFieldMax != undefined) {
        parts.push(
            `${variable.bb3ModuleFieldMin != undefined ? variable.bb3ModuleFieldMin : ""} .. ${
                variable.bb3ModuleFieldMax != undefined ? variable.bb3ModuleFieldMax : ""
            }`
        );
    }
    if (variable.bb3ModuleFieldUpdatePeriod) {
        parts.push(`every ${variable.bb3ModuleFieldUpdatePeriod} ms`);
    }
    if (isBB3ModuleFieldSampled(variable)) {
        parts.push(`sampled up to ${variable.bb3ModuleFieldMaxSampleRate} S/s`);
    }
    return parts.join(", ");
}

function getHex16(value: number | undefined) {
    return "0x" + (value ?? 0xffff).toString(16).toUpperCase().padStart(4, "0");
}

// C string literal, at most maxLength characters
function getCString(text: string | undefined, maxLength: number) {
    return JSON.stringify((text ?? "").replace(/[^\x20-\x7e]/g, "?").substring(0, maxLength));
}

// the length of the names in bb3_firmware_info_t (bb3-module.h), without the
// ending zero
const FIRMWARE_INFO_NAME_MAX_LENGTH = 23;

function buildIdentity(project: Project) {
    const metadata = project.bb3ModuleMetadata;
    return `// The identity of the module, for the description in the firmware image
// (bb3_firmware_info_t).
#define MODULE_INFO_TYPE ${getHex16(metadata.moduleTypeNum)}
#define MODULE_INFO_REVISION ${getHex16(metadata.moduleRevisionNum)}
#define MODULE_INFO_FIRMWARE_VERSION ${getHex16(metadata.firmwareVersionNum)}
#define MODULE_INFO_METADATA_VERSION ${BB3_MODULE_METADATA_VERSION}
#define MODULE_INFO_NAME ${getCString(metadata.moduleName, FIRMWARE_INFO_NAME_MAX_LENGTH)}
#define MODULE_INFO_BRAND ${getCString(metadata.moduleBrand, FIRMWARE_INFO_NAME_MAX_LENGTH)}`;
}

function buildDecl(project: Project, fields: Variable[]) {
    const indexes = fields.map(
        (variable, i) =>
            `${TAB}${getFieldIndexName(variable)} = ${i}, // ${getFieldComment(
                variable
            )}`
    );

    const members = fields.map(
        variable =>
            `${TAB}${BB3_MODULE_FIELD_TYPES[variable.type]?.cType ?? "int32_t"} ${
                variable.name
            };`
    );

    return `////////////////////////////////////////////////////////////////////////////////
// Module fields: the global variables of the project with "BB3 module field" set, in
// the order of the module metadata. BB3+ has a copy of them: it sends the
// input fields it changes (e.g. from the module GUI pages) and the module
// sends the fields it changes back, see bb3-module.h for the runtime.
// Generated by EEZ Studio.

${buildIdentity(project)}

// index of each field, its tag on the wire is BB3_MODULE_FIELD_TAG(index)
enum ModuleFieldIndex {
${indexes.join("\n")}
};

#define MODULE_NUM_FIELDS ${fields.length}

typedef struct {
${members.join("\n")}
} module_fields_t;

// The field values. The module writes the output fields (and the
// input-output fields when it changes them on its own), the runtime stores
// the input fields received from BB3+ (after the on_field_set callback) and
// sends every change to BB3+.
extern module_fields_t module_fields;

// type, direction, flags, size, offset, update period, min and max of each
// field, for the runtime
extern const bb3_field_def_t module_field_defs[MODULE_NUM_FIELDS];`;
}

function buildDef(project: Project, fields: Variable[]) {
    const values = fields.map(
        variable =>
            `${TAB}.${variable.name} = ${getCLiteral(
                variable.type,
                getDefaultValue(project, variable)
            )},`
    );

    const defs = fields.map(variable => {
        const bb3ModuleFieldType = BB3_MODULE_FIELD_TYPES[variable.type] ?? BB3_MODULE_FIELD_TYPES.integer;

        const flags: string[] = [];
        if (variable.persistent) {
            flags.push("BB3_FIELD_FLAG_PERSISTENT");
        }
        if (isBB3ModuleFieldSampled(variable)) {
            flags.push("BB3_FIELD_FLAG_SAMPLED");
        }
        const hasMin = variable.bb3ModuleFieldMin != undefined && variable.type != "boolean";
        const hasMax = variable.bb3ModuleFieldMax != undefined && variable.type != "boolean";
        if (hasMin) {
            flags.push("BB3_FIELD_FLAG_HAS_MIN");
        }
        if (hasMax) {
            flags.push("BB3_FIELD_FLAG_HAS_MAX");
        }

        const min = hasMin
            ? `{ .${bb3ModuleFieldType.valueMember} = ${getCLiteral(
                  variable.type,
                  variable.bb3ModuleFieldMin
              )} }`
            : "{ 0 }";
        const max = hasMax
            ? `{ .${bb3ModuleFieldType.valueMember} = ${getCLiteral(
                  variable.type,
                  variable.bb3ModuleFieldMax
              )} }`
            : "{ 0 }";

        const period =
            variable.bb3ModuleFieldUpdatePeriod && variable.bb3ModuleFieldUpdatePeriod > 0
                ? Math.round(variable.bb3ModuleFieldUpdatePeriod)
                : 0;

        return `${TAB}/* ${variable.name} */ { BB3_FIELD_TYPE_${
            bb3ModuleFieldType.bb3Type
        }, BB3_FIELD_DIRECTION_${getDirectionName(variable)}, ${
            flags.length > 0 ? flags.join(" | ") : "0"
        }, sizeof(${bb3ModuleFieldType.cType}), offsetof(module_fields_t, ${
            variable.name
        }), ${period}, ${min}, ${max} },`;
    });

    return `////////////////////////////////////////////////////////////////////////////////
// Module fields, generated by EEZ Studio (see the declarations)

module_fields_t module_fields = {
${values.join("\n")}
};

const bb3_field_def_t module_field_defs[MODULE_NUM_FIELDS] = {
${defs.join("\n")}
};`;
}

////////////////////////////////////////////////////////////////////////////////

export function buildBB3ModuleFields(
    project: Project,
    sectionNames: string[] | undefined
) {
    const result: { [sectionName: string]: string } = {};

    const wantDecl =
        !sectionNames || sectionNames.indexOf("BB3_MODULE_FIELDS_DECL") !== -1;
    const wantDef =
        !sectionNames || sectionNames.indexOf("BB3_MODULE_FIELDS_DEF") !== -1;

    if (!wantDecl && !wantDef) {
        return result;
    }

    const fields = project.bb3ModuleMetadata.bb3ModuleFields;

    if (wantDecl) {
        result.BB3_MODULE_FIELDS_DECL = buildDecl(project, fields);
    }

    if (wantDef) {
        result.BB3_MODULE_FIELDS_DEF = buildDef(project, fields);
    }

    return result;
}
