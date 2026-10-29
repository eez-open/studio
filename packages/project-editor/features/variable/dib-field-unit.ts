// Unit of a float DIB field: BB3+ gives the value with this unit to the flows
// (e.g. displayed as "1.5 V" or "250 mA"). Value is the eez-framework Unit
// enum value.
export const DIB_FIELD_UNITS = [
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
const DIB_FIELD_UNIT_NONE = 255;

export function getDibFieldUnitValue(dibFieldUnit: string | undefined) {
    const unit = DIB_FIELD_UNITS.find(unit => unit.id == dibFieldUnit);
    return unit ? unit.value : DIB_FIELD_UNIT_NONE;
}

// Channel measurement of a sampled DIB field, BB3P_MEASUREMENT_... in
// bb3p-dib-module.h: BB3+ finds the stream of a channel measurement (data
// logging, YT) by it instead of by the field name.
export const DIB_FIELD_MEASUREMENTS = [
    { id: "none", label: "None", value: 0 },
    { id: "voltage", label: "Voltage (MEASure:VOLTage)", value: 1 },
    { id: "current", label: "Current (MEASure:CURRent)", value: 2 },
    { id: "power", label: "Power (MEASure:POWer)", value: 3 },
    { id: "analog", label: "Analog input (voltage or current)", value: 4 },
    { id: "digital", label: "Digital input pins", value: 5 }
];

export function getDibFieldMeasurementValue(measurement: string | undefined) {
    const item = DIB_FIELD_MEASUREMENTS.find(item => item.id == measurement);
    return item ? item.value : 0;
}
