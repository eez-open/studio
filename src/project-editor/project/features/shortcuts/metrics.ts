import { ProjectProperties } from "project-editor/project/project";

import { ShortcutsProperties } from "project-editor/project/features/shortcuts/shortcuts";

////////////////////////////////////////////////////////////////////////////////

export function metrics(project: ProjectProperties): { [key: string]: string | number } {
    let shortcuts = project["shortcuts"] as ShortcutsProperties;

    return {
        Shortcuts: shortcuts.shortcuts.length
    };
}
