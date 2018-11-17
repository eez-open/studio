import { ProjectProperties } from "project-editor/project/project";

////////////////////////////////////////////////////////////////////////////////

export function metrics(project: ProjectProperties): { [key: string]: string | number } {
    return {
        Actions: project.actions._array.length
    };
}
