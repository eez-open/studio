// Module fields of the slots of a BB3+, from the push port subscription
// (SUBScribe:FIELds, FRAME_FIELD_CATALOG and FRAME_FIELD_VALUES of
// eez-bb3plus-cm5-firmware/src/bb3/push/push_protocol.h).

import { NUM_SLOTS } from "instrument/bb3plus/push-protocol";
import type { NameParts } from "instrument/bb3plus/labels";

// bb3_field_type_t (eez-bb3plus-module-interface/bb3-module.h)
export const FIELD_TYPE_BOOL = 2;
export const FIELD_TYPE_INT8 = 3;
export const FIELD_TYPE_UINT8 = 4;
export const FIELD_TYPE_INT16 = 5;
export const FIELD_TYPE_UINT16 = 6;
export const FIELD_TYPE_INT32 = 7;
export const FIELD_TYPE_UINT32 = 8;
export const FIELD_TYPE_INT64 = 9;
export const FIELD_TYPE_UINT64 = 10;
export const FIELD_TYPE_FLOAT = 11;
export const FIELD_TYPE_DOUBLE = 12;

// bb3_field_direction_t
export const FIELD_DIRECTION_INPUT = 0;
export const FIELD_DIRECTION_OUTPUT = 1;
export const FIELD_DIRECTION_INPUT_OUTPUT = 2;

// BB3_FIELD_FLAG_...
export const FIELD_FLAG_PERSISTENT = 1 << 0;
export const FIELD_FLAG_SAMPLED = 1 << 1;

// eez Unit (eez-framework core/unit.h), the order is fixed
const UNIT_NAMES = [
    "",
    "V",
    "mV",
    "A",
    "mA",
    "uA",
    "W",
    "mW",
    "s",
    "ms",
    "°C",
    "rpm",
    "Ω",
    "kΩ",
    "MΩ",
    "%",
    "Hz",
    "mHz",
    "kHz",
    "MHz",
    "J",
    "F",
    "mF",
    "uF",
    "nF",
    "pF",
    "min",
    "VA",
    "VAR",
    "°",
    "Vpp",
    "mVpp",
    "App",
    "mApp",
    "uApp"
];

export function getUnitName(unit: number) {
    return UNIT_NAMES[unit] ?? "";
}

const TYPE_NAMES: { [type: number]: string } = {
    [FIELD_TYPE_BOOL]: "bool",
    [FIELD_TYPE_INT8]: "int8",
    [FIELD_TYPE_UINT8]: "uint8",
    [FIELD_TYPE_INT16]: "int16",
    [FIELD_TYPE_UINT16]: "uint16",
    [FIELD_TYPE_INT32]: "int32",
    [FIELD_TYPE_UINT32]: "uint32",
    [FIELD_TYPE_INT64]: "int64",
    [FIELD_TYPE_UINT64]: "uint64",
    [FIELD_TYPE_FLOAT]: "float",
    [FIELD_TYPE_DOUBLE]: "double"
};

export function getFieldTypeName(type: number) {
    return TYPE_NAMES[type] ?? "";
}

export function getFieldDirectionName(direction: number) {
    switch (direction) {
        case FIELD_DIRECTION_INPUT:
            return "in";
        case FIELD_DIRECTION_OUTPUT:
            return "out";
        case FIELD_DIRECTION_INPUT_OUTPUT:
            return "in/out";
        default:
            return "";
    }
}

export interface FieldInfo {
    index: number;
    name: string;
    type: number;
    direction: number;
    flags: number;
    size: number;
    unit: number;
    maxSampleRate: number;
    channel: number;
    // a sampled field: its label ("U", "AIN1", "DIN"), the number of bits of
    // a bit field (0 for the other fields), its color per theme
    // ("Dark=#..;Light=#..;Legacy=#.."), the user's label of its channel (or
    // its default) and the color BB3+ draws the channel with; "" and 0 for
    // the other fields
    label: string;
    bits: number;
    color: string;
    channelLabel: string;
    channelColor: string;
    // a bit field: the user's label (or its default) of each pin, bit 0
    // first
    pinLabels: string[];
}

// the parts of the name of a sampled field (labels.ts), the field name if
// it has no label
export function getFieldNameParts(
    slotFields: SlotFields,
    field: FieldInfo
): NameParts {
    return {
        label: field.label || field.name,
        channelLabel: field.channelLabel,
        slotLabel: slotFields.slotLabel
    };
}

export function isFieldFloat(field: FieldInfo) {
    return field.type == FIELD_TYPE_FLOAT || field.type == FIELD_TYPE_DOUBLE;
}

export function isFieldSampled(field: FieldInfo) {
    return (field.flags & FIELD_FLAG_SAMPLED) != 0;
}

// BB3+ sets it (input, input/output), so it can be set from Studio
export function isFieldSettable(field: FieldInfo) {
    return (
        field.direction == FIELD_DIRECTION_INPUT ||
        field.direction == FIELD_DIRECTION_INPUT_OUTPUT
    );
}

export class SlotFields {
    // "empty", "not started", "ok" or "error"
    state = "";
    moduleType = 0;
    moduleName = "";
    moduleBrand = "";
    firmwareVersion = "";
    serialNumber = "";
    // the user's label of the slot (or its default), the color BB3+ draws
    // the slot with (per theme)
    slotLabel = "";
    slotColor = "";
    // in the order of the field index
    fields: FieldInfo[] = [];
    // the value of each field (its bytes), undefined if not received yet
    values: (Buffer | undefined)[] = [];
    // when each value changed last (performance.now()), 0 if it didn't
    changeTimes: number[] = [];
}

export class ModuleFields {
    // undefined: no catalog received for the slot
    slots: (SlotFields | undefined)[] = new Array(NUM_SLOTS).fill(undefined);

    clear() {
        this.slots = new Array(NUM_SLOTS).fill(undefined);
    }

    // FRAME_FIELD_CATALOG, the slot (1 - 5) or 0 if it is not valid
    applyCatalog(json: string) {
        let root: any;
        try {
            root = JSON.parse(json);
        } catch (err) {
            return 0;
        }
        const slot = root?.slot;
        if (typeof slot != "number" || slot < 1 || slot > NUM_SLOTS) {
            return 0;
        }

        const slotFields = new SlotFields();
        slotFields.state = getString(root, "state");
        slotFields.moduleType = getNumber(root, "moduleType", 0);
        slotFields.moduleName = getString(root, "moduleName");
        slotFields.moduleBrand = getString(root, "moduleBrand");
        slotFields.firmwareVersion = getString(root, "firmwareVersion");
        slotFields.serialNumber = getString(root, "serialNumber");
        slotFields.slotLabel = getString(root, "slotLabel");
        slotFields.slotColor = getString(root, "slotColor");

        const fields = Array.isArray(root.fields) ? root.fields : [];
        fields.forEach((item: any, i: number) => {
            const pinLabels = Array.isArray(item?.pinLabels)
                ? item.pinLabels.map((label: any) =>
                      typeof label == "string" ? label : ""
                  )
                : [];
            slotFields.fields.push({
                index: getNumber(item, "index", i),
                name: getString(item, "name"),
                type: getNumber(item, "type", 0),
                direction: getNumber(item, "direction", 0),
                flags: getNumber(item, "flags", 0),
                size: getNumber(item, "size", 0),
                unit: getNumber(item, "unit", 255),
                maxSampleRate: getNumber(item, "maxSampleRate", 0),
                channel: getNumber(item, "channel", 0),
                label: getString(item, "label"),
                bits: getNumber(item, "bits", 0),
                color: getString(item, "color"),
                channelLabel: getString(item, "channelLabel"),
                channelColor: getString(item, "channelColor"),
                pinLabels
            });
        });
        slotFields.values = new Array(slotFields.fields.length).fill(undefined);
        slotFields.changeTimes = new Array(slotFields.fields.length).fill(0);

        this.slots[slot - 1] = slotFields;
        return slot;
    }

    // FRAME_FIELD_VALUES, false if it is not valid; time for the change
    // marks
    applyValues(payload: Buffer, time: number) {
        if (payload.length < 3) {
            return false;
        }
        const slot = payload[0];
        if (slot < 1 || slot > NUM_SLOTS) {
            return false;
        }
        const slotFields = this.slots[slot - 1];
        const count = payload.readUInt16LE(1);
        let pos = 3;
        for (let i = 0; i < count; i++) {
            if (pos + 3 > payload.length) {
                return false;
            }
            const index = payload.readUInt16LE(pos);
            const valueSize = payload[pos + 2];
            pos += 3;
            if (pos + valueSize > payload.length) {
                return false;
            }
            if (slotFields && index < slotFields.values.length) {
                const hadValue = slotFields.values[index] != undefined;
                slotFields.values[index] = Buffer.from(
                    payload.subarray(pos, pos + valueSize)
                );
                if (hadValue) {
                    slotFields.changeTimes[index] = time;
                }
            }
            pos += valueSize;
        }
        return pos == payload.length;
    }
}

function getString(obj: any, key: string) {
    const value = obj?.[key];
    return typeof value == "string" ? value : "";
}

function getNumber(obj: any, key: string, defaultValue: number) {
    const value = obj?.[key];
    return typeof value == "number" ? value : defaultValue;
}

export function formatNumber(value: number, digits: number = 6) {
    if (isNaN(value)) {
        return "NaN";
    }
    if (!isFinite(value)) {
        return value > 0 ? "Infinity" : "-Infinity";
    }
    if (value == Math.floor(value) && Math.abs(value) < 1e15) {
        return value.toFixed(0);
    }
    // like %g
    let text = value.toPrecision(digits);
    if (text.indexOf("e") == -1 && text.indexOf(".") != -1) {
        text = text.replace(/0+$/, "").replace(/\.$/, "");
    }
    return text;
}

// the value of a field without its unit, e.g. "2.5", "true", "12";
// undefined if not received yet
export function formatFieldNumber(field: FieldInfo, value: Buffer | undefined) {
    if (!value) {
        return undefined;
    }
    if (value.length != field.size) {
        return value.toString("hex");
    }
    switch (field.type) {
        case FIELD_TYPE_BOOL:
            return value.some(b => b != 0) ? "true" : "false";
        case FIELD_TYPE_INT8:
            return value.readInt8(0).toString();
        case FIELD_TYPE_UINT8:
            return value.readUInt8(0).toString();
        case FIELD_TYPE_INT16:
            return value.readInt16LE(0).toString();
        case FIELD_TYPE_UINT16:
            return value.readUInt16LE(0).toString();
        case FIELD_TYPE_INT32:
            return value.readInt32LE(0).toString();
        case FIELD_TYPE_UINT32:
            return value.readUInt32LE(0).toString();
        case FIELD_TYPE_INT64:
            return value.readBigInt64LE(0).toString();
        case FIELD_TYPE_UINT64:
            return value.readBigUInt64LE(0).toString();
        case FIELD_TYPE_FLOAT:
            return formatNumber(value.readFloatLE(0));
        case FIELD_TYPE_DOUBLE:
            return formatNumber(value.readDoubleLE(0), 10);
        default:
            return value.toString("hex");
    }
}

// the value with its unit, e.g. "2.5 V", "true", "12"; "" if not received yet
export function formatFieldValue(field: FieldInfo, value: Buffer | undefined) {
    const text = formatFieldNumber(field, value);
    if (text == undefined) {
        return "";
    }
    if (isFieldFloat(field) && value && value.length == field.size) {
        const unit = getUnitName(field.unit);
        if (unit) {
            return text + " " + unit;
        }
    }
    return text;
}
