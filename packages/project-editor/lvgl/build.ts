import {
    TAB,
    NamingConvention,
    getName,
    indent
} from "project-editor/build/helper";

import type { Project } from "project-editor/project/project";

export function buildLvglDecl(project: Project) {
    let pages = project.pages.map(page => {
        return `lv_obj_t *${getName(
            "setup_screen_",
            page,
            NamingConvention.UnderscoreLowerCase
        )}();`;
    });

    return pages.join("\n");
}

export function buildLvglDef(project: Project) {
    let pages = project.pages.map(page => {
        return `lv_obj_t *${getName(
            "setup_screen_",
            page,
            NamingConvention.UnderscoreLowerCase
        )}() {\n${indent(TAB, page.lvglBuild())}\n}`;
    });

    return pages.join("\n\n");
}
