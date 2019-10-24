import { getProperty } from "project-editor/core/object";
import { Project } from "project-editor/project/project";

import { Gui } from "project-editor/features/gui/gui";

////////////////////////////////////////////////////////////////////////////////

export function metrics(project: Project): { [key: string]: string | number } {
    let gui = getProperty(project, "gui") as Gui;

    return {
        GUI: "",
        "<span class='td-indent'>Pages</span>": gui.pages.length,
        "<span class='td-indent'>Styles</span>": gui.styles.length,
        "<span class='td-indent'>Fonts</span>": gui.fonts.length,
        "<span class='td-indent'>Bitmaps</span>": gui.bitmaps.length
    };
}
