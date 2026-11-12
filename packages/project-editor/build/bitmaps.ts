import { computed, IComputedValue } from "mobx";

import {
    Bitmap,
    getBitmapDataAsync
} from "project-editor/features/bitmap/bitmap";
import type { Assets, DataBuffer } from "project-editor/build/assets";
import { TAB, NamingConvention, getName } from "project-editor/build/helper";

export interface GuiBitmap {
    name: string;
    width: number;
    height: number;
    bpp: number;
    pixels: Uint8Array;
}

export function buildGuiBitmapsEnum(assets: Assets) {
    let bitmaps = assets.bitmaps.map(
        (bitmap, i) =>
            `${TAB}${getName(
                "BITMAP_ID_",
                bitmap,
                NamingConvention.UnderscoreUpperCase
            )} = ${i + 1}`
    );

    bitmaps.unshift(`${TAB}BITMAP_ID_NONE = 0`);

    return `enum BitmapsEnum {\n${bitmaps.join(",\n")}\n};`;
}

// the bitmaps of the assets, to be written with writeGuiBitmapsData
export async function getGuiBitmaps(
    assets: Assets,
    option: "check" | "buildAssets" | "buildFiles"
) {
    if (assets.bitmaps.length === 0) {
        return null;
    }

    let bitmaps: GuiBitmap[] = [];

    const bitmapColorFormat =
        option == "buildAssets"
            ? "RGB"
            : assets.projectStore.project.settings.general.bitmapColorFormat;

    Promise.all(
        assets.bitmaps.map(bitmap =>
            getBitmapDataAsync(bitmap, undefined, bitmapColorFormat)
        )
    );

    for (let i = 0; i < assets.bitmaps.length; i++) {
        const bitmapsData = await getBitmapDataAsync(
            assets.bitmaps[i],
            undefined,
            bitmapColorFormat
        );

        bitmaps.push({
            name: assets.bitmaps[i].name,
            width: bitmapsData.width,
            height: bitmapsData.height,
            bpp: bitmapsData.bpp,
            pixels: bitmapsData.pixels
        });
    }

    return bitmaps;
}

// The editor build (see EditorBuild in assets.ts) is synchronous: the pixels of
// a bitmap are decoded once and kept until the bitmap changes; while its image
// is loading the bitmap is an empty 1x1 one (the editor build runs again when
// the image is loaded).
const editorBitmapData = new WeakMap<Bitmap, IComputedValue<GuiBitmap>>();

function getEditorBitmap(bitmap: Bitmap) {
    let bitmapData = editorBitmapData.get(bitmap);
    if (!bitmapData) {
        bitmapData = computed(
            () => {
                // the same as getBitmapDataAsync with the "buildAssets" option
                const data = bitmap.getBitmapData(bitmap.bpp, "RGB");
                if (data) {
                    return {
                        name: bitmap.name,
                        width: data.width,
                        height: data.height,
                        bpp: data.bpp,
                        pixels: data.pixels
                    };
                }
                return {
                    name: bitmap.name,
                    width: 1,
                    height: 1,
                    bpp: 32,
                    pixels: new Uint8Array([0, 0, 0, 0])
                };
            },
            { keepAlive: true }
        );
        editorBitmapData.set(bitmap, bitmapData);
    }
    return bitmapData.get();
}

export function getEditorGuiBitmaps(assets: Assets) {
    if (assets.bitmaps.length === 0) {
        return null;
    }
    return assets.bitmaps.map(bitmap => getEditorBitmap(bitmap));
}

export function writeGuiBitmapsData(
    dataBuffer: DataBuffer,
    bitmaps: GuiBitmap[] | null
) {
    dataBuffer.writeArray(bitmaps || [], bitmap => {
        dataBuffer.writeInt16(bitmap.width);
        dataBuffer.writeInt16(bitmap.height);
        dataBuffer.writeInt16(bitmap.bpp);
        dataBuffer.writeInt16(0);
        dataBuffer.writeStringPtr(bitmap.name);
        dataBuffer.writeUint8Array(bitmap.pixels);
    });
}
