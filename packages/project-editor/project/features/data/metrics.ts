import { ProjectProperties } from "project-editor/project/project";

////////////////////////////////////////////////////////////////////////////////

export function metrics(project: ProjectProperties): { [key: string]: string | number } {
    return {
        "Data items": project.data._array.length
    };
}
