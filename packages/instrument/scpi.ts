import { filterFloat } from "eez-studio-shared/validation";

export interface IEnumMember {
    name: string;
    value: string;
}

export interface IEnum {
    name: string;
    members: IEnumMember[];
}

export type IParameterTypeType =
    | "any"
    | "nr1"
    | "nr2"
    | "nr3"
    | "boolean"
    | "quoted-string"
    | "data-block"
    | "channel-list"
    | "discrete";

export interface IParameterType {
    type: IParameterTypeType;
    enumeration?: string;
}

export interface IParameter {
    name: string;
    type: IParameterType[];
    isOptional: boolean;
    description?: string;
}

export type IResponseTypeType =
    | "any"
    | "nr1"
    | "nr2"
    | "nr3"
    | "boolean"
    | "quoted-string"
    | "arbitrary-ascii"
    | "list-of-quoted-string"
    | "data-block"
    | "non-standard-data-block"
    | "discrete";

export interface IResponseType {
    type: IResponseTypeType;
    enumeration?: string;
}

export interface IResponse {
    type: IResponseType[];
    description?: string;
}

export interface ICommand {
    name: string;
    description?: string;
    helpLink?: string;
    usedIn?: string[] | undefined;
    parameters: IParameter[];
    response: IResponse;
    sendsBackDataBlock: boolean;
}

export interface ISubsystem {
    commands: ICommand[];
    enums: IEnum[];
}

export function getSdlSemanticTypeForParameter(parameter: IParameter) {
    if (parameter.type[0]) {
        return getSdlSemanticType(parameter.type[0].type);
    }
    return "Unknown";
}

export function getSdlSemanticTypeForResponse(response: IResponse) {
    if (response.type[0]) {
        return getSdlSemanticType(response.type[0].type);
    }
    return "Unknown";
}

export function getSdlParameterType(parameterType: IParameterType) {
    if (parameterType.type === "any") {
        return "<Any />";
    }

    if (parameterType.type === "nr1") {
        return "<NonDecimalNumeric />";
    }

    if (parameterType.type === "nr2" || parameterType.type === "nr3") {
        return "<DecimalNumeric />";
    }

    if (parameterType.type === "quoted-string") {
        return "<String />";
    }

    if (parameterType.type === "boolean") {
        return `<NonDecimalNumeric />`;
    }

    if (parameterType.type === "data-block") {
        return `<DataBlock />`;
    }

    if (parameterType.type === "discrete") {
        return `<Character><EnumRef name="${parameterType.enumeration}" /></Character>`;
    }

    if (parameterType.type === "channel-list") {
        return "<Expression><ChannelList/></Expression>";
    }

    return "<UnknownType />";
}

export function getSdlSemanticType(responseType: IParameterTypeType | IResponseTypeType) {
    if (responseType === "nr1") {
        return "Integer";
    }

    if (responseType === "nr2") {
        return "Real";
    }

    if (responseType === "nr3") {
        return "Real";
    }

    if (responseType === "boolean") {
        return "Boolean";
    }

    if (responseType === "quoted-string" || responseType === "arbitrary-ascii") {
        return "String";
    }

    if (responseType === "list-of-quoted-string") {
        return "ArrayOfString";
    }

    if (responseType === "data-block") {
        return "Block";
    }

    if (responseType === "non-standard-data-block") {
        return "NonStandardBlock";
    }

    if (responseType === "discrete") {
        return "String";
    }

    if (responseType === "channel-list") {
        return "String";
    }

    return "Unknown";
}

export function getSdlResponseType(response: IResponseType) {
    if (response.type === "any") {
        return "<Any />";
    }

    if (response.type === "nr1") {
        return "<NR1Numeric />";
    }

    if (response.type === "nr2") {
        return "<NR2Numeric />";
    }

    if (response.type === "nr3") {
        return "<NR3Numeric />";
    }

    if (response.type === "boolean") {
        return `<NR1Numeric />`;
    }

    if (response.type === "quoted-string") {
        return "<String />";
    }

    if (response.type === "arbitrary-ascii") {
        return "<ArbitraryAscii />";
    }

    if (response.type === "list-of-quoted-string") {
        return "<ListOfQuotedString />";
    }

    if (response.type === "data-block") {
        return "<DataBlock />";
    }

    if (response.type === "non-standard-data-block") {
        return "<NonStandardDataBlock />";
    }

    if (response.type === "discrete") {
        return `<Character><EnumRef name="${response.enumeration}" /></Character>`;
    }

    return "<UnknownType />";
}

export function parseScpiValue(data: string) {
    data = data.trim();

    let value = filterFloat(data);
    if (!isNaN(value)) {
        return value;
    }

    if (data.startsWith("**ERROR")) {
        return {
            error: data
        };
    }

    return data;
}

export function compareMnemonic(pattern: string, mnemonic: string) {
    let i;
    for (i = 0; i < mnemonic.length && i < pattern.length; ++i) {
        if (pattern[i].toLowerCase() !== mnemonic[i].toLowerCase()) {
            return false;
        }
    }

    if (i < mnemonic.length) {
        return false;
    }

    if (i < pattern.length) {
        if (pattern[i].toUpperCase() === pattern[i]) {
            return false;
        }
    }

    return true;
}
