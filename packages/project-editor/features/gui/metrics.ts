import { Project } from "project-editor/project/project";

export function metrics(project: Project): { [key: string]: string | number } {
    return {
        GUI: "",
        "<span class='td-indent'>Pages</span>": project.gui.pages.length,
        "<span class='td-indent'>Styles</span>": project.gui.styles.length,
        "<span class='td-indent'>Fonts</span>": project.gui.fonts.length,
        "<span class='td-indent'>Bitmaps</span>": project.gui.bitmaps.length
    };
}
