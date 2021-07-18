import * as projectBuild from "project-editor/project/build";

import { Assets, DataBuffer } from "project-editor/features/page/build/assets";
import { buildWidget } from "project-editor/features/page/build/widgets";

export function buildGuiPagesEnum(assets: Assets) {
    let pages = assets.pages.map(
        (widget, i) =>
            `${projectBuild.TAB}${projectBuild.getName(
                "PAGE_ID_",
                widget,
                projectBuild.NamingConvention.UnderscoreUpperCase
            )} = ${i + 1}`
    );

    pages.unshift(`${projectBuild.TAB}PAGE_ID_NONE = 0`);

    return `enum PagesEnum {\n${pages.join(",\n")}\n};`;
}

export function buildGuiDocumentData(assets: Assets, dataBuffer: DataBuffer) {
    if (dataBuffer) {
        dataBuffer.writeArray(assets.pages, page =>
            buildWidget(page, assets, dataBuffer)
        );
    } else {
        assets.pages.forEach(page => {
            buildWidget(page, assets, dataBuffer);
        });
    }
}
