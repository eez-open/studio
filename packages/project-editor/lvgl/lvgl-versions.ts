import { resolve } from "path";

import { getTempDirPath, isDev } from "eez-studio-shared/util-electron";
import { sourceRootDir } from "eez-studio-shared/util";

import { LVGL_FLAG_CODES, type IEezObject } from "project-editor/core/object";
import { ProjectEditor } from "project-editor/project-editor-interface";
import type { Bitmap, BitmapData } from "project-editor/features/bitmap/bitmap";
import type { IWasmFlowRuntime } from "eez-studio-types";

////////////////////////////////////////////////////////////////////////////////

export type LVGLStylePropCode = {
    "8.3": number | undefined;
    "9.0": number | undefined;
};

export const LVGL_STYLE_PROP_CODES: {
    [key: string]: LVGLStylePropCode;
} = {
    /*Group 0*/
    LV_STYLE_WIDTH: { "8.3": 1, "9.0": 1 },
    LV_STYLE_HEIGHT: { "8.3": 4, "9.0": 2 },
    LV_STYLE_LENGTH: { "8.3": undefined, "9.0": 3 }, // ONLY 9.0

    LV_STYLE_MIN_WIDTH: { "8.3": 2, "9.0": 4 },
    LV_STYLE_MAX_WIDTH: { "8.3": 3, "9.0": 5 },
    LV_STYLE_MIN_HEIGHT: { "8.3": 5, "9.0": 6 },
    LV_STYLE_MAX_HEIGHT: { "8.3": 6, "9.0": 7 },

    LV_STYLE_X: { "8.3": 7, "9.0": 8 },
    LV_STYLE_Y: { "8.3": 8, "9.0": 9 },
    LV_STYLE_ALIGN: { "8.3": 9, "9.0": 10 },

    LV_STYLE_RADIUS: { "8.3": 11, "9.0": 12 },

    /*Group 1*/
    LV_STYLE_PAD_TOP: { "8.3": 16, "9.0": 16 },
    LV_STYLE_PAD_BOTTOM: { "8.3": 17, "9.0": 17 },
    LV_STYLE_PAD_LEFT: { "8.3": 18, "9.0": 18 },
    LV_STYLE_PAD_RIGHT: { "8.3": 19, "9.0": 19 },

    LV_STYLE_PAD_ROW: { "8.3": 20, "9.0": 20 },
    LV_STYLE_PAD_COLUMN: { "8.3": 21, "9.0": 21 },
    LV_STYLE_LAYOUT: { "8.3": 10, "9.0": 22 },

    LV_STYLE_MARGIN_TOP: { "8.3": undefined, "9.0": 24 }, // ONLY 9.0
    LV_STYLE_MARGIN_BOTTOM: { "8.3": undefined, "9.0": 25 }, // ONLY 9.0
    LV_STYLE_MARGIN_LEFT: { "8.3": undefined, "9.0": 26 }, // ONLY 9.0
    LV_STYLE_MARGIN_RIGHT: { "8.3": undefined, "9.0": 27 }, // ONLY 9.0

    /*Group 2*/
    LV_STYLE_BG_COLOR: { "8.3": 32, "9.0": 28 },
    LV_STYLE_BG_OPA: { "8.3": 33, "9.0": 29 },

    LV_STYLE_BG_GRAD_DIR: { "8.3": 35, "9.0": 32 },
    LV_STYLE_BG_MAIN_STOP: { "8.3": 36, "9.0": 33 },
    LV_STYLE_BG_GRAD_STOP: { "8.3": 37, "9.0": 34 },
    LV_STYLE_BG_GRAD_COLOR: { "8.3": 34, "9.0": 35 },

    LV_STYLE_BG_MAIN_OPA: { "8.3": undefined, "9.0": 36 }, // ONLY 9.0
    LV_STYLE_BG_GRAD_OPA: { "8.3": undefined, "9.0": 37 }, // ONLY 9.0
    LV_STYLE_BG_GRAD: { "8.3": 38, "9.0": 38 },
    LV_STYLE_BASE_DIR: { "8.3": 22, "9.0": 39 },

    LV_STYLE_BG_DITHER_MODE: { "8.3": 39, "9.0": undefined }, // ONLY 8.3

    LV_STYLE_BG_IMG_SRC: { "8.3": 40, "9.0": 40 },
    LV_STYLE_BG_IMG_OPA: { "8.3": 41, "9.0": 41 },
    LV_STYLE_BG_IMG_RECOLOR: { "8.3": 42, "9.0": 42 },
    LV_STYLE_BG_IMG_RECOLOR_OPA: { "8.3": 43, "9.0": 43 },

    LV_STYLE_BG_IMG_TILED: { "8.3": 44, "9.0": 44 },
    LV_STYLE_CLIP_CORNER: { "8.3": 23, "9.0": 45 },

    /*Group 3*/
    LV_STYLE_BORDER_WIDTH: { "8.3": 50, "9.0": 48 },
    LV_STYLE_BORDER_COLOR: { "8.3": 48, "9.0": 49 },
    LV_STYLE_BORDER_OPA: { "8.3": 49, "9.0": 50 },

    LV_STYLE_BORDER_SIDE: { "8.3": 51, "9.0": 52 },
    LV_STYLE_BORDER_POST: { "8.3": 52, "9.0": 53 },

    LV_STYLE_OUTLINE_WIDTH: { "8.3": 53, "9.0": 56 },
    LV_STYLE_OUTLINE_COLOR: { "8.3": 54, "9.0": 57 },
    LV_STYLE_OUTLINE_OPA: { "8.3": 55, "9.0": 58 },
    LV_STYLE_OUTLINE_PAD: { "8.3": 56, "9.0": 59 },

    /*Group 4*/
    LV_STYLE_SHADOW_WIDTH: { "8.3": 64, "9.0": 60 },
    LV_STYLE_SHADOW_COLOR: { "8.3": 68, "9.0": 61 },
    LV_STYLE_SHADOW_OPA: { "8.3": 69, "9.0": 62 },

    LV_STYLE_SHADOW_OFS_X: { "8.3": 65, "9.0": 64 },
    LV_STYLE_SHADOW_OFS_Y: { "8.3": 66, "9.0": 65 },
    LV_STYLE_SHADOW_SPREAD: { "8.3": 67, "9.0": 66 },

    LV_STYLE_IMG_OPA: { "8.3": 70, "9.0": 68 },
    LV_STYLE_IMG_RECOLOR: { "8.3": 71, "9.0": 69 },
    LV_STYLE_IMG_RECOLOR_OPA: { "8.3": 72, "9.0": 70 },

    LV_STYLE_LINE_WIDTH: { "8.3": 73, "9.0": 72 },
    LV_STYLE_LINE_DASH_WIDTH: { "8.3": 74, "9.0": 73 },
    LV_STYLE_LINE_DASH_GAP: { "8.3": 75, "9.0": 74 },
    LV_STYLE_LINE_ROUNDED: { "8.3": 76, "9.0": 75 },
    LV_STYLE_LINE_COLOR: { "8.3": 77, "9.0": 76 },
    LV_STYLE_LINE_OPA: { "8.3": 78, "9.0": 77 },

    /*Group 5*/
    LV_STYLE_ARC_WIDTH: { "8.3": 80, "9.0": 80 },
    LV_STYLE_ARC_ROUNDED: { "8.3": 81, "9.0": 81 },
    LV_STYLE_ARC_COLOR: { "8.3": 82, "9.0": 82 },
    LV_STYLE_ARC_OPA: { "8.3": 83, "9.0": 83 },
    LV_STYLE_ARC_IMG_SRC: { "8.3": 84, "9.0": 84 },

    LV_STYLE_TEXT_COLOR: { "8.3": 85, "9.0": 88 },
    LV_STYLE_TEXT_OPA: { "8.3": 86, "9.0": 89 },
    LV_STYLE_TEXT_FONT: { "8.3": 87, "9.0": 90 },

    LV_STYLE_TEXT_LETTER_SPACE: { "8.3": 88, "9.0": 91 },
    LV_STYLE_TEXT_LINE_SPACE: { "8.3": 89, "9.0": 92 },
    LV_STYLE_TEXT_DECOR: { "8.3": 90, "9.0": 93 },
    LV_STYLE_TEXT_ALIGN: { "8.3": 91, "9.0": 94 },

    LV_STYLE_OPA: { "8.3": 96, "9.0": 95 },
    LV_STYLE_OPA_LAYERED: { "8.3": undefined, "9.0": 96 },
    LV_STYLE_COLOR_FILTER_DSC: { "8.3": 97, "9.0": 97 },
    LV_STYLE_COLOR_FILTER_OPA: { "8.3": 98, "9.0": 98 },

    LV_STYLE_ANIM: { "8.3": 99, "9.0": 99 },
    LV_STYLE_ANIM_TIME: { "8.3": 100, "9.0": undefined }, // ONLY 8.3
    LV_STYLE_ANIM_DURATION: { "8.3": undefined, "9.0": 100 }, // ONLY 9.0
    LV_STYLE_ANIM_SPEED: { "8.3": 101, "9.0": undefined }, // ONLY 8.3
    LV_STYLE_TRANSITION: { "8.3": 102, "9.0": 102 },

    LV_STYLE_BLEND_MODE: { "8.3": 103, "9.0": 103 },
    LV_STYLE_TRANSFORM_WIDTH: { "8.3": 104, "9.0": 104 },
    LV_STYLE_TRANSFORM_HEIGHT: { "8.3": 105, "9.0": 105 },
    LV_STYLE_TRANSLATE_X: { "8.3": 106, "9.0": 106 },
    LV_STYLE_TRANSLATE_Y: { "8.3": 107, "9.0": 107 },
    LV_STYLE_TRANSFORM_ZOOM: { "8.3": 108, "9.0": undefined }, // ONLY 8.3
    LV_STYLE_TRANSFORM_SCALE_X: { "8.3": undefined, "9.0": 108 }, // ONLY 9.0
    LV_STYLE_TRANSFORM_SCALE_Y: { "8.3": undefined, "9.0": 109 }, // ONLY 9.0
    LV_STYLE_TRANSFORM_ANGLE: { "8.3": 109, "9.0": undefined }, // ONLY 8.3
    LV_STYLE_TRANSFORM_ROTATION: { "8.3": undefined, "9.0": 110 }, // ONLY 9.0
    LV_STYLE_TRANSFORM_PIVOT_X: { "8.3": 110, "9.0": 111 },
    LV_STYLE_TRANSFORM_PIVOT_Y: { "8.3": 111, "9.0": 112 },
    LV_STYLE_TRANSFORM_SKEW_X: { "8.3": undefined, "9.0": 113 }, // ONLY 9.0
    LV_STYLE_TRANSFORM_SKEW_Y: { "8.3": undefined, "9.0": 114 }, // ONLY 9.0

    /* Flex */
    LV_STYLE_FLEX_FLOW: { "8.3": 112, "9.0": 115 },
    LV_STYLE_FLEX_MAIN_PLACE: { "8.3": 113, "9.0": 116 },
    LV_STYLE_FLEX_CROSS_PLACE: { "8.3": 114, "9.0": 117 },
    LV_STYLE_FLEX_TRACK_PLACE: { "8.3": 115, "9.0": 118 },
    LV_STYLE_FLEX_GROW: { "8.3": 0, "9.0": 119 },

    /* Grid */
    LV_STYLE_GRID_COLUMN_ALIGN: { "8.3": 118, "9.0": 120 },
    LV_STYLE_GRID_ROW_ALIGN: { "8.3": 119, "9.0": 121 },
    LV_STYLE_GRID_ROW_DSC_ARRAY: { "8.3": 117, "9.0": 122 },
    LV_STYLE_GRID_COLUMN_DSC_ARRAY: { "8.3": 116, "9.0": 123 },
    LV_STYLE_GRID_CELL_COLUMN_POS: { "8.3": 123, "9.0": 124 },
    LV_STYLE_GRID_CELL_COLUMN_SPAN: { "8.3": 122, "9.0": 125 },
    LV_STYLE_GRID_CELL_X_ALIGN: { "8.3": 124, "9.0": 126 },
    LV_STYLE_GRID_CELL_ROW_POS: { "8.3": 121, "9.0": 127 },
    LV_STYLE_GRID_CELL_ROW_SPAN: { "8.3": 120, "9.0": 128 },
    LV_STYLE_GRID_CELL_Y_ALIGN: { "8.3": 125, "9.0": 129 }
};

////////////////////////////////////////////////////////////////////////////////

export const CF_ALPHA_1_BIT = 1;
export const CF_ALPHA_2_BIT = 2;
export const CF_ALPHA_4_BIT = 3;
export const CF_ALPHA_8_BIT = 4;

export const CF_L8 = 0x06;

export const CF_RGB565 = 15;
export const CF_RGB565A8 = 16;

export const CF_TRUE_COLOR = 24;
export const CF_TRUE_COLOR_ALPHA = 32;
export const CF_TRUE_COLOR_CHROMA = 33;

export const CF_INDEXED_1_BIT = 41;
export const CF_INDEXED_2_BIT = 42;
export const CF_INDEXED_4_BIT = 43;
export const CF_INDEXED_8_BIT = 44;

export const CF_RAW = 51;
export const CF_RAW_CHROMA = 52;
export const CF_RAW_ALPHA = 53;

////////////////////////////////////////////////////////////////////////////////

export const LVGL_FLAG_CODES_90 = {
    HIDDEN: 1 << 0, // Make the object hidden. (Like it wasn't there at all)
    CLICKABLE: 1 << 1, // Make the object clickable by the input devices
    CLICK_FOCUSABLE: 1 << 2, // Add focused state to the object when clicked
    CHECKABLE: 1 << 3, // Toggle checked state when the object is clicked
    SCROLLABLE: 1 << 4, // Make the object scrollable
    SCROLL_ELASTIC: 1 << 5, // Allow scrolling inside but with slower speed
    SCROLL_MOMENTUM: 1 << 6, // Make the object scroll further when "thrown"
    SCROLL_ONE: 1 << 7, // Allow scrolling only one snappable children
    SCROLL_CHAIN_HOR: 1 << 8, // Allow propagating the horizontal scroll to a parent
    SCROLL_CHAIN_VER: 1 << 9, // Allow propagating the vertical scroll to a parent
    SCROLL_CHAIN: (1 << 8) | (1 << 9),
    SCROLL_ON_FOCUS: 1 << 10, // Automatically scroll object to make it visible when focused
    SCROLL_WITH_ARROW: 1 << 11, // Allow scrolling the focused object with arrow keys
    SNAPPABLE: 1 << 12, // If scroll snap is enabled on the parent it can snap to this object
    PRESS_LOCK: 1 << 13, // Keep the object pressed even if the press slid from the object
    EVENT_BUBBLE: 1 << 14, // Propagate the events to the parent too
    GESTURE_BUBBLE: 1 << 15, // Propagate the gestures to the parent
    ADV_HITTEST: 1 << 16, // Allow performing more accurate hit (click) test. E.g. consider rounded corners.
    IGNORE_LAYOUT: 1 << 17, // Make the object position-able by the layouts
    FLOATING: 1 << 18, // Do not scroll the object when the parent scrolls and ignore layout
    OVERFLOW_VISIBLE: 1 << 20 // Do not clip the children's content to the parent's boundary*/
};

////////////////////////////////////////////////////////////////////////////////

const versions = {
    "8.3": {
        wasmFlowRuntime: "project-editor/flow/runtime/lvgl_runtime_v8.3.js",

        _LV_COORD_TYPE_SHIFT: 13,

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

        hasLabelRecolorSupport: true,

        getLvglFlagCodes: () => {
            return LVGL_FLAG_CODES;
        },

        defaultFontBpp: 8
    },
    "9.0": {
        wasmFlowRuntime: "project-editor/flow/runtime/lvgl_runtime_v9.0.js",

        _LV_COORD_TYPE_SHIFT: 29,

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

                    [CF_RAW.toString()]: "TRUECOLOR",
                    [CF_RAW_ALPHA.toString()]: "TRUECOLOR_ALPHA"
                };

                const pythonShell = new PythonShell("LVGLImage.py", {
                    mode: "text",
                    pythonOptions: ["-u"], // get print results in real-time
                    scriptPath: lvglImageScriptPath,
                    args: [
                        "--ofmt",
                        "C",
                        "--cf",
                        TO_IMAGE_MODE[bitmap.bpp.toString()],
                        "--output",
                        `${tempDir}/output`,
                        bitmapFilePath
                    ]
                });

                let wasError = false;

                pythonShell.on("close", async () => {
                    if (!wasError) {
                        try {
                            const cFile = await fs.promises.readFile(
                                `${tempDir}/output/${fileName}.c`,
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

        hasLabelRecolorSupport: false,

        getLvglFlagCodes: () => {
            return LVGL_FLAG_CODES_90;
        },

        defaultFontBpp: 4
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

export function getLvglCoordTypeShift(object: IEezObject) {
    return getVersionProperty(object, "_LV_COORD_TYPE_SHIFT");
}

export function getLvglBitmapPtr(
    object: IEezObject,
    wasm: IWasmFlowRuntime,
    bitmapData: BitmapData
) {
    return getVersionProperty(object, "getLvglBitmapPtr")(wasm, bitmapData);
}

export function lvglHasLabelRecolorSupport(object: IEezObject) {
    return getVersionProperty(object, "hasLabelRecolorSupport");
}

export function getLvglFlagCodes(object: IEezObject) {
    return getVersionProperty(object, "getLvglFlagCodes")();
}

export function getLvglDefaultFontBpp(object: IEezObject) {
    return getVersionProperty(object, "defaultFontBpp");
}
