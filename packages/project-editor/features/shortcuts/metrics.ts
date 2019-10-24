import { getProperty } from "project-editor/core/object";

import { Project } from "project-editor/project/project";

import { Shortcuts } from "project-editor/features/shortcuts/shortcuts";

////////////////////////////////////////////////////////////////////////////////

export function metrics(project: Project): { [key: string]: string | number } {
    let shortcuts = getProperty(project, "shortcuts") as Shortcuts;

    return {
        Shortcuts: shortcuts.shortcuts.length
    };
}
