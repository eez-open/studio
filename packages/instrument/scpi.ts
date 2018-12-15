import { filterFloat } from "eez-studio-shared/model/validation";

export interface IEnumMember {
    name: string;
    value: string;
}

export interface IEnum {
    name: string;
    members: IEnumMember[];
}

export type ParameterTypeType = "numeric" | "boolean" | "string" | "discrete";

export interface IParameterType {
    type: ParameterTypeType;
    enumeration?: string;
}

export interface IParameter {
    name: string;
    type: IParameterType[];
    isOptional: boolean;
    description?: string;
}

export type ResponseType =
    | "nr1"
    | "nr2"
    | "nr3"
    | "boolean"
    | "string"
    | "arbitrary-block"
    | "discrete";

export interface IResponse {
    type: ResponseType;
    enumeration?: string;
    description?: string;
}

export interface ICommand {
    name: string;
    description?: string;
    helpLink?: string;
    usedIn?: string[] | undefined;
    parameters: IParameter[];
    response: IResponse;
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

export function getSdlParameterType(parameterType: IParameterType) {
    if (parameterType.type === "numeric") {
        return "<DecimalNumeric />";
    }

    if (parameterType.type === "string") {
        return "<String />";
    }

    if (parameterType.type === "boolean") {
        return `<NonDecimalNumeric />`;
    }

    if (parameterType.type === "discrete") {
        return `<Character><EnumRef name="${parameterType.enumeration}" /></Character>`;
    }

    return "<UnknownType />";
}

export function getSdlSemanticType(responseType: ResponseType | ParameterTypeType) {
    if (responseType === "numeric") {
        return "Real";
    }

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

    if (responseType === "string") {
        return "String";
    }

    if (responseType === "arbitrary-block") {
        return "Block";
    }

    if (responseType === "discrete") {
        return "String";
    }

    return "Unknown";
}

export function getSdlResponseType(response: IResponse) {
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

    if (response.type === "string") {
        return "<ArbitraryAscii />";
    }

    if (response.type === "arbitrary-block") {
        return "<DefiniteLengthArbitraryBlock />";
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

    if (data.startsWith("**ERROR:")) {
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
