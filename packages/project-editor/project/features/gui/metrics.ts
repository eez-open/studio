import { getProperty } from "project-editor/core/store";
import { ProjectProperties } from "project-editor/project/project";

import { GuiProperties } from "project-editor/project/features/gui/gui";

////////////////////////////////////////////////////////////////////////////////

export function metrics(project: ProjectProperties): { [key: string]: string | number } {
    let gui = getProperty(project, "gui") as GuiProperties;

    return {
        GUI: "",
        "<span class='td-indent'>Pages</span>": gui.pages._array.length,
        "<span class='td-indent'>Styles</span>": gui.styles._array.length,
        "<span class='td-indent'>Fonts</span>": gui.fonts._array.length,
        "<span class='td-indent'>Bitmaps</span>": gui.bitmaps._array.length
    };
}
