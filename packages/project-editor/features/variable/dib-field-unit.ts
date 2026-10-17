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
