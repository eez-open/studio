import { resolve } from "path";

import { getTempDirPath, isDev } from "eez-studio-shared/util-electron";
import { sourceRootDir } from "eez-studio-shared/util";

import type { IEezObject } from "project-editor/core/object";
import { ProjectEditor } from "project-editor/project-editor-interface";
import type { Bitmap, BitmapData } from "project-editor/features/bitmap/bitmap";
import type { IWasmFlowRuntime } from "eez-studio-types";
import {
    CF_ALPHA_1_BIT,
    CF_ALPHA_2_BIT,
    CF_ALPHA_4_BIT,
    CF_ALPHA_8_BIT,
    CF_INDEXED_1_BIT,
    CF_INDEXED_2_BIT,
    CF_INDEXED_4_BIT,
    CF_INDEXED_8_BIT,
    CF_L8,
    CF_RAW,
    CF_RAW_ALPHA,
    CF_RAW_CHROMA,
    CF_RGB565,
    CF_RGB565A8,
    CF_TRUE_COLOR,
    CF_TRUE_COLOR_ALPHA,
    CF_TRUE_COLOR_CHROMA,
    LVGLStylePropCode,
    LVGL_EVENTS_V8,
    LVGL_EVENTS_V9,
    LVGL_FLAG_CODES,
    LVGL_FLAG_CODES_90,
    LVGL_PARTS_8,
    LVGL_PARTS_9
} from "project-editor/lvgl/lvgl-constants";
import { settingsController } from "home/settings";

////////////////////////////////////////////////////////////////////////////////

const V8_LV_COORD_TYPE_SHIFT = 13;
const V8_LV_COORD_TYPE_SPEC = 1 << V8_LV_COORD_TYPE_SHIFT;
function V8_LV_COORD_SET_SPEC(x: number) {
    return x | V8_LV_COORD_TYPE_SPEC;
}

const V8_LV_COORD_MAX = (1 << V8_LV_COORD_TYPE_SHIFT) - 1;

function V8_LV_PCT(x: number) {
    return x < 0 ? V8_LV_COORD_SET_SPEC(1000 - x) : V8_LV_COORD_SET_SPEC(x);
}

const V8_LV_SIZE_CONTENT = V8_LV_COORD_SET_SPEC(2001);

////////////////////////////////////////////////////////////////////////////////

const V9_LV_COORD_TYPE_SHIFT = 29;
const V9_LV_COORD_TYPE_SPEC = 1 << V9_LV_COORD_TYPE_SHIFT;

function V9_LV_COORD_SET_SPEC(x: number) {
    return x | V9_LV_COORD_TYPE_SPEC;
}

const V9_LV_COORD_MAX = (1 << V9_LV_COORD_TYPE_SHIFT) - 1;

const V9_LV_PCT_STORED_MAX = V9_LV_COORD_MAX - 1;

const V9_LV_PCT_POS_MAX = V9_LV_PCT_STORED_MAX / 2;

function V9_LV_PCT(x: number) {
    return V9_LV_COORD_SET_SPEC(
        x < 0
            ? V9_LV_PCT_POS_MAX - Math.max(x, -V9_LV_PCT_POS_MAX)
            : Math.min(x, V9_LV_PCT_POS_MAX)
    );
}

const V9_LV_SIZE_CONTENT = V9_LV_COORD_SET_SPEC(V9_LV_COORD_MAX);

////////////////////////////////////////////////////////////////////////////////

const versions = {
    "8.3": {
        wasmFlowRuntime: "project-editor/flow/runtime/lvgl_runtime_v8.3.js",

        LV_COORD: {
            LV_COORD_MAX: V8_LV_COORD_MAX,
            LV_SIZE_CONTENT: V8_LV_SIZE_CONTENT,
            LV_PCT: V8_LV_PCT
        },

        bitmapColorFormats: [
            { id: CF_ALPHA_1_BIT, label: "ALPHA 1 BIT" },
            { id: CF_ALPHA_2_BIT, label: "ALPHA 2 BIT" },
            { id: CF_ALPHA_4_BIT, label: "ALPHA 4 BIT" },
            { id: CF_ALPHA_8_BIT, label: "ALPHA 8 BIT" },

            { id: CF_INDEXED_1_BIT, label: "INDEXED 1 BIT" },
            { id: CF_INDEXED_2_BIT, label: "INDEXED 2 BIT" },
            { id: CF_INDEXED_4_BIT, label: "INDEXED 4 BIT" },
            { id: CF_INDEXED_8_BIT, label: "INDEXED 8 BIT" },

            { id: CF_RAW, label: "RAW" },
            { id: CF_RAW_CHROMA, label: "RAW CHROMA" },
            { id: CF_RAW_ALPHA, label: "RAW ALPHA" },

            { id: CF_TRUE_COLOR, label: "TRUE COLOR" },
            {
                id: CF_TRUE_COLOR_ALPHA,
                label: "TRUE COLOR ALPHA"
            },
            {
                id: CF_TRUE_COLOR_CHROMA,
                label: "TRUE COLOR CHROMA"
            },

            { id: CF_RGB565A8, label: "RGB565A8" }
        ],

        lvglBitmapToSourceFile: async (bitmap: Bitmap, fileName: string) => {
            const { convertImage } = await import("./lv_img_conv/lib/convert");
            const { ImageMode, OutputMode } = await import(
                "./lv_img_conv/lib/enums"
            );

            const TO_IMAGE_MODE = {
                [CF_ALPHA_1_BIT.toString()]: ImageMode.CF_ALPHA_1_BIT,
                [CF_ALPHA_2_BIT.toString()]: ImageMode.CF_ALPHA_2_BIT,
                [CF_ALPHA_4_BIT.toString()]: ImageMode.CF_ALPHA_4_BIT,
                [CF_ALPHA_8_BIT.toString()]: ImageMode.CF_ALPHA_8_BIT,

                [CF_INDEXED_1_BIT.toString()]: ImageMode.CF_INDEXED_1_BIT,
                [CF_INDEXED_2_BIT.toString()]: ImageMode.CF_INDEXED_2_BIT,
                [CF_INDEXED_4_BIT.toString()]: ImageMode.CF_INDEXED_4_BIT,
                [CF_INDEXED_8_BIT.toString()]: ImageMode.CF_INDEXED_8_BIT,

                [CF_RAW.toString()]: ImageMode.CF_RAW,
                [CF_RAW_CHROMA.toString()]: ImageMode.CF_RAW_CHROMA,
                [CF_RAW_ALPHA.toString()]: ImageMode.CF_RAW_ALPHA,

                [CF_TRUE_COLOR.toString()]: ImageMode.CF_TRUE_COLOR,
                [CF_TRUE_COLOR_ALPHA.toString()]: ImageMode.CF_TRUE_COLOR_ALPHA,
                [CF_TRUE_COLOR_CHROMA.toString()]:
                    ImageMode.CF_TRUE_COLOR_CHROMA,

                [CF_RGB565A8.toString()]: ImageMode.CF_RGB565A8
            };

            function loadImage(url: string) {
                return new Promise<HTMLImageElement | null>(resolve => {
                    const image = new Image();
                    image.onload = () => resolve(image);
                    image.onerror = () => resolve(null);
                    image.src = url;
                });
            }

            const image = await loadImage(bitmap.image);
            if (!image) {
                return "";
            }

            const cf = TO_IMAGE_MODE[bitmap.bpp.toString()];

            if (cf == ImageMode.CF_RAW_CHROMA || cf == ImageMode.CF_RAW_ALPHA) {
                // for example: data:image/png;base64,
                const data: Uint8Array = Buffer.from(
                    bitmap.image.substring(bitmap.image.indexOf(",") + 1),
                    "base64"
                );
                return (await convertImage(data, {
                    cf,
                    outName: fileName,
                    swapEndian: false,
                    outputFormat: OutputMode.C,
                    binaryFormat: undefined,
                    overrideWidth: image.width,
                    overrideHeight: image.height
                })) as string;
            } else {
                return (await convertImage(image, {
                    cf,
                    outName: fileName,
                    swapEndian: false,
                    outputFormat: OutputMode.C,
                    binaryFormat: undefined,
                    overrideWidth: image.width,
                    overrideHeight: image.height
                })) as string;
            }
        },

        getLvglStylePropName: (stylePropName: string) => stylePropName,

        getLvglBitmapPtr: (wasm: IWasmFlowRuntime, bitmapData: BitmapData) => {
            let bitmapPtr = wasm._malloc(4 + 4 + 4 + bitmapData.pixels.length);

            if (!bitmapPtr) {
                return 0;
            }

            const LV_IMG_CF_TRUE_COLOR = 4;
            const LV_IMG_CF_TRUE_COLOR_ALPHA = 5;
            const LV_IMG_CF_RGB565A8 = 20;

            let header =
                ((bitmapData.bpp == 32
                    ? LV_IMG_CF_TRUE_COLOR_ALPHA
                    : bitmapData.bpp == 24
                    ? LV_IMG_CF_TRUE_COLOR
                    : LV_IMG_CF_RGB565A8) <<
                    0) |
                (bitmapData.width << 10) |
                (bitmapData.height << 21);

            wasm.HEAP32[(bitmapPtr >> 2) + 0] = header;

            wasm.HEAP32[(bitmapPtr >> 2) + 1] = bitmapData.pixels.length;

            const offset = bitmapPtr + 12;

            wasm.HEAP32[(bitmapPtr >> 2) + 2] = offset;

            for (let i = 0; i < bitmapData.pixels.length; i++) {
                wasm.HEAP8[offset + i] = bitmapData.pixels[i];
            }

            return bitmapPtr;
        },

        getLvglFlagCodes: () => {
            return LVGL_FLAG_CODES;
        },

        defaultFontBpp: 8,

        LVGL_EVENTS: LVGL_EVENTS_V8,

        LVGL_PARTS: LVGL_PARTS_8
    },
    "9.0": {
        wasmFlowRuntime: "project-editor/flow/runtime/lvgl_runtime_v9.0.js",

        LV_COORD: {
            LV_COORD_MAX: V9_LV_COORD_MAX,
            LV_SIZE_CONTENT: V9_LV_SIZE_CONTENT,
            LV_PCT: V9_LV_PCT
        },

        bitmapColorFormats: [
            { id: CF_L8, label: "L8" },

            { id: CF_INDEXED_1_BIT, label: "I1" },
            { id: CF_INDEXED_2_BIT, label: "I2" },
            { id: CF_INDEXED_4_BIT, label: "I4" },
            { id: CF_INDEXED_8_BIT, label: "I8" },

            { id: CF_ALPHA_1_BIT, label: "A1" },
            { id: CF_ALPHA_2_BIT, label: "A2" },
            { id: CF_ALPHA_4_BIT, label: "A4" },
            { id: CF_ALPHA_8_BIT, label: "A8" },

            { id: CF_TRUE_COLOR_ALPHA, label: "ARGB8888" },
            { id: CF_TRUE_COLOR_CHROMA, label: "XRGB8888" },
            { id: CF_RGB565, label: "RGB565" },
            { id: CF_RGB565A8, label: "RGB565A8" },
            { id: CF_TRUE_COLOR, label: "RGB888" },

            { id: CF_RAW, label: "RAW" },
            { id: CF_RAW_ALPHA, label: "RAW ALPHA" }
        ],

        lvglBitmapToSourceFile: async (bitmap: Bitmap, fileName: string) => {
            const lvglImageScriptPath = isDev
                ? resolve(`${sourceRootDir()}/../resources/lv_img_conv_9`)
                : process.resourcesPath! + "/lv_img_conv_9";

            const fs = await import("fs");

            const [tempDir, cleanupCallback] = await getTempDirPath({
                unsafeCleanup: true
            });

            let bitmapFilePath = `${tempDir}/${fileName}.png`;

            {
                // for example: data:image/png;base64,
                const k = bitmap.image.indexOf(",");

                const bin = Buffer.from(
                    bitmap.image.substring(k + 1),
                    "base64"
                );
                await fs.promises.writeFile(bitmapFilePath, bin);
            }

            return new Promise<string>((resolve, reject) => {
                const { PythonShell } =
                    require("python-shell") as typeof import("python-shell");

                const TO_IMAGE_MODE = {
                    [CF_L8.toString()]: "L8",

                    [CF_INDEXED_1_BIT.toString()]: "I1",
                    [CF_INDEXED_2_BIT.toString()]: "I2",
                    [CF_INDEXED_4_BIT.toString()]: "I4",
                    [CF_INDEXED_8_BIT.toString()]: "I8",

                    [CF_ALPHA_1_BIT.toString()]: "A1",
                    [CF_ALPHA_2_BIT.toString()]: "A2",
                    [CF_ALPHA_4_BIT.toString()]: "A4",
                    [CF_ALPHA_8_BIT.toString()]: "A8",

                    [CF_TRUE_COLOR_ALPHA.toString()]: "ARGB8888",
                    [CF_TRUE_COLOR_CHROMA.toString()]: "XRGB8888",
                    [CF_RGB565.toString()]: "RGB565",
                    [CF_RGB565A8.toString()]: "RGB565A8",
                    [CF_TRUE_COLOR.toString()]: "RGB888",

                    [CF_RAW.toString()]: "RAW",
                    [CF_RAW_ALPHA.toString()]: "RAW_ALPHA"
                };

                const pythonShell = new PythonShell("LVGLImage.py", {
                    mode: "text",
                    pythonOptions: ["-u"], // get print results in real-time
                    scriptPath: lvglImageScriptPath,
                    pythonPath: settingsController.pythonUseCustomPath
                        ? settingsController.pythonCustomPath
                        : undefined,
                    args: [
                        "--ofmt",
                        "C",
                        "--cf",
                        TO_IMAGE_MODE[bitmap.bpp.toString()],
                        "--output",
                        `${tempDir}`,
                        bitmapFilePath
                    ]
                });

                let wasError = false;

                pythonShell.on("close", async () => {
                    if (!wasError) {
                        try {
                            const cFile = await fs.promises.readFile(
                                `${tempDir}/${fileName}.c`,
                                "utf-8"
                            );
                            resolve(cFile);
                        } catch (err) {
                            reject(err);
                        }

                        cleanupCallback();
                    }
                });

                pythonShell.on("pythonError", err => {
                    console.error("pythonError", err);
                    wasError = true;
                    reject(err);
                    cleanupCallback();
                });

                pythonShell.on("error", err => {
                    console.error("error", err);
                    wasError = true;
                    reject(err);
                    cleanupCallback();
                });
            });
        },

        getLvglStylePropName: (stylePropName: string) => {
            if (stylePropName == "bg_img_src") {
                return "bg_image_src";
            } else if (stylePropName == "bg_img_opa") {
                return "bg_image_opa";
            } else if (stylePropName == "bg_img_recolor") {
                return "bg_image_recolor";
            } else if (stylePropName == "bg_img_recolor_opa") {
                return "bg_image_recolor_opa";
            } else if (stylePropName == "bg_img_tiled") {
                return "bg_image_tiled";
            } else if (stylePropName == "img_opa") {
                return "image_opa";
            } else if (stylePropName == "img_recolor") {
                return "image_recolor";
            } else if (stylePropName == "img_recolor_opa") {
                return "image_recolor_opa";
            } else if (stylePropName == "arc_img_src") {
                return "arc_image_src";
            }
            return stylePropName;
        },

        getLvglBitmapPtr: (wasm: IWasmFlowRuntime, bitmapData: BitmapData) => {
            let bitmapPtr = wasm._malloc(
                4 + 4 + 4 + 4 + 4 + bitmapData.pixels.length
            );

            if (!bitmapPtr) {
                return 0;
            }

            const LV_IMAGE_HEADER_MAGIC = 0x19;
            const LV_COLOR_FORMAT_ARGB8888 = 0x10;

            const FLAGS = 0;

            // lv_image_header_t
            {
                // uint32_t magic: 8;          /*Magic number. Must be LV_IMAGE_HEADER_MAGIC*/
                // uint32_t cf : 8;            /*Color format: See `lv_color_format_t`*/
                // uint32_t flags: 16;         /*Image flags, see `lv_image_flags_t`*/
                wasm.HEAP32[(bitmapPtr >> 2) + 0] =
                    LV_IMAGE_HEADER_MAGIC |
                    (LV_COLOR_FORMAT_ARGB8888 << 8) |
                    (FLAGS << 16);

                // uint32_t w: 16;
                // uint32_t h: 16;
                wasm.HEAP32[(bitmapPtr >> 2) + 1] =
                    bitmapData.width | (bitmapData.height << 16);

                // uint32_t stride: 16;        /*Number of bytes in a row*/
                // uint32_t reserved_2: 16;    /*Reserved to be used later*/
                wasm.HEAP32[(bitmapPtr >> 2) + 2] = 4 * bitmapData.width;
            }

            // uint32_t data_size;     /**< Size of the image in bytes*/
            wasm.HEAP32[(bitmapPtr >> 2) + 3] = bitmapData.pixels.length;

            // const uint8_t * data;   /**< Pointer to the data of the image*/
            const offset = bitmapPtr + 20;
            wasm.HEAP32[(bitmapPtr >> 2) + 4] = offset;

            for (let i = 0; i < bitmapData.pixels.length; i++) {
                wasm.HEAP8[offset + i] = bitmapData.pixels[i];
            }

            return bitmapPtr;
        },

        getLvglFlagCodes: () => {
            return LVGL_FLAG_CODES_90;
        },

        defaultFontBpp: 4,

        LVGL_EVENTS: LVGL_EVENTS_V9,

        LVGL_PARTS: LVGL_PARTS_9
    }
};

type Version = (typeof versions)["8.3"];

function getVersionPropertyForLvglVersion<
    PN extends keyof (typeof versions)[8.3]
>(lvglVersion: "8.3" | "9.0" | undefined, propertyName: PN): Version[PN] {
    let ver =
        lvglVersion == "8.3" || lvglVersion == "9.0" ? lvglVersion : "8.3";
    const version = versions[ver];
    return version[propertyName];
}

function getVersionProperty<PN extends keyof (typeof versions)[8.3]>(
    object: IEezObject,
    propertyName: PN
): Version[PN] {
    return getVersionPropertyForLvglVersion(
        ProjectEditor.getProject(object).settings.general.lvglVersion,
        propertyName
    );
}

////////////////////////////////////////////////////////////////////////////////

const wasmFlowRuntimeConstructors: {
    [key: string]: any;
} = {};

export function getLvglWasmFlowRuntimeConstructor(
    lvglVersion: "8.3" | "9.0" | undefined
) {
    const wasmFlowRuntime = getVersionPropertyForLvglVersion(
        lvglVersion,
        "wasmFlowRuntime"
    );

    let wasmFlowRuntimeConstructor =
        wasmFlowRuntimeConstructors[wasmFlowRuntime];
    if (!wasmFlowRuntimeConstructor) {
        wasmFlowRuntimeConstructor = require(wasmFlowRuntime);
        wasmFlowRuntimeConstructors[wasmFlowRuntime] =
            wasmFlowRuntimeConstructor;
    }

    return wasmFlowRuntimeConstructor;
}

////////////////////////////////////////////////////////////////////////////////

export function getLvglBitmapColorFormats(object: IEezObject) {
    return getVersionProperty(object, "bitmapColorFormats");
}

export async function getLvglBitmapSourceFile(
    bitmap: Bitmap,
    fileName: string
) {
    const lvglBitmapToSourceFile = getVersionProperty(
        bitmap,
        "lvglBitmapToSourceFile"
    );

    return lvglBitmapToSourceFile(bitmap, fileName);
}

export function getLvglStylePropName(
    object: IEezObject,
    stylePropName: string
) {
    return getVersionProperty(object, "getLvglStylePropName")(stylePropName);
}

export function getLvglStylePropCode(
    object: IEezObject,
    code: LVGLStylePropCode
) {
    return code[ProjectEditor.getProject(object).settings.general.lvglVersion];
}

export function getLvglCoord(object: IEezObject) {
    return getVersionProperty(object, "LV_COORD");
}

export function getLvglBitmapPtr(
    object: IEezObject,
    wasm: IWasmFlowRuntime,
    bitmapData: BitmapData
) {
    return getVersionProperty(object, "getLvglBitmapPtr")(wasm, bitmapData);
}

export function getLvglFlagCodes(object: IEezObject) {
    return getVersionProperty(object, "getLvglFlagCodes")();
}

export function getLvglDefaultFontBpp(object: IEezObject) {
    return getVersionProperty(object, "defaultFontBpp");
}

export function getLvglEvents(object: IEezObject) {
    return getVersionProperty(object, "LVGL_EVENTS");
}

export function getLvglParts(object: IEezObject) {
    return getVersionProperty(object, "LVGL_PARTS");
}
