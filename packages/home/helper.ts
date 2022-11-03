import { ProjectType } from "project-editor/project/project";

export function getProjectIcon(filePath: string, projectType: string) {
    const isProject = filePath.endsWith(".eez-project");

    if (isProject) {
        if (projectType == ProjectType.LVGL) {
            return "../eez-studio-ui/_images/eez-project-lvgl.png";
        }

        if (projectType == ProjectType.DASHBOARD) {
            return "../eez-studio-ui/_images/eez-project-dashboard.png";
        }

        return "../eez-studio-ui/_images/eez-project-devboard.png";
    }

    return "../eez-studio-ui/_images/eez-dashboard.png";
}
