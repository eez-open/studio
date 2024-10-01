export interface LvglAPI {
    enums: Enum[];
    functions: Function[];
    function_pointers: FunctionPointer[];
    structures: Enum[];
    unions: Enum[];
    variables: Variable[];
    typedefs: Typedef[];
    forward_decls: Enum[];
    macros: Macro[];
}

export interface Enum {
    name: null | string;
    type?: MemberType;
    json_type: EnumJSONType;
    docstring?: null | string;
    members?: Member[];
    quals?: "const"[];
    fields?: EnumField[];
}

export interface EnumField {
    name: string;
    type: PurpleType;
    json_type: FieldJSONType;
    bitsize: null | string;
    docstring: string;
}

export type FieldJSONType =
    | "field"
    | "primitive_type"
    | "stdlib_type"
    | "lvgl_type"
    | "pointer"
    | "arg"
    | "ret_type"
    | "typedef";

export interface PurpleType {
    name?: string;
    json_type: FunctionPointerJSONType;
    quals: any[];
    type?: Typedef;
    docstring?: string;
    fields?: PurpleField[];
    args?: TypeElement[];
    dim?: string;
}

export interface TypeElement {
    name?: null | string;
    json_type: FieldJSONType;
    quals?: "const"[];
    type?: TypeElement;
    docstring?: string;
    bitsize?: null;
}

export interface PurpleField {
    name: string;
    type: FluffyType;
    json_type: FieldJSONType;
    bitsize: null;
    docstring: string;
}

export interface FluffyType {
    name?: string;
    json_type: FieldJSONType;
    quals: any[];
    type?: TypeElement;
}

export type FunctionPointerJSONType =
    | "stdlib_type"
    | "pointer"
    | "lvgl_type"
    | "union"
    | "function_pointer"
    | "array"
    | "primitive_type"
    | "struct"
    | "special_type";

export interface Typedef {
    name?: null | string;
    json_type: FieldJSONType;
    quals?: "const"[];
    type?: TypeElement;
    docstring?: TypedefDocstring;
}

export type TypedefDocstring = "" | "Dummy type to make handling easier ";

export type EnumJSONType =
    | "enum"
    | "forward_decl"
    | "primitive_type"
    | "lvgl_type"
    | "stdlib_type"
    | "struct"
    | "union";

export interface Member {
    name: string;
    type: MemberType;
    json_type: "enum_member";
    docstring: string;
    value: string;
}

export interface MemberType {
    name: string;
    json_type: FieldJSONType;
}

export interface FunctionPointer {
    name: string;
    type: FunctionPointerType;
    json_type: FunctionPointerJSONType;
    docstring: string;
    args: FunctionPointerArg[];
    quals: any[];
}

export interface FunctionPointerArg {
    name: null | string;
    type: TentacledType;
    json_type: FieldJSONType;
    docstring: string;
    quals?: "const"[];
}

export interface TentacledType {
    name?: string;
    json_type: FieldJSONType;
    quals?: "const"[];
    type?: Enum;
}

export interface FunctionPointerType {
    type: TypeElement;
    json_type: FieldJSONType;
    docstring: string;
}

export interface Function {
    name: string;
    type: FunctionPointerType;
    json_type: "function";
    docstring: string;
    args: FunctionArg[];
}

export interface FunctionArg {
    name: null | string;
    type: StickyType;
    json_type: FieldJSONType;
    docstring: string;
    quals?: any[];
}

export interface StickyType {
    name?: string;
    json_type: FunctionPointerJSONType;
    quals?: "const"[];
    type?: IndigoType;
    docstring?: string;
    args?: Typedef[];
    dim?: null;
}

export interface IndigoType {
    name?: string;
    json_type: PurpleJSONType;
    quals?: "const"[];
    type?: TentacledType;
    docstring?: null | string;
    fields?: FluffyField[];
}

export interface FluffyField {
    name: string;
    type: TentacledType;
    json_type: FieldJSONType;
    bitsize: null;
    docstring: string;
}

export type PurpleJSONType =
    | "primitive_type"
    | "lvgl_type"
    | "ret_type"
    | "stdlib_type"
    | "forward_decl"
    | "pointer"
    | "struct";

export interface Macro {
    name: string;
    json_type: "macro";
    docstring: string;
    params: string[] | null;
    initializer: null | string;
}

export interface Variable {
    name: string;
    type: TypeElement;
    json_type: "variable";
    docstring: VariableDocstring;
    quals: "const"[];
    storage: "extern"[];
}

export type VariableDocstring =
    | ""
    | "Make the base object's class publicly available. ";
