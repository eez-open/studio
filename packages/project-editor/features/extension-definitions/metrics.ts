import type { Project } from "project-editor/project/project";

export function metrics(project: Project): { [key: string]: string | number } {
    let extensionDefinitions = project.extensionDefinitions;
    return {
        "IEXT definitions": extensionDefinitions.length
    };
}
