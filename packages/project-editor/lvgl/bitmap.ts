import { convertImageBlob } from "./lv_img_conv/lib/convert";
import { ImageMode, OutputMode } from "./lv_img_conv/lib/enums";

import {
    Bitmap,
    CF_ALPHA_1_BIT,
    CF_ALPHA_2_BIT,
    CF_ALPHA_4_BIT,
    CF_ALPHA_8_BIT,
    CF_INDEXED_1_BIT,
    CF_INDEXED_2_BIT,
    CF_INDEXED_4_BIT,
    CF_INDEXED_8_BIT,
    CF_RAW,
    CF_RAW_CHROMA,
    CF_RAW_ALPHA,
    CF_TRUE_COLOR,
    CF_TRUE_COLOR_ALPHA,
    CF_TRUE_COLOR_CHROMA,
    CF_RGB565A8
} from "project-editor/features/bitmap/bitmap";

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
    [CF_TRUE_COLOR_CHROMA.toString()]: ImageMode.CF_TRUE_COLOR_CHROMA,

    [CF_RGB565A8.toString()]: ImageMode.CF_RGB565A8
};

function tryParsingImageData(url: string) {
    return new Promise<HTMLImageElement | null>(resolve => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => resolve(null);
        image.src = url;
    });
}

export async function getLvglBitmapSourceFile(bitmap: Bitmap) {
    const result = await tryParsingImageData(bitmap.image);

    if (!result) {
        return "";
    }

    return (await convertImageBlob(result, {
        cf: TO_IMAGE_MODE[bitmap.bpp.toString()],
        outName: "img_" + bitmap.name,
        swapEndian: false,
        outputFormat: OutputMode.C,
        binaryFormat:
            bitmap.bpp == CF_TRUE_COLOR ||
            bitmap.bpp == CF_TRUE_COLOR_ALPHA ||
            bitmap.bpp == CF_TRUE_COLOR_CHROMA
                ? ImageMode.ICF_TRUE_COLOR_ARGB8888
                : undefined,
        overrideWidth: result.width,
        overrideHeight: result.height
    })) as string;
}
