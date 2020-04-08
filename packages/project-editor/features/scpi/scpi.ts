import { observable, computed } from "mobx";

import { humanize } from "eez-studio-shared/string";

import { validators } from "eez-studio-shared/validation";
import * as output from "project-editor/core/output";

import styled from "eez-studio-ui/styled-components";
import { showGenericDialog } from "eez-studio-ui/generic-dialog";

import {
    ClassInfo,
    registerClass,
    IEezObject,
    EezObject,
    EezArrayObject,
    PropertyType,
    PropertyInfo,
    asArray,
    getChildOfObject,
    getParent
} from "project-editor/core/object";

import { IParameterType, ParameterTypeType, ResponseType } from "instrument/scpi";

import { registerFeatureImplementation } from "project-editor/core/extensions";

import { ScpiNavigation } from "project-editor/features/scpi/ScpiNavigation";
import { ScpiSubsystemsNavigation } from "project-editor/features/scpi/ScpiSubsystemsNavigation";
import { build } from "project-editor/features/scpi/build";
import { metrics } from "project-editor/features/scpi/metrics";
import {
    ScpiEnum,
    findScpiEnum,
    getScpiEnumsAsDialogEnumItems
} from "project-editor/features/scpi/enum";

////////////////////////////////////////////////////////////////////////////////

export class ScpiParameterType extends EezObject implements IParameterType {
    @observable
    type: ParameterTypeType;

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

    check(object: IEezObject) {
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

function getScpiType(object: ScpiParameter, type: ParameterTypeType) {
    return object.type.find(scpiType => scpiType.type === type);
}

function isScpiType(object: ScpiParameter, type: ParameterTypeType) {
    return !!getScpiType(object, type);
}

function getNumericType(object: ScpiParameter) {
    if (isScpiType(object, "nr2")) {
        return "nr2";
    }
    if (isScpiType(object, "nr3")) {
        return "nr3";
    }

    return "nr1";
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
                            size: "medium",
                            fields: [
                                {
                                    name: "numeric",
                                    type: "boolean",
                                    visible: (values: any) => {
                                        return !values.any;
                                    }
                                },
                                {
                                    name: "numericType",
                                    displayName: "",
                                    type: "enum",
                                    enumItems: [
                                        { id: "nr1", label: "Integer (NR1)" },
                                        { id: "nr2", label: "Decimal (NR2)" },
                                        { id: "nr3", label: "Real (NR3)" }
                                    ],
                                    visible: (values: any) => {
                                        return !values.any && values.numeric;
                                    }
                                },
                                {
                                    name: "boolean",
                                    type: "boolean",
                                    visible: (values: any) => {
                                        return !values.any;
                                    }
                                },
                                {
                                    name: "string",
                                    type: "boolean",
                                    visible: (values: any) => {
                                        return !values.any;
                                    }
                                },
                                {
                                    name: "dataBlock",
                                    type: "boolean",
                                    visible: (values: any) => {
                                        return !values.any;
                                    }
                                },
                                {
                                    name: "channelList",
                                    type: "boolean",
                                    visible: (values: any) => {
                                        return !values.any;
                                    }
                                },
                                {
                                    name: "discrete",
                                    type: "boolean",
                                    visible: (values: any) => {
                                        return !values.any;
                                    }
                                },
                                {
                                    name: "enumeration",
                                    type: "enum",
                                    enumItems: () => {
                                        return getScpiEnumsAsDialogEnumItems();
                                    },
                                    visible: (values: any) => {
                                        return !values.any && values.discrete;
                                    }
                                },
                                {
                                    name: "any",
                                    type: "boolean"
                                }
                            ]
                        },
                        values: {
                            any: isScpiType(object, "any"),
                            numeric:
                                isScpiType(object, "nr1") ||
                                isScpiType(object, "nr2") ||
                                isScpiType(object, "nr3"),
                            numericType: getNumericType(object),
                            boolean: isScpiType(object, "boolean"),
                            string: isScpiType(object, "quoted-string"),
                            dataBlock: isScpiType(object, "data-block"),
                            channelList: isScpiType(object, "channel-list"),
                            discrete: isScpiType(object, "discrete"),
                            enumeration: getDiscreteTypeEnumeration(object)
                        }
                    });

                    const type: IParameterType[] = [];

                    if (result.values.any) {
                        type.push({
                            type: "any"
                        });
                    } else {
                        if (result.values.numeric) {
                            type.push({
                                type: result.values.numericType
                            });
                        }

                        if (result.values.boolean) {
                            type.push({
                                type: "boolean"
                            });
                        }

                        if (result.values.string) {
                            type.push({
                                type: "quoted-string"
                            });
                        }

                        if (result.values.dataBlock) {
                            type.push({
                                type: "data-block"
                            });
                        }

                        if (result.values.channelList) {
                            type.push({
                                type: "channel-list"
                            });
                        }

                        if (result.values.discrete) {
                            type.push({
                                type: "discrete",
                                enumeration: result.values.enumeration
                            });
                        }
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
            }
        ],

        defaultValue: {
            type: []
        },

        propertyGridTableComponent: ScpiParameterTable
    };

    check(object: IEezObject) {
        const messages: output.Message[] = [];

        if (this.name) {
            const arr = asArray<ScpiParameter>(getParent(this));
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
            const arr = asArray<ScpiParameter>(getParent(this));
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

        if (!this.type || this.type.length === 0) {
            messages.push(output.propertyNotSetMessage(this, "type"));
        }

        return messages;
    }
}

////////////////////////////////////////////////////////////////////////////////

export class ScpiResponse extends EezObject {
    @observable
    type: ResponseType;

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
                    { id: "nr1", label: "Integer (NR1)" },
                    { id: "nr2", label: "Decimal (NR2)" },
                    { id: "nr3", label: "Real (NR3)" },
                    { id: "boolean" },
                    { id: "quoted-string" },
                    { id: "arbitrary-ascii" },
                    { id: "list-of-quoted-string" },
                    { id: "data-block" },
                    { id: "non-standard-data-block" },
                    { id: "discrete" },
                    { id: "any" }
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
        defaultValue: {}
    };

    check(object: IEezObject) {
        const messages: output.Message[] = [];

        const command: ScpiCommand = getParent(this) as ScpiCommand;
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
        newItem: (parent: IEezObject) => {
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
        newItem: (parent: IEezObject) => {
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
