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
    propertyInvalidValueMessage,
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

import {
    SCPI_ADDRESSING_KINDS,
    SCPI_DEFAULT_TIMEOUT_MS,
    SCPI_UNITS,
    SCPI_WIRE_TYPE_CHANNEL_LIST,
    SCPI_WIRE_TYPE_CHOICE,
    ScpiAddressingKind,
    getEnumeration,
    getScpiAddressing,
    getScpiAddressingLabel,
    getScpiCommandNumSuffixes,
    getScpiCommandPattern,
    getScpiResponseItems,
    getWireTypeMask,
    parseSpecialValues
} from "project-editor/features/scpi/scpi-wire";

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

type ScpiTypedObject = {
    type: (ScpiParameterType | ScpiResponseType)[];
};

function getScpiType(
    object: ScpiTypedObject,
    type: IParameterTypeType | IResponseTypeType
) {
    return (object.type || []).find(
        (scpiType: ScpiParameterType | ScpiResponseType) =>
            scpiType.type === type ||
            (scpiType.type === ("numeric" as any) && type === "nr3")
    );
}

function isScpiType(
    object: ScpiTypedObject,
    type: IParameterTypeType | IResponseTypeType
) {
    return !!getScpiType(object, type);
}

function getNumericType(object: ScpiTypedObject) {
    if (isScpiType(object, "nr2")) {
        return "nr2";
    }
    if (isScpiType(object, "nr3")) {
        return "nr3";
    }

    return "nr1";
}

function getDiscreteTypeEnumeration(object: ScpiTypedObject) {
    const discreteType = getScpiType(object, "discrete");
    if (discreteType) {
        return discreteType.enumeration;
    }
    return undefined;
}

////////////////////////////////////////////////////////////////////////////////

// SCPI commands of a DIB module project are forwarded by BB3+ to the module,
// so they need the extra details (units, special values, addressing, ...)
export function isScpiModuleProject(object: IEezObject) {
    return !!ProjectEditor.getProject(object).dibModuleMetadata;
}

const hideIfNotModuleProject = (object: IEezObject) =>
    !isScpiModuleProject(object);

const unitProperty: PropertyInfo = {
    name: "unit",
    type: PropertyType.Enum,
    enumItems: SCPI_UNITS.map(unit => ({ id: unit.id, label: unit.label })),
    hideInPropertyGrid: hideIfNotModuleProject
};

const repeatProperty: PropertyInfo = {
    name: "repeat",
    type: PropertyType.Enum,
    enumItems: [
        { id: "once", label: "Once" },
        { id: "list", label: "List (one or more values)" }
    ],
    hideInPropertyGrid: hideIfNotModuleProject
};

function checkTypeForModule(
    object: IEezObject,
    types: (ScpiParameterType | ScpiResponseType)[],
    messages: IMessage[]
) {
    const enumeration = getEnumeration(types);
    if (enumeration) {
        const scpiEnum = findScpiEnum(getProjectStore(object), enumeration);
        if (scpiEnum) {
            for (const member of scpiEnum.members) {
                if (!/^[+-]?\d+$/.test((member.value || "").trim())) {
                    messages.push(
                        new Message(
                            MessageType.ERROR,
                            `Enum '${enumeration}' member '${member.name}' value must be an integer`,
                            getChildOfObject(object, "type")
                        )
                    );
                    break;
                }
            }
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

export class ScpiParameter extends EezObject {
    name: string;
    type: ScpiParameterType[];
    isOptional: string;
    description: string;
    unit?: string;
    specialValues?: string;
    repeat?: "once" | "list";
    isCalibrationPassword?: boolean;

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
            unitProperty,
            {
                name: "specialValues",
                displayName: "Special values (MIN, MAX, DEF, UP, DOWN, NAN, INF, NINF, AUTO)",
                type: PropertyType.String,
                hideInPropertyGrid: hideIfNotModuleProject
            },
            repeatProperty,
            {
                name: "isCalibrationPassword",
                displayName: "Is calibration password? (checked by BB3+, not sent to the module)",
                type: PropertyType.Boolean,
                checkboxStyleSwitch: true,
                hideInPropertyGrid: hideIfNotModuleProject
            },
            {
                name: "description",
                type: PropertyType.MultilineText
            }
        ],

        defaultValue: {
            type: []
        },

        check: (parameter: ScpiParameter, messages: IMessage[]) => {
            if (!isScpiModuleProject(parameter)) {
                return;
            }

            checkTypeForModule(parameter, parameter.type, messages);

            if (
                parameter.isCalibrationPassword &&
                !(
                    parameter.type.length == 1 &&
                    parameter.type[0].type == "quoted-string"
                )
            ) {
                messages.push(
                    new Message(
                        MessageType.ERROR,
                        `Calibration password must be a quoted string`,
                        getChildOfObject(parameter, "isCalibrationPassword")
                    )
                );
            }

            const { invalid } = parseSpecialValues(parameter.specialValues);
            if (invalid.length > 0) {
                messages.push(
                    new Message(
                        MessageType.ERROR,
                        `Unknown special value(s): ${invalid.join(", ")}`,
                        getChildOfObject(parameter, "specialValues")
                    )
                );
            }

            const parameters = getParent(parameter) as ScpiParameter[];
            if (
                parameter.repeat == "list" &&
                parameters[parameters.length - 1] !== parameter
            ) {
                messages.push(
                    new Message(
                        MessageType.ERROR,
                        `Only the last parameter can be a list`,
                        getChildOfObject(parameter, "repeat")
                    )
                );
            }

            if (getWireTypeMask(parameter.type, false) == 0) {
                messages.push(propertyNotSetMessage(parameter, "type"));
            }
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
            description: observable,
            unit: observable,
            specialValues: observable,
            repeat: observable,
            isCalibrationPassword: observable
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

async function onSelectResponseType(object: ScpiTypedObject & IEezObject) {
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

export class ScpiResponseItem extends EezObject {
    name: string;
    type: ScpiResponseType[];
    unit?: string;
    repeat?: "once" | "list";
    description?: string;

    static classInfo: ClassInfo = {
        properties: [
            {
                name: "name",
                type: PropertyType.String
            },
            {
                name: "type",
                type: PropertyType.Array,
                typeClass: ScpiResponseType,
                defaultValue: [],
                onSelect: (object: ScpiResponseItem) =>
                    onSelectResponseType(object)
            },
            unitProperty,
            repeatProperty,
            {
                name: "description",
                type: PropertyType.MultilineText,
                isOptional: true
            }
        ],
        defaultValue: {
            type: []
        },
        listLabel: (item: ScpiResponseItem, collapsed: boolean) => {
            if (!collapsed) {
                return "";
            }
            return `${item.name}: ${item.type
                .map(type => getLabel(type))
                .join(", ")}${item.repeat == "list" ? " (List)" : ""}`;
        },
        check: (item: ScpiResponseItem, messages: IMessage[]) => {
            if (!item.name) {
                messages.push(propertyNotSetMessage(item, "name"));
            }

            if (getWireTypeMask(item.type, false) == 0) {
                messages.push(propertyNotSetMessage(item, "type"));
            } else if (isScpiModuleProject(item)) {
                checkTypeForModule(item, item.type, messages);
            }

            const items = getParent(item) as ScpiResponseItem[];
            if (item.repeat == "list" && items[items.length - 1] !== item) {
                messages.push(
                    new Message(
                        MessageType.ERROR,
                        `Only the last response item can be a list`,
                        getChildOfObject(item, "repeat")
                    )
                );
            }
        }
    };

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            name: observable,
            type: observable,
            unit: observable,
            repeat: observable,
            description: observable
        });
    }
}

registerClass("ScpiResponseItem", ScpiResponseItem);

////////////////////////////////////////////////////////////////////////////////

export class ScpiResponse extends EezObject {
    type: ScpiResponseType[];
    unit?: string;
    repeat?: "once" | "list";
    items?: ScpiResponseItem[];
    description?: string;

    static classInfo: ClassInfo = {
        properties: [
            {
                name: "type",
                type: PropertyType.Array,
                typeClass: ScpiResponseType,
                defaultValue: [],
                onSelect: (object: ScpiResponse) =>
                    onSelectResponseType(object)
            },
            unitProperty,
            repeatProperty,
            {
                name: "items",
                displayName: "Items (when the response has more than one value)",
                type: PropertyType.Array,
                typeClass: ScpiResponseItem,
                defaultValue: [],
                hideInPropertyGrid: hideIfNotModuleProject
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
        },
        check: (response: ScpiResponse, messages: IMessage[]) => {
            if (!isScpiModuleProject(response)) {
                return;
            }

            const command = getParent(response) as ScpiCommand;
            const items = getScpiResponseItems(command);

            if (command.isQuery) {
                if (items.length == 0) {
                    messages.push(propertyNotSetMessage(response, "type"));
                }
            }

            if (!response.items || response.items.length == 0) {
                checkTypeForModule(response, response.type, messages);
            }
        }
    };

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            type: observable,
            unit: observable,
            repeat: observable,
            items: observable,
            description: observable
        });
    }
}

////////////////////////////////////////////////////////////////////////////////

export class ScpiAddressing extends EezObject {
    kind: ScpiAddressingKind;
    parameter?: string;
    suffixIndex?: number;

    static classInfo: ClassInfo = {
        label: (addressing: ScpiAddressing) => {
            const command = getParent(addressing) as ScpiCommand;
            const label = getScpiAddressingLabel(getScpiAddressing(command));
            return !addressing.kind || addressing.kind == "auto"
                ? `Auto: ${label}`
                : label;
        },
        properties: [
            {
                name: "kind",
                type: PropertyType.Enum,
                enumItems: SCPI_ADDRESSING_KINDS.map(kind => ({
                    id: kind.id,
                    label: kind.label
                }))
            },
            {
                name: "parameter",
                type: PropertyType.Enum,
                enumItems: (addressing: ScpiAddressing) => {
                    const command = getParent(addressing) as ScpiCommand;
                    return (command.parameters || []).map(parameter => ({
                        id: parameter.name,
                        label: parameter.name
                    }));
                },
                hideInPropertyGrid: (addressing: ScpiAddressing) =>
                    addressing.kind != "channel-list-param" &&
                    addressing.kind != "power-channel-param"
            },
            {
                name: "suffixIndex",
                displayName: "Header suffix index (0 = first #)",
                type: PropertyType.Number,
                hideInPropertyGrid: (addressing: ScpiAddressing) =>
                    addressing.kind != "power-channel-suffix" &&
                    addressing.kind != "slot-suffix"
            }
        ],
        defaultValue: {
            kind: "auto"
        },
        check: (addressing: ScpiAddressing, messages: IMessage[]) => {
            const command = getParent(addressing) as ScpiCommand;

            if (
                addressing.kind == "channel-list-param" ||
                addressing.kind == "power-channel-param"
            ) {
                const parameter = (command.parameters || []).find(
                    parameter => parameter.name == addressing.parameter
                );
                if (!parameter) {
                    messages.push(
                        propertyNotFoundMessage(addressing, "parameter")
                    );
                } else {
                    const mask = getWireTypeMask(parameter.type, false);
                    const expected =
                        addressing.kind == "channel-list-param"
                            ? SCPI_WIRE_TYPE_CHANNEL_LIST
                            : SCPI_WIRE_TYPE_CHOICE;
                    if (!(mask & (1 << expected))) {
                        messages.push(
                            propertyInvalidValueMessage(
                                addressing,
                                "parameter"
                            )
                        );
                    }
                }
            } else if (
                addressing.kind == "power-channel-suffix" ||
                addressing.kind == "slot-suffix"
            ) {
                const index = addressing.suffixIndex || 0;
                if (index < 0 || index >= getScpiCommandNumSuffixes(command)) {
                    messages.push(
                        propertyInvalidValueMessage(addressing, "suffixIndex")
                    );
                }
            }
        }
    };

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            kind: observable,
            parameter: observable,
            suffixIndex: observable
        });
    }
}

registerClass("ScpiAddressing", ScpiAddressing);

////////////////////////////////////////////////////////////////////////////////

export class ScpiCommand extends EezObject {
    name: string;
    description?: string;
    helpLink?: string;
    usedIn?: string[];
    parameters: ScpiParameter[];
    response?: ScpiResponse;
    sendsBackDataBlock: boolean;
    addressing?: ScpiAddressing;
    timeoutMs?: number;
    applyOnDibSync?: boolean;

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
            sendsBackDataBlock: observable,
            addressing: observable,
            timeoutMs: observable,
            applyOnDibSync: observable
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
            },
            {
                name: "addressing",
                type: PropertyType.Object,
                typeClass: ScpiAddressing,
                defaultValue: {},
                hideInPropertyGrid: hideIfNotModuleProject
            },
            {
                name: "timeoutMs",
                displayName: `Timeout (ms, default ${SCPI_DEFAULT_TIMEOUT_MS})`,
                type: PropertyType.Number,
                hideInPropertyGrid: hideIfNotModuleProject
            },
            {
                name: "applyOnDibSync",
                displayName: "Apply on DIB SYNC (e.g. output enable, switched together in all the modules)",
                type: PropertyType.Boolean,
                checkboxStyleSwitch: true,
                hideInPropertyGrid: hideIfNotModuleProject
            }
        ],
        check: (command: ScpiCommand, messages: IMessage[]) => {
            if (!isScpiModuleProject(command)) {
                return;
            }

            const pattern = getScpiCommandPattern(command);

            // the same pattern must not be defined twice in the module
            const project = ProjectEditor.getProject(command);
            let first: ScpiCommand | undefined;
            for (const subsystem of project.scpi.subsystems) {
                first = subsystem.commands.find(
                    other => getScpiCommandPattern(other) == pattern
                );
                if (first) {
                    break;
                }
            }
            if (first && first !== command) {
                messages.push(
                    new Message(
                        MessageType.ERROR,
                        `Command pattern '${pattern}' is defined more than once`,
                        getChildOfObject(command, "name")
                    )
                );
            }

            if (!command.isQuery && getScpiResponseItems(command).length > 0) {
                messages.push(
                    new Message(
                        MessageType.ERROR,
                        `Only a query (name ends with '?') can have a response`,
                        getChildOfObject(command, "response")
                    )
                );
            }

            // optional parameters come last
            let optionalFound = false;
            for (const parameter of command.parameters || []) {
                if (parameter.isOptional) {
                    optionalFound = true;
                } else if (optionalFound) {
                    messages.push(
                        new Message(
                            MessageType.ERROR,
                            `Parameter '${parameter.name}' must be optional because it follows an optional parameter`,
                            getChildOfObject(parameter, "isOptional")
                        )
                    );
                }
            }

            if (
                command.timeoutMs != undefined &&
                (command.timeoutMs <= 0 || command.timeoutMs > 65535)
            ) {
                messages.push(
                    propertyInvalidValueMessage(command, "timeoutMs")
                );
            }

            if (getScpiAddressing(command).kind == "bb3") {
                messages.push(
                    new Message(
                        MessageType.WARNING,
                        `Addressing "BB3+ only" means this command is never sent to the module`,
                        getChildOfObject(command, "addressing")
                    )
                );
            }
        },
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
                values: {},
                modal: true,
                backdrop: "static"
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
                values: {},
                modal: true,
                backdrop: "static"
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
