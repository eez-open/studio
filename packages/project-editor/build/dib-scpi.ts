// Generates the SCPI helper library for a DIB module (no libscpi needed):
//   DIB_SCPI_DECL - types, command ids, runtime API and handler prototypes
//   DIB_SCPI_DEF  - runtime (request reassembly, decoding, response encoding)
//                   and the dispatch table
// The module implements one handler per command, BB3+ does all the SCPI text
// parsing and formatting. Wire format is described in bb3p-dib-module.h.

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
    getModuleScpiCommands,
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
        cType: "dib_scpi_number_t",
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
        cType: "dib_scpi_string_t",
        field: "string"
    },
    [SCPI_WIRE_TYPE_BLOCK]: {
        name: "BLOCK",
        cType: "dib_scpi_block_t",
        field: "block"
    },
    [SCPI_WIRE_TYPE_CHANNEL_LIST]: {
        name: "CHANNEL_LIST",
        cType: "dib_scpi_channel_list_t",
        field: "channel_list"
    },
    [SCPI_WIRE_TYPE_RAW]: {
        name: "RAW",
        cType: "dib_scpi_string_t",
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
        "DIB_SCPI_CMD_" +
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
        return "dib_scpi_list_t";
    }
    if (param.wireTypes.length != 1) {
        return "const dib_scpi_value_t *";
    }
    const cType = WIRE_TYPES[param.wireTypes[0]].cType;
    return param.isOptional ? `const ${cType} *` : cType;
}

function getHandlerPrototype(info: CommandInfo) {
    const args = ["dib_scpi_req_t *req"];
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
            `//   channel: module channel index, BB3P_SCPI_NO_CHANNEL if none`
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
        (project.dibModuleMetadata &&
            project.dibModuleMetadata.scpiMaxMessageSize) ||
        DEFAULT_SCPI_MAX_MESSAGE_SIZE;

    return `#include <stdbool.h>
#include <stdint.h>

#define DIB_SCPI_MAX_MESSAGE_SIZE ${maxMessageSize}
#define DIB_SCPI_MAX_ERRORS 8

// handler result
#define DIB_SCPI_OK 0
#define DIB_SCPI_ERR -1

// standard SCPI error codes for dib_scpi_error_push
#define DIB_SCPI_ERROR_DATA_TYPE_ERROR -104
#define DIB_SCPI_ERROR_PARAMETER_NOT_ALLOWED -108
#define DIB_SCPI_ERROR_MISSING_PARAMETER -109
#define DIB_SCPI_ERROR_UNDEFINED_HEADER -113
#define DIB_SCPI_ERROR_INVALID_SUFFIX -131
#define DIB_SCPI_ERROR_EXECUTION_ERROR -200
#define DIB_SCPI_ERROR_SETTINGS_CONFLICT -221
#define DIB_SCPI_ERROR_DATA_OUT_OF_RANGE -222
#define DIB_SCPI_ERROR_TOO_MUCH_DATA -223
#define DIB_SCPI_ERROR_ILLEGAL_PARAMETER_VALUE -224
#define DIB_SCPI_ERROR_HARDWARE_ERROR -240
#define DIB_SCPI_ERROR_HARDWARE_MISSING -241

typedef struct {
    uint8_t special; // BB3P_SCPI_NUMBER_..., BB3P_SCPI_NUMBER_VALUE if value is set
    double value;    // in base unit (V, A, s, ...)
} dib_scpi_number_t;

// not NUL terminated
typedef struct {
    const char *data;
    uint16_t length;
} dib_scpi_string_t;

typedef struct {
    const uint8_t *data;
    uint32_t length;
} dib_scpi_block_t;

typedef struct {
    const uint8_t *channels; // module channel indexes
    uint8_t count;
} dib_scpi_channel_list_t;

// list parameter, use dib_scpi_list_get to get the values
typedef struct {
    const uint8_t *data;
    uint32_t length;
    uint16_t count;
} dib_scpi_list_t;

typedef struct {
    uint8_t type; // BB3P_SCPI_WIRE_TYPE_...
    union {
        int32_t int32;
        dib_scpi_number_t number;
        bool boolean;
        int32_t choice;
        dib_scpi_string_t string; // STRING and RAW
        dib_scpi_block_t block;
        dib_scpi_channel_list_t channel_list;
        dib_scpi_list_t list;
    } value;
} dib_scpi_value_t;

typedef struct dib_scpi_req dib_scpi_req_t;

enum DibScpiCommandId {
${infos.map(info => `    ${info.idName} = ${info.id}, // ${info.pattern}`).join("\n")}
    DIB_SCPI_NUM_COMMANDS = ${infos.length}
};

// Runtime. dib_scpi_on_field and dib_scpi_put_response are called while
// handling the frames exchanged with BB3+, dib_scpi_poll from the main loop
// (it executes the command handler).
void dib_scpi_init(void);
// returns true if the field was BB3P_FIELD_TAG_SCPI_REQUEST
bool dib_scpi_on_field(uint16_t tag, const uint8_t *value, uint32_t length);
void dib_scpi_poll(void);
// Puts the next BB3P_FIELD_TAG_SCPI_RESPONSE field (field header included) in
// dst if there is a response to send, returns the number of bytes written.
uint32_t dib_scpi_put_response(uint8_t *dst, uint32_t max_length);

// For use in the handlers
uint16_t dib_scpi_command_id(const dib_scpi_req_t *req);
bool dib_scpi_list_get(const dib_scpi_list_t *list, uint16_t index, dib_scpi_value_t *value);
void dib_scpi_error_push(dib_scpi_req_t *req, int16_t error);
bool dib_scpi_result_int32(dib_scpi_req_t *req, int32_t value);
bool dib_scpi_result_number(dib_scpi_req_t *req, double value);
bool dib_scpi_result_bool(dib_scpi_req_t *req, bool value);
bool dib_scpi_result_choice(dib_scpi_req_t *req, int32_t value);
bool dib_scpi_result_text(dib_scpi_req_t *req, const char *text, uint16_t length);
bool dib_scpi_result_raw(dib_scpi_req_t *req, const char *text, uint16_t length);
bool dib_scpi_result_block(dib_scpi_req_t *req, const void *data, uint32_t length);

// Command handlers, implemented by the module. Return DIB_SCPI_OK or
// DIB_SCPI_ERR (after dib_scpi_error_push). Query handlers write the response
// with dib_scpi_result_..., in the order of the response items.
${infos
    .map(info => `${getHandlerComment(info)}\n${getHandlerPrototype(info)};`)
    .join("\n\n")}
`;
}

////////////////////////////////////////////////////////////////////////////////

const RUNTIME_DEF_HEAD = `#include <string.h>

#define DIB_SCPI_FIELD_HEADER_SIZE (sizeof(uint16_t) + sizeof(uint32_t))

// space before the items in the response buffer for num_errors, errors and
// num_items
#define DIB_SCPI_RESPONSE_HEAD_MAX (1 + 2 * DIB_SCPI_MAX_ERRORS + 2)

#define DIB_SCPI_DECODE_ERROR -2
#define DIB_SCPI_UNKNOWN_COMMAND -3

enum {
    DIB_SCPI_STATE_IDLE,
    DIB_SCPI_STATE_RECEIVING,
    DIB_SCPI_STATE_READY,
    DIB_SCPI_STATE_RESPONDING
};

struct dib_scpi_req {
    uint16_t command_id;
    uint8_t local_channel;
    uint8_t num_errors;
    int16_t errors[DIB_SCPI_MAX_ERRORS];
    uint16_t num_items;
    uint32_t items_length;
    bool overflow;
};

typedef struct {
    const uint8_t *p;
    const uint8_t *end;
} dib_scpi_reader_t;

static volatile uint8_t g_dib_scpi_state;
static uint16_t g_dib_scpi_request_id;
static uint32_t g_dib_scpi_request_length;
static uint32_t g_dib_scpi_request_received;
static uint8_t g_dib_scpi_request[DIB_SCPI_MAX_MESSAGE_SIZE];

static uint8_t g_dib_scpi_response[DIB_SCPI_RESPONSE_HEAD_MAX + DIB_SCPI_MAX_MESSAGE_SIZE];
static uint32_t g_dib_scpi_response_start;
static uint32_t g_dib_scpi_response_length;
static uint32_t g_dib_scpi_response_sent;

static dib_scpi_req_t g_dib_scpi_req;

////////////////////////////////////////////////////////////////////////////////

static bool dib_scpi_read(dib_scpi_reader_t *reader, void *dst, uint32_t length) {
    if ((uint32_t)(reader->end - reader->p) < length) {
        return false;
    }
    memcpy(dst, reader->p, length);
    reader->p += length;
    return true;
}

static bool dib_scpi_skip(dib_scpi_reader_t *reader, uint32_t length) {
    if ((uint32_t)(reader->end - reader->p) < length) {
        return false;
    }
    reader->p += length;
    return true;
}

static bool dib_scpi_read_u8(dib_scpi_reader_t *reader, uint8_t *value) {
    return dib_scpi_read(reader, value, sizeof(uint8_t));
}

static bool dib_scpi_read_param(dib_scpi_reader_t *reader, dib_scpi_value_t *value, bool allowList) {
    if (!dib_scpi_read_u8(reader, &value->type)) {
        return false;
    }

    switch (value->type) {
    case BB3P_SCPI_WIRE_TYPE_NONE:
        return true;

    case BB3P_SCPI_WIRE_TYPE_INT32:
        return dib_scpi_read(reader, &value->value.int32, sizeof(int32_t));

    case BB3P_SCPI_WIRE_TYPE_CHOICE:
        return dib_scpi_read(reader, &value->value.choice, sizeof(int32_t));

    case BB3P_SCPI_WIRE_TYPE_NUMBER:
        return dib_scpi_read_u8(reader, &value->value.number.special) &&
            dib_scpi_read(reader, &value->value.number.value, sizeof(double));

    case BB3P_SCPI_WIRE_TYPE_BOOL: {
        uint8_t b;
        if (!dib_scpi_read_u8(reader, &b)) {
            return false;
        }
        value->value.boolean = b != 0;
        return true;
    }

    case BB3P_SCPI_WIRE_TYPE_STRING:
    case BB3P_SCPI_WIRE_TYPE_RAW:
        if (!dib_scpi_read(reader, &value->value.string.length, sizeof(uint16_t))) {
            return false;
        }
        value->value.string.data = (const char *)reader->p;
        return dib_scpi_skip(reader, value->value.string.length);

    case BB3P_SCPI_WIRE_TYPE_BLOCK:
        if (!dib_scpi_read(reader, &value->value.block.length, sizeof(uint32_t))) {
            return false;
        }
        value->value.block.data = reader->p;
        return dib_scpi_skip(reader, value->value.block.length);

    case BB3P_SCPI_WIRE_TYPE_CHANNEL_LIST:
        if (!dib_scpi_read_u8(reader, &value->value.channel_list.count)) {
            return false;
        }
        value->value.channel_list.channels = reader->p;
        return dib_scpi_skip(reader, value->value.channel_list.count);

    case BB3P_SCPI_WIRE_TYPE_LIST: {
        if (!allowList) {
            return false;
        }
        if (!dib_scpi_read(reader, &value->value.list.count, sizeof(uint16_t))) {
            return false;
        }
        const uint8_t *data = reader->p;
        for (uint16_t i = 0; i < value->value.list.count; i++) {
            dib_scpi_value_t element;
            if (!dib_scpi_read_param(reader, &element, false)) {
                return false;
            }
        }
        value->value.list.data = data;
        value->value.list.length = (uint32_t)(reader->p - data);
        return true;
    }
    }

    return false;
}

bool dib_scpi_list_get(const dib_scpi_list_t *list, uint16_t index, dib_scpi_value_t *value) {
    if (index >= list->count) {
        return false;
    }
    dib_scpi_reader_t reader = { list->data, list->data + list->length };
    for (uint16_t i = 0; i <= index; i++) {
        if (!dib_scpi_read_param(&reader, value, false)) {
            return false;
        }
    }
    return true;
}

uint16_t dib_scpi_command_id(const dib_scpi_req_t *req) {
    return req->command_id;
}

void dib_scpi_error_push(dib_scpi_req_t *req, int16_t error) {
    if (req->num_errors < DIB_SCPI_MAX_ERRORS) {
        req->errors[req->num_errors++] = error;
    }
}

static bool dib_scpi_result(dib_scpi_req_t *req, uint8_t type, const void *value1, uint32_t length1, const void *value2, uint32_t length2) {
    uint32_t length = 1 + length1 + length2;
    if (req->overflow || req->items_length + length > DIB_SCPI_MAX_MESSAGE_SIZE - DIB_SCPI_RESPONSE_HEAD_MAX) {
        req->overflow = true;
        return false;
    }
    uint8_t *p = g_dib_scpi_response + DIB_SCPI_RESPONSE_HEAD_MAX + req->items_length;
    *p++ = type;
    if (length1) {
        memcpy(p, value1, length1);
        p += length1;
    }
    if (length2) {
        memcpy(p, value2, length2);
    }
    req->items_length += length;
    req->num_items++;
    return true;
}

bool dib_scpi_result_int32(dib_scpi_req_t *req, int32_t value) {
    return dib_scpi_result(req, BB3P_SCPI_WIRE_TYPE_INT32, &value, sizeof(value), 0, 0);
}

bool dib_scpi_result_number(dib_scpi_req_t *req, double value) {
    uint8_t special = BB3P_SCPI_NUMBER_VALUE;
    return dib_scpi_result(req, BB3P_SCPI_WIRE_TYPE_NUMBER, &special, sizeof(special), &value, sizeof(value));
}

bool dib_scpi_result_bool(dib_scpi_req_t *req, bool value) {
    uint8_t b = value ? 1 : 0;
    return dib_scpi_result(req, BB3P_SCPI_WIRE_TYPE_BOOL, &b, sizeof(b), 0, 0);
}

bool dib_scpi_result_choice(dib_scpi_req_t *req, int32_t value) {
    return dib_scpi_result(req, BB3P_SCPI_WIRE_TYPE_CHOICE, &value, sizeof(value), 0, 0);
}

bool dib_scpi_result_text(dib_scpi_req_t *req, const char *text, uint16_t length) {
    return dib_scpi_result(req, BB3P_SCPI_WIRE_TYPE_STRING, &length, sizeof(length), text, length);
}

bool dib_scpi_result_raw(dib_scpi_req_t *req, const char *text, uint16_t length) {
    return dib_scpi_result(req, BB3P_SCPI_WIRE_TYPE_RAW, &length, sizeof(length), text, length);
}

bool dib_scpi_result_block(dib_scpi_req_t *req, const void *data, uint32_t length) {
    return dib_scpi_result(req, BB3P_SCPI_WIRE_TYPE_BLOCK, &length, sizeof(length), data, length);
}
`;

const RUNTIME_DEF_TAIL = `
////////////////////////////////////////////////////////////////////////////////

void dib_scpi_init(void) {
    g_dib_scpi_state = DIB_SCPI_STATE_IDLE;
}

bool dib_scpi_on_field(uint16_t tag, const uint8_t *value, uint32_t length) {
    if (tag != BB3P_FIELD_TAG_SCPI_REQUEST) {
        return false;
    }

    if (length < BB3P_SCPI_CHUNK_HEADER_SIZE) {
        return true;
    }

    uint16_t request_id;
    uint8_t chunk_flags;
    uint32_t total_length;
    uint32_t offset;
    memcpy(&request_id, value, sizeof(request_id));
    chunk_flags = value[2];
    memcpy(&total_length, value + 4, sizeof(total_length));
    memcpy(&offset, value + 8, sizeof(offset));

    const uint8_t *data = value + BB3P_SCPI_CHUNK_HEADER_SIZE;
    uint32_t data_length = length - BB3P_SCPI_CHUNK_HEADER_SIZE;

    if (chunk_flags & BB3P_SCPI_CHUNK_FIRST) {
        if (g_dib_scpi_state == DIB_SCPI_STATE_READY || g_dib_scpi_state == DIB_SCPI_STATE_RESPONDING) {
            // BB3+ sends a new request only after the response, this one
            // is dropped and BB3+ will report a timeout
            return true;
        }
        if (total_length > DIB_SCPI_MAX_MESSAGE_SIZE) {
            g_dib_scpi_state = DIB_SCPI_STATE_IDLE;
            return true;
        }
        g_dib_scpi_request_id = request_id;
        g_dib_scpi_request_length = total_length;
        g_dib_scpi_request_received = 0;
        g_dib_scpi_state = DIB_SCPI_STATE_RECEIVING;
    } else if (g_dib_scpi_state != DIB_SCPI_STATE_RECEIVING || request_id != g_dib_scpi_request_id) {
        return true;
    }

    if (offset != g_dib_scpi_request_received || offset + data_length > g_dib_scpi_request_length) {
        g_dib_scpi_state = DIB_SCPI_STATE_IDLE;
        return true;
    }

    memcpy(g_dib_scpi_request + offset, data, data_length);
    g_dib_scpi_request_received += data_length;

    if (chunk_flags & BB3P_SCPI_CHUNK_LAST) {
        g_dib_scpi_state = g_dib_scpi_request_received == g_dib_scpi_request_length
            ? DIB_SCPI_STATE_READY
            : DIB_SCPI_STATE_IDLE;
    }

    return true;
}

static int dib_scpi_execute(dib_scpi_req_t *req) {
    dib_scpi_reader_t reader = { g_dib_scpi_request, g_dib_scpi_request + g_dib_scpi_request_length };

    uint8_t num_suffixes;
    if (!dib_scpi_read(&reader, &req->command_id, sizeof(uint16_t)) ||
        !dib_scpi_read_u8(&reader, &req->local_channel) ||
        !dib_scpi_read_u8(&reader, &num_suffixes)) {
        return DIB_SCPI_DECODE_ERROR;
    }

    int32_t suffixes[8];
    if (num_suffixes > sizeof(suffixes) / sizeof(suffixes[0])) {
        return DIB_SCPI_DECODE_ERROR;
    }
    for (uint8_t i = 0; i < num_suffixes; i++) {
        if (!dib_scpi_read(&reader, &suffixes[i], sizeof(int32_t))) {
            return DIB_SCPI_DECODE_ERROR;
        }
    }

    uint8_t num_params;
    if (!dib_scpi_read_u8(&reader, &num_params)) {
        return DIB_SCPI_DECODE_ERROR;
    }

    return dib_scpi_dispatch(req, suffixes, num_suffixes, num_params, &reader);
}

void dib_scpi_poll(void) {
    if (g_dib_scpi_state != DIB_SCPI_STATE_READY) {
        return;
    }

    dib_scpi_req_t *req = &g_dib_scpi_req;
    memset(req, 0, sizeof(*req));

    int result = dib_scpi_execute(req);

    if (req->overflow) {
        req->num_items = 0;
        req->items_length = 0;
        dib_scpi_error_push(req, DIB_SCPI_ERROR_TOO_MUCH_DATA);
    } else if (result == DIB_SCPI_UNKNOWN_COMMAND) {
        dib_scpi_error_push(req, DIB_SCPI_ERROR_UNDEFINED_HEADER);
    } else if (result == DIB_SCPI_DECODE_ERROR) {
        dib_scpi_error_push(req, DIB_SCPI_ERROR_DATA_TYPE_ERROR);
    } else if (result != DIB_SCPI_OK && req->num_errors == 0) {
        dib_scpi_error_push(req, DIB_SCPI_ERROR_EXECUTION_ERROR);
    }

    // num_errors, errors and num_items are put just before the items
    uint32_t head_length = 1 + 2 * req->num_errors + 2;
    uint8_t *p = g_dib_scpi_response + DIB_SCPI_RESPONSE_HEAD_MAX - head_length;
    g_dib_scpi_response_start = (uint32_t)(p - g_dib_scpi_response);
    *p++ = req->num_errors;
    memcpy(p, req->errors, 2 * req->num_errors);
    p += 2 * req->num_errors;
    memcpy(p, &req->num_items, sizeof(uint16_t));

    g_dib_scpi_response_length = head_length + req->items_length;
    g_dib_scpi_response_sent = 0;
    g_dib_scpi_state = DIB_SCPI_STATE_RESPONDING;
}

uint32_t dib_scpi_put_response(uint8_t *dst, uint32_t max_length) {
    if (g_dib_scpi_state != DIB_SCPI_STATE_RESPONDING) {
        return 0;
    }

    uint32_t header_length = DIB_SCPI_FIELD_HEADER_SIZE + BB3P_SCPI_CHUNK_HEADER_SIZE;
    if (max_length <= header_length) {
        return 0;
    }

    uint32_t offset = g_dib_scpi_response_sent;
    uint32_t chunk_length = g_dib_scpi_response_length - offset;
    if (chunk_length > max_length - header_length) {
        chunk_length = max_length - header_length;
    }

    uint8_t chunk_flags = 0;
    if (offset == 0) {
        chunk_flags |= BB3P_SCPI_CHUNK_FIRST;
    }
    if (offset + chunk_length == g_dib_scpi_response_length) {
        chunk_flags |= BB3P_SCPI_CHUNK_LAST;
    }

    uint16_t tag = BB3P_FIELD_TAG_SCPI_RESPONSE;
    uint32_t field_length = BB3P_SCPI_CHUNK_HEADER_SIZE + chunk_length;

    uint8_t *p = dst;
    memcpy(p, &tag, sizeof(tag));
    p += sizeof(tag);
    memcpy(p, &field_length, sizeof(field_length));
    p += sizeof(field_length);

    memcpy(p, &g_dib_scpi_request_id, sizeof(uint16_t));
    p[2] = chunk_flags;
    p[3] = 0;
    memcpy(p + 4, &g_dib_scpi_response_length, sizeof(uint32_t));
    memcpy(p + 8, &offset, sizeof(uint32_t));
    p += BB3P_SCPI_CHUNK_HEADER_SIZE;

    memcpy(p, g_dib_scpi_response + g_dib_scpi_response_start + offset, chunk_length);

    g_dib_scpi_response_sent += chunk_length;
    if (chunk_flags & BB3P_SCPI_CHUNK_LAST) {
        g_dib_scpi_state = DIB_SCPI_STATE_IDLE;
    }

    return header_length + chunk_length;
}
`;

function buildDispatchFunction(info: CommandInfo) {
    const lines: string[] = [];
    lines.push(
        `static int dib_scpi_dispatch_${info.id}(dib_scpi_req_t *req, const int32_t *suffixes, uint8_t num_suffixes, uint8_t num_params, dib_scpi_reader_t *reader) {`
    );
    lines.push(`    // ${info.pattern}`);
    lines.push(`    if (num_suffixes != ${info.numWireSuffixes}) {`);
    lines.push(`        return DIB_SCPI_DECODE_ERROR;`);
    lines.push(`    }`);

    if (info.params.length == 0) {
        lines.push(`    (void)reader;`);
        lines.push(`    (void)num_params;`);
    }
    if (info.numWireSuffixes == 0) {
        lines.push(`    (void)suffixes;`);
    }

    const args = ["req"];
    if (hasChannelArg(info.addressing)) {
        args.push("req->local_channel");
    }
    info.suffixes.forEach((suffix, i) => args.push(`suffixes[${i}]`));

    for (const param of info.params) {
        const v = `v${param.index}`;
        lines.push(``);
        lines.push(`    dib_scpi_value_t ${v} = { BB3P_SCPI_WIRE_TYPE_NONE };`);
        lines.push(
            `    if (num_params > ${param.index} && !dib_scpi_read_param(reader, &${v}, ${param.isList ? "true" : "false"})) {`
        );
        lines.push(`        return DIB_SCPI_DECODE_ERROR;`);
        lines.push(`    }`);

        if (!param.cName) {
            // addressing parameter or calibration password, BB3+ sends it
            // as NONE
            continue;
        }

        const isNone = `${v}.type == BB3P_SCPI_WIRE_TYPE_NONE`;

        if (param.isList) {
            if (param.isOptional) {
                lines.push(`    if (${isNone}) {`);
                lines.push(`        ${v}.value.list.data = 0;`);
                lines.push(`        ${v}.value.list.length = 0;`);
                lines.push(`        ${v}.value.list.count = 0;`);
                lines.push(`    } else if (${v}.type != BB3P_SCPI_WIRE_TYPE_LIST) {`);
            } else {
                lines.push(`    if (${v}.type != BB3P_SCPI_WIRE_TYPE_LIST) {`);
            }
            lines.push(`        return DIB_SCPI_DECODE_ERROR;`);
            lines.push(`    }`);
            args.push(`${v}.value.list`);
            continue;
        }

        const typeCheck = param.wireTypes
            .map(wireType => `${v}.type != BB3P_SCPI_WIRE_TYPE_${WIRE_TYPES[wireType].name}`)
            .join(" && ");

        if (param.isOptional) {
            lines.push(`    if (!(${isNone}) && ${typeCheck}) {`);
        } else {
            lines.push(`    if (${typeCheck}) {`);
        }
        lines.push(`        return DIB_SCPI_DECODE_ERROR;`);
        lines.push(`    }`);

        if (param.wireTypes.length != 1) {
            args.push(param.isOptional ? `${isNone} ? 0 : &${v}` : `&${v}`);
        } else {
            const field = `${v}.value.${WIRE_TYPES[param.wireTypes[0]].field}`;
            args.push(param.isOptional ? `${isNone} ? 0 : &${field}` : field);
        }
    }

    lines.push(``);
    lines.push(`    return ${info.funcName}(${args.join(", ")});`);
    lines.push(`}`);

    return lines.join("\n");
}

function buildDef(infos: CommandInfo[]) {
    const dispatchers = infos.map(buildDispatchFunction).join("\n\n");

    const dispatch = `static int dib_scpi_dispatch(dib_scpi_req_t *req, const int32_t *suffixes, uint8_t num_suffixes, uint8_t num_params, dib_scpi_reader_t *reader) {
    switch (req->command_id) {
${infos
    .map(
        info =>
            `    case ${info.idName}:\n        return dib_scpi_dispatch_${info.id}(req, suffixes, num_suffixes, num_params, reader);`
    )
    .join("\n")}
    }
    (void)suffixes;
    (void)num_suffixes;
    (void)num_params;
    (void)reader;
    return DIB_SCPI_UNKNOWN_COMMAND;
}`;

    return (
        RUNTIME_DEF_HEAD +
        `
////////////////////////////////////////////////////////////////////////////////
// Dispatch table

${dispatchers ? dispatchers + "\n\n" : ""}${dispatch}
` +
        RUNTIME_DEF_TAIL
    );
}

////////////////////////////////////////////////////////////////////////////////

export function buildDibScpi(project: Project, sectionNames: string[] | undefined) {
    const result: { [sectionName: string]: string } = {};

    const wantDecl =
        !sectionNames || sectionNames.indexOf("DIB_SCPI_DECL") !== -1;
    const wantDef = !sectionNames || sectionNames.indexOf("DIB_SCPI_DEF") !== -1;

    if (!wantDecl && !wantDef) {
        return result;
    }

    const infos = getModuleScpiCommands(project).map((command, id) =>
        getCommandInfo(command, id)
    );

    if (wantDecl) {
        result.DIB_SCPI_DECL = buildDecl(project, infos);
    }

    if (wantDef) {
        result.DIB_SCPI_DEF = buildDef(infos);
    }

    return result;
}
