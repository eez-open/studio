import fs from "fs";

import { Build } from "./build";

import type { LvglAPI, Type, RetType, Arg, Function } from "./api";

const VERSION = "8.3";

const ARG_NAME_PLACHOLDER = "$$$_NAME_$$$";

function getType(type: Type): string {
    try {
        if (type.json_type === "array") {
            return `${
                type.type ? getType(type.type) : type.name
            }${ARG_NAME_PLACHOLDER}[${type.dim ? type.dim : ""}]`;
        } else if (type.json_type === "forward_decl") {
            return getType(type.type) + " " + type.name;
        } else if (type.json_type === "function_pointer") {
            return `${getReturn(
                type.type
            )} (*${ARG_NAME_PLACHOLDER})(${type.args
                .map((arg: any) => getArg(arg))
                .join(", ")})`;
        } else if (type.json_type === "pointer") {
            return `${getType(type.type)} *`;
        } else if (
            type.json_type === "primitive_type" ||
            type.json_type === "lvgl_type" ||
            type.json_type === "stdlib_type" ||
            type.json_type === "unknown_type"
        ) {
            return (type.quals?.[0] == "const" ? "const " : "") + type.name;
        } else if (type.json_type === "special_type") {
            return "";
        } else {
            throw new Error(`Unknown type: ${type.json_type}`);
        }

        return type.json_type + "{}";
    } catch (e) {
        console.error("Error getting type", type);
        throw e;
    }
}

const types = new Set<string>();

function addType(type: string) {
    if (type.startsWith("const")) {
        type = type.slice(6);
    }
    if (type.startsWith("void") || type.startsWith("bool")) {
        return;
    }
    if (
        type.startsWith("int") ||
        type.startsWith("uint") ||
        type.startsWith("char") ||
        type.startsWith("size_t") ||
        type.startsWith("va_list")
    ) {
        return;
    }

    types.add(type);
}

function getReturn(retType: RetType): string {
    const type = getType(retType.type);

    addType(type.replace(ARG_NAME_PLACHOLDER, ""));

    if (type.indexOf(ARG_NAME_PLACHOLDER) !== -1) {
        return type.replace(ARG_NAME_PLACHOLDER, "");
    }

    return type;
}

function getArg(arg: Arg): string {
    const type = getType(arg.type);

    addType(type.replace(ARG_NAME_PLACHOLDER, ""));

    const argName = arg.name != null ? " " + arg.name : "";

    if (type.indexOf(ARG_NAME_PLACHOLDER) !== -1) {
        return type.replace(ARG_NAME_PLACHOLDER, argName);
    }

    return type + argName;
}

function buildFunction(build: Build, func: Function) {
    if (func.docstring) {
        build.line(`/*`);
        build.text(func.docstring);
        build.line("");
        build.line(`*/`);
    }

    build.line(
        `${getReturn(func.type)} ${"stub_" + func.name}(${func.args
            .map((arg: any) => getArg(arg))
            .join(", ")}) {`
    );

    build.indent();

    build.line(
        `${
            func.type.type.json_type == "primitive_type" &&
            func.type.type.name == "void"
                ? ""
                : "return "
        }${func.name}(${func.args
            .filter(arg => arg.name != null)
            .map(arg => arg.name)
            .join(",")});`
    );

    build.unindent();
    build.line(`}`);
    build.line("");
}

(async function main() {
    const exportedFunctions = (
        await fs.promises.readFile(
            `../../wasm/lvgl-runtime/v${VERSION}/exported-functions.txt`,
            "utf-8"
        )
    )
        .split("\n")
        .filter(line => line.startsWith("_lv"))
        .map(line => line.slice(1));

    const apiStr = await fs.promises.readFile("lvgl-8.json", "utf-8");
    const api: LvglAPI = JSON.parse(apiStr);

    const build = new Build();
    build.startBuild();

    build.line("#include <lvgl/lvgl.h>");

    build.line("");

    let skipped = 0;
    let processed = 0;

    for (const func of api.functions) {
        if (
            !exportedFunctions.includes(func.name) ||
            func.name == "lv_log" ||
            func.name == "lv_snprintf" ||
            func.name == "lv_draw_buf_save_to_file" ||
            func.name == "lv_font_get_glyph_bitmap" ||
            func.name == "lv_font_get_bitmap_fmt_txt" ||
            func.name == "lv_label_set_text_fmt" ||
            func.name == "lv_table_set_cell_value_fmt"
        ) {
            console.log("Skipping", func.name);
            skipped++;
            continue;
        }

        buildFunction(build, func);
        processed++;
    }

    const enumTypes = new Set<string>();
    for (const type of types) {
        for (const enumType of api.enums) {
            if (type.startsWith(enumType.name)) {
                types.delete(type);
                enumTypes.add(enumType.name);
            }
        }
    }

    const structTypes = new Set<string>();
    for (const type of types) {
        for (const structType of api.structures) {
            if (type.startsWith(structType.name)) {
                types.delete(type);
                structTypes.add(structType.name);
            }
        }
    }

    const functionPointers = new Set<string>();
    for (const type of types) {
        for (const functionPointer of api.function_pointers) {
            if (type.startsWith(functionPointer.name)) {
                types.delete(type);
                functionPointers.add(functionPointer.name);
            }
        }
    }

    const forwardDecls = new Set<string>();
    for (const type of types) {
        for (const forwardDecl of api.forward_decls) {
            if (type.startsWith(forwardDecl.name)) {
                types.delete(type);
                forwardDecls.add(forwardDecl.name);
            }
        }
    }

    const unionTypes = new Set<string>();
    for (const type of types) {
        for (const unionType of api.unions) {
            if (type.startsWith(unionType.name)) {
                types.delete(type);
                unionTypes.add(unionType.name);
            }
        }
    }

    const typedefs = new Set<string>();
    for (const type of types) {
        for (const typdef of api.typedefs) {
            if (type.startsWith(typdef.name)) {
                types.delete(type);
                typedefs.add(typdef.name);
            }
        }
    }

    console.log("Enum Types", [...enumTypes.keys()].join(", "));
    console.log("Struct Types", [...structTypes.keys()].join(", "));
    console.log("Function pointers", [...functionPointers.keys()].join(", "));
    console.log("Forward decls", [...forwardDecls.keys()].join(", "));
    console.log("Union types", [...unionTypes.keys()].join(", "));
    console.log("Typedefs", [...typedefs.keys()].join(", "));

    console.log("Types", [...types.keys()].join(", "));

    console.log("Skipped", skipped, "functions");
    console.log("Processed", processed, "functions");

    await fs.promises.writeFile(
        `../../wasm/lvgl-runtime/v${VERSION}/stub_api.c`,
        build.result
    );
})();
