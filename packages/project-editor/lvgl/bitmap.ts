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

export async function getLvglBitmapSourceFile(
    bitmap: Bitmap,
    fileName: string
) {
    const { convertImage } = await import("./lv_img_conv/lib/convert");
    const { ImageMode, OutputMode } = await import("./lv_img_conv/lib/enums");

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
}
