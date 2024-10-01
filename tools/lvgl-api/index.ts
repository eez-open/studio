import fs from "fs";

import { Build } from "./build";

import type { LvglAPI, Type, RetType, Arg, Function } from "./api";

const ARG_NAME_PLACHOLDER = "$$$_NAME_$$$";

function getType(type: Type): string {
    if (type.json_type === "array") {
        return `${
            type.type ? getType(type.type) : type.name
        }${ARG_NAME_PLACHOLDER}[${type.dim ? type.dim : ""}]`;
    } else if (type.json_type === "forward_decl") {
        return getType(type.type) + " " + type.name;
    } else if (type.json_type === "function_pointer") {
        return `${getReturn(type.type)} (*${ARG_NAME_PLACHOLDER})(${type.args
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
        return type.name;
    } else if (type.json_type === "special_type") {
        return "";
    } else {
        throw new Error(`Unknown type: ${type.json_type}`);
    }

    return type.json_type + "{}";
}

function getReturn(retType: RetType): string {
    const type = getType(retType.type);

    if (type.indexOf(ARG_NAME_PLACHOLDER) !== -1) {
        return type.replace(ARG_NAME_PLACHOLDER, "");
    }

    return type;
}

function getArg(arg: Arg): string {
    const type = getType(arg.type);

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
            func.name == "lv_calloc" ||
            func.name == "lv_zalloc" ||
            func.name == "lv_snprintf" ||
            func.name == "lv_log" ||
            func.name == "lv_log_add" ||
            func.name == "lv_sqr" ||
            func.name == "lv_sqrt32" ||
            func.name == "lv_array_shrink" ||
            func.name.startsWith("lv_bidi") ||
            func.name.startsWith("lv_font") ||
            func.name.startsWith("lv_image_cache") ||
            func.name.startsWith("lv_image_header") ||
            func.name.startsWith("lv_cache") ||
            func.name.startsWith("lv_lock") ||
            func.name.startsWith("lv_unlock") ||
            func.name.startsWith("lv_thread_") ||
            func.name.startsWith("lv_iter_") ||
            func.name.startsWith("lv_anim_") ||
            func.name.startsWith("lv_draw_buf") ||
            func.name.startsWith("lv_draw_task") ||
            func.name.startsWith("lv_color") ||
            func.name.startsWith("lv_utils") ||
            func.name.startsWith("lv_str") ||
            (func.name.startsWith("lv_mem") &&
                !func.name.startsWith("lv_mem_")) ||
            func.name.startsWith("lv_ll_")
        ) {
            console.log("Skipping", func.name);
            skipped++;
            continue;
        }

        buildFunction(build, func);
        processed++;
    }

    console.log("Skipped", skipped, "functions");
    console.log("Processed", processed, "functions");

    await fs.promises.writeFile(
        "../../packages/project-editor/flow/runtime/cpp/lvgl-runtime/v9.0/stub_api.c",
        build.result
    );
})();
