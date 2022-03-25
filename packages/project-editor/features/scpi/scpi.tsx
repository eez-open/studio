import React from "react";
import { observable, computed, makeObservable } from "mobx";

import { humanize } from "eez-studio-shared/string";

import { validators } from "eez-studio-shared/validation";

import { showGenericDialog } from "eez-studio-ui/generic-dialog";

import {
    ClassInfo,
    registerClass,
    IEezObject,
    EezObject,
    PropertyType,
    PropertyInfo,
    getParent,
    MessageType
} from "project-editor/core/object";
import {
    getDocumentStore,
    getChildOfObject,
    Message,
    propertyNotSetMessage,
    propertyNotFoundMessage
} from "project-editor/store";

import type {
    IParameterType,
    IParameterTypeType,
    IResponseType,
    IResponseTypeType
} from "instrument/scpi";

import { metrics } from "project-editor/features/scpi/metrics";
import {
    ScpiEnum,
    findScpiEnum,
    getScpiEnumsAsDialogEnumItems
} from "project-editor/features/scpi/enum";

////////////////////////////////////////////////////////////////////////////////

export class ScpiParameterType extends EezObject implements IParameterType {
    type: IParameterTypeType;
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
                type: PropertyType.String
            },
            {
                name: "enumeration",
                type: PropertyType.ObjectReference,
                referencedObjectCollectionPath: "scpi/enums"
            }
        ],
        defaultValue: {
            type: "numeric"
        }
    };

    constructor() {
        super();

        makeObservable(this, {
            type: observable,
            enumeration: observable
        });
    }

    check(object: IEezObject) {
        const messages: Message[] = [];

        if (!this.type) {
            messages.push(propertyNotSetMessage(this, "type"));
        } else if (this.type === "discrete") {
            if (!this.enumeration) {
                messages.push(propertyNotSetMessage(this, "enumeration"));
            } else {
                if (!findScpiEnum(getDocumentStore(object), this.enumeration)) {
                    messages.push(propertyNotFoundMessage(this, "enumeration"));
                }
            }
        }

        return messages;
    }
}

function getScpiType(
    object: ScpiParameter | ScpiResponse,
    type: IParameterTypeType | IResponseTypeType
) {
    return (object.type as (ScpiParameterType | ScpiResponseType)[]).find(
        (scpiType: ScpiParameterType | ScpiResponseType) =>
            scpiType.type === type ||
            (scpiType.type === ("numeric" as any) && type === "nr3")
    );
}

function isScpiType(
    object: ScpiParameter | ScpiResponse,
    type: IParameterTypeType | IResponseTypeType
) {
    return !!getScpiType(object, type);
}

function getNumericType(object: ScpiParameter | ScpiResponse) {
    if (isScpiType(object, "nr2")) {
        return "nr2";
    }
    if (isScpiType(object, "nr3")) {
        return "nr3";
    }

    return "nr1";
}

function getDiscreteTypeEnumeration(object: ScpiParameter | ScpiResponse) {
    const discreteType = getScpiType(object, "discrete");
    if (discreteType) {
        return discreteType.enumeration;
    }
    return undefined;
}

////////////////////////////////////////////////////////////////////////////////

class ScpiParameterTable extends React.Component {
    render() {
        return (
            <div className="EezStudio_ScpiParameterTable">
                <table>{this.props.children}</table>
            </div>
        );
    }
}

export class ScpiParameter extends EezObject {
    name: string;
    type: ScpiParameterType[];
    isOptional: string;
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
                onSelect: async (
                    object: ScpiParameter,
                    propertyInfo: PropertyInfo
                ) => {
                    const DocumentStore = getDocumentStore(object);
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
                                        return getScpiEnumsAsDialogEnumItems(
                                            DocumentStore
                                        );
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

    constructor() {
        super();

        makeObservable(this, {
            name: observable,
            type: observable,
            isOptional: observable,
            description: observable
        });
    }

    check(object: IEezObject) {
        const messages: Message[] = [];

        if (this.name) {
            const arr = getParent(this) as ScpiParameter[];
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
                    new Message(
                        MessageType.ERROR,
                        `Parameter name '${this.name}' is not unique`,
                        getChildOfObject(this, "name")
                    )
                );
            }
        } else {
            messages.push(propertyNotSetMessage(this, "name"));
        }

        if (!this.isOptional) {
            const arr = getParent(this) as ScpiParameter[];
            for (let i = 0; arr[i] !== this && i < arr.length; ++i) {
                if (arr[i].isOptional) {
                    messages.push(
                        new Message(
                            MessageType.ERROR,
                            `Parameter must be optional`,
                            getChildOfObject(this, "isOptional")
                        )
                    );
                    break;
                }
            }
        }

        if (!this.type || this.type.length === 0) {
            messages.push(propertyNotSetMessage(this, "type"));
        }

        return messages;
    }
}

////////////////////////////////////////////////////////////////////////////////

export class ScpiResponseType extends EezObject implements IResponseType {
    type: IResponseTypeType;
    enumeration?: string;

    static classInfo: ClassInfo = {
        label: (scpiType: ScpiResponseType) => {
            if (scpiType.type === "discrete") {
                return `Discrete<${scpiType.enumeration || ""}>`;
            } else {
                return humanize(scpiType.type);
            }
        },
        properties: [
            {
                name: "type",
                type: PropertyType.String
            },
            {
                name: "enumeration",
                type: PropertyType.ObjectReference,
                referencedObjectCollectionPath: "scpi/enums"
            }
        ],
        defaultValue: {
            type: "numeric"
        }
    };

    constructor() {
        super();

        makeObservable(this, {
            type: observable,
            enumeration: observable
        });
    }

    check(object: IEezObject) {
        const messages: Message[] = [];

        if (!this.type) {
            messages.push(propertyNotSetMessage(this, "type"));
        } else if (this.type === "discrete") {
            if (!this.enumeration) {
                messages.push(propertyNotSetMessage(this, "enumeration"));
            } else {
                if (!findScpiEnum(getDocumentStore(object), this.enumeration)) {
                    messages.push(propertyNotFoundMessage(this, "enumeration"));
                }
            }
        }

        return messages;
    }
}

////////////////////////////////////////////////////////////////////////////////

export class ScpiResponse extends EezObject {
    type: ScpiResponseType[];
    description?: string;

    static classInfo: ClassInfo = {
        properties: [
            {
                name: "type",
                type: PropertyType.Array,
                typeClass: ScpiResponseType,
                defaultValue: [],
                onSelect: async (
                    object: ScpiResponse,
                    propertyInfo: PropertyInfo
                ) => {
                    const DocumentStore = getDocumentStore(object);
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
                                    name: "arbitraryAscii",
                                    type: "boolean",
                                    visible: (values: any) => {
                                        return !values.any;
                                    }
                                },
                                {
                                    name: "listOfQuotedString",
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
                                    name: "nonStandardDataBlock",
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
                                        return getScpiEnumsAsDialogEnumItems(
                                            DocumentStore
                                        );
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

                    const type: IResponseType[] = [];

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

                        if (result.values.arbitraryAscii) {
                            type.push({
                                type: "arbitrary-ascii"
                            });
                        }

                        if (result.values.listOfQuotedString) {
                            type.push({
                                type: "list-of-quoted-string"
                            });
                        }

                        if (result.values.dataBlock) {
                            type.push({
                                type: "data-block"
                            });
                        }

                        if (result.values.nonStandardDataBlock) {
                            type.push({
                                type: "non-standard-data-block"
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
                name: "description",
                type: PropertyType.MultilineText,
                isOptional: true
            }
        ],
        defaultValue: {},
        beforeLoadHook(object: IEezObject, jsObject: any) {
            if (!Array.isArray(jsObject.type)) {
                jsObject.type = [
                    {
                        type: jsObject.type,
                        enumeration: jsObject.enumeration
                    }
                ];
            }
        }
    };

    constructor() {
        super();

        makeObservable(this, {
            type: observable,
            description: observable
        });
    }

    check(object: IEezObject) {
        const messages: Message[] = [];

        const command: ScpiCommand = getParent(this) as ScpiCommand;
        if (command.isQuery) {
            if (!this.type || this.type.length === 0) {
                messages.push(propertyNotSetMessage(this, "type"));
            }
        }

        return messages;
    }
}

////////////////////////////////////////////////////////////////////////////////

export class ScpiCommand extends EezObject {
    name: string;
    description?: string;
    helpLink?: string;
    usedIn?: string[];
    parameters: ScpiParameter[];
    response?: ScpiResponse;
    sendsBackDataBlock: boolean;

    constructor() {
        super();

        makeObservable(this, {
            name: observable,
            description: observable,
            helpLink: observable,
            usedIn: observable,
            parameters: observable,
            response: observable,
            sendsBackDataBlock: observable,
            shortCommand: computed,
            longCommand: computed
        });
    }

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
                type: PropertyType.ConfigurationReference,
                referencedObjectCollectionPath: "settings/build/configurations"
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
            },
            {
                name: "sendsBackDataBlock",
                displayName: "This command sends back data block",
                type: PropertyType.Boolean,
                hideInPropertyGrid: (command: ScpiCommand) => {
                    return command.isQuery;
                },
                defaultValue: false
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
                                validators.unique({}, parent)
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

    get shortCommand(): string {
        return this.name
            .replace(/[a-z]/g, "") // remove lower case letters
            .replace(/\[.*\]/g, ""); // remove optional parts (between [])
    }

    get longCommand(): string {
        return this.name.replace(/[\[\]]/g, ""); // remove [ and ]
    }
}

registerClass("ScpiCommand", ScpiCommand);

////////////////////////////////////////////////////////////////////////////////

export class ScpiSubsystem extends EezObject {
    name: string;
    description?: string;
    helpLink?: string;
    commands: ScpiCommand[];

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
                                validators.unique({}, parent)
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
        }
    };

    constructor() {
        super();

        makeObservable(this, {
            name: observable,
            description: observable,
            helpLink: observable,
            commands: observable
        });
    }
}

registerClass("ScpiSubsystem", ScpiSubsystem);

////////////////////////////////////////////////////////////////////////////////

export class Scpi extends EezObject {
    subsystems: ScpiSubsystem[];
    enums: ScpiEnum[];

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
        icon: "navigate_next"
    };

    constructor() {
        super();

        makeObservable(this, {
            subsystems: observable,
            enums: observable
        });
    }
}

registerClass("Scpi", Scpi);

////////////////////////////////////////////////////////////////////////////////

export default {
    name: "eezstudio-project-feature-scpi",
    version: "0.1.0",
    description: "This feature adds SCPI support for your project",
    author: "EEZ",
    authorLogo: "../eez-studio-ui/_images/eez_logo.png",
    eezStudioExtension: {
        displayName: "SCPI",
        implementation: {
            projectFeature: {
                mandatory: false,
                key: "scpi",
                type: PropertyType.Object,
                typeClass: Scpi,
                icon: "navigate_next",
                create: () => {
                    return {
                        subsystems: [],
                        enums: []
                    };
                },
                metrics: metrics
            }
        }
    }
};
