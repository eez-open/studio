import tinycolor from "tinycolor2";

import {
    EezClass,
    IObjectClassInfo,
    getClassesDerivedFrom,
    isProperSubclassOf
} from "project-editor/core/object";
import { ProjectEditor } from "project-editor/project-editor-interface";
import type { ProjectStore } from "project-editor/store";

export function getAllComponentClasses(
    projectStore: ProjectStore | undefined,
    baseClass: EezClass
) {
    let stockComponents = getClassesDerivedFrom(projectStore, baseClass);

    if (!projectStore) {
        return stockComponents;
    }

    stockComponents = stockComponents.filter(objectClassInfo => {
        if (
            objectClassInfo.objectClass ==
                ProjectEditor.UserWidgetWidgetClass ||
            objectClassInfo.objectClass ==
                ProjectEditor.LVGLUserWidgetWidgetClass ||
            objectClassInfo.objectClass ==
                ProjectEditor.CallActionActionComponentClass
        ) {
            return false;
        }

        if (
            (projectStore.projectTypeTraits.isFirmware ||
                projectStore.projectTypeTraits.isLVGL) &&
            projectStore.projectTypeTraits.hasFlowSupport
        ) {
            return (
                objectClassInfo.objectClass.classInfo.flowComponentId !=
                    undefined ||
                (projectStore.projectTypeTraits.isLVGL &&
                    isProperSubclassOf(
                        objectClassInfo.objectClass.classInfo,
                        ProjectEditor.WidgetClass.classInfo
                    ))
            );
        }

        return true;
    });

    const userWidgets: IObjectClassInfo[] = [];
    if (baseClass == ProjectEditor.WidgetClass) {
        for (const pageAsset of projectStore.project._assets.pages) {
            if (pageAsset.page.isUsedAsUserWidget) {
                const widgetName = projectStore.projectTypeTraits.isLVGL
                    ? "LVGLUserWidgetWidget"
                    : "UserWidgetWidget";

                userWidgets.push({
                    id: `${widgetName}<${pageAsset.name}>`,
                    name: widgetName,
                    objectClass: projectStore.projectTypeTraits.isLVGL
                        ? ProjectEditor.LVGLUserWidgetWidgetClass
                        : ProjectEditor.UserWidgetWidgetClass,
                    displayName: pageAsset.name,
                    componentPaletteGroupName: "!7User Widgets",
                    props: {
                        userWidgetPageName: pageAsset.name,
                        width: pageAsset.page.width,
                        height: pageAsset.page.height
                    }
                });
            }
        }

        userWidgets.sort((a, b) =>
            a
                .displayName!.toLowerCase()
                .localeCompare(b.displayName!.toLowerCase())
        );
    }

    const userActions: IObjectClassInfo[] = [];
    if (baseClass == ProjectEditor.ActionComponentClass) {
        for (const actionAsset of projectStore.project._assets.actions) {
            userActions.push({
                id: `CallActionActionComponent<${actionAsset.name}>`,
                name: "CallActionActionComponent",
                objectClass: ProjectEditor.CallActionActionComponentClass,
                displayName: actionAsset.name,
                componentPaletteGroupName: "!8User Actions",
                props: {
                    action: actionAsset.name
                }
            });
        }
        userActions.sort((a, b) =>
            a
                .displayName!.toLowerCase()
                .localeCompare(b.displayName!.toLowerCase())
        );
    }

    return [...stockComponents, ...userWidgets, ...userActions];
}

export function getComponentGroupName(
    componentClass: IObjectClassInfo
): string {
    const parts = componentClass.name.split("/");

    let groupName: string | undefined;

    if (parts.length == 1) {
        groupName =
            componentClass.componentPaletteGroupName != undefined
                ? componentClass.componentPaletteGroupName
                : componentClass.objectClass.classInfo
                      .componentPaletteGroupName;
        if (groupName) {
            if (!groupName.startsWith("!")) {
                groupName = "!4" + groupName;
            }
        } else {
            if (componentClass.name.endsWith("Widget")) {
                groupName = "!1Basic";
            } else if (componentClass.name.endsWith("ActionComponent")) {
                groupName = "!3Basic";
            } else {
                groupName = "!5Other components";
            }
        }
    } else if (parts.length == 2) {
        groupName = "!6" + parts[0];
    } else {
        groupName = "!1Basic";
    }

    return groupName;
}

// Groups sort order:
//  !1 -> "Common Widgets" and odther LVGL widget groups
//  !2 -> "LVGL Actions"
//  !3 -> "Common Actions"
//  !4 -> Built-in groups
//  !5 -> "Other components"
//  !6 -> Extensions
//  !7 -> "User Widgets"
//  !8 -> "User Actions"

export function getGroups(
    allComponentClasses: IObjectClassInfo[],
    projectStore: ProjectStore | undefined,
    searchText: string | undefined
) {
    if (searchText) {
        searchText = searchText.toLowerCase();
    }

    const groups = new Map<string, IObjectClassInfo[]>();

    allComponentClasses.forEach(componentClass => {
        if (
            searchText &&
            (componentClass.displayName || componentClass.name)
                .toLowerCase()
                .indexOf(searchText) == -1
        ) {
            return;
        }

        if (
            projectStore &&
            componentClass.objectClass.classInfo.enabledInComponentPalette &&
            !componentClass.objectClass.classInfo.enabledInComponentPalette(
                projectStore.project.settings.general.projectType,
                projectStore
            )
        ) {
            return;
        }

        const groupName = getComponentGroupName(componentClass);

        let componentClasses = groups.get(groupName);
        if (!componentClasses) {
            componentClasses = [];
            groups.set(groupName, componentClasses);
        }
        componentClasses.push(componentClass);
    });

    return groups;
}

export function getComponentName(componentClassName: string) {
    const parts = componentClassName.split("/");
    let name;
    if (parts.length == 2) {
        name = parts[1];
    } else {
        name = componentClassName;
    }

    if (name.startsWith("LVGL") && !name.endsWith("ActionComponent")) {
        name = name.substring("LVGL".length);
    }

    if (name.endsWith("EmbeddedWidget")) {
        name = name.substring(0, name.length - "EmbeddedWidget".length);
    } else if (name.endsWith("DashboardWidget")) {
        name = name.substring(0, name.length - "DashboardWidget".length);
    } else if (name.endsWith("Widget")) {
        name = name.substring(0, name.length - "Widget".length);
    } else if (name.endsWith("ActionComponent")) {
        name = name.substring(0, name.length - "ActionComponent".length);
    }

    return name;
}

export function getComponentVisualData(
    componentClass: IObjectClassInfo,
    projectStore: ProjectStore | undefined
) {
    const classInfo = componentClass.objectClass.classInfo;

    let icon;

    if (classInfo.getIcon) {
        icon = classInfo.getIcon(undefined, componentClass, projectStore);
    }

    if (icon == undefined) {
        icon = classInfo.icon as any;
    }

    let label = componentClass.displayName
        ? componentClass.displayName
        : classInfo.componentPaletteLabel ||
          getComponentName(componentClass.name);

    let titleStyle: React.CSSProperties | undefined;
    if (classInfo.componentHeaderColor) {
        let backgroundColor;
        if (typeof classInfo.componentHeaderColor == "string") {
            backgroundColor = classInfo.componentHeaderColor;
        } else {
            backgroundColor = classInfo.componentHeaderColor(
                undefined,
                componentClass,
                projectStore
            );
        }

        titleStyle = {
            backgroundColor,
            color: tinycolor
                .mostReadable(backgroundColor, ["#fff", "0x333"])
                .toHexString()
        };
    }

    return { icon, label, titleStyle };
}

export function getComponentGroupDisplayName(groupName: string) {
    if (groupName.startsWith("!")) {
        return groupName.substring(2);
    }
    return groupName;
}
