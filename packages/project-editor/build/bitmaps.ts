import { getBitmapDataAsync } from "project-editor/features/bitmap/bitmap";
import type { Assets, DataBuffer } from "project-editor/build/assets";
import { TAB, NamingConvention, getName } from "project-editor/build/helper";

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

async function buildGuiBitmaps(
    assets: Assets,
    option: "check" | "buildAssets" | "buildFiles"
) {
    if (assets.bitmaps.length === 0) {
        return null;
    }

    let bitmaps: {
        name: string;
        width: number;
        height: number;
        bpp: number;
        pixels: Uint8Array;
    }[] = [];

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

export async function buildGuiBitmapsData(
    assets: Assets,
    dataBuffer: DataBuffer,
    option: "check" | "buildAssets" | "buildFiles"
) {
    const bitmaps = await buildGuiBitmaps(assets, option);

    dataBuffer.writeArray(bitmaps || [], bitmap => {
        dataBuffer.writeInt16(bitmap.width);
        dataBuffer.writeInt16(bitmap.height);
        dataBuffer.writeInt16(bitmap.bpp);
        dataBuffer.writeInt16(0);
        dataBuffer.writeObjectOffset(() => dataBuffer.writeString(bitmap.name));
        dataBuffer.writeUint8Array(bitmap.pixels);
    });
}
