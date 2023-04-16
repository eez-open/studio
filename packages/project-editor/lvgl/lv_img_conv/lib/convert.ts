import { ImageMode, ImageModeUtil, OutputMode } from "./enums";
import { buildPalette, utils, applyPalette } from "./image-q/image-q";
import { round_half_up, str_pad, dechex } from "./helpers";

export interface ConverterOptions {
    dith?: boolean;
    cf: ImageMode;
    outputFormat: OutputMode;
    binaryFormat: ImageMode;
    swapEndian: boolean;
    outName: string;
    useLegacyFooterOrder?: boolean;
    use565A8alpha?: boolean;
    overrideWidth?: number;
    overrideHeight?: number;
}
class Converter {
    w = 0; /*Image width*/
    h = 0; /*Image height*/
    raw_len = 0; /* RAW image data size */
    cf: ImageMode; /*Color format*/
    outputFormat: OutputMode;
    alpha = false; /*Add alpha byte or not*/
    chroma = false; /*Chroma keyed?*/
    d_out: Array<number>; /*Output data (result)*/
    imageData: Array<number> | Uint8Array; /* Input image data */
    options: ConverterOptions;

    /*Helper variables*/
    r_act: number;
    b_act: number;
    g_act: number;

    /*For dithering*/
    r_earr: Array<number>; /*Classification error for next row of pixels*/
    g_earr: Array<number>;
    b_earr: Array<number>;

    r_nerr: number; /*Classification error for next pixel*/
    g_nerr: number;
    b_nerr: number;

    /* Current pass being made */
    pass: number;

    constructor(
        w: number,
        h: number,
        imageData: any,
        alpha: boolean,
        options: Partial<ConverterOptions>
    ) {
        this.w = w;
        this.h = h;
        this.imageData = imageData;
        this.r_earr = []; /*Classification error for next row of pixels*/
        this.g_earr = [];
        this.b_earr = [];

        if (options.dith) {
            for (var i = 0; i < this.w + 2; ++i) {
                this.r_earr[i] = 0;
                this.g_earr[i] = 0;
                this.b_earr[i] = 0;
            }
        }

        this.r_nerr = 0; /*Classification error for next pixel*/
        this.g_nerr = 0;
        this.b_nerr = 0;
        this.pass = 0;
        this.cf = options.cf!;
        this.alpha = alpha;
        this.outputFormat = options.outputFormat!;
        this.options = options as ConverterOptions;
    }

    /**
     * Get the number of passes being made over an image to output it.
     */
    getNumPasses() {
        if (this.cf == ImageMode.CF_RGB565A8) return 2;
        else return 1;
    }

    async convert(): Promise<string | ArrayBuffer> {
        if (this.cf == ImageMode.CF_RAW || this.cf == ImageMode.CF_RAW_ALPHA) {
            const d_array = Array.from(this.imageData as Uint8Array);
            this.raw_len = d_array.length;
            const indent = this.options.useLegacyFooterOrder ? "  " : "    ";
            const numValuesPerRow = this.options.useLegacyFooterOrder ? 15 : 12;
            let str =
                "\n" +
                indent +
                d_array
                    .map(
                        (val, i) =>
                            "0x" +
                            str_pad(dechex(val), 2, "0", true) +
                            (i % (numValuesPerRow + 1) == numValuesPerRow
                                ? ", \n" + indent
                                : ", ")
                    )
                    .join("");
            str = str.substr(0, str.length - 2);
            return str;
        }
        var palette_size = 0,
            bits_per_value = 0;
        if (this.cf == ImageMode.CF_INDEXED_1_BIT) {
            palette_size = 2;
            bits_per_value = 1;
        } else if (this.cf == ImageMode.CF_INDEXED_2_BIT) {
            palette_size = 4;
            bits_per_value = 2;
        } else if (this.cf == ImageMode.CF_INDEXED_4_BIT) {
            palette_size = 16;
            bits_per_value = 4;
        } else if (this.cf == ImageMode.CF_INDEXED_8_BIT) {
            palette_size = 256;
            bits_per_value = 8;
        }
        bits_per_value;
        this.d_out = [];

        if (palette_size) {
            const pointContainer = utils.PointContainer.fromUint8Array(
                this.imageData,
                this.w,
                this.h
            );
            const palette = await buildPalette([pointContainer], {
                colors: palette_size // optional
            });
            const color_arr = this.d_out;
            const palettePointArray = palette
                .getPointContainer()
                .getPointArray();
            const paletteColors = palettePointArray.map(point => {
                return point.uint32;
            });
            for (var i = 0; i < palette_size; i++) {
                if (i < palettePointArray.length) {
                    color_arr.push(
                        palettePointArray[i].b,
                        palettePointArray[i].g,
                        palettePointArray[i].r,
                        palettePointArray[i].a
                    );
                } else {
                    color_arr.push(0, 0, 0, 0);
                }
            }

            const outPointContainer = await applyPalette(
                pointContainer,
                palette,
                {}
            );
            // let currentValue = 0;
            // let numBitsShifted = 0;
            const outPointArray = outPointContainer.getPointArray();
            this.imageData = [];
            outPointArray.forEach((point, arrayIndex) => {
                const index = paletteColors.indexOf(point.uint32);
                if (index == -1) throw new Error("Unknown color??");
                (this.imageData as Array<number>).push(index);
            });
        }

        let oldColorFormat: any;
        const needsFormatSwap =
            this.outputFormat == OutputMode.BIN &&
            ImageModeUtil.isTrueColor(this.cf);
        if (needsFormatSwap) {
            oldColorFormat = this.cf;
            this.cf = this.options.binaryFormat;
        }

        for (this.pass = 0; this.pass < this.getNumPasses(); this.pass++) {
            /*Convert all the pixels*/
            for (var y = 0; y < this.h; y++) {
                this.dith_reset();

                for (var x = 0; x < this.w; ++x) {
                    this.conv_px(x, y);
                }
            }
        }

        if (needsFormatSwap) {
            this.cf = oldColorFormat;
        }

        if (this.outputFormat == OutputMode.C) return this.format_to_c_array();
        else {
            //var $content = this.d_out;
            var $cf = this.cf;
            var $lv_cf = 4; /*Color format in LittlevGL*/
            switch ($cf) {
                case ImageMode.CF_TRUE_COLOR:
                    $lv_cf = 4;
                    break;
                case ImageMode.CF_TRUE_COLOR_ALPHA:
                    $lv_cf = 5;
                    break;
                case ImageMode.CF_TRUE_COLOR_CHROMA:
                    $lv_cf = 6;
                    break;
                case ImageMode.CF_INDEXED_1_BIT:
                    $lv_cf = 7;
                    break;
                case ImageMode.CF_INDEXED_2_BIT:
                    $lv_cf = 8;
                    break;
                case ImageMode.CF_INDEXED_4_BIT:
                    $lv_cf = 9;
                    break;
                case ImageMode.CF_INDEXED_8_BIT:
                    $lv_cf = 10;
                    break;
                case ImageMode.CF_ALPHA_1_BIT:
                    $lv_cf = 11;
                    break;
                case ImageMode.CF_ALPHA_2_BIT:
                    $lv_cf = 12;
                    break;
                case ImageMode.CF_ALPHA_4_BIT:
                    $lv_cf = 13;
                    break;
                case ImageMode.CF_ALPHA_8_BIT:
                    $lv_cf = 14;
                    break;
            }

            var $header_32bit =
                ($lv_cf | (this.w << 10) | (this.h << 21)) >>> 0;

            var finalBinary = new Uint8Array(this.d_out.length + 4);
            finalBinary[0] = $header_32bit & 0xff;
            finalBinary[1] = ($header_32bit & 0xff00) >> 8;
            finalBinary[2] = ($header_32bit & 0xff0000) >> 16;
            finalBinary[3] = ($header_32bit & 0xff000000) >> 24;

            for (var i = 0; i < this.d_out.length; i++) {
                finalBinary[i + 4] = this.d_out[i];
            }
            return finalBinary.buffer;
        }
    }

    get_c_header(out_name: string): string {
        var $c_header = `#ifdef __has_include
    #if __has_include("lvgl.h")
        #ifndef LV_LVGL_H_INCLUDE_SIMPLE
            #define LV_LVGL_H_INCLUDE_SIMPLE
        #endif
    #endif
#endif

#if defined(LV_LVGL_H_INCLUDE_SIMPLE)
    #include "lvgl.h"
#else
    #include "lvgl/lvgl.h"
#endif


#ifndef LV_ATTRIBUTE_MEM_ALIGN
#define LV_ATTRIBUTE_MEM_ALIGN
#endif

`;
        var $attr_name = "LV_ATTRIBUTE_IMG_" + out_name.toUpperCase();
        $c_header +=
            `#ifndef ${$attr_name}
#define ${$attr_name}
#endif

const LV_ATTRIBUTE_MEM_ALIGN LV_ATTRIBUTE_LARGE_CONST ${$attr_name} uint8_t ` +
            out_name +
            "_map[] = {";

        return $c_header;
    }

    static imagemode_to_enum_name($cf: ImageMode): string {
        switch ($cf) {
            case ImageMode.CF_TRUE_COLOR:
            case ImageMode.CF_TRUE_COLOR_ALPHA:
            case ImageMode.CF_RAW_ALPHA:
            case ImageMode.CF_RGB565A8:
                return "LV_IMG_" + ImageMode[$cf];
            case ImageMode.CF_TRUE_COLOR_CHROMA:
                return "LV_IMG_CF_TRUE_COLOR_CHROMA_KEYED";
            case ImageMode.CF_RAW_CHROMA /* and CF_RAW due to it having the same value */:
                return "LV_IMG_CF_RAW_CHROMA_KEYED";
            case ImageMode.CF_ALPHA_1_BIT:
            case ImageMode.CF_ALPHA_2_BIT:
            case ImageMode.CF_ALPHA_4_BIT:
            case ImageMode.CF_ALPHA_8_BIT:
            case ImageMode.CF_INDEXED_1_BIT:
            case ImageMode.CF_INDEXED_2_BIT:
            case ImageMode.CF_INDEXED_4_BIT:
            case ImageMode.CF_INDEXED_8_BIT:
                return "LV_IMG_" + ImageMode[$cf].replace("_BIT", "BIT");
            default:
                throw new Error("unexpected color format " + $cf);
        }
    }

    get_c_footer($cf: any, out_name: any) {
        var header_cf = Converter.imagemode_to_enum_name($cf);
        var data_size;

        switch ($cf) {
            case ImageMode.CF_TRUE_COLOR:
            case ImageMode.CF_TRUE_COLOR_ALPHA:
            case ImageMode.CF_TRUE_COLOR_CHROMA:
                data_size =
                    this.w * this.h +
                    " * " +
                    ($cf == ImageMode.CF_TRUE_COLOR_ALPHA
                        ? "LV_IMG_PX_SIZE_ALPHA_BYTE"
                        : "LV_COLOR_SIZE / 8");
                break;
            case ImageMode.CF_ALPHA_1_BIT:
            case ImageMode.CF_ALPHA_2_BIT:
            case ImageMode.CF_ALPHA_4_BIT:
            case ImageMode.CF_ALPHA_8_BIT:
            case ImageMode.CF_INDEXED_1_BIT:
            case ImageMode.CF_INDEXED_2_BIT:
            case ImageMode.CF_INDEXED_4_BIT:
            case ImageMode.CF_INDEXED_8_BIT:
            case ImageMode.CF_RGB565A8:
                data_size = this.d_out.length;
                break;
            case ImageMode.CF_RAW:
            case ImageMode.CF_RAW_ALPHA:
            case ImageMode.CF_RAW_CHROMA:
                data_size = this.raw_len;
                break;
            default:
                throw new Error("unexpected color format " + ImageMode[$cf]);
        }

        var $c_footer;
        if (!this.options.useLegacyFooterOrder) {
            $c_footer = `\n};\n
const lv_img_dsc_t ${out_name} = {
  .header.cf = ${header_cf},
  .header.always_zero = 0,
  .header.reserved = 0,
  .header.w = ${this.w},
  .header.h = ${this.h},
  .data_size = ${data_size},
  .data = ${out_name}_map,
};\n`;
        } else {
            $c_footer = `\n};\n
const lv_img_dsc_t ${out_name} = {
  .header.always_zero = 0,
  .header.w = ${this.w},
  .header.h = ${this.h},
  .data_size = ${data_size},
  .header.cf = ${header_cf},
  .data = ${out_name}_map,
};\n`;
        }

        return $c_footer;
    }

    private conv_px(x: any, y: any) {
        function array_push<T>(arr: Array<T>, v: T) {
            arr.push(v);
        }
        function isset(val: any): boolean {
            return typeof val != "undefined" && val != undefined;
        }
        const startIndex = (y * this.w + x) * 4;
        let a;
        if (this.alpha) {
            a = this.imageData[startIndex + 3];
        } else {
            a = 0xff;
        }
        const r = this.imageData[startIndex];
        const g = this.imageData[startIndex + 1];
        const b = this.imageData[startIndex + 2];

        const c = this.imageData[y * this.w + x];

        if (
            this.cf == ImageMode.ICF_TRUE_COLOR_ARGB8565 ||
            this.cf == ImageMode.ICF_TRUE_COLOR_ARGB8565_RBSWAP ||
            this.cf == ImageMode.ICF_TRUE_COLOR_ARGB8332 ||
            this.cf == ImageMode.ICF_TRUE_COLOR_ARGB8888 ||
            this.cf == ImageMode.CF_RGB565A8
        ) {
            /* Populate r_act, g_act, b_act */
            this.dith_next(r, g, b, x);
        }

        if (this.cf == ImageMode.ICF_TRUE_COLOR_ARGB8332) {
            const c8 = this.r_act | (this.g_act >> 3) | (this.b_act >> 6); //RGB332
            array_push(this.d_out, c8);
            if (this.alpha) array_push(this.d_out, a);
        } else if (this.cf == ImageMode.ICF_TRUE_COLOR_ARGB8565) {
            const c16 =
                (this.r_act << 8) | (this.g_act << 3) | (this.b_act >> 3); //RGR565
            array_push(this.d_out, c16 & 0xff);
            array_push(this.d_out, (c16 >> 8) & 0xff);
            if (this.alpha) array_push(this.d_out, a);
        } else if (this.cf == ImageMode.ICF_TRUE_COLOR_ARGB8565_RBSWAP) {
            const c16 =
                (this.r_act << 8) | (this.g_act << 3) | (this.b_act >> 3); //RGR565
            array_push(this.d_out, (c16 >> 8) & 0xff);
            array_push(this.d_out, c16 & 0xff);
            if (this.alpha) array_push(this.d_out, a);
        } else if (this.cf == ImageMode.ICF_TRUE_COLOR_ARGB8888) {
            array_push(this.d_out, this.b_act);
            array_push(this.d_out, this.g_act);
            array_push(this.d_out, this.r_act);
            array_push(this.d_out, a);
        } else if (this.cf == ImageMode.CF_RGB565A8) {
            if (this.pass == 0) {
                const c16 =
                    (this.r_act << 8) | (this.g_act << 3) | (this.b_act >> 3); //RGR565
                array_push(this.d_out, c16 & 0xff);
                array_push(this.d_out, (c16 >> 8) & 0xff);
            } else if (this.pass == 1) {
                if (this.alpha) array_push(this.d_out, a);
            }
        } else if (this.cf == ImageMode.CF_ALPHA_1_BIT) {
            let w = this.w >> 3;
            if (this.w & 0x07) w++;
            const p = w * y + (x >> 3);
            if (!isset(this.d_out[p])) {
                this.d_out[p] = 0; /*Clear the bits first*/
            }
            if (a > 0x80) {
                this.d_out[p] |= 1 << (7 - (x & 0x7));
            }
        } else if (this.cf == ImageMode.CF_ALPHA_2_BIT) {
            let w = this.w >> 2;
            if (this.w & 0x03) w++;

            const p = w * y + (x >> 2);
            if (!isset(this.d_out[p]))
                this.d_out[p] = 0; /*Clear the bits first*/
            this.d_out[p] |= (a >> 6) << (6 - (x & 0x3) * 2);
        } else if (this.cf == ImageMode.CF_ALPHA_4_BIT) {
            let w = this.w >> 1;
            if (this.w & 0x01) w++;

            const p = w * y + (x >> 1);
            if (!isset(this.d_out[p]))
                this.d_out[p] = 0; /*Clear the bits first*/
            this.d_out[p] |= (a >> 4) << (4 - (x & 0x1) * 4);
        } else if (this.cf == ImageMode.CF_ALPHA_8_BIT) {
            const p = this.w * y + x;
            this.d_out[p] = a;
        } else if (this.cf == ImageMode.CF_INDEXED_1_BIT) {
            let w = this.w >> 3;
            if (this.w & 0x07) w++;

            const p = w * y + (x >> 3) + 8; // +8 for the palette
            if (!isset(this.d_out[p])) this.d_out[p] = 0; //Clear the bits first
            this.d_out[p] |= (c & 0x1) << (7 - (x & 0x7));
        } else if (this.cf == ImageMode.CF_INDEXED_2_BIT) {
            let w = this.w >> 2;
            if (this.w & 0x03) w++;

            const p = w * y + (x >> 2) + 16; // +16 for the palette
            if (!isset(this.d_out[p])) this.d_out[p] = 0; // Clear the bits first
            this.d_out[p] |= (c & 0x3) << (6 - (x & 0x3) * 2);
        } else if (this.cf == ImageMode.CF_INDEXED_4_BIT) {
            let w = this.w >> 1;
            if (this.w & 0x01) w++;

            const p = w * y + (x >> 1) + 64; // +64 for the palette
            if (!isset(this.d_out[p])) this.d_out[p] = 0; // Clear the bits first
            this.d_out[p] |= (c & 0xf) << (4 - (x & 0x1) * 4);
        } else if (this.cf == ImageMode.CF_INDEXED_8_BIT) {
            const p = this.w * y + x + 1024; // +1024 for the palette
            this.d_out[p] = c & 0xff;
        }
    }

    dith_reset() {
        if (this.options.dith) {
            this.r_nerr = 0;
            this.g_nerr = 0;
            this.b_nerr = 0;
        }
    }

    dith_next(r: any, g: any, b: any, x: any) {
        if (this.options.dith) {
            this.r_act = r + this.r_nerr + this.r_earr[x + 1];
            this.r_earr[x + 1] = 0;

            this.g_act = g + this.g_nerr + this.g_earr[x + 1];
            this.g_earr[x + 1] = 0;

            this.b_act = b + this.b_nerr + this.b_earr[x + 1];
            this.b_earr[x + 1] = 0;

            if (this.cf == ImageMode.ICF_TRUE_COLOR_ARGB8332) {
                this.r_act = this.classify_pixel(this.r_act, 3);
                this.g_act = this.classify_pixel(this.g_act, 3);
                this.b_act = this.classify_pixel(this.b_act, 2);

                if (this.r_act > 0xe0) this.r_act = 0xe0;
                if (this.g_act > 0xe0) this.g_act = 0xe0;
                if (this.b_act > 0xc0) this.b_act = 0xc0;
            } else if (
                this.cf == ImageMode.ICF_TRUE_COLOR_ARGB8565 ||
                this.cf == ImageMode.ICF_TRUE_COLOR_ARGB8565_RBSWAP
            ) {
                this.r_act = this.classify_pixel(this.r_act, 5);
                this.g_act = this.classify_pixel(this.g_act, 6);
                this.b_act = this.classify_pixel(this.b_act, 5);

                if (this.r_act > 0xf8) this.r_act = 0xf8;
                if (this.g_act > 0xfc) this.g_act = 0xfc;
                if (this.b_act > 0xf8) this.b_act = 0xf8;
            } else if (this.cf == ImageMode.ICF_TRUE_COLOR_ARGB8888) {
                this.r_act = this.classify_pixel(this.r_act, 8);
                this.g_act = this.classify_pixel(this.g_act, 8);
                this.b_act = this.classify_pixel(this.b_act, 8);

                if (this.r_act > 0xff) this.r_act = 0xff;
                if (this.g_act > 0xff) this.g_act = 0xff;
                if (this.b_act > 0xff) this.b_act = 0xff;
            }

            this.r_nerr = r - this.r_act;
            this.g_nerr = g - this.g_act;
            this.b_nerr = b - this.b_act;

            this.r_nerr = round_half_up((7 * this.r_nerr) / 16);
            this.g_nerr = round_half_up((7 * this.g_nerr) / 16);
            this.b_nerr = round_half_up((7 * this.b_nerr) / 16);

            this.r_earr[x] += round_half_up((3 * this.r_nerr) / 16);
            this.g_earr[x] += round_half_up((3 * this.g_nerr) / 16);
            this.b_earr[x] += round_half_up((3 * this.b_nerr) / 16);

            this.r_earr[x + 1] += round_half_up((5 * this.r_nerr) / 16);
            this.g_earr[x + 1] += round_half_up((5 * this.g_nerr) / 16);
            this.b_earr[x + 1] += round_half_up((5 * this.b_nerr) / 16);

            this.r_earr[x + 2] += round_half_up(this.r_nerr / 16);
            this.g_earr[x + 2] += round_half_up(this.g_nerr / 16);
            this.b_earr[x + 2] += round_half_up(this.b_nerr / 16);
        } else {
            if (this.cf == ImageMode.ICF_TRUE_COLOR_ARGB8332) {
                this.r_act = this.classify_pixel(r, 3);
                this.g_act = this.classify_pixel(g, 3);
                this.b_act = this.classify_pixel(b, 2);

                if (this.r_act > 0xe0) this.r_act = 0xe0;
                if (this.g_act > 0xe0) this.g_act = 0xe0;
                if (this.b_act > 0xc0) this.b_act = 0xc0;
            } else if (
                this.cf == ImageMode.ICF_TRUE_COLOR_ARGB8565 ||
                this.cf == ImageMode.ICF_TRUE_COLOR_ARGB8565_RBSWAP ||
                this.cf == ImageMode.CF_RGB565A8
            ) {
                this.r_act = this.classify_pixel(r, 5);
                this.g_act = this.classify_pixel(g, 6);
                this.b_act = this.classify_pixel(b, 5);

                if (this.r_act > 0xf8) this.r_act = 0xf8;
                if (this.g_act > 0xfc) this.g_act = 0xfc;
                if (this.b_act > 0xf8) this.b_act = 0xf8;
            } else if (this.cf == ImageMode.ICF_TRUE_COLOR_ARGB8888) {
                this.r_act = this.classify_pixel(r, 8);
                this.g_act = this.classify_pixel(g, 8);
                this.b_act = this.classify_pixel(b, 8);

                if (this.r_act > 0xff) this.r_act = 0xff;
                if (this.g_act > 0xff) this.g_act = 0xff;
                if (this.b_act > 0xff) this.b_act = 0xff;
            }
        }
    }

    classify_pixel(value: any, bits: any) {
        const tmp = 1 << (8 - bits);
        let val = Math.round(value / tmp) * tmp;
        if (val < 0) val = 0;
        return val;
    }
    format_to_c_array() {
        let c_array = "";
        var i = 0;
        let y_end = this.h;
        let x_end = this.w;

        if (this.cf == ImageMode.ICF_TRUE_COLOR_ARGB8332) {
            c_array += "\n#if LV_COLOR_DEPTH == 1 || LV_COLOR_DEPTH == 8";
            if (!this.alpha)
                c_array +=
                    "\n  /*Pixel format: Red: 3 bit, Green: 3 bit, Blue: 2 bit*/";
            else
                c_array +=
                    "\n  /*Pixel format: Alpha 8 bit, Red: 3 bit, Green: 3 bit, Blue: 2 bit*/";
        } else if (this.cf == ImageMode.ICF_TRUE_COLOR_ARGB8565) {
            c_array += "\n#if LV_COLOR_DEPTH == 16 && LV_COLOR_16_SWAP == 0";
            if (!this.alpha)
                c_array +=
                    "\n  /*Pixel format: Red: 5 bit, Green: 6 bit, Blue: 5 bit*/";
            else
                c_array +=
                    "\n  /*Pixel format: Alpha 8 bit, Red: 5 bit, Green: 6 bit, Blue: 5 bit*/";
        } else if (this.cf == ImageMode.ICF_TRUE_COLOR_ARGB8565_RBSWAP) {
            c_array += "\n#if LV_COLOR_DEPTH == 16 && LV_COLOR_16_SWAP != 0";
            if (!this.alpha)
                c_array +=
                    "\n  /*Pixel format: Red: 5 bit, Green: 6 bit, Blue: 5 bit BUT the 2 bytes are swapped*/";
            else
                c_array +=
                    "\n  /*Pixel format: Alpha 8 bit, Red: 5 bit, Green: 6 bit, Blue: 5 bit  BUT the 2  color bytes are swapped*/";
        } else if (this.cf == ImageMode.ICF_TRUE_COLOR_ARGB8888) {
            c_array += "\n#if LV_COLOR_DEPTH == 32";
            if (!this.alpha)
                c_array +=
                    "\n  /*Pixel format: Fix 0xFF: 8 bit, Red: 8 bit, Green: 8 bit, Blue: 8 bit*/";
            else
                "\n  /*Pixel format: Alpha 8 bit, Red: 8 bit, Green: 8 bit, Blue: 8 bit*/";
        } else if (this.cf == ImageMode.CF_INDEXED_1_BIT) {
            c_array += "\n";
            for (var p = 0; p < 2; p++) {
                c_array +=
                    "  0x" +
                    str_pad(dechex(this.d_out[p * 4 + 0]), 2, "0", true) +
                    ", ";
                c_array +=
                    "0x" +
                    str_pad(dechex(this.d_out[p * 4 + 1]), 2, "0", true) +
                    ", ";
                c_array +=
                    "0x" +
                    str_pad(dechex(this.d_out[p * 4 + 2]), 2, "0", true) +
                    ", ";
                c_array +=
                    "0x" +
                    str_pad(dechex(this.d_out[p * 4 + 3]), 2, "0", true) +
                    ", ";
                c_array += `\t/*Color of index ${p}*/\n`;
            }

            i = p * 4;
        } else if (this.cf == ImageMode.CF_INDEXED_2_BIT) {
            c_array += "\n";
            for (p = 0; p < 4; p++) {
                c_array +=
                    "  0x" +
                    str_pad(dechex(this.d_out[p * 4 + 0]), 2, "0", true) +
                    ", ";
                c_array +=
                    "0x" +
                    str_pad(dechex(this.d_out[p * 4 + 1]), 2, "0", true) +
                    ", ";
                c_array +=
                    "0x" +
                    str_pad(dechex(this.d_out[p * 4 + 2]), 2, "0", true) +
                    ", ";
                c_array +=
                    "0x" +
                    str_pad(dechex(this.d_out[p * 4 + 3]), 2, "0", true) +
                    ", ";
                c_array += `\t/*Color of index ${p}*/\n`;
            }

            i = p * 4;
        } else if (this.cf == ImageMode.CF_INDEXED_4_BIT) {
            c_array += "\n";
            for (p = 0; p < 16; p++) {
                c_array +=
                    "  0x" +
                    str_pad(dechex(this.d_out[p * 4 + 0]), 2, "0", true) +
                    ", ";
                c_array +=
                    "0x" +
                    str_pad(dechex(this.d_out[p * 4 + 1]), 2, "0", true) +
                    ", ";
                c_array +=
                    "0x" +
                    str_pad(dechex(this.d_out[p * 4 + 2]), 2, "0", true) +
                    ", ";
                c_array +=
                    "0x" +
                    str_pad(dechex(this.d_out[p * 4 + 3]), 2, "0", true) +
                    ", ";
                c_array += `\t/*Color of index ${p}*/\n`;
            }

            i = p * 4;
        } else if (this.cf == ImageMode.CF_INDEXED_8_BIT) {
            c_array += "\n";
            for (p = 0; p < 256; p++) {
                c_array +=
                    "  0x" +
                    str_pad(dechex(this.d_out[p * 4 + 0]), 2, "0", true) +
                    ", ";
                c_array +=
                    "0x" +
                    str_pad(dechex(this.d_out[p * 4 + 1]), 2, "0", true) +
                    ", ";
                c_array +=
                    "0x" +
                    str_pad(dechex(this.d_out[p * 4 + 2]), 2, "0", true) +
                    ", ";
                c_array +=
                    "0x" +
                    str_pad(dechex(this.d_out[p * 4 + 3]), 2, "0", true) +
                    ", ";
                c_array += `\t/*Color of index ${p}*/\n`;
            }

            i = p * 4;
        } else if (
            this.cf == ImageMode.CF_RAW_ALPHA ||
            this.cf == ImageMode.CF_RAW_CHROMA
        ) {
            y_end = 1;
            x_end = this.d_out.length;
            i = 1;
        } else if (
            this.cf == ImageMode.CF_ALPHA_1_BIT ||
            this.cf == ImageMode.CF_ALPHA_2_BIT ||
            this.cf == ImageMode.CF_ALPHA_4_BIT ||
            this.cf == ImageMode.CF_ALPHA_8_BIT ||
            this.cf == ImageMode.CF_RGB565A8
        ) {
            /* No special handling required */
        } else throw new Error("Unhandled color format: " + ImageMode[this.cf]);

        for (var y = 0; y < y_end; y++) {
            c_array += "\n  ";
            for (var x = 0; x < x_end; x++) {
                /* Note: some accesses to d_out may be out of bounds */
                if (this.cf == ImageMode.ICF_TRUE_COLOR_ARGB8332) {
                    c_array +=
                        "0x" +
                        str_pad(dechex(this.d_out[i]), 2, "0", true) +
                        ", ";
                    i++;
                    if (this.alpha) {
                        c_array +=
                            "0x" +
                            str_pad(dechex(this.d_out[i]), 2, "0", true) +
                            ", ";
                        i++;
                    }
                } else if (
                    this.cf == ImageMode.ICF_TRUE_COLOR_ARGB8565 ||
                    this.cf == ImageMode.ICF_TRUE_COLOR_ARGB8565_RBSWAP ||
                    this.cf == ImageMode.CF_RGB565A8
                ) {
                    if (this.options.swapEndian) {
                        c_array +=
                            "0x" +
                            str_pad(dechex(this.d_out[i + 1]), 2, "0", true) +
                            ", ";
                        c_array +=
                            "0x" +
                            str_pad(dechex(this.d_out[i]), 2, "0", true) +
                            ", ";
                    } else {
                        c_array +=
                            "0x" +
                            str_pad(dechex(this.d_out[i]), 2, "0", true) +
                            ", ";
                        c_array +=
                            "0x" +
                            str_pad(dechex(this.d_out[i + 1]), 2, "0", true) +
                            ", ";
                    }
                    i += 2;
                    if (this.cf != ImageMode.CF_RGB565A8 && this.alpha) {
                        c_array +=
                            "0x" +
                            str_pad(dechex(this.d_out[i]), 2, "0", true) +
                            ", ";
                        i++;
                    }
                } else if (this.cf == ImageMode.ICF_TRUE_COLOR_ARGB8888) {
                    if (this.options.swapEndian) {
                        c_array +=
                            "0x" +
                            str_pad(dechex(this.d_out[i + 2]), 2, "0", true) +
                            ", ";
                        c_array +=
                            "0x" +
                            str_pad(dechex(this.d_out[i + 1]), 2, "0", true) +
                            ", ";
                        c_array +=
                            "0x" +
                            str_pad(dechex(this.d_out[i]), 2, "0", true) +
                            ", ";
                    } else {
                        c_array +=
                            "0x" +
                            str_pad(dechex(this.d_out[i]), 2, "0", true) +
                            ", ";
                        c_array +=
                            "0x" +
                            str_pad(dechex(this.d_out[i + 1]), 2, "0", true) +
                            ", ";
                        c_array +=
                            "0x" +
                            str_pad(dechex(this.d_out[i + 2]), 2, "0", true) +
                            ", ";
                    }
                    c_array +=
                        "0x" +
                        str_pad(dechex(this.d_out[i + 3]), 2, "0", true) +
                        ", ";

                    i += 4;
                } else if (
                    this.cf == ImageMode.CF_ALPHA_1_BIT ||
                    this.cf == ImageMode.CF_INDEXED_1_BIT
                ) {
                    if ((x & 0x7) == 0) {
                        c_array +=
                            "0x" +
                            str_pad(dechex(this.d_out[i]), 2, "0", true) +
                            ", ";
                        i++;
                    }
                } else if (
                    this.cf == ImageMode.CF_ALPHA_2_BIT ||
                    this.cf == ImageMode.CF_INDEXED_2_BIT
                ) {
                    if ((x & 0x3) == 0) {
                        c_array +=
                            "0x" +
                            str_pad(dechex(this.d_out[i]), 2, "0", true) +
                            ", ";
                        i++;
                    }
                } else if (
                    this.cf == ImageMode.CF_ALPHA_4_BIT ||
                    this.cf == ImageMode.CF_INDEXED_4_BIT
                ) {
                    if ((x & 0x1) == 0) {
                        c_array +=
                            "0x" +
                            str_pad(dechex(this.d_out[i]), 2, "0", true) +
                            ", ";
                        i++;
                    }
                } else if (
                    this.cf == ImageMode.CF_ALPHA_8_BIT ||
                    this.cf == ImageMode.CF_INDEXED_8_BIT
                ) {
                    c_array +=
                        "0x" +
                        str_pad(dechex(this.d_out[i]), 2, "0", true) +
                        ", ";
                    i++;
                } else if (
                    this.cf == ImageMode.CF_RAW_ALPHA ||
                    this.cf == ImageMode.CF_RAW_CHROMA
                ) {
                    c_array +=
                        "0x" +
                        str_pad(dechex(this.d_out[i]), 2, "0", true) +
                        ", ";
                    if (i != 0 && i % 16 == 0) c_array += "\n  ";
                    i++;
                } else
                    throw new Error(
                        "Unhandled color format: " + ImageMode[this.cf]
                    );
            }
        }

        if (this.cf == ImageMode.CF_RGB565A8) {
            c_array += "\n  /*alpha channel*/\n  ";
            for (var y = 0; y < y_end; y++) {
                for (var x = 0; x < x_end; x++) {
                    c_array +=
                        "0x" +
                        str_pad(dechex(this.d_out[i]), 2, "0", true) +
                        ", ";
                    i++;
                }
                c_array += "\n  ";
            }
        }

        if (
            this.cf == ImageMode.ICF_TRUE_COLOR_ARGB8332 ||
            this.cf == ImageMode.ICF_TRUE_COLOR_ARGB8565 ||
            this.cf == ImageMode.ICF_TRUE_COLOR_ARGB8565_RBSWAP ||
            this.cf == ImageMode.ICF_TRUE_COLOR_ARGB8888
        ) {
            c_array += "\n#endif";
        }
        return c_array;
    }
}

export function isNotRaw(options: { cf: ImageMode }): boolean {
    return (
        options.cf != ImageMode.CF_RAW && options.cf != ImageMode.CF_RAW_ALPHA
    ); /* && options.cf != ImageMode.CF_RAW_CHROMA; */
}

async function convertImage(
    img: HTMLImageElement | Uint8Array,
    options: Partial<ConverterOptions>
): Promise<string | ArrayBuffer> {
    function isImage(img: any, options: any): img is HTMLImageElement {
        return isNotRaw(options);
    }
    let c_res_array: string = "";
    let bin_res_blob: ArrayBuffer;
    const out_name = options.outName;
    const outputFormat: OutputMode | undefined = options.outputFormat;
    let c_creator: Converter;
    if (isImage(img, options)) {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, img.width, img.height).data;

        const alpha =
            options.cf == ImageMode.CF_TRUE_COLOR_ALPHA ||
            options.cf == ImageMode.CF_ALPHA_1_BIT ||
            options.cf == ImageMode.CF_ALPHA_2_BIT ||
            options.cf == ImageMode.CF_ALPHA_4_BIT ||
            options.cf == ImageMode.CF_ALPHA_8_BIT ||
            options.cf == ImageMode.CF_RGB565A8;
        c_creator = new Converter(
            img.width,
            img.height,
            imageData,
            alpha,
            options
        );

        if (options.outputFormat == OutputMode.C) {
            if (
                options.cf == ImageMode.CF_TRUE_COLOR ||
                options.cf == ImageMode.CF_TRUE_COLOR_ALPHA ||
                options.cf == ImageMode.CF_TRUE_COLOR_CHROMA
            ) {
                const arrayList = (await Promise.all(
                    [
                        ImageMode.ICF_TRUE_COLOR_ARGB8332,
                        ImageMode.ICF_TRUE_COLOR_ARGB8565,
                        ImageMode.ICF_TRUE_COLOR_ARGB8565_RBSWAP,
                        ImageMode.ICF_TRUE_COLOR_ARGB8888
                    ].map(cf =>
                        new Converter(
                            img.width,
                            img.height,
                            imageData,
                            alpha,
                            Object.assign({}, options, { cf })
                        ).convert()
                    )
                )) as string[];
                c_res_array = arrayList.join("");
            } else c_res_array = (await c_creator.convert()) as string;
        } else {
            const binaryConv = new Converter(
                img.width,
                img.height,
                imageData,
                alpha,
                options
            );
            bin_res_blob = (await binaryConv.convert()) as ArrayBuffer;
        }
    } else {
        c_creator = new Converter(
            options.overrideWidth ?? 0,
            options.overrideHeight ?? 0,
            img,
            options.cf == ImageMode.CF_RAW_ALPHA,
            options
        );
        if (options.outputFormat == OutputMode.C)
            c_res_array = (await c_creator.convert()) as string;
        else bin_res_blob = (await c_creator.convert()) as ArrayBuffer;
    }

    if (outputFormat == OutputMode.BIN) return bin_res_blob!;
    else
        return (
            c_creator.get_c_header(out_name!) +
            c_res_array +
            c_creator.get_c_footer(options.cf, out_name!)
        );
}

export { convertImage, Converter };
