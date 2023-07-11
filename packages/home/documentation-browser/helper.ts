import { ProjectType } from "project-editor/project/project";

import { ComponentInfo } from "./component-info";

export function getGroupsByComponentInfo(components: ComponentInfo[]) {
    const groups = new Map<string, ComponentInfo[]>();

    components.forEach(componentInfo => {
        const groupName = componentInfo.group;

        let componentClasses = groups.get(groupName);
        if (!componentClasses) {
            componentClasses = [];
            groups.set(groupName, componentClasses);
        }
        componentClasses.push(componentInfo);
    });

    return groups;
}

export function projectTypeToString(
    projectType: ProjectType
): "dashboard" | "eezgui" | "lvgl" {
    return projectType == ProjectType.DASHBOARD
        ? "dashboard"
        : projectType == ProjectType.FIRMWARE
        ? "eezgui"
        : "lvgl";
}
