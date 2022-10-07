import {
    TAB,
    NamingConvention,
    getName,
    indent
} from "project-editor/build/helper";
import { ProjectEditor } from "project-editor/project-editor-interface";

import type { Project } from "project-editor/project/project";

export function buildLvglDecl(project: Project) {
    let pages = project.pages.map(page => {
        return `lv_obj_t *${getName(
            "setup_screen_",
            page,
            NamingConvention.UnderscoreLowerCase
        )}();`;
    });

    let bitmaps = project.bitmaps.map(bitmap => {
        return `extern const lv_img_dsc_t ${getName(
            "img_",
            bitmap,
            NamingConvention.UnderscoreLowerCase
        )};`;
    });

    return pages.join("\n") + "\n\n" + bitmaps.join("\n");
}

export async function buildLvglDef(project: Project) {
    let pages = project.pages.map(page => {
        return `lv_obj_t *${getName(
            "setup_screen_",
            page,
            NamingConvention.UnderscoreLowerCase
        )}() {\n${indent(TAB, page.lvglBuild())}\n}`;
    });

    let bitmaps = await Promise.all(
        project.bitmaps.map(async bitmap => {
            const varName = getName(
                "img_",
                bitmap,
                NamingConvention.UnderscoreLowerCase
            );

            const bitmapData = await ProjectEditor.getBitmapData(bitmap);

            return `const LV_ATTRIBUTE_MEM_ALIGN uint8_t ${varName}_data[] = { ${bitmapData.pixels.join(
                ", "
            )} };
const lv_img_dsc_t ${varName} = {
    .header.always_zero = 0,
    .header.w = ${bitmapData.width},
    .header.h = ${bitmapData.height},
    .data_size = sizeof(${varName}_data),
    .header.cf = ${
        bitmapData.bpp == 32
            ? "LV_IMG_CF_TRUE_COLOR_ALPHA"
            : "LV_IMG_CF_TRUE_COLOR"
    },
    .data = ${varName}_data
};\n`;
        })
    );

    return pages.join("\n") + "\n\n" + bitmaps.join("\n");
}
