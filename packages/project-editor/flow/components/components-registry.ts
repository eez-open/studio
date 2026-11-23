import {
    EezClass,
    IObjectClassInfo,
    getClassesDerivedFrom,
    isProperSubclassOf
} from "project-editor/core/object";
import React from "react";
import { ProjectEditor } from "project-editor/project-editor-interface";
import { mostReadable } from "eez-studio-shared/color";
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
                ProjectEditor.UserWidgetDashboardWidgetClass ||
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
        let widgetName: string;
        let widgetClass: EezClass;
        if (projectStore.projectTypeTraits.isLVGL) {
            widgetName = "LVGLUserWidgetWidget";
            widgetClass = ProjectEditor.LVGLUserWidgetWidgetClass;
        } else if (projectStore.projectTypeTraits.isDashboard) {
            widgetName = "UserWidgetDashboardWidget";
            widgetClass = ProjectEditor.UserWidgetDashboardWidgetClass;
        } else {
            widgetName = "UserWidgetWidget";
            widgetClass = ProjectEditor.UserWidgetWidgetClass;
        }

        for (const pageAsset of projectStore.project._assets.pages) {
            if (pageAsset.page.isUsedAsUserWidget) {
                userWidgets.push({
                    id: `${widgetName}<${pageAsset.name}>`,
                    name: widgetName,
                    objectClass: widgetClass,
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

    // The widget presets of an EEZ-GUI project (see WidgetPreset): a preset
    // with the name of a widget gives the widget its property values, the
    // others are entries of their own.
    const presetWidgets: IObjectClassInfo[] = [];
    if (
        baseClass == ProjectEditor.WidgetClass &&
        projectStore.projectTypeTraits.isFirmware &&
        !projectStore.projectTypeTraits.isEezGuiLite
    ) {
        const presets = ProjectEditor.getWidgetPresets(projectStore.project);

        stockComponents = stockComponents.map(objectClassInfo => {
            const preset = presets.find(
                preset =>
                    preset.widgetType == objectClassInfo.name &&
                    preset.name == getComponentName(objectClassInfo.name)
            );
            return preset
                ? {
                      ...objectClassInfo,
                      props: { ...objectClassInfo.props, ...preset.values }
                  }
                : objectClassInfo;
        });

        for (const preset of presets) {
            if (preset.name == getComponentName(preset.widgetType)) {
                continue;
            }
            const objectClassInfo = stockComponents.find(
                objectClassInfo => objectClassInfo.name == preset.widgetType
            );
            if (!objectClassInfo) {
                continue;
            }
            presetWidgets.push({
                id: `WidgetPreset<${preset.name}>`,
                name: objectClassInfo.name,
                objectClass: objectClassInfo.objectClass,
                displayName: preset.name,
                // (the first group of the palette)
                componentPaletteGroupName: "!0Presets",
                props: { ...preset.values, preset: preset.name },
                svgIcon: preset.icon || undefined
            });
        }
    }

    return [
        ...stockComponents,
        ...presetWidgets,
        ...userWidgets,
        ...userActions
    ];
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
//  !0 -> "Presets" (the widget presets of an EEZ-GUI project)
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
    } else if (name.endsWith("LiteWidget")) {
        name = name.substring(0, name.length - "LiteWidget".length);
    } else if (name.endsWith("Widget")) {
        name = name.substring(0, name.length - "Widget".length);
    } else if (name.endsWith("ActionComponent")) {
        name = name.substring(0, name.length - "ActionComponent".length);
    }

    return name;
}

// An icon given as the text of an SVG image (the icon of a widget preset), as
// an element like the icons of the classes; undefined if the text is not an
// SVG image. Scripts, event handlers and foreign content are removed: the text
// comes from a project file.
const svgIcons = new Map<string, React.ReactElement | null>();

const SVG_ROOT_ATTRIBUTES: { [name: string]: string } = {
    viewBox: "viewBox",
    fill: "fill",
    stroke: "stroke",
    "stroke-width": "strokeWidth",
    "stroke-linecap": "strokeLinecap",
    "stroke-linejoin": "strokeLinejoin",
    "fill-rule": "fillRule",
    "clip-rule": "clipRule"
};

export function getSvgIcon(svg: string): React.ReactElement | undefined {
    let icon = svgIcons.get(svg);
    if (icon === undefined) {
        icon = null;
        try {
            const root = new DOMParser().parseFromString(
                svg.trim(),
                "image/svg+xml"
            ).documentElement;
            if (
                root &&
                root.nodeName.toLowerCase() == "svg" &&
                !root.querySelector("parsererror")
            ) {
                for (const element of [
                    ...root.querySelectorAll(
                        "script, foreignObject, iframe, object, embed"
                    )
                ]) {
                    element.remove();
                }
                for (const element of [...root.querySelectorAll("*")]) {
                    for (const attribute of [...element.attributes]) {
                        if (
                            /^on/i.test(attribute.name) ||
                            /^\s*javascript:/i.test(attribute.value)
                        ) {
                            element.removeAttribute(attribute.name);
                        }
                    }
                }

                const props: any = {};
                for (const name of Object.keys(SVG_ROOT_ATTRIBUTES)) {
                    const value = root.getAttribute(name);
                    if (value != null) {
                        props[SVG_ROOT_ATTRIBUTES[name]] = value;
                    }
                }
                if (!props.viewBox) {
                    const width = parseFloat(root.getAttribute("width") ?? "");
                    const height = parseFloat(
                        root.getAttribute("height") ?? ""
                    );
                    if (width > 0 && height > 0) {
                        props.viewBox = `0 0 ${width} ${height}`;
                    }
                }
                props.dangerouslySetInnerHTML = { __html: root.innerHTML };
                icon = React.createElement("svg", props);
            }
        } catch (err) {}
        svgIcons.set(svg, icon);
    }
    return icon ?? undefined;
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

    if (componentClass.svgIcon) {
        const svgIcon = getSvgIcon(componentClass.svgIcon);
        if (svgIcon) {
            icon = svgIcon;
        }
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
            color: mostReadable(backgroundColor, ["#fff", "#333"])
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
