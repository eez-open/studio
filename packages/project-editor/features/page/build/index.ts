import { BuildResult } from "project-editor/core/extensions";

import { Project, BuildConfiguration } from "project-editor/project/project";

import { build as buildV1 } from "project-editor/features/page/build/build-v1";
import { build as buildV2 } from "project-editor/features/page/build/build-v2";

import {
    Assets,
    buildGuiAssetsData,
    buildGuiAssetsDecl,
    buildGuiAssetsDef
} from "project-editor/features/page/build/assets";

import { buildGuiPagesEnum } from "project-editor/features/page/build/pages";
import { buildGuiStylesEnum } from "project-editor/features/page/build/styles";
import { buildGuiFontsEnum } from "project-editor/features/page/build/fonts";
import { buildGuiBitmapsEnum } from "project-editor/features/page/build/bitmaps";
import {
    buildGuiThemesEnum,
    buildGuiColorsEnum
} from "project-editor/features/page/build/themes";
import { buildFlowDefs } from "project-editor/features/page/build/flows";

////////////////////////////////////////////////////////////////////////////////

export async function build(
    project: Project,
    sectionNames: string[] | undefined,
    buildConfiguration: BuildConfiguration | undefined
): Promise<BuildResult> {
    if (project.settings.general.projectVersion === "v1") {
        return buildV1(project, sectionNames, buildConfiguration);
    }

    if (project.settings.general.projectVersion === "v2") {
        return buildV2(project, sectionNames, buildConfiguration);
    }

    const result: any = {};

    const assets = new Assets(project, buildConfiguration);

    assets.reportUnusedAssets();

    // build enum's
    if (!sectionNames || sectionNames.indexOf("GUI_PAGES_ENUM") !== -1) {
        result.GUI_PAGES_ENUM = buildGuiPagesEnum(assets);
    }

    if (!sectionNames || sectionNames.indexOf("GUI_STYLES_ENUM") !== -1) {
        result.GUI_STYLES_ENUM = buildGuiStylesEnum(assets);
    }

    if (!sectionNames || sectionNames.indexOf("GUI_FONTS_ENUM") !== -1) {
        result.GUI_FONTS_ENUM = buildGuiFontsEnum(assets);
    }

    if (!sectionNames || sectionNames.indexOf("GUI_BITMAPS_ENUM") !== -1) {
        result.GUI_BITMAPS_ENUM = buildGuiBitmapsEnum(assets);
    }

    if (!sectionNames || sectionNames.indexOf("GUI_THEMES_ENUM") !== -1) {
        result.GUI_THEMES_ENUM = buildGuiThemesEnum(assets);
    }

    if (!sectionNames || sectionNames.indexOf("GUI_COLORS_ENUM") !== -1) {
        result.GUI_COLORS_ENUM = buildGuiColorsEnum(assets);
    }

    if (!sectionNames || sectionNames.indexOf("FLOW_DEFS") !== -1) {
        result.FLOW_DEFS = buildFlowDefs(assets);
    }

    const buildAssetsDecl =
        !sectionNames || sectionNames.indexOf("GUI_ASSETS_DECL") !== -1;

    const buildAssetsDeclCompressed =
        !sectionNames ||
        sectionNames.indexOf("GUI_ASSETS_DECL_COMPRESSED") !== -1;

    const buildAssetsDef =
        !sectionNames || sectionNames.indexOf("GUI_ASSETS_DEF") !== -1;

    const buildAssetsDefCompressed =
        !sectionNames ||
        sectionNames.indexOf("GUI_ASSETS_DEF_COMPRESSED") !== -1;

    const buildAssetsData =
        !sectionNames || sectionNames.indexOf("GUI_ASSETS_DATA") !== -1;

    const buildAssetsDataMap =
        !sectionNames || sectionNames.indexOf("GUI_ASSETS_DATA_MAP") !== -1;

    if (
        buildAssetsDecl ||
        buildAssetsDeclCompressed ||
        buildAssetsDef ||
        buildAssetsDefCompressed ||
        buildAssetsData ||
        buildAssetsDataMap
    ) {
        // build all assets as single data chunk
        const compressedAssetsData = await buildGuiAssetsData(assets);

        if (buildAssetsDecl) {
            result.GUI_ASSETS_DECL = buildGuiAssetsDecl(compressedAssetsData);
        }

        if (buildAssetsDeclCompressed) {
            result.GUI_ASSETS_DECL_COMPRESSED =
                buildGuiAssetsDecl(compressedAssetsData);
        }

        if (buildAssetsDef) {
            result.GUI_ASSETS_DEF = await buildGuiAssetsDef(
                compressedAssetsData
            );
        }

        if (buildAssetsDefCompressed) {
            result.GUI_ASSETS_DEF_COMPRESSED = await buildGuiAssetsDef(
                compressedAssetsData
            );
        }

        if (buildAssetsData) {
            result.GUI_ASSETS_DATA = compressedAssetsData;
        }

        if (buildAssetsDataMap) {
            assets.finalizeMap();
            result.GUI_ASSETS_DATA_MAP = JSON.stringify(
                assets.map,
                undefined,
                2
            );
        }
    }

    return result;
}
