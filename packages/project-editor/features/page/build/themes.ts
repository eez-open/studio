import { strToColor16 } from "eez-studio-shared/color";
import * as projectBuild from "project-editor/project/build";
import { Theme } from "project-editor/features/style/theme";
import {
    buildListData,
    Color,
    DataBuffer,
    ObjectList,
    Struct,
    String
} from "project-editor/features/page/build/pack";
import { Assets } from "project-editor/features/page/build/assets";

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
    function buildTheme(theme: Theme) {
        let result = new Struct();

        result.addField(new String(theme.name));

        // widgets
        let colors = new ObjectList();
        theme.colors.forEach(color => {
            colors.addItem(buildColor(color));
        });

        result.addField(colors);

        return result;
    }

    function buildColor(color: string) {
        return new Color(strToColor16(color));
    }

    return buildListData((document: Struct) => {
        let themes = new ObjectList();

        if (!assets.DocumentStore.masterProject) {
            assets.rootProject.themes.forEach(theme => {
                themes.addItem(buildTheme(theme));
            });
        }

        document.addField(themes);

        let colors = new ObjectList();

        if (!assets.DocumentStore.masterProject) {
            assets.colors.forEach(color => {
                colors.addItem(buildColor(color));
            });
        }

        document.addField(colors);
    }, dataBuffer);
}
