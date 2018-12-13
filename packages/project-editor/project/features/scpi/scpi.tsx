import React from "react";
import { observable, computed } from "mobx";
import { bind } from "bind-decorator";

import { humanize } from "eez-studio-shared/string";

import { validators } from "eez-studio-shared/model/validation";
import * as output from "eez-studio-shared/model/output";

import styled from "eez-studio-ui/styled-components";
import { showGenericDialog, FieldComponent } from "eez-studio-ui/generic-dialog";

import {
    ClassInfo,
    registerClass,
    EezObject,
    EezArrayObject,
    PropertyType,
    PropertyInfo,
    asArray,
    getChildOfObject
} from "eez-studio-shared/model/object";

import { registerFeatureImplementation } from "project-editor/core/extensions";

import { ScpiNavigation } from "project-editor/project/features/scpi/ScpiNavigation";
import { ScpiSubsystemsNavigation } from "project-editor/project/features/scpi/ScpiSubsystemsNavigation";
import { ScpiEnumsNavigation } from "project-editor/project/features/scpi/ScpiEnumsNavigation";
import { build } from "project-editor/project/features/scpi/build";
import { metrics } from "project-editor/project/features/scpi/metrics";
import showEnumsDialog from "project-editor/project/features/scpi/EnumsDialog";

////////////////////////////////////////////////////////////////////////////////

export class ScpiEnumMember extends EezObject {
    @observable
    name: string;

    @observable
    value: string;

    static classInfo: ClassInfo = {
        properties: [
            {
                name: "name",
                type: PropertyType.String
            },
            {
                name: "value",
                type: PropertyType.String
            }
        ],

        defaultValue: {}
    };

    check(object: EezObject) {
        const messages: output.Message[] = [];

        if (this.name) {
            const arr = asArray<ScpiEnumMember>(this._parent!);
            let thisIndex = -1;
            let otherIndex = -1;
            for (let i = 0; i < arr.length; ++i) {
                if (arr[i] === this) {
                    thisIndex = i;
                } else if (arr[i] !== this && arr[i].name === this.name) {
                    otherIndex = i;
                }
            }
            if (otherIndex !== -1 && thisIndex > otherIndex) {
                messages.push(
                    new output.Message(
                        output.Type.ERROR,
                        `Member name '${this.name}' is not unique`,
                        getChildOfObject(this, "name")
                    )
                );
            }
        } else {
            messages.push(output.propertyNotSetMessage(this, "name"));
        }

        if (this.value) {
            const arr = asArray<ScpiEnumMember>(this._parent!);
            let thisIndex = -1;
            let otherIndex = -1;
            for (let i = 0; i < arr.length; ++i) {
                if (arr[i] === this) {
                    thisIndex = i;
                } else if (arr[i] !== this && arr[i].value === this.value) {
                    otherIndex = i;
                }
            }
            if (otherIndex !== -1 && thisIndex > otherIndex) {
                messages.push(
                    new output.Message(
                        output.Type.ERROR,
                        `Value '${this.value}' is not unique`,
                        getChildOfObject(this, "value")
                    )
                );
            }
        } else {
            messages.push(output.propertyNotSetMessage(this, "value"));
        }

        return messages;
    }
}

////////////////////////////////////////////////////////////////////////////////

export class ScpiEnum extends EezObject {
    @observable
    name: string;

    @observable
    members: EezArrayObject<ScpiEnumMember>;

    static classInfo: ClassInfo = {
        properties: [
            {
                name: "name",
                type: PropertyType.String,
                unique: true
            },
            {
                name: "members",
                type: PropertyType.Array,
                typeClass: ScpiEnumMember
            }
        ],
        newItem: (parent: EezObject) => {
            return showGenericDialog({
                dialogDefinition: {
                    title: "New Enumaration",
                    fields: [
                        {
                            name: "name",
                            type: "string",
                            validators: [
                                validators.required,
                                validators.unique({}, asArray(parent))
                            ]
                        }
                    ]
                },
                values: {}
            }).then(result => {
                return Promise.resolve({
                    name: result.values.name
                });
            });
        },
        navigationComponent: ScpiEnumsNavigation,
        navigationComponentId: "scpi-enums",
        icon: "format_list_numbered"
    };
}

////////////////////////////////////////////////////////////////////////////////

type ScpiTypeType = "nr1" | "nr2" | "nr3" | "boolean" | "string" | "discrete";

interface IScpiType {
    type: ScpiTypeType;
    enumRef?: string;
}

export class ScpiType extends EezObject implements IScpiType {
    @observable
    type: ScpiTypeType;

    @observable
    enumRef?: string;

    static classInfo: ClassInfo = {
        label: (scpiType: ScpiType) => {
            if (scpiType.type === "nr1") {
                return "NR1 Numeric";
            } else if (scpiType.type === "nr2") {
                return "NR2 Numeric";
            } else if (scpiType.type === "nr3") {
                return "NR3 Numeric";
            } else if (scpiType.type === "discrete") {
                return `Discrete<${scpiType.enumRef || ""}>`;
            } else {
                return humanize(scpiType.type);
            }
        },
        properties: [
            {
                name: "type",
                type: PropertyType.Enum,
                enumItems: [
                    { id: "Numeric" },
                    { id: "Discrete" },
                    { id: "Boolean" },
                    { id: "String" }
                ]
            },
            {
                name: "enumRef",
                type: PropertyType.ObjectReference,
                referencedObjectCollectionPath: ["scpi", "enums"]
            }
        ],
        defaultValue: {
            type: "Numeric"
        }
    };
}

function getScpiType(object: ScpiParameter | ScpiResponse, type: ScpiTypeType) {
    return object.type._array.find(scpiType => scpiType.type === type);
}

function isScpiType(object: ScpiParameter | ScpiResponse, type: ScpiTypeType) {
    return !!getScpiType(object, type);
}

function getNumericType(object: ScpiParameter | ScpiResponse) {
    if (isScpiType(object, "nr1")) {
        return "nr1";
    } else if (isScpiType(object, "nr2")) {
        return "nr2";
    } else if (isScpiType(object, "nr3")) {
        return "nr3";
    }
    return undefined;
}

function getDiscreteTypeEnumeration(object: ScpiParameter | ScpiResponse) {
    const discreteType = getScpiType(object, "discrete");
    if (discreteType) {
        return discreteType.enumRef;
    }
    return undefined;
}

class ScpiEnumSelectFieldComponent extends FieldComponent {
    @bind
    onSelect() {
        showEnumsDialog(value => {
            this.props.onChange(value);
        });
    }

    render() {
        return (
            <div className="input-group">
                <input
                    type="text"
                    className="form-control"
                    value={this.props.values[this.props.fieldProperties.name] || ""}
                    readOnly
                />
                <div className="input-group-append">
                    <button className="btn btn-secondary" type="button" onClick={this.onSelect}>
                        &hellip;
                    </button>
                </div>
            </div>
        );
    }
}

const typePropertyInfo = {
    name: "type",
    type: PropertyType.Array,
    typeClass: ScpiType,
    defaultValue: [],
    onSelect: async (object: ScpiParameter | ScpiResponse, propertyInfo: PropertyInfo) => {
        const result = await showGenericDialog({
            dialogDefinition: {
                title: "Select one or more type",
                size: "small",
                fields: [
                    {
                        name: "numeric",
                        type: "boolean"
                    },
                    {
                        name: "numericType",
                        type: "enum",
                        enumItems: [
                            { id: "nr1", label: "NR1" },
                            { id: "nr2", label: "NR2" },
                            { id: "nr3", label: "NR3" }
                        ],
                        visible: (values: any) => {
                            return values.numeric;
                        }
                    },
                    {
                        name: "boolean",
                        type: "boolean"
                    },
                    {
                        name: "string",
                        type: "boolean"
                    },
                    {
                        name: "discrete",
                        type: "boolean"
                    },
                    {
                        name: "enumeration",
                        type: ScpiEnumSelectFieldComponent,
                        visible: (values: any) => {
                            return values.discrete;
                        }
                    }
                ]
            },
            values: {
                numeric:
                    isScpiType(object, "nr1") ||
                    isScpiType(object, "nr2") ||
                    isScpiType(object, "nr3"),
                numericType: getNumericType(object) || "nr1",
                boolean: isScpiType(object, "boolean"),
                string: isScpiType(object, "string"),
                discrete: isScpiType(object, "discrete"),
                enumeration: getDiscreteTypeEnumeration(object)
            }
        });

        const type: IScpiType[] = [];

        if (result.values.numeric) {
            if (result.values.numericType === "nr1") {
                type.push({
                    type: "nr1"
                });
            } else if (result.values.numericType === "nr2") {
                type.push({
                    type: "nr2"
                });
            } else {
                type.push({
                    type: "nr3"
                });
            }
        }

        if (result.values.boolean) {
            type.push({
                type: "boolean"
            });
        }

        if (result.values.string) {
            type.push({
                type: "string"
            });
        }

        if (result.values.discrete) {
            type.push({
                type: "discrete",
                enumRef: result.values.enumeration
            });
        }

        return {
            type
        };
    }
};

////////////////////////////////////////////////////////////////////////////////

const ScpiParameterTable = styled.table`
    & > tbody > tr {
        & > td.name {
            transform: none;
        }

        & > td.type {
            white-space: nowrap;
        }

        & > td.isOptional {
            white-space: nowrap;
            text-align: center;
            & > label > span {
                display: none;
            }
        }

        & > td.description {
        }

        & > td.defaultValue {
        }
    }
`;

export class ScpiParameter extends EezObject {
    @observable
    name: string;

    @observable
    type: EezArrayObject<ScpiType>;

    @observable
    isOptional: string;

    @observable
    description: string;

    @observable
    defaultValue: string;

    static classInfo: ClassInfo = {
        properties: [
            {
                name: "name",
                type: PropertyType.String
            },
            typePropertyInfo,
            {
                name: "isOptional",
                displayName: "Is optional?",
                type: PropertyType.Boolean
            },
            {
                name: "description",
                type: PropertyType.MultilineText
            },
            {
                name: "defaultValue",
                type: PropertyType.String
            }
        ],

        defaultValue: {
            type: []
        },

        propertyGridTableComponent: ScpiParameterTable
    };

    check(object: EezObject) {
        const messages: output.Message[] = [];

        if (this.name) {
            const arr = asArray<ScpiParameter>(this._parent!);
            let thisIndex = -1;
            let otherIndex = -1;
            for (let i = 0; i < arr.length; ++i) {
                if (arr[i] === this) {
                    thisIndex = i;
                } else if (arr[i] !== this && arr[i].name === this.name) {
                    otherIndex = i;
                }
            }
            if (otherIndex !== -1 && thisIndex > otherIndex) {
                messages.push(
                    new output.Message(
                        output.Type.ERROR,
                        `Parameter name '${this.name}' is not unique`,
                        getChildOfObject(this, "name")
                    )
                );
            }
        } else {
            messages.push(output.propertyNotSetMessage(this, "name"));
        }

        if (!this.isOptional) {
            const arr = asArray<ScpiParameter>(this._parent!);
            for (let i = 0; arr[i] !== this && i < arr.length; ++i) {
                if (arr[i].isOptional) {
                    messages.push(
                        new output.Message(
                            output.Type.ERROR,
                            `Parameter must be optional`,
                            getChildOfObject(this, "isOptional")
                        )
                    );
                    break;
                }
            }
        }

        if (!this.type || this.type._array.length === 0) {
            messages.push(output.propertyNotSetMessage(this, "type"));
        }

        return messages;
    }
}

////////////////////////////////////////////////////////////////////////////////

export class ScpiResponse extends EezObject {
    @observable
    type: EezArrayObject<ScpiType>;

    @observable
    description?: string;

    static classInfo: ClassInfo = {
        properties: [
            typePropertyInfo,
            {
                name: "description",
                type: PropertyType.MultilineText,
                isOptional: true
            }
        ],
        defaultValue: {
            type: []
        }
    };

    check(object: EezObject) {
        const messages: output.Message[] = [];

        const command: ScpiCommand = this._parent as ScpiCommand;
        if (command.isQuery) {
            if (!this.type || this.type._array.length === 0) {
                messages.push(output.propertyNotSetMessage(this, "type"));
            }
        }

        return messages;
    }
}

////////////////////////////////////////////////////////////////////////////////

export class ScpiCommand extends EezObject {
    @observable name: string;
    @observable description?: string;
    @observable helpLink?: string;
    @observable usedIn: string[] | undefined;
    @observable parameters: EezArrayObject<ScpiParameter>;
    @observable response?: ScpiResponse;

    get isQuery() {
        return this.name ? this.name.trim().endsWith("?") : false;
    }

    static classInfo: ClassInfo = {
        properties: [
            {
                name: "name",
                type: PropertyType.String,
                unique: true
            },
            {
                name: "description",
                type: PropertyType.MultilineText
            },
            {
                name: "helpLink",
                type: PropertyType.String
            },
            {
                name: "usedIn",
                type: PropertyType.ConfigurationReference
            },
            {
                name: "parameters",
                type: PropertyType.Array,
                typeClass: ScpiParameter,
                defaultValue: []
            },
            {
                name: "response",
                type: PropertyType.Object,
                typeClass: ScpiResponse,
                hideInPropertyGrid: (command: ScpiCommand) => {
                    return !command.isQuery;
                },
                defaultValue: {}
            }
        ],
        newItem: (parent: EezObject) => {
            return showGenericDialog({
                dialogDefinition: {
                    title: "New Command",
                    fields: [
                        {
                            name: "name",
                            type: "string",
                            validators: [
                                validators.required,
                                validators.unique({}, asArray(parent))
                            ]
                        }
                    ]
                },
                values: {}
            }).then(result => {
                return Promise.resolve({
                    name: result.values.name
                });
            });
        }
    };

    @computed
    get shortCommand(): string {
        return this.name
            .replace(/[a-z]/g, "") // remove lower case letters
            .replace(/\[.*\]/g, ""); // remove optional parts (between [])
    }

    @computed
    get longCommand(): string {
        return this.name.replace(/[\[\]]/g, ""); // remove [ and ]
    }
}

registerClass(ScpiCommand);

////////////////////////////////////////////////////////////////////////////////

export class ScpiSubsystem extends EezObject {
    @observable name: string;
    @observable description?: string;
    @observable helpLink?: string;
    @observable commands: EezArrayObject<ScpiCommand>;

    static classInfo: ClassInfo = {
        properties: [
            {
                name: "name",
                type: PropertyType.String,
                unique: true
            },
            {
                name: "description",
                type: PropertyType.MultilineText
            },
            {
                name: "helpLink",
                type: PropertyType.String
            },
            {
                name: "commands",
                type: PropertyType.Array,
                typeClass: ScpiCommand,
                hideInPropertyGrid: true
            }
        ],
        newItem: (parent: EezObject) => {
            return showGenericDialog({
                dialogDefinition: {
                    title: "New Subsystem",
                    fields: [
                        {
                            name: "name",
                            type: "string",
                            validators: [
                                validators.required,
                                validators.unique({}, asArray(parent))
                            ]
                        }
                    ]
                },
                values: {}
            }).then(result => {
                return Promise.resolve({
                    name: result.values.name,
                    commands: []
                });
            });
        },
        navigationComponent: ScpiSubsystemsNavigation,
        navigationComponentId: "scpi-subsystems",
        icon: "list"
    };
}

registerClass(ScpiSubsystem);

////////////////////////////////////////////////////////////////////////////////

export class Scpi extends EezObject {
    @observable subsystems: EezArrayObject<ScpiSubsystem>;
    @observable enums: EezArrayObject<ScpiEnum>;

    static classInfo: ClassInfo = {
        label: () => "SCPI",
        properties: [
            {
                name: "subsystems",
                type: PropertyType.Array,
                typeClass: ScpiSubsystem,
                hideInPropertyGrid: true
            },
            {
                name: "enums",
                type: PropertyType.Array,
                typeClass: ScpiEnum,
                hideInPropertyGrid: true
            }
        ],
        navigationComponent: ScpiNavigation,
        navigationComponentId: "scpi",
        defaultNavigationKey: "subsystems",
        icon: "navigate_next"
    };
}

registerClass(Scpi);

////////////////////////////////////////////////////////////////////////////////

registerFeatureImplementation("scpi", {
    projectFeature: {
        mandatory: false,
        key: "scpi",
        type: PropertyType.Object,
        typeClass: Scpi,
        create: () => {
            return {
                subsystems: [],
                enums: []
            };
        },
        build: build,
        metrics: metrics
    }
});
