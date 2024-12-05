import fs from "fs";
import path from "path";
import { exec } from "child_process";

////////////////////////////////////////////////////////////////////////////////

const isDev = process.argv[process.argv.length - 1] == "dev";

const OUT_DIR = isDev
    ? "./out"
    : "../../../resources/eez-framework-amalgamation";

// only used if isDev
const CLEANUP_SRC_DIR = "./src";
const META_DIR = "./meta";

////////////////////////////////////////////////////////////////////////////////

const EEZ_FRAMEWORK_PATH = path.resolve("../../../wasm//eez-framework");

const BASE_PATH = path.resolve(EEZ_FRAMEWORK_PATH + "/src/eez");

const CONFIG = {
    ignore: [
        "fs",
        "gui",
        "libs",
        "platform",
        "core/eeprom.cpp",
        "core/eeprom.h",
        "core/encoder.h",
        "core/hmi.cpp",
        "core/hmi.h",
        "core/keyboard.h",
        "core/mouse.h",
        "core/sound.h",
        "core/step_values.h",
        "flow/dashboard_api.h",
        "flow/dashboard_api.cpp",
        "flow/components/LineChartWidgetComponenent.cpp",
        "flow/components/LineChartWidgetComponenent.h",
        "flow/components/line_chart_widget.h",
        "flow/components/override_style.cpp",
        "flow/components/set_page_direction.cpp",
        "flow/components/show_keyboard.cpp",
        "flow/components/show_keypad.cpp",
        "flow/components/show_message_box.cpp",
        "flow/components/roller_widget.cpp",
        "flow/components/roller_widget.h",
        "flow/components/user_widget.cpp"
    ],
    headersFront: ["conf-internal.h"],
    headersCPP: [
        "core/unit.h",
        "core/value_types.h",
        "core/alloc.h",
        "flow/flow_defs_v3.h",
        "core/value.h",
        "core/action.h",
        "core/assets.h",
        "core/debug.h",
        "core/os.h",
        "core/memory.h",
        "core/utf8.h",
        "core/util.h",
        "flow/private.h",
        "flow/components.h",
        "flow/date.h",
        "flow/debugger.h",
        "flow/expression.h",
        "flow/flow.h",
        "flow/hooks.h",
        "flow/operations.h",
        "flow/queue.h",
        "flow/watch_list.h",
        "flow/components/call_action.h",
        "flow/components/input.h",
        "flow/components/lvgl.h",
        "flow/components/lvgl_user_widget.h",
        "flow/components/mqtt.h",
        "flow/components/on_event.h",
        "flow/components/set_variable.h",
        "flow/components/sort_array.h",
        "flow/components/switch.h"
    ],
    headersC: ["core/vars.h", "flow/lvgl_api.h"]
};

////////////////////////////////////////////////////////////////////////////////

function walk(dir: string, done: (err: any, result: string[]) => void) {
    var results: string[] = [];
    fs.readdir(dir, function (err, list) {
        if (err) return done(err, []);
        var pending = list.length;
        if (!pending) return done(null, results);

        list.forEach(function (file) {
            file = path.resolve(dir, file);
            fs.stat(file, function (err, stat) {
                if (stat && stat.isDirectory()) {
                    walk(file, function (err, res) {
                        results = results.concat(res);
                        if (!--pending) done(null, results);
                    });
                } else {
                    results.push(file);
                    if (!--pending) done(null, results);
                }
            });
        });
    });
}

////////////////////////////////////////////////////////////////////////////////

function evalExpr(expr: string) {
    // TODO currenty not implemented

    /*

    function defined(x: any) {
        return x;
    }

    function __has_include(x: string) {
        return true;
    }
    __has_include("");

    const __EMSCRIPTEN__ = undefined;
    defined(__EMSCRIPTEN__);

    const EEZ_FOR_LVGL = true;
    defined(EEZ_FOR_LVGL);

    const EEZ_PLATFORM_ESP32 = undefined;
    defined(EEZ_PLATFORM_ESP32);

    const EEZ_PLATFORM_PICO = undefined;
    defined(EEZ_PLATFORM_PICO);

    const EEZ_PLATFORM_RASPBERRY = undefined;
    defined(EEZ_PLATFORM_RASPBERRY);

    const EEZ_PLATFORM_SIMULATOR = undefined;
    defined(EEZ_PLATFORM_SIMULATOR);

    const EEZ_PLATFORM_STM32F469I_DISCO = undefined;
    defined(EEZ_PLATFORM_STM32F469I_DISCO);

    const LZ4_DLL_IMPORT = undefined;
    defined(LZ4_DLL_IMPORT);

    const LZ4_FORCE_MEMORY_ACCESS = undefined;
    defined(LZ4_FORCE_MEMORY_ACCESS);

    const EEZ_FLOW_EVAL_STACK_SIZE = undefined;
    defined(EEZ_FLOW_EVAL_STACK_SIZE);

    const EEZ_FLOW_QUEUE_SIZE = undefined;
    defined(EEZ_FLOW_QUEUE_SIZE);

    const EEZ_LVGL_SCREEN_STACK_SIZE = undefined;
    defined(EEZ_LVGL_SCREEN_STACK_SIZE);

    const ARDUINO = undefined;
    defined(ARDUINO);

    const EEZ_OPTION_GUI = false;
    defined(EEZ_OPTION_GUI);

    const LVGL_VERSION_MAJOR = undefined;
    defined(LVGL_VERSION_MAJOR);

    const EEZ_PLATFORM_STM32 = false;
    defined(EEZ_PLATFORM_STM32);

    const OPTION_SCPI = false;
    defined(OPTION_SCPI);

    const USE_EEPROM = false;
    defined(USE_EEPROM);

    const OPTION_KEYBOARD = false;
    defined(OPTION_KEYBOARD);

    const EEZ_OPTION_GUI_ANIMATIONS = false;
    defined(EEZ_OPTION_GUI_ANIMATIONS);

    const LV_MEM_SIZE = undefined;
    defined(LV_MEM_SIZE);

    const CONF_OPTION_FPGA = undefined;
    defined(CONF_OPTION_FPGA);

    const CONF_MAX_DECOMPRESSED_ASSETS_SIZE = undefined;
    defined(CONF_MAX_DECOMPRESSED_ASSETS_SIZE);

    const UTF8_SUPPORT = undefined;
    defined(UTF8_SUPPORT);

    const M_PI = undefined;
    defined(M_PI);

    const EEZ_DASHBOARD_API = false;
    defined(EEZ_DASHBOARD_API);

    const INFINITY_SYMBOL = undefined;
    defined(INFINITY_SYMBOL);

    const OPTION_KEYPAD = false;
    defined(OPTION_KEYPAD);

    expr = expr.replace("201402L", "201402");
    expr = expr.replace("202002L", "202002");

    const result = eval(expr);
    if (result === true) {
        //console.log("true", expr);
    } else if (result === false) {
        //console.log("false", expr);
    }

    */

    return undefined;
}

////////////////////////////////////////////////////////////////////////////////

function removeComments(content: string) {
    let result = "";

    // remove comments
    let state: "code" | "singleline" | "multiline" = "code";
    for (let i = 0; i < content.length; i++) {
        const ch = content[i];
        if (state == "code") {
            if (ch == "/") {
                if (i + 1 < content.length) {
                    if (content[i + 1] == "/") {
                        state = "singleline";
                        i += 1;
                        continue;
                    } else if (content[i + 1] == "*") {
                        state = "multiline";
                        i += 1;
                        continue;
                    }
                }
            }
        } else if (state == "singleline") {
            if (ch == "\r" || ch == "\n") {
                state = "code";
            } else {
                continue;
            }
        } else if (state == "multiline") {
            if (ch == "*") {
                if (i + 1 < content.length) {
                    if (content[i + 1] == "/") {
                        state = "code";
                        i += 1;
                        continue;
                    }
                }
            }
            continue;
        }
        result += ch;
    }

    return result;
}

////////////////////////////////////////////////////////////////////////////////

function removePragmaOnce(content: string) {
    return content
        .match(/[^\r\n]+/g)!
        .filter(line => !line.startsWith("#pragma once"))
        .join("\n");
}

////////////////////////////////////////////////////////////////////////////////

function removeIncludeEez(content: string) {
    return content
        .match(/[^\r\n]+/g)!
        .filter(
            line =>
                !line.trim().startsWith("#include <eez/") &&
                !line.trim().startsWith('#include "eez/')
        )
        .join("\n");
}

function removeEmptyLines(content: string) {
    return content
        .match(/[^\r\n]+/g)!
        .filter(line => line.trim() != "")
        .join("\n");
}

////////////////////////////////////////////////////////////////////////////////

function cleanupH(content: string) {
    content = removeComments(content);
    content = removeIncludeEez(content);
    content = removePragmaOnce(content);
    content = removeEmptyLines(content);
    return content;
}

////////////////////////////////////////////////////////////////////////////////

function cleanupCPP(content: string) {
    content = removeComments(content);
    content = removeIncludeEez(content);
    content = removeEmptyLines(content);
    return content;
}

////////////////////////////////////////////////////////////////////////////////

function getDevInfo(
    filePath: string,
    content: string,
    includePaths: string[],
    ifs: string[]
) {
    for (let line of content.match(/[^\r\n]+/g)!) {
        line = line.trim();
        if (line.startsWith("#include")) {
            let includePath = line.substring("#include".length);
            includePath = includePath.trim();
            includePath = includePath.substring(1, includePath.length - 1);

            if (
                !includePath.startsWith("eez") &&
                !fs.existsSync(
                    path.dirname(BASE_PATH + "/" + filePath) + "/" + includePath
                ) &&
                !includePaths.find(
                    includePathIn => includePathIn == includePath
                )
            ) {
                includePaths.push(includePath);
            }
        } else {
            if (line.startsWith("#if ") || line.startsWith("#elif ")) {
                const expr = line.startsWith("#if ")
                    ? line.substring("#if ".length)
                    : line.substring("#elif ".length);

                evalExpr(expr);

                if (!ifs.find(ifIn => ifIn == line)) {
                    ifs.push(line);
                }
            } else if (line.startsWith("#if") || line.startsWith("#elif")) {
                if (!ifs.find(ifIn => ifIn == line)) {
                    ifs.push(line);
                }
            }
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

async function buildAutogenComment() {
    const today = new Date();
    const todayStr = `${today.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric"
    })} ${today.toLocaleTimeString("en-US")}`;

    const eezFrameworkSHA = await new Promise<string>((resolve, reject) => {
        exec(
            `git ls-tree HEAD "${EEZ_FRAMEWORK_PATH}"`,
            function (error, stdout, stderr) {
                if (error) {
                    reject(error);
                } else {
                    let matches = stdout.match(/.+\s+.+\s+(.+)\s+.+/);
                    if (!matches) {
                        reject("no matches in git result");
                    } else if (!matches[1]) {
                        reject("matches[1] is empty in git result");
                    } else {
                        resolve(matches[1]);
                    }
                }
            }
        );
    });

    return `/* Autogenerated on ${todayStr} from eez-framework commit ${eezFrameworkSHA} */`;
}

////////////////////////////////////////////////////////////////////////////////

async function buildEezH(files: Map<string, string>, autogenComment: string) {
    function buildHeader(filePath: string) {
        result +=
            "\n// -----------------------------------------------------------------------------\n";
        result += `// ${filePath}\n`;
        result +=
            "// -----------------------------------------------------------------------------\n";
        result += files.get(filePath);
    }

    let result = `${autogenComment}
/*
 * eez-framework
 *
 * MIT License
 * Copyright ${new Date().getFullYear()} Envox d.o.o.
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the “Software”), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 * THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
#pragma once

#define EEZ_FOR_LVGL 1
#define EEZ_FOR_LVGL_LZ4_OPTION 1
#define EEZ_FOR_LVGL_SHA256_OPTION 1
#define EEZ_FLOW_QUEUE_SIZE 1000
#define EEZ_FLOW_EVAL_STACK_SIZE 20
`;

    for (const filePath of CONFIG.headersFront) {
        buildHeader(filePath);
    }

    result += `\n#ifdef __cplusplus\n`;
    for (const filePath of CONFIG.headersCPP) {
        buildHeader(filePath);
    }
    result += `\n#endif\n`;

    for (const filePath of CONFIG.headersC) {
        buildHeader(filePath);
    }

    const utf8_H = await fs.promises.readFile(
        BASE_PATH + "/libs/utf8.h",
        "utf-8"
    );

    result += "\n\n";
    result += utf8_H;

    return result;
}

////////////////////////////////////////////////////////////////////////////////

async function buildEezCPP(files: Map<string, string>, autogenComment: string) {
    let result = `${autogenComment}
/*
 * eez-framework
 *
 * MIT License
 * Copyright ${new Date().getFullYear()} Envox d.o.o.
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the “Software”), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 * THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
#include "eez-flow.h"
#if EEZ_FOR_LVGL_LZ4_OPTION
#include "eez-flow-lz4.h"
#endif
#if EEZ_FOR_LVGL_SHA256_OPTION
extern "C" {
#include "eez-flow-sha256.h"
}
#endif
`;

    const filePaths = [...files.keys()];

    for (const filePath of filePaths) {
        result +=
            "\n// -----------------------------------------------------------------------------\n";
        result += `// ${filePath}\n`;
        result +=
            "// -----------------------------------------------------------------------------\n";
        result += files.get(filePath);
    }

    return result;
}

////////////////////////////////////////////////////////////////////////////////

walk(BASE_PATH, async (err, results) => {
    if (err) {
        console.error(err);
        process.exit(-1);
    }

    const filesAll = results
        .map(path => path.substring(BASE_PATH.length + 1).replace(/\\/g, "/"))
        .filter(path => {
            path = path.toLowerCase();
            return (
                path.endsWith(".cpp") ||
                path.endsWith(".c") ||
                path.endsWith(".h")
            );
        })
        .filter(
            path =>
                CONFIG.ignore.find(ignorePath => path.startsWith(ignorePath)) ==
                undefined
        );

    filesAll.sort();
    console.log(filesAll);

    const includePaths: string[] = [];
    const ifs: string[] = [];

    let filesH = new Map<string, string>();
    let filesCPP = new Map<string, string>();

    for (const filePath of filesAll) {
        const fullPath = BASE_PATH + "/" + filePath;

        let content = await fs.promises.readFile(fullPath, "utf-8");

        const isHeader = filePath.toLowerCase().endsWith(".h");

        if (isHeader) {
            // all header files must be declared in advance in CONFIG
            if (
                CONFIG.headersFront.indexOf(filePath) == -1 &&
                CONFIG.headersC.indexOf(filePath) == -1 &&
                CONFIG.headersCPP.indexOf(filePath) == -1
            ) {
                console.error("unknown header: ", filePath);
                process.exit(-2);
            }
        }

        content = isHeader ? cleanupH(content) : cleanupCPP(content);

        if (isHeader) {
            filesH.set(filePath, content);
        } else {
            filesCPP.set(filePath, content);
        }

        if (isDev) {
            getDevInfo(filePath, content, includePaths, ifs);

            // write cleaned-up content into CLEANUP_SRC_DIR
            const tmpFilePath = CLEANUP_SRC_DIR + "/" + filePath;
            await fs.promises.mkdir(path.dirname(tmpFilePath), {
                recursive: true
            });
            await fs.promises.writeFile(tmpFilePath, content);
        }
    }

    if (isDev) {
        // write meta for debugging purpose
        await fs.promises.mkdir(META_DIR, {
            recursive: true
        });

        await fs.promises.writeFile(
            META_DIR + "/results.json",
            JSON.stringify(
                {
                    h: [...filesH.keys()],
                    cpp: [...filesCPP.keys()]
                },
                undefined,
                2
            )
        );

        includePaths.sort((a: string, b: string) => {
            a = a.toLowerCase();
            b = b.toLowerCase();
            return a < b ? -1 : a == b ? 0 : 1;
        });
        await fs.promises.writeFile(
            META_DIR + "/includePaths.json",
            JSON.stringify(includePaths, undefined, 2)
        );

        ifs.sort((a: string, b: string) => {
            a = a.toLowerCase();
            b = b.toLowerCase();
            return a < b ? -1 : a == b ? 0 : 1;
        });
        await fs.promises.writeFile(
            META_DIR + "/ifs.json",
            JSON.stringify(ifs, undefined, 2)
        );
    }

    // write to OUT_DIR
    await fs.promises.rm(OUT_DIR, {
        recursive: true
    });
    await fs.promises.mkdir(OUT_DIR, {
        recursive: true
    });

    const autgenComment = await buildAutogenComment();

    // write eez-flow.h
    await fs.promises.writeFile(
        OUT_DIR + "/eez-flow.h",
        await buildEezH(filesH, autgenComment)
    );

    // write eez-flow.cpp
    await fs.promises.writeFile(
        OUT_DIR + "/eez-flow.cpp",
        await buildEezCPP(filesCPP, autgenComment)
    );

    // write eez-flow-lz4.c and eez-flow-lz4.h
    let lz4_c = await fs.promises.readFile(
        BASE_PATH + "/libs/lz4/lz4.c",
        "utf-8"
    );
    lz4_c = lz4_c.split("\n").slice(2, -2).join("\n");
    lz4_c = lz4_c.replace('#include "lz4.h"', '#include "eez-flow-lz4.h"');
    await fs.promises.writeFile(OUT_DIR + "/eez-flow-lz4.c", lz4_c, "utf-8");
    await fs.promises.cp(
        BASE_PATH + "/libs/lz4/lz4.h",
        OUT_DIR + "/eez-flow-lz4.h"
    );

    // write eez-flow-sha256.c and eez-flow-sha256.h
    let sha256_c = await fs.promises.readFile(
        BASE_PATH + "/libs/sha256/sha256.c",
        "utf-8"
    );
    sha256_c = sha256_c.split("\n").slice(2, -2).join("\n");
    sha256_c = sha256_c.replace(
        '#include "sha256.h"',
        '#include "eez-flow-sha256.h"'
    );
    await fs.promises.writeFile(
        OUT_DIR + "/eez-flow-sha256.c",
        sha256_c,
        "utf-8"
    );
    await fs.promises.cp(
        BASE_PATH + "/libs/sha256/sha256.h",
        OUT_DIR + "/eez-flow-sha256.h"
    );
});
