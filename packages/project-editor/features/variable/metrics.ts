import type { Project } from "project-editor/project/project";

////////////////////////////////////////////////////////////////////////////////

export function metrics(project: Project): { [key: string]: string | number } {
    return {
        "Global variables": project.variables.globalVariables.length,
        Structures: project.variables.structures.length
    };
}
