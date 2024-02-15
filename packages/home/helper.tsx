import { ProjectType } from "project-editor/project/project";
import {
    DASHBOARD_PROJECT_ICON,
    EEZ_GUI_PROJECT_ICON,
    LVGL_PROJECT_ICON,
    LVGL_WITH_FLOW_PROJECT_ICON,
    MICROPYTHON_ICON,
    APPLET_ICON,
    IEXT_PROJECT_ICON
} from "project-editor/ui-components/icons";

export function getProjectIcon(
    filePath: string,
    projectType: string,
    size: number,
    hasFlowSupport: boolean
) {
    if (projectType == ProjectType.IEXT) {
        return IEXT_PROJECT_ICON(size);
    }

    if (projectType == ProjectType.LVGL) {
        return hasFlowSupport
            ? LVGL_WITH_FLOW_PROJECT_ICON(size)
            : LVGL_PROJECT_ICON(size);
    }

    const isProject = filePath.endsWith(".eez-project");
    if (!isProject || projectType == ProjectType.DASHBOARD) {
        return DASHBOARD_PROJECT_ICON(size);
    }

    if (projectType == ProjectType.RESOURCE) {
        return MICROPYTHON_ICON(size);
    }

    if (projectType == ProjectType.APPLET) {
        return APPLET_ICON(size);
    }

    return EEZ_GUI_PROJECT_ICON(size);
}
