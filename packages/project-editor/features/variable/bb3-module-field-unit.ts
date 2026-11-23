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

// Tracking role of a power channel BB3 module field, BB3_TRACKING_ROLE_... in
// bb3-module.h: BB3+ tracking (OUTPut:TRACk) merges the fields of the
// channels in the group by the role and sets a field set on one channel to
// the field with the same role of the others.
export const BB3_MODULE_FIELD_TRACKING_ROLES = [
    { id: "none", label: "None", value: 0 },
    { id: "refused", label: "Refused while tracked", value: 1 },
    { id: "u_set", label: "Voltage set value", value: 2 },
    { id: "i_set", label: "Current set value", value: 3 },
    { id: "u_limit", label: "Voltage limit", value: 4 },
    { id: "i_limit", label: "Current limit", value: 5 },
    { id: "p_limit", label: "Power limit", value: 6 },
    { id: "ovp_state", label: "OVP state", value: 7 },
    { id: "ovp_type", label: "OVP type (0 software, 1 hardware)", value: 8 },
    { id: "ovp_level", label: "OVP level", value: 9 },
    { id: "ovp_delay", label: "OVP delay", value: 10 },
    { id: "ocp_state", label: "OCP state", value: 11 },
    { id: "ocp_delay", label: "OCP delay", value: 12 },
    { id: "opp_state", label: "OPP state", value: 13 },
    { id: "opp_level", label: "OPP level", value: 14 },
    { id: "opp_delay", label: "OPP delay", value: 15 },
    { id: "u_ramp_duration", label: "Voltage ramp duration", value: 16 },
    { id: "i_ramp_duration", label: "Current ramp duration", value: 17 },
    { id: "output_delay", label: "Output delay", value: 18 },
    { id: "u_trigger_mode", label: "Voltage trigger mode", value: 19 },
    { id: "i_trigger_mode", label: "Current trigger mode", value: 20 },
    { id: "u_trigger_level", label: "Voltage trigger level", value: 21 },
    { id: "i_trigger_level", label: "Current trigger level", value: 22 },
    { id: "output_enable", label: "Output enable", value: 23 },
    { id: "remote_sense", label: "Remote sense", value: 24 },
    { id: "remote_programming", label: "Remote programming", value: 25 },
    { id: "otp_state", label: "OTP state", value: 26 },
    { id: "otp_level", label: "OTP level", value: 27 },
    { id: "otp_delay", label: "OTP delay", value: 28 },
    { id: "trigger_output_state", label: "Output state at the trigger", value: 29 },
    { id: "trigger_on_list_stop", label: "Exit condition of the lists", value: 30 },
    { id: "u_func_waveform", label: "Voltage function waveform", value: 31 },
    { id: "u_func_frequency", label: "Voltage function frequency", value: 32 },
    { id: "u_func_phase_shift", label: "Voltage function phase shift", value: 33 },
    { id: "u_func_amplitude", label: "Voltage function amplitude", value: 34 },
    { id: "u_func_offset", label: "Voltage function offset", value: 35 },
    { id: "u_func_duty", label: "Voltage function duty cycle", value: 36 },
    { id: "i_func_waveform", label: "Current function waveform", value: 37 },
    { id: "i_func_frequency", label: "Current function frequency", value: 38 },
    { id: "i_func_phase_shift", label: "Current function phase shift", value: 39 },
    { id: "i_func_amplitude", label: "Current function amplitude", value: 40 },
    { id: "i_func_offset", label: "Current function offset", value: 41 },
    { id: "i_func_duty", label: "Current function duty cycle", value: 42 }
];

export function getBB3ModuleFieldTrackingRoleValue(role: string | undefined) {
    const item = BB3_MODULE_FIELD_TRACKING_ROLES.find(item => item.id == role);
    return item ? item.value : 0;
}

// a sampled field with a measurement or a field with a tracking role belongs
// to a module channel
export function hasBB3ModuleFieldChannel(variable: {
    bb3ModuleField: string | undefined;
    bb3ModuleFieldMaxSampleRate: number | undefined;
    bb3ModuleFieldMeasurement: string | undefined;
    bb3ModuleFieldTrackingRole: string | undefined;
}) {
    const hasMeasurement =
        !!variable.bb3ModuleFieldMaxSampleRate &&
        !!variable.bb3ModuleFieldMeasurement &&
        variable.bb3ModuleFieldMeasurement != "none";
    const hasTrackingRole =
        variable.bb3ModuleField != undefined &&
        variable.bb3ModuleField != "output" &&
        !!variable.bb3ModuleFieldTrackingRole &&
        variable.bb3ModuleFieldTrackingRole != "none";
    return hasMeasurement || hasTrackingRole;
}
