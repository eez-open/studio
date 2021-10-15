import type { Project } from "project-editor/project/project";

export function metrics(project: Project): { [key: string]: string | number } {
    return {
        Shortcuts: project.shortcuts.shortcuts.length
    };
}
