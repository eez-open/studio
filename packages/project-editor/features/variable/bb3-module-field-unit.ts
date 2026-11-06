// Unit of a float BB3 module field: BB3+ gives the value with this unit to the flows
// (e.g. displayed as "1.5 V" or "250 mA"). Value is the eez-framework Unit
// enum value.
export const BB3_MODULE_FIELD_UNITS = [
    { id: "volt", label: "Volt (V)", value: 1 },
    { id: "amper", label: "Amper (A)", value: 3 },
    { id: "watt", label: "Watt (W)", value: 6 },
    { id: "second", label: "Second (s)", value: 8 },
    { id: "celsius", label: "Celsius (°C)", value: 10 },
    { id: "ohm", label: "Ohm (Ω)", value: 12 },
    { id: "percent", label: "Percent (%)", value: 15 },
    { id: "hertz", label: "Hertz (Hz)", value: 16 },
    { id: "degree", label: "Degree (°)", value: 29 }
];

// UNIT_UNKNOWN
const BB3_MODULE_FIELD_UNIT_NONE = 255;

export function getBB3ModuleFieldUnitValue(bb3ModuleFieldUnit: string | undefined) {
    const unit = BB3_MODULE_FIELD_UNITS.find(unit => unit.id == bb3ModuleFieldUnit);
    return unit ? unit.value : BB3_MODULE_FIELD_UNIT_NONE;
}

// Channel measurement of a sampled BB3 module field, BB3_MEASUREMENT_... in
// bb3-module.h: BB3+ finds the stream of a channel measurement (data
// logging, YT) by it instead of by the field name.
export const BB3_MODULE_FIELD_MEASUREMENTS = [
    { id: "none", label: "None", value: 0 },
    { id: "voltage", label: "Voltage (MEASure:VOLTage)", value: 1 },
    { id: "current", label: "Current (MEASure:CURRent)", value: 2 },
    { id: "analog", label: "Analog input (voltage or current)", value: 3 },
    { id: "digital", label: "Digital input pins", value: 4 }
];

export function getBB3ModuleFieldMeasurementValue(measurement: string | undefined) {
    const item = BB3_MODULE_FIELD_MEASUREMENTS.find(item => item.id == measurement);
    return item ? item.value : 0;
}
