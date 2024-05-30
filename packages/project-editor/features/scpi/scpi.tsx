import { observable, computed, makeObservable } from "mobx";

import { humanize } from "eez-studio-shared/string";
import { validators } from "eez-studio-shared/validation";

import { showGenericDialog } from "eez-studio-ui/generic-dialog";

import type {
    IParameterType,
    IParameterTypeType,
    IResponseType,
    IResponseTypeType
} from "instrument/scpi";

import {
    ClassInfo,
    registerClass,
    IEezObject,
    EezObject,
    PropertyType,
    PropertyInfo,
    getParent,
    MessageType,
    IMessage
} from "project-editor/core/object";
import {
    getProjectStore,
    getChildOfObject,
    Message,
    propertyNotSetMessage,
    propertyNotFoundMessage,
    createObject,
    getLabel
} from "project-editor/store";

import {
    ScpiEnum,
    findScpiEnum,
    getScpiEnumsAsDialogEnumItems
} from "project-editor/features/scpi/enum";
import { ProjectEditor } from "project-editor/project-editor-interface";
import type { ProjectEditorFeature } from "project-editor/store/features";

import { isArray } from "eez-studio-shared/util";

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

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            type: observable,
            enumeration: observable
        });
    }

    check(object: IEezObject, messages: IMessage[]) {
        if (!this.type) {
            messages.push(propertyNotSetMessage(this, "type"));
        } else if (this.type === "discrete") {
            if (!this.enumeration) {
                messages.push(propertyNotSetMessage(this, "enumeration"));
            } else {
                if (!findScpiEnum(getProjectStore(object), this.enumeration)) {
                    messages.push(propertyNotFoundMessage(this, "enumeration"));
                }
            }
        }
    }
}

registerClass("ScpiParameterType", ScpiParameterType);

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
                    const projectStore = getProjectStore(object);
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
                                            projectStore
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
                type: PropertyType.Boolean,
                checkboxStyleSwitch: true
            },
            {
                name: "description",
                type: PropertyType.MultilineText
            }
        ],

        defaultValue: {
            type: []
        },

        listLabel: (parameter: ScpiParameter, collapsed: boolean) => {
            if (!collapsed) {
                return "";
            }
            return `${parameter.name}: ${parameter.type
                .map(type => getLabel(type))
                .join(", ")} (${
                parameter.isOptional ? "Optional" : "Mandatory"
            }${
                parameter.description
                    ? `, Description=${parameter.description}`
                    : ""
            })`;
        }
    };

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            name: observable,
            type: observable,
            isOptional: observable,
            description: observable
        });
    }

    check(object: IEezObject, messages: IMessage[]) {
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

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            type: observable,
            enumeration: observable
        });
    }

    check(object: IEezObject, messages: IMessage[]) {
        if (!this.type) {
            messages.push(propertyNotSetMessage(this, "type"));
        } else if (this.type === "discrete") {
            if (!this.enumeration) {
                messages.push(propertyNotSetMessage(this, "enumeration"));
            } else {
                if (!findScpiEnum(getProjectStore(object), this.enumeration)) {
                    messages.push(propertyNotFoundMessage(this, "enumeration"));
                }
            }
        }
    }
}

registerClass("ScpiResponseType", ScpiResponseType);

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
                    const projectStore = getProjectStore(object);
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
                                            projectStore
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
            if (!isArray(jsObject.type)) {
                jsObject.type = [
                    {
                        type: jsObject.type,
                        enumeration: jsObject.enumeration
                    }
                ];
            }
        }
    };

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            type: observable,
            description: observable
        });
    }

    check(object: IEezObject, messages: IMessage[]) {
        const command: ScpiCommand = getParent(this) as ScpiCommand;
        if (command.isQuery) {
            if (!this.type || this.type.length === 0) {
                messages.push(propertyNotSetMessage(this, "type"));
            }
        }
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
            shortCommand: computed,
            longCommand: computed
        });
    }

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            name: observable,
            description: observable,
            helpLink: observable,
            usedIn: observable,
            parameters: observable,
            response: observable,
            sendsBackDataBlock: observable
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
                disabled: (command: ScpiCommand) => {
                    return !command.isQuery;
                },
                defaultValue: {}
            },
            {
                name: "sendsBackDataBlock",
                displayName: "This command sends back data block",
                type: PropertyType.Boolean,
                disabled: (command: ScpiCommand) => {
                    return command.isQuery;
                },
                defaultValue: false
            }
        ],
        newItem: async (parent: IEezObject) => {
            const result = await showGenericDialog({
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
            });

            const scpiCommandProperties: Partial<ScpiCommand> = {
                name: result.values.name
            };

            const project = ProjectEditor.getProject(parent);

            const scpiCommand = createObject<ScpiCommand>(
                project._store,
                scpiCommandProperties,
                ScpiCommand
            );

            return scpiCommand;
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
        newItem: async (parent: IEezObject) => {
            const result = await showGenericDialog({
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
            });

            const scpiSubsystemProperties: Partial<ScpiSubsystem> = {
                name: result.values.name,
                commands: []
            };

            const project = ProjectEditor.getProject(parent);

            const scpiCommand = createObject<ScpiSubsystem>(
                project._store,
                scpiSubsystemProperties,
                ScpiSubsystem
            );

            return scpiCommand;
        }
    };

    override makeEditable() {
        super.makeEditable();

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
        icon: "material:navigate_next"
    };

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            subsystems: observable,
            enums: observable
        });
    }
}

registerClass("Scpi", Scpi);

////////////////////////////////////////////////////////////////////////////////

const feature: ProjectEditorFeature = {
    name: "eezstudio-project-feature-scpi",
    version: "0.1.0",
    description: "This feature adds SCPI support for your project",
    author: "EEZ",
    authorLogo: "../eez-studio-ui/_images/eez_logo.png",
    displayName: "SCPI",
    mandatory: false,
    key: "scpi",
    type: PropertyType.Object,
    typeClass: Scpi,
    icon: "material:navigate_next",
    create: () => {
        return {
            subsystems: [],
            enums: []
        };
    }
};

export default feature;
