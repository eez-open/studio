import { observable, computed } from "mobx";

import { humanize } from "eez-studio-shared/string";

import { validators } from "eez-studio-shared/model/validation";
import * as output from "eez-studio-shared/model/output";

import styled from "eez-studio-ui/styled-components";
import { showGenericDialog } from "eez-studio-ui/generic-dialog";

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
import { build } from "project-editor/project/features/scpi/build";
import { metrics } from "project-editor/project/features/scpi/metrics";
import {
    ScpiEnum,
    findScpiEnum,
    getScpiEnumsAsDialogEnumItems
} from "project-editor/project/features/scpi/enum";

////////////////////////////////////////////////////////////////////////////////

type ScpiParameterTypeType = "numeric" | "boolean" | "string" | "discrete";

interface IScpiParameterType {
    type: ScpiParameterTypeType;
    enumeration?: string;
}

export class ScpiParameterType extends EezObject implements IScpiParameterType {
    @observable
    type: ScpiParameterTypeType;

    @observable
    enumeration?: string;

    static classInfo: ClassInfo = {
        label: (scpiType: ScpiParameterType) => {
            if (scpiType.type === "discrete") {
                return `Discrete<${scpiType.enumeration || ""}>`;
            } else {
                return humanize(scpiType.type);
            }
        },
        properties: [
            {
                name: "type",
                type: PropertyType.Enum,
                enumItems: [
                    { id: "numeric" },
                    { id: "boolean" },
                    { id: "string" },
                    { id: "discrete" }
                ]
            },
            {
                name: "enumeration",
                type: PropertyType.ObjectReference,
                referencedObjectCollectionPath: ["scpi", "enums"]
            }
        ],
        defaultValue: {
            type: "numeric"
        }
    };

    check(object: EezObject) {
        const messages: output.Message[] = [];

        if (!this.type) {
            messages.push(output.propertyNotSetMessage(this, "type"));
        } else if (this.type === "discrete") {
            if (!this.enumeration) {
                messages.push(output.propertyNotSetMessage(this, "enumeration"));
            } else {
                if (!findScpiEnum(this.enumeration)) {
                    messages.push(output.propertyNotFoundMessage(this, "enumeration"));
                }
            }
        }

        return messages;
    }
}

function getScpiType(object: ScpiParameter, type: ScpiParameterTypeType) {
    return object.type._array.find(scpiType => scpiType.type === type);
}

function isScpiType(object: ScpiParameter, type: ScpiParameterTypeType) {
    return !!getScpiType(object, type);
}

function getDiscreteTypeEnumeration(object: ScpiParameter) {
    const discreteType = getScpiType(object, "discrete");
    if (discreteType) {
        return discreteType.enumeration;
    }
    return undefined;
}

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
    type: EezArrayObject<ScpiParameterType>;

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
            {
                name: "type",
                type: PropertyType.Array,
                typeClass: ScpiParameterType,
                defaultValue: [],
                onSelect: async (object: ScpiParameter, propertyInfo: PropertyInfo) => {
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
                                    type: "enum",
                                    enumItems: () => {
                                        return getScpiEnumsAsDialogEnumItems();
                                    },
                                    visible: (values: any) => {
                                        return values.discrete;
                                    }
                                }
                            ]
                        },
                        values: {
                            numeric: isScpiType(object, "numeric"),
                            boolean: isScpiType(object, "boolean"),
                            string: isScpiType(object, "string"),
                            discrete: isScpiType(object, "discrete"),
                            enumeration: getDiscreteTypeEnumeration(object)
                        }
                    });

                    const type: IScpiParameterType[] = [];

                    if (result.values.numeric) {
                        type.push({
                            type: "numeric"
                        });
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
                            enumeration: result.values.enumeration
                        });
                    }

                    return {
                        type
                    };
                }
            },
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

type ScpiResponseType = "numeric" | "boolean" | "string" | "arbitrary-block" | "discrete";

export class ScpiResponse extends EezObject {
    @observable
    type: ScpiResponseType;

    @observable
    enumeration?: string;

    @observable
    description?: string;

    static classInfo: ClassInfo = {
        properties: [
            {
                name: "type",
                type: PropertyType.Enum,
                enumItems: [
                    { id: "numeric" },
                    { id: "boolean" },
                    { id: "string" },
                    { id: "arbitrary-block" },
                    { id: "discrete" }
                ]
            },
            {
                name: "enumeration",
                type: PropertyType.ObjectReference,
                referencedObjectCollectionPath: ["scpi", "enums"],
                hideInPropertyGrid: (response: ScpiResponse) => {
                    return response.type !== "discrete";
                }
            },
            {
                name: "description",
                type: PropertyType.MultilineText,
                isOptional: true
            }
        ],
        defaultValue: {
            type: "numeric"
        }
    };

    check(object: EezObject) {
        const messages: output.Message[] = [];

        const command: ScpiCommand = this._parent as ScpiCommand;
        if (command.isQuery) {
            if (!this.type) {
                messages.push(output.propertyNotSetMessage(this, "type"));
            } else if (this.type === "discrete") {
                if (!this.enumeration) {
                    messages.push(output.propertyNotSetMessage(this, "enumeration"));
                } else {
                    if (!findScpiEnum(this.enumeration)) {
                        messages.push(output.propertyNotFoundMessage(this, "enumeration"));
                    }
                }
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
