import { makeObservable, observable } from "mobx";
import React from "react";

import {
    ClassInfo,
    EezObject,
    IMessage,
    PropertyType,
    registerClass
} from "project-editor/core/object";
import {
    createObject,
    propertyInvalidValueMessage,
    propertyNotSetMessage
} from "project-editor/store";
import type { ProjectEditorFeature } from "project-editor/store/features";
import { DataBuffer } from "project-editor/build/data-buffer";
import { ProjectEditor } from "project-editor/project-editor-interface";
import { showGenericDialog } from "eez-studio-ui/generic-dialog";
import {
    DIB_FIELD_TYPES,
    isIntegerType,
} from "project-editor/features/variable/value-type";
import { getValueType } from "project-editor/build/values";
import type { Variable } from "project-editor/features/variable/variable";
import {
    getDibFieldMeasurementValue,
    getDibFieldUnitValue
} from "project-editor/features/variable/dib-field-unit";
import {
    SCPI_COMMAND_FLAG_QUERY,
    SCPI_COMMAND_FLAG_APPLY_ON_DIB_SYNC,
    DIB_FIELD_FLAG_PERSISTENT,
    DIB_FIELD_FLAG_SAMPLED,
    SCPI_DEFAULT_TIMEOUT_MS,
    SCPI_PARAM_FLAG_CALIBRATION_PASSWORD,
    SCPI_PARAM_FLAG_LIST,
    SCPI_PARAM_FLAG_OPTIONAL,
    SCPI_RESPONSE_ITEM_FLAG_LIST,
    getEnumIndex,
    getEnumeration,
    getModuleScpiCommands,
    getModuleScpiEnums,
    getScpiAddressing,
    getScpiAddressingKindValue,
    getScpiCommandPattern,
    getScpiResponseItems,
    getSpecialValuesMask,
    getUnitValue,
    getWireTypeMask
} from "project-editor/features/scpi/scpi-wire";

const DEFAULT_SCPI_MAX_MESSAGE_SIZE = 1024;

const DIB_MODULE_METADATA_ICON = (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path
            fill="currentColor"
            d="M9 2a1 1 0 0 1 1 1v1h4V3a1 1 0 1 1 2 0v1h.5A2.5 2.5 0 0 1 19 6.5V7h1a1 1 0 1 1 0 2h-1v2h1a1 1 0 1 1 0 2h-1v2h1a1 1 0 1 1 0 2h-1v.5a2.5 2.5 0 0 1-2.5 2.5H16v1a1 1 0 1 1-2 0v-1h-4v1a1 1 0 1 1-2 0v-1h-.5A2.5 2.5 0 0 1 5 17.5V17H4a1 1 0 1 1 0-2h1v-2H4a1 1 0 1 1 0-2h1V9H4a1 1 0 1 1 0-2h1v-.5A2.5 2.5 0 0 1 7.5 4H8V3a1 1 0 0 1 1-1Zm-1.5 4A0.5 0.5 0 0 0 7 6.5v11a0.5 0.5 0 0 0 0.5.5h9a0.5 0.5 0 0 0 0.5-0.5v-11a0.5 0.5 0 0 0-0.5-0.5h-9Z"
        />
    </svg>
);

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

class DibChannel extends EezObject {
    type: DibChannelType;

    static classInfo: ClassInfo = {
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

            return createObject<DibChannel>(
                project._store,
                { type: result.values.type },
                DibChannel
            );
        }
    };

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            type: observable
        });
    }
}

registerClass("DibChannel", DibChannel);

////////////////////////////////////////////////////////////////////////////////

export class DibModuleMetadata extends EezObject {
    moduleName: string;
    moduleBrand: string;
    moduleType: string;
    moduleRevision: string;
    firmwareVersion: string;
    channels: DibChannel[];
    scpiMaxMessageSize: number;
    // name of the float DIB field with the seconds per sample of the slot YT
    // graphs (e.g. ch_yt_view_rate), BB3+ requests the sampled fields at
    // that period
    ytRateField: string | undefined;

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
                name: "scpiMaxMessageSize",
                displayName: "SCPI max. message size (bytes)",
                type: PropertyType.Number
            },
            {
                name: "ytRateField",
                displayName: "YT rate field",
                type: PropertyType.Enum,
                enumItems: (object: DibModuleMetadata) =>
                    object.dibFields
                        .filter(variable => variable.type == "float")
                        .map(variable => ({ id: variable.name }))
            }
        ],
        defaultValue: {
            scpiMaxMessageSize: DEFAULT_SCPI_MAX_MESSAGE_SIZE
        },
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

            if (
                object.scpiMaxMessageSize != undefined &&
                (object.scpiMaxMessageSize < 64 ||
                    object.scpiMaxMessageSize > 65535)
            ) {
                messages.push(
                    propertyInvalidValueMessage(object, "scpiMaxMessageSize")
                );
            }

            if (object.ytRateField) {
                const ytRateField = object.dibFields.find(
                    variable => variable.name == object.ytRateField
                );
                if (!ytRateField || ytRateField.type != "float") {
                    messages.push(
                        propertyInvalidValueMessage(object, "ytRateField")
                    );
                }
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
            scpiMaxMessageSize: observable,
            ytRateField: observable
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

// size of the field value on the wire and in the BB3+ copy, 0 for a type
// that is not supported (the project check reports it)
function getDibFieldSize(variable: Variable) {
    const dibFieldType = DIB_FIELD_TYPES[variable.type];
    return dibFieldType ? dibFieldType.size : 0;
}

// pageNames: names of the pages in the assets (index is page id - 1), BB3+ finds
// the module pages (slot views, settings) by name
export function writeDibModuleMetadata(
    metadata: DibModuleMetadata,
    dataBuffer: DataBuffer,
    pageNames: string[]
) {
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
        })
        
        // customFields
        let offset = 0;
        dataBuffer.writeArray(metadata.dibFields, variable => {
            // valueType
            dataBuffer.writeUint16(getValueType(variable.type));

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

            // flags
            const maxSampleRate = getDibFieldMaxSampleRate(variable);
            dataBuffer.writeUint8(
                (variable.persistent ? DIB_FIELD_FLAG_PERSISTENT : 0) |
                    (maxSampleRate > 0 ? DIB_FIELD_FLAG_SAMPLED : 0)
            );

            // offset
            dataBuffer.writeUint32(offset);

            // size
            const size = getDibFieldSize(variable);
            dataBuffer.writeUint32(size);

            // name
            dataBuffer.writeStringPtr(variable.name);

            // unit
            dataBuffer.writeUint16(getDibFieldUnitValue(variable.dibFieldUnit));
            // measurement (BB3P_MEASUREMENT_...) and its module channel
            const measurement =
                maxSampleRate > 0
                    ? getDibFieldMeasurementValue(variable.dibFieldMeasurement)
                    : 0;
            dataBuffer.writeUint8(measurement);
            dataBuffer.writeUint8(
                measurement != 0 ? variable.dibFieldMeasurementChannel ?? 0 : 0
            );

            // maxSampleRate
            dataBuffer.writeFloat(maxSampleRate);

            offset += size;
        })

        writeScpiMetadata(metadata, dataBuffer);

        // pageNames
        dataBuffer.writeArray(pageNames, pageName => {
            dataBuffer.writeString(pageName);
        });

        // ytRateField
        dataBuffer.writeStringPtr(metadata.ytRateField || "");
    });
}

// samples per second, 0 if the field is not sampled
function getDibFieldMaxSampleRate(variable: Variable) {
    if (variable.type != "float" && !isIntegerType(variable.type)) {
        return 0;
    }
    return variable.dibFieldMaxSampleRate != undefined &&
        variable.dibFieldMaxSampleRate > 0
        ? variable.dibFieldMaxSampleRate
        : 0;
}

function writeScpiMetadata(metadata: DibModuleMetadata, dataBuffer: DataBuffer) {
    const project = ProjectEditor.getProject(metadata);
    const commands = getModuleScpiCommands(project);
    const enums = getModuleScpiEnums(project);

    // scpiMaxMessageSize
    dataBuffer.writeUint32(
        metadata.scpiMaxMessageSize || DEFAULT_SCPI_MAX_MESSAGE_SIZE
    );

    // scpiCommands, index is the command id on the wire
    dataBuffer.writeArray(commands, command => {
        // pattern
        dataBuffer.writeStringPtr(getScpiCommandPattern(command));
        // flags
        dataBuffer.writeUint16(
            (command.isQuery ? SCPI_COMMAND_FLAG_QUERY : 0) |
                (command.applyOnDibSync ? SCPI_COMMAND_FLAG_APPLY_ON_DIB_SYNC : 0)
        );
        // timeoutMs
        dataBuffer.writeUint16(command.timeoutMs || SCPI_DEFAULT_TIMEOUT_MS);

        // addressing
        const addressing = getScpiAddressing(command);
        dataBuffer.writeUint8(getScpiAddressingKindValue(addressing.kind));
        dataBuffer.writeUint8(addressing.index);
        dataBuffer.writeUint16(0); // reserved

        // params
        dataBuffer.writeArray(command.parameters || [], parameter => {
            const specialMask = getSpecialValuesMask(parameter.specialValues);
            // wireTypeMask
            dataBuffer.writeUint16(
                getWireTypeMask(parameter.type, specialMask != 0)
            );
            // flags
            dataBuffer.writeUint16(
                (parameter.isOptional ? SCPI_PARAM_FLAG_OPTIONAL : 0) |
                    (parameter.repeat == "list" ? SCPI_PARAM_FLAG_LIST : 0) |
                    (parameter.isCalibrationPassword
                        ? SCPI_PARAM_FLAG_CALIBRATION_PASSWORD
                        : 0)
            );
            // unit
            dataBuffer.writeUint16(getUnitValue(parameter.unit));
            // specialMask
            dataBuffer.writeUint16(specialMask);
            // enumIndex
            dataBuffer.writeUint16(
                getEnumIndex(enums, getEnumeration(parameter.type))
            );
            // reserved
            dataBuffer.writeUint16(0);
        });

        // response
        dataBuffer.writeArray(getScpiResponseItems(command), item => {
            // wireTypeMask
            dataBuffer.writeUint16(getWireTypeMask(item.types, false));
            // flags
            dataBuffer.writeUint16(
                item.repeat == "list" ? SCPI_RESPONSE_ITEM_FLAG_LIST : 0
            );
            // unit
            dataBuffer.writeUint16(getUnitValue(item.unit));
            // enumIndex
            dataBuffer.writeUint16(
                getEnumIndex(enums, getEnumeration(item.types))
            );
        });
    });

    // scpiEnums
    dataBuffer.writeArray(enums, scpiEnum => {
        // members
        dataBuffer.writeArray(scpiEnum.members, member => {
            // name
            dataBuffer.writeStringPtr(member.name);
            // value
            dataBuffer.writeInt32(parseInt(member.value) || 0);
        });
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
