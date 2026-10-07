import { computed, makeObservable, observable } from "mobx";
import React from "react";

import {
    ClassInfo,
    EezObject,
    IMessage,
    PropertyType,
    makeDerivedClassInfo,
    registerClass
} from "project-editor/core/object";
import {
    createObject,
    ProjectStore,
    propertyInvalidValueMessage,
    propertyNotSetMessage
} from "project-editor/store";
import type { ProjectEditorFeature } from "project-editor/store/features";
import { DataBuffer } from "project-editor/build/data-buffer";
import { ProjectEditor } from "project-editor/project-editor-interface";
import { showGenericDialog } from "eez-studio-ui/generic-dialog";
import { ValueType } from "eez-studio-types";
import { VariableTypeFieldComponent, variableTypeProperty } from "project-editor/features/variable/value-type";
import { validators } from "eez-studio-shared/validation";
import { validators as validatorsRenderer } from "eez-studio-shared/validation-renderer";
import { getValueType } from "project-editor/build/values";
import type { Variable } from "project-editor/features/variable/variable";

const DIB_MODULE_METADATA_ICON = (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path
            fill="currentColor"
            d="M9 2a1 1 0 0 1 1 1v1h4V3a1 1 0 1 1 2 0v1h.5A2.5 2.5 0 0 1 19 6.5V7h1a1 1 0 1 1 0 2h-1v2h1a1 1 0 1 1 0 2h-1v2h1a1 1 0 1 1 0 2h-1v.5a2.5 2.5 0 0 1-2.5 2.5H16v1a1 1 0 1 1-2 0v-1h-4v1a1 1 0 1 1-2 0v-1h-.5A2.5 2.5 0 0 1 5 17.5V17H4a1 1 0 1 1 0-2h1v-2H4a1 1 0 1 1 0-2h1V9H4a1 1 0 1 1 0-2h1v-.5A2.5 2.5 0 0 1 7.5 4H8V3a1 1 0 0 1 1-1Zm-1.5 4A0.5 0.5 0 0 0 7 6.5v11a0.5 0.5 0 0 0 0.5.5h9a0.5 0.5 0 0 0 0.5-0.5v-11a0.5 0.5 0 0 0-0.5-0.5h-9Z"
        />
    </svg>
);

////////////////////////////////////////////////////////////////////////////////

class ModuleDataItem extends EezObject {
    name: string;
    description: string;
    type: ValueType;
    direction: "input" | "output" | "input-output";

    static classInfo: ClassInfo = {
        properties: [
            {
                name: "name",
                type: PropertyType.String,
                uniqueIdentifier: true
            },
            {
                name: "description",
                type: PropertyType.MultilineText
            },
            variableTypeProperty,
            {
                name: "direction",
                type: PropertyType.Enum,
                enumItems: [
                    {
                        id: "input"
                    },
                    {
                        id: "output"
                    },
                    {
                        id: "input-output",
                        label: "Input and output"
                    }
                ]
            }
        ],
        defaultValue: {
            direction: "output"
        },
        newItem: async (parent: ModuleDataItem[]) => {
            const result = await showGenericDialog({
                dialogDefinition: {
                    title: "New Module Data Item",
                    fields: [
                        {
                            name: "name",
                            type: "string",
                            validators: [
                                validators.required,
                                validatorsRenderer.identifierValidator,
                                validators.unique({}, parent)
                            ]
                        },
                        {
                            name: "type",
                            type: VariableTypeFieldComponent,
                            validators: [validators.required]
                        },
                        {
                            name: "direction",
                            type: "enum",
                            enumItems: [
                                {
                                    id: "input",
                                    label: "Input"
                                },
                                {
                                    id: "output",
                                    label: "Output"
                                },
                                {
                                    id: "input-output",
                                    label: "Input and output"
                                }
                            ]
                        }
                    ]
                },
                values: {
                    direction: "output"
                },
                dialogContext: ProjectEditor.getProject(parent),
                modal: true,
                backdrop: "static"
            });

            const moduleDataItemProperties: Partial<ModuleDataItem> = {
                name: result.values.name,
                type: result.values.type,
                direction: result.values.direction
            };

            const project = ProjectEditor.getProject(parent);

            const moduleDataItem = createObject<ModuleDataItem>(
                project._store,
                moduleDataItemProperties,
                ModuleDataItem
            );

            return moduleDataItem;
        }
    };

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            name: observable,
            type: observable,
            direction: observable,
            description: observable
        });
    }
}

////////////////////////////////////////////////////////////////////////////////

const DIB_CHANNEL_TYPES = {
    Power: "Power",
    DigitalInput: "Digital input",
    DigitalOutput: "Digital output",
    AnalogInput: "Analog input",
    AnalogOutput: "Analog output",
    PWMSource: "PWM source",
    Relay: "Relay",
    Route: "Route",
    Temperature: "Temperature"
};

const DIB_CHANNEL_TYPE_ID = {
    Power: 0,
    DigitalInput: 1,
    DigitalOutput: 2,
    AnalogInput: 3,
    AnalogOutput: 4,
    PWMSource: 5,
    Relay: 6,
    Route: 7,
    Temperature: 8
}

type DibChannelType = keyof typeof DIB_CHANNEL_TYPES;

const CAL_POINTS_FORM_TEXT =
    "Floating point numbers separated with comma (e.g. 0.5, 1.0, 2.5).";

const CH_FEATURE_VOLT = 1 << 0;
const CH_FEATURE_CURRENT = 1 << 1;
const CH_FEATURE_POWER = 1 << 2;
const CH_FEATURE_OE = 1 << 3;
const CH_FEATURE_RPROG = 1 << 5;
const CH_FEATURE_RPOL = 1 << 6;
const CH_FEATURE_CURRENT_DUAL_RANGE = 1 << 7;
const CH_FEATURE_HW_OVP = 1 << 8;
const CH_FEATURE_COUPLING = 1 << 9;

const OVP_DEFAULT_STATE = 1 << 0;
const OCP_DEFAULT_STATE = 1 << 1;
const OPP_DEFAULT_STATE = 1 << 2;

class DibChannel extends EezObject {
    type: DibChannelType;

    static classInfo: ClassInfo = {
        getClass: function (projectStore: ProjectStore, object: DibChannel) {
            if (object.type == "Power") return PowerChannel;
            else if (object.type == "DigitalInput") return DigitalInputChannel;
            else if (object.type == "DigitalOutput")
                return DigitalOutputChannel;
            else if (object.type == "AnalogInput") return AnalogInputChannel;
            else if (object.type == "AnalogOutput") return AnalogOutputChannel;
            else if (object.type == "PWMSource") return PWMSourceChannel;
            else if (object.type == "Relay") return RelayChannel;
            else if (object.type == "Route") return RouteChannel;
            return TemperatureChannel;
        },

        properties: [
            {
                name: "type",
                type: PropertyType.Enum,
                enumItems: Object.keys(DIB_CHANNEL_TYPES).map((id: DibChannelType) => ({
                    id,
                    label: DIB_CHANNEL_TYPES[id]
                })),
                enumDisallowUndefined: true,
                hideInPropertyGrid: true
            }
        ],

        listLabel: (channel: DibChannel, collapsed: boolean) =>
            `${DIB_CHANNEL_TYPES[channel.type] ?? channel.type}`,

        newItem: async (object: DibChannel[]) => {
            const project = ProjectEditor.getProject(object);

            const result = await showGenericDialog({
                dialogDefinition: {
                    title: "New Channel",
                    fields: [
                        {
                            name: "type",
                            displayName: "Channel type",
                            type: "enum",
                            enumItems: Object.keys(DIB_CHANNEL_TYPES).map(
                                id => ({
                                    id,
                                    label: DIB_CHANNEL_TYPES[
                                        id as DibChannelType
                                    ]
                                })
                            )
                        }
                    ]
                },
                values: {
                    type: "Power"
                },
                dialogContext: project,
                modal: true,
                backdrop: "static"
            });

            const type: DibChannelType = result.values.type;
            const channelClass = DibChannel.classInfo.getClass!(
                project._store,
                { type },
                DibChannel
            ) as typeof DibChannel;

            return createObject<DibChannel>(
                project._store,
                Object.assign(
                    {
                        type
                    },
                    channelClass.classInfo.defaultValue
                ),
                channelClass
            );
        }
    };

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            type: observable
        });
    }

    writeChannelSpecificMetadata(dataBuffer: DataBuffer) {}
}

////////////////////////////////////////////////////////////////////////////////

class PowerChannel extends DibChannel {
    CH_FEATURE_VOLT: boolean;
    CH_FEATURE_CURRENT: boolean;
    CH_FEATURE_POWER: boolean;
    CH_FEATURE_OE: boolean;
    CH_FEATURE_RPROG: boolean;
    CH_FEATURE_RPOL: boolean;
    CH_FEATURE_CURRENT_DUAL_RANGE: boolean;
    CH_FEATURE_HW_OVP: boolean;
    CH_FEATURE_COUPLING: boolean;

    U_MIN: number;
    U_DEF: number;
    U_MAX: number;

    U_MIN_STEP: number;
    U_DEF_STEP: number;
    U_MAX_STEP: number;

    I_MIN: number;
    I_DEF: number;
    I_MAX: number;

    I_MON_MIN: number;

    I_MIN_STEP: number;
    I_DEF_STEP: number;
    I_MAX_STEP: number;

    I_LOW_RANGE_MAX: number;

    U_CAL_POINTS: string;
    U_CAL_I_SET: number;

    I_CAL_POINTS: string;
    I_CAL_U_SET: number;

    I_LOW_RANGE_CAL_POINTS: string;
    I_LOW_RANGE_CAL_U_SET: number;

    OVP_DEFAULT_STATE: boolean;
    OVP_MIN_DELAY: number;
    OVP_DEFAULT_DELAY: number;
    OVP_MAX_DELAY: number;

    OCP_DEFAULT_STATE: boolean;
    OCP_MIN_DELAY: number;
    OCP_DEFAULT_DELAY: number;
    OCP_MAX_DELAY: number;

    OPP_DEFAULT_STATE: boolean;
    OPP_MIN_DELAY: number;
    OPP_DEFAULT_DELAY: number;
    OPP_MAX_DELAY: number;
    OPP_MIN_LEVEL: number;
    OPP_DEFAULT_LEVEL: number;

    PTOT: number;

    U_RESOLUTION: number;
    U_RESOLUTION_DURING_CALIBRATION: number;
    I_RESOLUTION: number;
    I_RESOLUTION_DURING_CALIBRATION: number;
    I_LOW_RESOLUTION: number;
    I_LOW_RESOLUTION_DURING_CALIBRATION: number;
    P_RESOLUTION: number;

    VOLTAGE_GND_OFFSET: number;
    CURRENT_GND_OFFSET: number;

    CALIBRATION_DATA_TOLERANCE_PERCENT: number;

    CALIBRATION_MID_TOLERANCE_PERCENT: number;

    MON_REFRESH_RATE_MS: number;

    U_RAMP_DURATION_MIN_VALUE: number;

    OCP_TRIP_LEVEL_PERCENT: number;
    OCP_TRIP_LEVEL_PERCENT_MIN_VALUE_HIGH_RANGE: number;
    OCP_TRIP_LEVEL_PERCENT_MIN_VALUE_LOW_RANGE: number;

    static classInfo = makeDerivedClassInfo(DibChannel.classInfo, {
        properties: [
            {
                name: "CH_FEATURE_VOLT",
                type: PropertyType.Boolean,
                checkboxStyleSwitch: true
            },
            {
                name: "CH_FEATURE_CURRENT",
                type: PropertyType.Boolean,
                checkboxStyleSwitch: true
            },
            {
                name: "CH_FEATURE_POWER",
                type: PropertyType.Boolean,
                checkboxStyleSwitch: true
            },
            {
                name: "CH_FEATURE_OE",
                type: PropertyType.Boolean,
                checkboxStyleSwitch: true
            },
            {
                name: "CH_FEATURE_RPROG",
                type: PropertyType.Boolean,
                checkboxStyleSwitch: true
            },
            {
                name: "CH_FEATURE_RPOL",
                type: PropertyType.Boolean,
                checkboxStyleSwitch: true
            },
            {
                name: "CH_FEATURE_CURRENT_DUAL_RANGE",
                type: PropertyType.Boolean,
                checkboxStyleSwitch: true
            },
            {
                name: "CH_FEATURE_HW_OVP",
                type: PropertyType.Boolean,
                checkboxStyleSwitch: true
            },
            {
                name: "CH_FEATURE_COUPLING",
                type: PropertyType.Boolean,
                checkboxStyleSwitch: true
            },

            { name: "U_MIN", type: PropertyType.Number },
            { name: "U_DEF", type: PropertyType.Number },
            { name: "U_MAX", type: PropertyType.Number },

            { name: "U_MIN_STEP", type: PropertyType.Number },
            { name: "U_DEF_STEP", type: PropertyType.Number },
            { name: "U_MAX_STEP", type: PropertyType.Number },

            { name: "I_MIN", type: PropertyType.Number },
            { name: "I_DEF", type: PropertyType.Number },
            { name: "I_MAX", type: PropertyType.Number },

            { name: "I_MON_MIN", type: PropertyType.Number },

            { name: "I_MIN_STEP", type: PropertyType.Number },
            { name: "I_DEF_STEP", type: PropertyType.Number },
            { name: "I_MAX_STEP", type: PropertyType.Number },

            { name: "I_LOW_RANGE_MAX", type: PropertyType.Number },

            {
                name: "U_CAL_POINTS",
                type: PropertyType.String,
                monospaceFont: true,
                formText: CAL_POINTS_FORM_TEXT
            },
            { name: "U_CAL_I_SET", type: PropertyType.Number },

            {
                name: "I_CAL_POINTS",
                type: PropertyType.String,
                monospaceFont: true,
                formText: CAL_POINTS_FORM_TEXT
            },
            { name: "I_CAL_U_SET", type: PropertyType.Number },

            {
                name: "I_LOW_RANGE_CAL_POINTS",
                type: PropertyType.String,
                monospaceFont: true,
                formText: CAL_POINTS_FORM_TEXT
            },
            { name: "I_LOW_RANGE_CAL_U_SET", type: PropertyType.Number },

            {
                name: "OVP_DEFAULT_STATE",
                type: PropertyType.Boolean,
                checkboxStyleSwitch: true
            },
            { name: "OVP_MIN_DELAY", type: PropertyType.Number },
            { name: "OVP_DEFAULT_DELAY", type: PropertyType.Number },
            { name: "OVP_MAX_DELAY", type: PropertyType.Number },

            {
                name: "OCP_DEFAULT_STATE",
                type: PropertyType.Boolean,
                checkboxStyleSwitch: true
            },
            { name: "OCP_MIN_DELAY", type: PropertyType.Number },
            { name: "OCP_DEFAULT_DELAY", type: PropertyType.Number },
            { name: "OCP_MAX_DELAY", type: PropertyType.Number },

            {
                name: "OPP_DEFAULT_STATE",
                type: PropertyType.Boolean,
                checkboxStyleSwitch: true
            },
            { name: "OPP_MIN_DELAY", type: PropertyType.Number },
            { name: "OPP_DEFAULT_DELAY", type: PropertyType.Number },
            { name: "OPP_MAX_DELAY", type: PropertyType.Number },
            { name: "OPP_MIN_LEVEL", type: PropertyType.Number },
            { name: "OPP_DEFAULT_LEVEL", type: PropertyType.Number },

            { name: "PTOT", type: PropertyType.Number },

            { name: "U_RESOLUTION", type: PropertyType.Number },
            { name: "U_RESOLUTION_DURING_CALIBRATION", type: PropertyType.Number },
            { name: "I_RESOLUTION", type: PropertyType.Number },
            { name: "I_RESOLUTION_DURING_CALIBRATION", type: PropertyType.Number },
            { name: "I_LOW_RESOLUTION", type: PropertyType.Number },
            { name: "I_LOW_RESOLUTION_DURING_CALIBRATION", type: PropertyType.Number },
            { name: "P_RESOLUTION", type: PropertyType.Number },

            { name: "VOLTAGE_GND_OFFSET", type: PropertyType.Number },
            { name: "CURRENT_GND_OFFSET", type: PropertyType.Number },

            { name: "CALIBRATION_DATA_TOLERANCE_PERCENT", type: PropertyType.Number },

            { name: "CALIBRATION_MID_TOLERANCE_PERCENT", type: PropertyType.Number },

            { name: "MON_REFRESH_RATE_MS", type: PropertyType.Number },

            { name: "U_RAMP_DURATION_MIN_VALUE", type: PropertyType.Number },

            { name: "OCP_TRIP_LEVEL_PERCENT", type: PropertyType.Number },
            { name: "OCP_TRIP_LEVEL_PERCENT_MIN_VALUE_HIGH_RANGE", type: PropertyType.Number },
            { name: "OCP_TRIP_LEVEL_PERCENT_MIN_VALUE_LOW_RANGE", type: PropertyType.Number }
        ],

        check: (channel: PowerChannel, messages: IMessage[]) => {
            if (!parseCalPoints(channel.U_CAL_POINTS)) {
                messages.push(
                    propertyInvalidValueMessage(channel, "U_CAL_POINTS")
                );
            }

            if (!parseCalPoints(channel.I_CAL_POINTS)) {
                messages.push(
                    propertyInvalidValueMessage(channel, "I_CAL_POINTS")
                );
            }

            if (!parseCalPoints(channel.I_LOW_RANGE_CAL_POINTS)) {
                messages.push(
                    propertyInvalidValueMessage(
                        channel,
                        "I_LOW_RANGE_CAL_POINTS"
                    )
                );
            }

            if (
                !Number.isInteger(channel.MON_REFRESH_RATE_MS) ||
                channel.MON_REFRESH_RATE_MS < 0 ||
                channel.MON_REFRESH_RATE_MS > 0xffffffff
            ) {
                messages.push(
                    propertyInvalidValueMessage(channel, "MON_REFRESH_RATE_MS")
                );
            }
        },

        defaultValue: {
            CH_FEATURE_VOLT: true,
            CH_FEATURE_CURRENT: true,
            CH_FEATURE_POWER: true,
            CH_FEATURE_OE: true,
            CH_FEATURE_RPROG: true,
            CH_FEATURE_RPOL: true,
            CH_FEATURE_CURRENT_DUAL_RANGE: true,
            CH_FEATURE_HW_OVP: true,
            CH_FEATURE_COUPLING: true,

            U_MIN: 0,
            U_DEF: 0,
            U_MAX: 0,

            U_MIN_STEP: 0,
            U_DEF_STEP: 0,
            U_MAX_STEP: 0,

            I_MIN: 0,
            I_DEF: 0,
            I_MAX: 0,

            I_MON_MIN: 0,

            I_MIN_STEP: 0,
            I_DEF_STEP: 0,
            I_MAX_STEP: 0,

            I_LOW_RANGE_MAX: 0,

            U_CAL_POINTS: "",
            U_CAL_I_SET: 0,

            I_CAL_POINTS: "",
            I_CAL_U_SET: 0,

            I_LOW_RANGE_CAL_POINTS: "",
            I_LOW_RANGE_CAL_U_SET: 0,

            OVP_DEFAULT_STATE: false,
            OVP_MIN_DELAY: 0,
            OVP_DEFAULT_DELAY: 0,
            OVP_MAX_DELAY: 0,

            OCP_DEFAULT_STATE: false,
            OCP_MIN_DELAY: 0,
            OCP_DEFAULT_DELAY: 0,
            OCP_MAX_DELAY: 0,

            OPP_DEFAULT_STATE: false,
            OPP_MIN_DELAY: 0,
            OPP_DEFAULT_DELAY: 0,
            OPP_MAX_DELAY: 0,
            OPP_MIN_LEVEL: 0,
            OPP_DEFAULT_LEVEL: 0,

            PTOT: 0,

            U_RESOLUTION: 0,
            U_RESOLUTION_DURING_CALIBRATION: 0,
            I_RESOLUTION: 0,
            I_RESOLUTION_DURING_CALIBRATION: 0,
            I_LOW_RESOLUTION: 0,
            I_LOW_RESOLUTION_DURING_CALIBRATION: 0,
            P_RESOLUTION: 0,

            VOLTAGE_GND_OFFSET: 0,
            CURRENT_GND_OFFSET: 0,

            CALIBRATION_DATA_TOLERANCE_PERCENT: 0,

            CALIBRATION_MID_TOLERANCE_PERCENT: 0,

            MON_REFRESH_RATE_MS: 0,

            U_RAMP_DURATION_MIN_VALUE: 0,

            OCP_TRIP_LEVEL_PERCENT: 0,
            OCP_TRIP_LEVEL_PERCENT_MIN_VALUE_HIGH_RANGE: 0,
            OCP_TRIP_LEVEL_PERCENT_MIN_VALUE_LOW_RANGE: 0
        }
    });

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            CH_FEATURE_VOLT: observable,
            CH_FEATURE_CURRENT: observable,
            CH_FEATURE_POWER: observable,
            CH_FEATURE_OE: observable,
            CH_FEATURE_RPROG: observable,
            CH_FEATURE_RPOL: observable,
            CH_FEATURE_CURRENT_DUAL_RANGE: observable,
            CH_FEATURE_HW_OVP: observable,
            CH_FEATURE_COUPLING: observable,

            U_MIN: observable,
            U_DEF: observable,
            U_MAX: observable,

            U_MIN_STEP: observable,
            U_DEF_STEP: observable,
            U_MAX_STEP: observable,

            I_MIN: observable,
            I_DEF: observable,
            I_MAX: observable,

            I_MON_MIN: observable,

            I_MIN_STEP: observable,
            I_DEF_STEP: observable,
            I_MAX_STEP: observable,

            I_LOW_RANGE_MAX: observable,

            U_CAL_POINTS: observable,
            U_CAL_I_SET: observable,

            I_CAL_POINTS: observable,
            I_CAL_U_SET: observable,

            I_LOW_RANGE_CAL_POINTS: observable,
            I_LOW_RANGE_CAL_U_SET: observable,

            OVP_DEFAULT_STATE: observable,
            OVP_MIN_DELAY: observable,
            OVP_DEFAULT_DELAY: observable,
            OVP_MAX_DELAY: observable,

            OCP_DEFAULT_STATE: observable,
            OCP_MIN_DELAY: observable,
            OCP_DEFAULT_DELAY: observable,
            OCP_MAX_DELAY: observable,

            OPP_DEFAULT_STATE: observable,
            OPP_MIN_DELAY: observable,
            OPP_DEFAULT_DELAY: observable,
            OPP_MAX_DELAY: observable,
            OPP_MIN_LEVEL: observable,
            OPP_DEFAULT_LEVEL: observable,

            PTOT: observable,

            U_RESOLUTION: observable,
            U_RESOLUTION_DURING_CALIBRATION: observable,
            I_RESOLUTION: observable,
            I_RESOLUTION_DURING_CALIBRATION: observable,
            I_LOW_RESOLUTION: observable,
            I_LOW_RESOLUTION_DURING_CALIBRATION: observable,
            P_RESOLUTION: observable,

            VOLTAGE_GND_OFFSET: observable,
            CURRENT_GND_OFFSET: observable,

            CALIBRATION_DATA_TOLERANCE_PERCENT: observable,

            CALIBRATION_MID_TOLERANCE_PERCENT: observable,

            MON_REFRESH_RATE_MS: observable,

            U_RAMP_DURATION_MIN_VALUE: observable,

            OCP_TRIP_LEVEL_PERCENT: observable,
            OCP_TRIP_LEVEL_PERCENT_MIN_VALUE_HIGH_RANGE: observable,
            OCP_TRIP_LEVEL_PERCENT_MIN_VALUE_LOW_RANGE: observable,

            uCalPoints: computed,
            iCalPoints: computed,
            iLowRangeCalPoints: computed
        });
    }

    get uCalPoints(): number[] {
        return parseCalPoints(this.U_CAL_POINTS) ?? [];
    }

    get iCalPoints(): number[] {
        return parseCalPoints(this.I_CAL_POINTS) ?? [];
    }

    get iLowRangeCalPoints(): number[] {
        return parseCalPoints(this.I_LOW_RANGE_CAL_POINTS) ?? [];
    }

    writeChannelSpecificMetadata(dataBuffer: DataBuffer) {
        dataBuffer.writeUint32(
            (this.CH_FEATURE_VOLT ? CH_FEATURE_VOLT : 0) |
            (this.CH_FEATURE_CURRENT ? CH_FEATURE_CURRENT : 0) |
            (this.CH_FEATURE_POWER ? CH_FEATURE_POWER : 0) |
            (this.CH_FEATURE_OE ? CH_FEATURE_OE : 0) |
            (this.CH_FEATURE_RPROG ? CH_FEATURE_RPROG : 0) |
            (this.CH_FEATURE_RPOL ? CH_FEATURE_RPOL : 0) |
            (this.CH_FEATURE_CURRENT_DUAL_RANGE ? CH_FEATURE_CURRENT_DUAL_RANGE : 0) |
            (this.CH_FEATURE_HW_OVP ? CH_FEATURE_HW_OVP : 0) |
            (this.CH_FEATURE_COUPLING ? CH_FEATURE_COUPLING : 0)
        );

        dataBuffer.writeFloat(this.U_MIN);
        dataBuffer.writeFloat(this.U_DEF);
        dataBuffer.writeFloat(this.U_MAX);

        dataBuffer.writeFloat(this.U_MIN_STEP);
        dataBuffer.writeFloat(this.U_DEF_STEP);
        dataBuffer.writeFloat(this.U_MAX_STEP);

        dataBuffer.writeFloat(this.I_MIN);
        dataBuffer.writeFloat(this.I_DEF);
        dataBuffer.writeFloat(this.I_MAX);

        dataBuffer.writeFloat(this.I_MON_MIN);

        dataBuffer.writeFloat(this.I_MIN_STEP);
        dataBuffer.writeFloat(this.I_DEF_STEP);
        dataBuffer.writeFloat(this.I_MAX_STEP);

        dataBuffer.writeFloat(this.I_LOW_RANGE_MAX);

        dataBuffer.writeNumberArray(this.uCalPoints, (calPoint) => {
            dataBuffer.writeFloat(calPoint);
        })
        dataBuffer.writeFloat(this.U_CAL_I_SET);

        dataBuffer.writeNumberArray(this.iCalPoints, (calPoint) => {
            dataBuffer.writeFloat(calPoint);
        })
        dataBuffer.writeFloat(this.I_CAL_U_SET);

        dataBuffer.writeNumberArray(this.iLowRangeCalPoints, (calPoint) => {
            dataBuffer.writeFloat(calPoint);
        })
        dataBuffer.writeFloat(this.I_LOW_RANGE_CAL_U_SET);

        dataBuffer.writeUint32(
            (this.OVP_DEFAULT_STATE ? OVP_DEFAULT_STATE : 0) |
            (this.OCP_DEFAULT_STATE ? OCP_DEFAULT_STATE : 0) |
            (this.OPP_DEFAULT_STATE ? OPP_DEFAULT_STATE : 0)
        );

        dataBuffer.writeFloat(this.OVP_MIN_DELAY);
        dataBuffer.writeFloat(this.OVP_DEFAULT_DELAY);
        dataBuffer.writeFloat(this.OVP_MAX_DELAY);

        dataBuffer.writeFloat(this.OCP_MIN_DELAY);
        dataBuffer.writeFloat(this.OCP_DEFAULT_DELAY);
        dataBuffer.writeFloat(this.OCP_MAX_DELAY);

        dataBuffer.writeFloat(this.OPP_MIN_DELAY);
        dataBuffer.writeFloat(this.OPP_DEFAULT_DELAY);
        dataBuffer.writeFloat(this.OPP_MAX_DELAY);
        dataBuffer.writeFloat(this.OPP_MIN_LEVEL);
        dataBuffer.writeFloat(this.OPP_DEFAULT_LEVEL);

        dataBuffer.writeFloat(this.PTOT);

        dataBuffer.writeFloat(this.U_RESOLUTION);
        dataBuffer.writeFloat(this.U_RESOLUTION_DURING_CALIBRATION);
        dataBuffer.writeFloat(this.I_RESOLUTION);
        dataBuffer.writeFloat(this.I_RESOLUTION_DURING_CALIBRATION);
        dataBuffer.writeFloat(this.I_LOW_RESOLUTION);
        dataBuffer.writeFloat(this.I_LOW_RESOLUTION_DURING_CALIBRATION);
        dataBuffer.writeFloat(this.P_RESOLUTION);

        dataBuffer.writeFloat(this.VOLTAGE_GND_OFFSET);
        dataBuffer.writeFloat(this.CURRENT_GND_OFFSET);

        dataBuffer.writeFloat(this.CALIBRATION_DATA_TOLERANCE_PERCENT);

        dataBuffer.writeFloat(this.CALIBRATION_MID_TOLERANCE_PERCENT);

        dataBuffer.writeUint32(this.MON_REFRESH_RATE_MS);

        dataBuffer.writeFloat(this.U_RAMP_DURATION_MIN_VALUE);

        dataBuffer.writeFloat(this.OCP_TRIP_LEVEL_PERCENT);
        dataBuffer.writeFloat(this.OCP_TRIP_LEVEL_PERCENT_MIN_VALUE_HIGH_RANGE);
        dataBuffer.writeFloat(this.OCP_TRIP_LEVEL_PERCENT_MIN_VALUE_LOW_RANGE);        
    }
}

registerClass("DibPowerChannel", PowerChannel);

////////////////////////////////////////////////////////////////////////////////

class DigitalInputChannel extends DibChannel {
    // no aditional properties for now
    static classInfo = makeDerivedClassInfo(DibChannel.classInfo, {
        properties: []
    });

    writeChannelSpecificMetadata(dataBuffer: DataBuffer) {
    }
}

registerClass("DibDigitalInputChannel", DigitalInputChannel);

////////////////////////////////////////////////////////////////////////////////

class DigitalOutputChannel extends DibChannel {
    // no aditional properties for now
    static classInfo = makeDerivedClassInfo(DibChannel.classInfo, {
        properties: []
    });

    writeChannelSpecificMetadata(dataBuffer: DataBuffer) {
    }
}

registerClass("DibDigitalOutputChannel", DigitalOutputChannel);

////////////////////////////////////////////////////////////////////////////////

class AnalogInputChannel extends DibChannel {
    // no aditional properties for now
    static classInfo = makeDerivedClassInfo(DibChannel.classInfo, {
        properties: []
    });

    writeChannelSpecificMetadata(dataBuffer: DataBuffer) {
    }
}

registerClass("DibAnalogInputChannel", AnalogInputChannel);

////////////////////////////////////////////////////////////////////////////////

class AnalogOutputChannel extends DibChannel {
    // no aditional properties for now
    static classInfo = makeDerivedClassInfo(DibChannel.classInfo, {
        properties: []
    });

    writeChannelSpecificMetadata(dataBuffer: DataBuffer) {
    }
}

registerClass("DibAnalogOutputChannel", AnalogOutputChannel);

////////////////////////////////////////////////////////////////////////////////

class PWMSourceChannel extends DibChannel {
    MIN_FREQUENCY: number;
    MAX_FREQUENCY: number;

    static classInfo = makeDerivedClassInfo(DibChannel.classInfo, {
        properties: [
            { name: "MIN_FREQUENCY", type: PropertyType.Number },
            { name: "MAX_FREQUENCY", type: PropertyType.Number }
        ],

        defaultValue: {
            MIN_FREQUENCY: 0,
            MAX_FREQUENCY: 0
        }
    });

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            MIN_FREQUENCY: observable,
            MAX_FREQUENCY: observable
        });
    }

    writeChannelSpecificMetadata(dataBuffer: DataBuffer) {
        dataBuffer.writeFloat(this.MIN_FREQUENCY);
        dataBuffer.writeFloat(this.MAX_FREQUENCY);
    }

}

registerClass("DibPWMSourceChannel", PWMSourceChannel);

////////////////////////////////////////////////////////////////////////////////

class RelayChannel extends DibChannel {
    // no aditional properties for now
    static classInfo = makeDerivedClassInfo(DibChannel.classInfo, {
        properties: []
    });

    writeChannelSpecificMetadata(dataBuffer: DataBuffer) {
    }
}

registerClass("DibRelayChannel", RelayChannel);

////////////////////////////////////////////////////////////////////////////////

class RouteChannel extends DibChannel {
    // no aditional properties for now
    static classInfo = makeDerivedClassInfo(DibChannel.classInfo, {
        properties: []
    });

    writeChannelSpecificMetadata(dataBuffer: DataBuffer) {
    }
}

registerClass("DibRouteChannel", RouteChannel);

////////////////////////////////////////////////////////////////////////////////

class TemperatureChannel extends DibChannel {
    // no aditional properties for now
    static classInfo = makeDerivedClassInfo(DibChannel.classInfo, {
        properties: []
    });

    writeChannelSpecificMetadata(dataBuffer: DataBuffer) {
    }
}

registerClass("DibTemperatureChannel", TemperatureChannel);

////////////////////////////////////////////////////////////////////////////////

export class DibModuleMetadata extends EezObject {
    moduleName: string;
    moduleBrand: string;
    moduleType: string;
    moduleRevision: string;
    firmwareVersion: string;
    channels: DibChannel[];
    moduleDataItems: ModuleDataItem[];

    static classInfo: ClassInfo = {
        properties: [
            {
                name: "moduleName",
                type: PropertyType.String
            },
            {
                name: "moduleBrand",
                type: PropertyType.String
            },
            {
                name: "moduleType",
                type: PropertyType.String,
                monospaceFont: true
            },
            {
                name: "moduleRevision",
                type: PropertyType.String,
                monospaceFont: true
            },
            {
                name: "firmwareVersion",
                type: PropertyType.String,
                monospaceFont: true
            },
            {
                name: "channels",
                type: PropertyType.Array,
                typeClass: DibChannel,
                partOfNavigation: false,
                enumerable: false,
                defaultValue: []
            },
            {
                name: "moduleDataItems",
                type: PropertyType.Array,
                typeClass: ModuleDataItem
            }
        ],
        icon: DIB_MODULE_METADATA_ICON,
        check: (object: DibModuleMetadata, messages: IMessage[]) => {
            if (!object.moduleName) {
                messages.push(propertyNotSetMessage(object, "moduleName"));
            }

            if (!object.moduleBrand) {
                messages.push(propertyNotSetMessage(object, "moduleBrand"));
            }

            if (!isValidHex(object.moduleType, 16)) {
                messages.push(
                    propertyInvalidValueMessage(object, "moduleType")
                );
            }

            if (!isValidHex(object.moduleRevision, 16)) {
                messages.push(
                    propertyInvalidValueMessage(object, "moduleRevision")
                );
            }

            if (!isValidHex(object.firmwareVersion, 16)) {
                messages.push(
                    propertyInvalidValueMessage(object, "firmwareVersion")
                );
            }
        }
    };

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            moduleName: observable,
            moduleBrand: observable,
            moduleType: observable,
            moduleRevision: observable,
            firmwareVersion: observable,
            channels: observable,
            moduleDataItems: observable
        });
    }

    get moduleTypeNum() {
        return isValidHex(this.moduleType, 16)
            ? parseInt(this.moduleType, 16)
            : 0;
    }

    get moduleRevisionNum() {
        return isValidHex(this.moduleRevision, 16)
            ? parseInt(this.moduleRevision, 16)
            : 0;
    }

    get firmwareVersionNum() {
        return isValidHex(this.firmwareVersion, 16)
            ? parseInt(this.firmwareVersion, 16)
            : 0;
    }

    get dibFields() {
        const project = ProjectEditor.getProject(this);
        return project.variables.globalVariables.filter(
            globalVariable => globalVariable.dibField != undefined
        );
    }

    getDibFieldIndex(name: string) {
        return this.dibFields.findIndex(
            globalVariable => globalVariable.name == name
        );
    }
}

registerClass("DibModuleMetadata", DibModuleMetadata);

////////////////////////////////////////////////////////////////////////////////

const DIB_METADATA_SPECIFICATION_VERSION_1 = 1;

function getDibFieldSize(variable: Variable) {
    if (variable.type == "float") {
        return 4;
    }
    if (variable.type == "integer") {
        return 4;
    }    
    return 0;
}

export function writeDibModuleMetadata(metadata: DibModuleMetadata, dataBuffer: DataBuffer) {
    dataBuffer.writeObjectOffset(() => {
        // version
        dataBuffer.writeUint16(DIB_METADATA_SPECIFICATION_VERSION_1);
        // moduleType
        dataBuffer.writeUint16(metadata.moduleTypeNum);
        // moduleRevision
        dataBuffer.writeUint16(metadata.moduleRevisionNum);
        // firmwareVersion
        dataBuffer.writeUint16(metadata.firmwareVersionNum);
        // moduleName
        dataBuffer.writeStringPtr(metadata.moduleName);
        // moduleBrand
        dataBuffer.writeStringPtr(metadata.moduleBrand);

        // channels
        dataBuffer.writeArray(metadata.channels, channel => {
            // type
            dataBuffer.writeUint16(DIB_CHANNEL_TYPE_ID[channel.type]);
            // reserved
            dataBuffer.writeUint16(0); // reserved

            channel.writeChannelSpecificMetadata(dataBuffer);
        })
        
        // customFields
        let offset = 0;
        dataBuffer.writeArray(metadata.dibFields, variable => {
            // valueType
            dataBuffer.writeUint8(getValueType(variable.type));

            // direction
            const DIB_FIELD_DIRECTION_INPUT = 0;
            const DIB_FIELD_DIRECTION_OUTPUT = 1;
            const DIB_FIELD_DIRECTION_INPUT_OUTPUT = 2;
            dataBuffer.writeUint8(
                variable.dibField == "input"
                    ? DIB_FIELD_DIRECTION_INPUT
                    : variable.dibField == "output"
                      ? DIB_FIELD_DIRECTION_OUTPUT
                      : DIB_FIELD_DIRECTION_INPUT_OUTPUT
            );

            // reserved
            dataBuffer.writeUint16(0);

            // offset
            dataBuffer.writeUint32(offset);

            // size
            const size = getDibFieldSize(variable);
            dataBuffer.writeUint32(size);

            // name
            dataBuffer.writeStringPtr(variable.name);

            offset += size;
        })        
    });
}

////////////////////////////////////////////////////////////////////////////////

function isValidHex(value: string | undefined, numBits: number) {
    if (!value) {
        return false;
    }

    if (!/^[0-9a-fA-F]+$/.test(value)) {
        return false;
    }

    return parseInt(value, 16) <= Math.pow(2, numBits) - 1;
}

// returns undefined if value is not valid
function parseCalPoints(value: string | undefined) {
    if (!value || !value.trim()) {
        return [];
    }

    const calPoints: number[] = [];

    for (const item of value.split(",")) {
        const trimmed = item.trim();
        if (!/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(trimmed)) {
            return undefined;
        }
        calPoints.push(parseFloat(trimmed));
    }

    return calPoints;
}

////////////////////////////////////////////////////////////////////////////////

const feature: ProjectEditorFeature = {
    name: "eezstudio-project-feature-dib-module-metadata",
    version: "0.1.0",
    description: "DIB module metadata",
    author: "EEZ",
    authorLogo: "../eez-studio-ui/_images/eez_logo.png",
    displayName: "DIB Module Metadata",
    mandatory: false,
    key: "dibModuleMetadata",
    type: PropertyType.Object,
    typeClass: DibModuleMetadata,
    icon: DIB_MODULE_METADATA_ICON,
    create: () => ({})
};

export default feature;
