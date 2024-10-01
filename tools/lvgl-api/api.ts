export interface Array {
    json_type: "array";

    dim: number;
    quals: "const"[];
    type?: Type;
    name: string;
}

export interface Field {
    json_type: "field";

    name: string;
    type: Type;
    bitsize: number | null;
    docstring: string;
}

export interface Arg {
    json_type: "arg";

    name: string;
    type: Type;
    docstring: string;
    quals: "const"[];
}

export interface ForwardDecl {
    json_type: "forward_decl";

    name: string;
    type: Type;
    docstring: string;
    args: Arg[];
    quals: "const"[];
}

export interface FunctionPointer {
    json_type: "function_pointer";

    name: string;
    type: RetType;
    docstring: string;
    args: Arg[];
    quals: "const"[];
}

export interface Variable {
    json_type: "variable";

    name: string;
    type: Type;
    docstring: string;
    quals: "const"[];
    storage: "extern";
}

export interface SpecialType {
    json_type: "special_type";

    name: "ellipsis";
}

export interface PrimitiveType {
    json_type: "primitive_type";

    name: string;
    quals?: "const"[];
}

export interface Enum {
    json_type: "enum";

    name: string;
    type: Type;
    docstring: string;
    members: EnumMember[];
}

export interface EnumMember {
    json_type: "enum_member";

    name: string;
    type: Type;
    docstring: string;
    value: string;
}

export interface LvglType {
    json_type: "lvgl_type";

    name: string;
    quals: "const"[];
}

export interface Struct {
    json_type: "struct";

    name: string;
    type: Type;
    docstring: string;
    fields: Field[];
    quals: "const"[];
}

export interface Union {
    json_type: "union";

    name: string;
    type: Type;
    docstring: string;
    fields: Field[];
    quals: "const"[];
}

export interface Macro {
    json_type: "macro";

    name: string;
    docstring: string;
}

export interface RetType {
    json_type: "ret_type";

    type: Type;
    docstring: string;
}

export interface Function {
    json_type: "function";

    name: string;
    type: RetType;
    docstring: string;
    args: Arg[];
}

export interface StdlibType {
    json_type: "stdlib_type";

    name: string;
    quals: "const"[];
}

export interface UnknownType {
    json_type: "unknown_type";

    name: string;
    quals: "const"[];
}

export interface Pointer {
    json_type: "pointer";

    type: Type;
    quals: "const"[];
}

export interface Typedef {
    json_type: "typedef";

    name: string;
    type: Type;
    docstring: string;
    quals: "const"[];
}

export type Type =
    | Array
    | ForwardDecl
    | FunctionPointer
    | SpecialType
    | PrimitiveType
    | LvglType
    | StdlibType
    | UnknownType
    | Pointer
    | {
          json_type: null;
      };

export type LvglAPI = {
    enums: Enum[];
    functions: Function[];
    function_pointers: Function[];
    structures: Struct[];
    unions: Union[];
    variables: Variable[];
    typedefs: Typedef[];
    forward_decls: ForwardDecl[];
    macros: Macro[];
};
