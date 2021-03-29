import { Project } from "project-editor/project/project";

export function metrics(project: Project): { [key: string]: string | number } {
    return {
        Pages: project.pages.length
    };
}
