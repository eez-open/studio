"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const build_1 = require("./build");
const ARG_NAME_PLACHOLDER = "$$$_NAME_$$$";
function getType(type) {
    if (type.json_type === "array") {
        return `${type.type ? getType(type.type) : type.name}${ARG_NAME_PLACHOLDER}[${type.dim ? type.dim : ""}]`;
    }
    else if (type.json_type === "forward_decl") {
        return getType(type.type) + " " + type.name;
    }
    else if (type.json_type === "function_pointer") {
        return `${getReturn(type.type)} (*${ARG_NAME_PLACHOLDER})(${type.args
            .map((arg) => getArg(arg))
            .join(", ")})`;
    }
    else if (type.json_type === "pointer") {
        return `${getType(type.type)} *`;
    }
    else if (type.json_type === "primitive_type" ||
        type.json_type === "lvgl_type" ||
        type.json_type === "stdlib_type" ||
        type.json_type === "unknown_type") {
        return type.name;
    }
    else if (type.json_type === "special_type") {
        return "";
    }
    else {
        throw new Error(`Unknown type: ${type.json_type}`);
    }
    return type.json_type + "{}";
}
function getReturn(retType) {
    const type = getType(retType.type);
    if (type.indexOf(ARG_NAME_PLACHOLDER) !== -1) {
        return type.replace(ARG_NAME_PLACHOLDER, "");
    }
    return type;
}
function getArg(arg) {
    const type = getType(arg.type);
    const argName = arg.name != null ? " " + arg.name : "";
    if (type.indexOf(ARG_NAME_PLACHOLDER) !== -1) {
        return type.replace(ARG_NAME_PLACHOLDER, argName);
    }
    return type + argName;
}
function buildFunction(build, func) {
    if (func.docstring) {
        build.line(`/*`);
        build.text(func.docstring);
        build.line("");
        build.line(`*/`);
    }
    build.line(`${getReturn(func.type)} ${"stub_" + func.name}(${func.args
        .map((arg) => getArg(arg))
        .join(", ")}) {`);
    build.indent();
    build.line(`${func.type.type.json_type == "primitive_type" &&
        func.type.type.name == "void"
        ? ""
        : "return "}${func.name}(${func.args
        .filter(arg => arg.name != null)
        .map(arg => arg.name)
        .join(",")});`);
    build.unindent();
    build.line(`}`);
    build.line("");
}
(function main() {
    return __awaiter(this, void 0, void 0, function* () {
        const apiStr = yield fs_1.default.promises.readFile("lvgl-8.json", "utf-8");
        const api = JSON.parse(apiStr);
        const build = new build_1.Build();
        build.startBuild();
        build.line("#include <lvgl/lvgl.h>");
        build.line("");
        let skipped = 0;
        let processed = 0;
        for (const func of api.functions) {
            if (func.name == "lv_calloc" ||
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
                func.name.startsWith("lv_ll_")) {
                console.log("Skipping", func.name);
                skipped++;
                continue;
            }
            buildFunction(build, func);
            processed++;
        }
        console.log("Skipped", skipped, "functions");
        console.log("Processed", processed, "functions");
        yield fs_1.default.promises.writeFile("../../packages/project-editor/flow/runtime/cpp/lvgl-runtime/v9.0/stub_api.c", build.result);
    });
})();
