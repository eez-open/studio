import { getProperty } from "project-editor/core/store";
import { ProjectProperties } from "project-editor/project/project";

import { GuiProperties } from "project-editor/project/features/gui/gui";

////////////////////////////////////////////////////////////////////////////////

export function metrics(project: ProjectProperties): { [key: string]: string | number } {
    let gui = getProperty(project, "gui") as GuiProperties;

    return {
        GUI: "",
        "<span class='td-indent'>Pages</span>": gui.pages.length,
        "<span class='td-indent'>Widgets</span>": gui.widgets.length,
        "<span class='td-indent'>Styles</span>": gui.styles.length,
        "<span class='td-indent'>Fonts</span>": gui.fonts.length,
        "<span class='td-indent'>Bitmaps</span>": gui.bitmaps.length
    };
}
