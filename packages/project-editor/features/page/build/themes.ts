import { strToColor16 } from "eez-studio-shared/color";
import * as projectBuild from "project-editor/project/build";
import { Theme } from "project-editor/features/style/theme";
import { Assets, DataBuffer } from "project-editor/features/page/build/assets";

export function buildGuiThemesEnum(assets: Assets) {
    let themes = assets.rootProject.themes.map(
        (theme, i) =>
            `${projectBuild.TAB}${projectBuild.getName(
                "THEME_ID_",
                theme,
                projectBuild.NamingConvention.UnderscoreUpperCase
            )} = ${i}`
    );

    return `enum ThemesEnum {\n${themes.join(",\n")}\n};`;
}

export function buildGuiColorsEnum(assets: Assets) {
    let colors = assets.rootProject.colors.map(
        (color, i) =>
            `${projectBuild.TAB}${projectBuild.getName(
                "COLOR_ID_",
                color,
                projectBuild.NamingConvention.UnderscoreUpperCase
            )} = ${i}`
    );

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

    if (!assets.DocumentStore.masterProject) {
        dataBuffer.writeObjectOffset(() => {
            // no. of theme colors
            dataBuffer.writeUint32(
                assets.rootProject.themes.length > 0
                    ? assets.rootProject.themes[0].colors.length
                    : 0
            );

            // themes
            dataBuffer.writeArray(assets.rootProject.themes, buildTheme);

            // colors
            dataBuffer.writeNumberArray(assets.colors, buildColor);
        });
    } else {
        dataBuffer.writeUint32(0);
    }
}
