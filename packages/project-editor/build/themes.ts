import { strToColor16 } from "eez-studio-shared/color";
import { TAB, NamingConvention, getName } from "project-editor/build/helper";
import {
    Theme,
    getProjectWithThemes
} from "project-editor/features/style/theme";
import type { Assets, DataBuffer } from "project-editor/build/assets";

export function buildGuiThemesEnum(assets: Assets) {
    let themes = getProjectWithThemes(assets.projectStore).themes.map(
        (theme, i) =>
            `${TAB}${getName(
                "THEME_ID_",
                theme,
                NamingConvention.UnderscoreUpperCase
            )} = ${i}`
    );

    return `enum ThemesEnum {\n${themes.join(",\n")}\n};`;
}

export function buildGuiColorsEnum(assets: Assets) {
    let colors = [
        `${TAB}COLOR_ID_TRANSPARENT = 65535`,

        ...assets.rootProject.buildColors.map(
            (color, i) =>
                `${TAB}${getName(
                    "COLOR_ID_",
                    color,
                    NamingConvention.UnderscoreUpperCase
                )} = ${i}`
        ),

        ...assets.colors.map(
            (color, i) =>
                `\tCOLOR_ID_CUSTOM_${color == undefined
                    ? "UNDEFINED"
                    : color.slice(1).toUpperCase()
                } = ${assets.rootProject.buildColors.length + i}`
        )
    ];

    return `enum ColorsEnum {\n${colors.join(",\n")}\n};`;
}

export function buildGuiColors(assets: Assets, dataBuffer: DataBuffer) {
    function buildColor(color: string) {
        dataBuffer.writeUint16(strToColor16(color));
    }

    function buildTheme(theme: Theme) {
        dataBuffer.writeObjectOffset(() => dataBuffer.writeString(theme.name));
        dataBuffer.writeNumberArray(theme.colors, buildColor);
    }

    if (!assets.projectStore.masterProject) {
        dataBuffer.writeObjectOffset(() => {
            // themes
            dataBuffer.writeArray(
                getProjectWithThemes(assets.projectStore).themes,
                buildTheme
            );

            // colors
            dataBuffer.writeNumberArray(assets.colors, buildColor);
        });
    } else {
        dataBuffer.writeObjectOffset(() => {
            // themes
            dataBuffer.writeArray(
                [],
                buildTheme
            );

            // colors
            dataBuffer.writeNumberArray(assets.colors, buildColor);
        });
    }
}
