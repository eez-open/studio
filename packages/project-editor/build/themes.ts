import { strToColor16, strToColor32 } from "eez-studio-shared/color";
import { TAB, NamingConvention, getName } from "project-editor/build/helper";
import {
    Theme,
    getModuleColorValue,
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
        if (assets.projectStore.project.settings.general.colorBpp == "16") {
            dataBuffer.writeUint16(strToColor16(color));
        } else {
            dataBuffer.writeUint32(strToColor32(color));
        }
    }

    // the values of the colors defined in the module project for the theme
    const moduleColors = assets.moduleColors;
    function getModuleColorValues(theme: Theme) {
        return moduleColors.map(color =>
            getModuleColorValue(color, theme.name)
        );
    }

    function buildTheme(theme: Theme, colors: string[]) {
        dataBuffer.writeStringPtr(theme.name);
        dataBuffer.writeNumberArray(colors, buildColor);
    }

    const themes = getProjectWithThemes(assets.projectStore).themes;

    if (!assets.masterProject) {
        dataBuffer.writeObjectOffset(() => {
            // themes (module project with the master project included:
            // the module colors after the master colors)
            dataBuffer.writeArray(themes, theme =>
                buildTheme(theme, [
                    ...theme.colors,
                    ...getModuleColorValues(theme)
                ])
            );

            // colors
            dataBuffer.writeNumberArray(assets.colors, buildColor);
        });
    } else {
        dataBuffer.writeObjectOffset(() => {
            // themes: for each master theme (in the same order) the values of
            // the module colors, none if the module has no colors
            dataBuffer.writeArray(
                moduleColors.length > 0 ? themes : [],
                theme => buildTheme(theme, getModuleColorValues(theme))
            );

            // colors
            dataBuffer.writeNumberArray(assets.colors, buildColor);
        });
    }
}
