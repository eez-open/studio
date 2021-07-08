import * as projectBuild from "project-editor/project/build";
import { getData as getBitmapData } from "project-editor/features/bitmap/bitmap";
import { Assets } from "project-editor/features/page/build/assets";
import {
    DataBuffer,
    Struct,
    Int16,
    UInt8ArrayField
} from "project-editor/features/page/build/pack";

export function buildGuiBitmapsEnum(assets: Assets) {
    let bitmaps = assets.bitmaps.map(
        (bitmap, i) =>
            `${projectBuild.TAB}${projectBuild.getName(
                "BITMAP_ID_",
                bitmap,
                projectBuild.NamingConvention.UnderscoreUpperCase
            )} = ${i + 1}`
    );

    bitmaps.unshift(`${projectBuild.TAB}BITMAP_ID_NONE = 0`);

    return `enum BitmapsEnum {\n${bitmaps.join(",\n")}\n};`;
}

async function buildGuiBitmaps(assets: Assets) {
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

    for (let i = 0; i < assets.bitmaps.length; i++) {
        const bitmapsData = await getBitmapData(assets.bitmaps[i]);

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
    dataBuffer: DataBuffer
) {
    const bitmaps = await buildGuiBitmaps(assets);
    if (bitmaps) {
        await dataBuffer.packRegions(bitmaps.length, async (i: number) => {
            const bitmap = bitmaps[i];

            const struct = new Struct();

            struct.addField(new Int16(bitmap.width));
            struct.addField(new Int16(bitmap.height));
            struct.addField(new Int16(bitmap.bpp));
            struct.addField(new Int16(0));
            struct.addField(new UInt8ArrayField(bitmap.pixels));

            struct.packObject(dataBuffer);
        });
    }
}
