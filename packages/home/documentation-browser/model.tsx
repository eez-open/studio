import React from "react";
import {
    action,
    computed,
    makeObservable,
    observable,
    reaction,
    runInAction
} from "mobx";
import { resolve } from "path";
import fs from "fs";

import { isDev } from "eez-studio-shared/util-electron";
import { sourceRootDir } from "eez-studio-shared/util";

import type { ITreeNode } from "eez-studio-ui/tree";

import { ProjectType } from "project-editor/project/project";
import { ProjectStore, loadProject } from "project-editor/store";
import {
    getAllComponentClasses,
    getComponentGroupDisplayName,
    getComponentGroupName,
    getComponentVisualData
} from "project-editor/flow/components/components-registry";
import { ProjectEditor } from "project-editor/project-editor-interface";
import {
    ClassInfo,
    getObjectPropertyDisplayName,
    isProperSubclassOf
} from "project-editor/core/object";
import {
    DASHBOARD_PROJECT_ICON,
    EEZ_GUI_PROJECT_ICON,
    FOLDER_ICON,
    LVGL_PROJECT_ICON
} from "project-editor/ui-components/icons";

import { getGroupsByComponentInfo } from "./helper";
import { readMarkdown, readParentMarkdown } from "./doc-markdown";
import {
    ComponentInfo,
    IProjectTypeComponentInfoParent
} from "./component-info";
import { Component } from "project-editor/flow/component";
import {
    getInputDisplayName,
    getOutputDisplayName
} from "project-editor/flow/helper";

interface ProjectTypeNodeData {
    id: string;
    kind: "project-type";
    projectType: ProjectType;
}

interface SectionTreeNodeData {
    id: string;
    kind: "section";
    type: "widget" | "action";
}

interface GroupTreeNodeData {
    id: string;
    kind: "group";
    groupName: string;
    groupComponents: ComponentInfo[];
}

interface ComponentTreeNodeData {
    id: string;
    kind: "component";
    componentInfo: ComponentInfo;
    projectType: ProjectType;
}

type TreeNodeData =
    | ProjectTypeNodeData
    | SectionTreeNodeData
    | GroupTreeNodeData
    | ComponentTreeNodeData;

type DocumentationTreeNode = ITreeNode<TreeNodeData>;

class Model {
    documentationBrowserClosed = true;
    selectedNode: TreeNodeData | undefined;
    showGroups = true;
    groupByProjectType = false;
    searchText = "";
    selectedProjectType: ProjectType = ProjectType.DASHBOARD;

    dashboardProjectStore: ProjectStore;
    eezguiProjectStore: ProjectStore;
    lvglProjectStore: ProjectStore;

    allComponentsNoSearchFilter: ComponentInfo[];

    parentInfoMap = new Map<
        string,
        Map<ProjectType, IProjectTypeComponentInfoParent>
    >();

    loading: boolean = true;

    docCounters: {
        total: number;
        drafts: number;
        completed: number;
    };

    constructor() {
        const showGroups = window.localStorage.getItem(
            "DocumentationBrowser.showGroups"
        );
        if (showGroups != undefined) {
            this.showGroups = showGroups == "true";
        } else {
            this.showGroups = true;
        }

        const groupByProjectType = window.localStorage.getItem(
            "DocumentationBrowser.groupByProjectType"
        );
        if (groupByProjectType != undefined) {
            this.groupByProjectType = groupByProjectType == "true";
        } else {
            this.groupByProjectType = false;
        }

        makeObservable(this, {
            selectedNode: observable,
            groupByProjectType: observable,
            showGroups: observable,
            searchText: observable,
            loading: observable,
            allComponents: computed,
            rootNode: computed,
            selectNode: action
        });

        reaction(
            () => this.showGroups,
            showGroups => {
                window.localStorage.setItem(
                    "DocumentationBrowser.showGroups",
                    showGroups ? "true" : "false"
                );
            }
        );

        reaction(
            () => this.groupByProjectType,
            groupByProjectType => {
                window.localStorage.setItem(
                    "DocumentationBrowser.groupByProjectType",
                    groupByProjectType ? "true" : "false"
                );
            }
        );

        this.loadModel();
    }

    async loadModel() {
        this.dashboardProjectStore = await this.createProjectStore("dashboard");
        this.eezguiProjectStore = await this.createProjectStore("firmware");
        this.lvglProjectStore = await this.createProjectStore("LVGL");

        await this.loadComponents();

        for (const entry1 of model.parentInfoMap) {
            for (const entry2 of entry1[1]) {
                entry2[1].markdown = await readParentMarkdown(
                    entry1[0],
                    entry2[0]
                );
            }
        }

        this.updateDocCounters();

        runInAction(() => {
            this.loading = false;
        });
    }

    async createProjectStore(type: string) {
        const relativePath = `project-templates/${type}.eez-project`;

        const jsonStr = await fs.promises.readFile(
            isDev
                ? resolve(`${sourceRootDir()}/../resources/${relativePath}`)
                : `${process.resourcesPath!}/${relativePath}`,
            "utf8"
        );

        const projectStore = await ProjectStore.create();

        const project = loadProject(projectStore, jsonStr);

        projectStore.setProject(project, "");

        return projectStore;
    }

    async loadComponents() {
        const getParentInfo = (
            classInfo: ClassInfo,
            componentObject: Component | undefined,
            projectType: ProjectType
        ): IProjectTypeComponentInfoParent => {
            let className;
            if (classInfo == ProjectEditor.ActionComponentClass.classInfo) {
                className = "ActionComponent";
            } else if (classInfo == ProjectEditor.WidgetClass.classInfo) {
                className = "Widget";
            } else if (classInfo == ProjectEditor.LVGLWidgetClass.classInfo) {
                className = "LVGLWidget";
            } else if (classInfo == ProjectEditor.ComponentClass.classInfo) {
                className = "Component";
            } else {
                throw new Error("Unexpected classInfo");
            }

            let parentInfo = this.parentInfoMap.get(className);
            if (parentInfo) {
                const parentInfoForProjectType = parentInfo.get(projectType);
                if (parentInfoForProjectType) {
                    return parentInfoForProjectType;
                }
            }

            const doGetProperties = (classInfo: ClassInfo): string[] => {
                return classInfo.properties.map(property =>
                    getObjectPropertyDisplayName(componentObject!, property)
                );
            };

            const parentProperties =
                classInfo.parentClassInfo && componentObject
                    ? doGetProperties(classInfo.parentClassInfo)
                    : [];
            const properties = componentObject
                ? doGetProperties(classInfo)
                : [];

            const parentInfoForProjectType = {
                properties: properties.filter(
                    property => !parentProperties.includes(property)
                ),
                parent: classInfo.parentClassInfo
                    ? getParentInfo(
                          classInfo.parentClassInfo,
                          componentObject,
                          projectType
                      )
                    : undefined
            };

            if (!parentInfo) {
                parentInfo = new Map<
                    ProjectType,
                    IProjectTypeComponentInfoParent
                >();
                this.parentInfoMap.set(className, parentInfo);
            }

            parentInfo.set(projectType, parentInfoForProjectType);

            return parentInfoForProjectType;
        };

        const components: ComponentInfo[] = [];
        const componentsMap = new Map<string, ComponentInfo>();

        for (const componentClass of [
            ...getAllComponentClasses(undefined, ProjectEditor.WidgetClass),
            ...getAllComponentClasses(
                undefined,
                ProjectEditor.ActionComponentClass
            )
        ]) {
            const { label, icon, titleStyle } =
                getComponentVisualData(componentClass);

            let componentInfo = componentsMap.get(label);

            if (!componentInfo) {
                componentInfo = new ComponentInfo();

                componentsMap.set(label, componentInfo);
                components.push(componentInfo);

                componentInfo.id = "component_" + label;
                componentInfo.type = isProperSubclassOf(
                    componentClass.objectClass.classInfo,
                    ProjectEditor.WidgetClass.classInfo
                )
                    ? "widget"
                    : "action";
                componentInfo.group = getComponentGroupName(componentClass);
                componentInfo.name = label;
                componentInfo.icon = icon;
                componentInfo.titleStyle = titleStyle;
                componentInfo.common = {
                    markdown: await readMarkdown(
                        componentInfo,
                        ProjectType.UNDEFINED
                    ),
                    parent: getParentInfo(
                        componentClass.objectClass.classInfo.parentClassInfo!,
                        undefined,
                        ProjectType.UNDEFINED
                    )
                };
            }

            const enabledInComponentPalette =
                componentClass.objectClass.classInfo.enabledInComponentPalette;

            let isDashboardComponent = false;
            let isEEZGUIComponent = false;
            let isLVGLComponent = false;

            if (enabledInComponentPalette) {
                if (enabledInComponentPalette(ProjectType.DASHBOARD)) {
                    isDashboardComponent = true;
                }

                if (
                    enabledInComponentPalette(ProjectType.FIRMWARE) ||
                    enabledInComponentPalette(ProjectType.FIRMWARE_MODULE) ||
                    enabledInComponentPalette(ProjectType.RESOURCE) ||
                    enabledInComponentPalette(ProjectType.APPLET)
                ) {
                    isEEZGUIComponent = true;
                }

                if (enabledInComponentPalette(ProjectType.LVGL)) {
                    isLVGLComponent = true;
                }
            } else {
                if (
                    componentInfo.type != "widget" ||
                    (componentClass.objectClass.classInfo.flowComponentId ==
                        undefined &&
                        !isProperSubclassOf(
                            componentClass.objectClass.classInfo,
                            ProjectEditor.LVGLWidgetClass.classInfo
                        ))
                ) {
                    isDashboardComponent = true;
                }

                if (
                    componentClass.objectClass.classInfo.flowComponentId !=
                    undefined
                ) {
                    isEEZGUIComponent = true;

                    if (
                        componentInfo.type != "widget" ||
                        isProperSubclassOf(
                            componentClass.objectClass.classInfo,
                            ProjectEditor.LVGLWidgetClass.classInfo
                        )
                    ) {
                        isLVGLComponent = true;
                    }
                }
            }

            function getClassProperties(
                classInfo: ClassInfo,
                componentObject: Component
            ): string[] {
                const doGetProperties = (classInfo: ClassInfo): string[] => {
                    return classInfo.properties.map(property =>
                        getObjectPropertyDisplayName(componentObject, property)
                    );
                };

                const parentProperties = classInfo.parentClassInfo
                    ? doGetProperties(classInfo.parentClassInfo)
                    : [];
                const properties = doGetProperties(classInfo);

                return properties.filter(
                    property => !parentProperties.includes(property)
                );
            }

            if (isDashboardComponent) {
                const componentObject = ComponentInfo.createComponentObject(
                    model.dashboardProjectStore,
                    componentClass
                );

                componentInfo.dashboard = {
                    componentClass,
                    componentObject,
                    properties: getClassProperties(
                        componentClass.objectClass.classInfo,
                        componentObject
                    ),
                    inputs: componentObject
                        .getInputs()
                        .map(input =>
                            getInputDisplayName(componentObject, input.name)
                        ),
                    outputs: componentObject
                        .getOutputs()
                        .map(output =>
                            getOutputDisplayName(componentObject, output.name)
                        ),
                    parent: getParentInfo(
                        componentClass.objectClass.classInfo.parentClassInfo!,
                        componentObject,
                        ProjectType.DASHBOARD
                    ),
                    markdown: await readMarkdown(
                        componentInfo,
                        ProjectType.DASHBOARD
                    ),
                    docCounters: {
                        total: 0,
                        drafts: 0,
                        completed: 0
                    }
                };
            }

            if (isEEZGUIComponent) {
                const componentObject = ComponentInfo.createComponentObject(
                    model.eezguiProjectStore,
                    componentClass
                );

                componentInfo.eezgui = {
                    componentClass,
                    componentObject,
                    properties: getClassProperties(
                        componentClass.objectClass.classInfo,
                        componentObject
                    ),
                    inputs: componentObject
                        .getInputs()
                        .map(input =>
                            getInputDisplayName(componentObject, input.name)
                        ),
                    outputs: componentObject
                        .getOutputs()
                        .map(output =>
                            getOutputDisplayName(componentObject, output.name)
                        ),
                    parent: getParentInfo(
                        componentClass.objectClass.classInfo.parentClassInfo!,
                        componentObject,
                        ProjectType.FIRMWARE
                    ),
                    markdown: await readMarkdown(
                        componentInfo,
                        ProjectType.FIRMWARE
                    ),
                    docCounters: {
                        total: 0,
                        drafts: 0,
                        completed: 0
                    }
                };
            }

            if (isLVGLComponent) {
                const componentObject = ComponentInfo.createComponentObject(
                    model.lvglProjectStore,
                    componentClass
                );

                componentInfo.lvgl = {
                    componentClass,
                    componentObject,
                    properties: getClassProperties(
                        componentClass.objectClass.classInfo,
                        componentObject
                    ),
                    inputs: componentObject
                        .getInputs()
                        .map(input =>
                            getInputDisplayName(componentObject, input.name)
                        ),
                    outputs: componentObject
                        .getOutputs()
                        .map(output =>
                            getOutputDisplayName(componentObject, output.name)
                        ),
                    parent: getParentInfo(
                        componentClass.objectClass.classInfo.parentClassInfo!,
                        componentObject,
                        ProjectType.LVGL
                    ),
                    markdown: await readMarkdown(
                        componentInfo,
                        ProjectType.LVGL
                    ),
                    docCounters: {
                        total: 0,
                        drafts: 0,
                        completed: 0
                    }
                };
            }
        }

        this.allComponentsNoSearchFilter = components;
    }

    updateDocCounters() {
        this.docCounters = {
            total: 0,
            drafts: 0,
            completed: 0
        };
        for (const componentInfo of this.allComponentsNoSearchFilter) {
            componentInfo.updateDocCounters();
            this.docCounters.total += componentInfo.docCounters.total;
            this.docCounters.drafts += componentInfo.docCounters.drafts;
            this.docCounters.completed += componentInfo.docCounters.completed;
        }
    }

    get allComponents(): ComponentInfo[] {
        return this.allComponentsNoSearchFilter.filter(componentInfo =>
            componentInfo.name
                .toLowerCase()
                .includes(this.searchText.toLowerCase())
        );
    }

    get dashboardComponents(): ComponentInfo[] {
        return this.allComponents.filter(
            component => component.dashboard != undefined
        );
    }

    get eezguiComponents(): ComponentInfo[] {
        return this.allComponents.filter(
            component => component.eezgui != undefined
        );
    }

    get lvglComponents(): ComponentInfo[] {
        return this.allComponents.filter(
            component => component.lvgl != undefined
        );
    }

    get rootNode(): DocumentationTreeNode {
        const getChildrenCountDeep = (children: ITreeNode[]): number => {
            let count = 0;

            children.forEach(child => {
                count += getChildrenCountDeep(child.children);
                if (child.data?.kind == "component") {
                    count++;
                }
            });

            return count;
        };

        const getComponentTreeChild = (
            idPrefix: string,
            componentInfo: ComponentInfo,
            projectType: ProjectType
        ): ITreeNode<ComponentTreeNodeData> => {
            let id = idPrefix + componentInfo.id;
            return {
                id,
                label: (
                    <span className="EezStudio_DocumentationBrowser_ComponentTreeNode">
                        <span>
                            {typeof componentInfo.icon === "string" ? (
                                <img src={componentInfo.icon} />
                            ) : (
                                componentInfo.icon
                            )}
                            <span title={componentInfo.name}>
                                {componentInfo.name}
                            </span>
                        </span>
                    </span>
                ),
                children: [],
                selected: this.selectedNode?.id === id,
                expanded: false,
                data: {
                    id: id,
                    kind: "component",
                    componentInfo,
                    projectType
                }
            };
        };

        const getComponentGroupTreeChild = (
            idPrefix: string,
            groupName: string,
            groupComponents: ComponentInfo[],
            projectType: ProjectType
        ): ITreeNode<GroupTreeNodeData> => {
            let id = idPrefix + "_" + groupName;

            let children = groupComponents
                .map(componentInfo =>
                    getComponentTreeChild(id, componentInfo, projectType)
                )
                .sort((a, b) => {
                    return a.data!.componentInfo.name.localeCompare(
                        b.data!.componentInfo.name
                    );
                });

            let label = getComponentGroupDisplayName(groupName);

            return {
                id,
                label: (
                    <span className="EezStudio_DocumentationBrowser_ComponentTreeNode">
                        <span>
                            {FOLDER_ICON}
                            <span title={label}>{label}</span>
                        </span>
                        <span className="badge bg-secondary">
                            {getChildrenCountDeep(children)}
                        </span>
                    </span>
                ),
                children,
                selected: this.selectedNode?.id === id,
                expanded: true,
                data: {
                    id: id,
                    kind: "group",
                    groupName,
                    groupComponents
                }
            };
        };

        const getComponentSectionTreeChild = (
            idPrefix: string,
            label: string,
            components: ComponentInfo[],
            type: "widget" | "action",
            projectType: ProjectType
        ): ITreeNode<SectionTreeNodeData> => {
            let id = idPrefix;

            components = components.filter(
                componentInfo => componentInfo.type === type
            );

            let children;
            if (this.showGroups) {
                const componentPaletteGroupNames =
                    getGroupsByComponentInfo(components);

                const groupEntries = [
                    ...componentPaletteGroupNames.entries()
                ].sort();

                children = groupEntries.map(groupEntry =>
                    getComponentGroupTreeChild(
                        id,
                        groupEntry[0],
                        groupEntry[1],
                        projectType
                    )
                );
            } else {
                children = components
                    .map(componentInfo =>
                        getComponentTreeChild(id, componentInfo, projectType)
                    )
                    .sort((a, b) => {
                        return a.data!.componentInfo.name.localeCompare(
                            b.data!.componentInfo.name
                        );
                    });
            }

            return {
                id,
                label: (
                    <span className="EezStudio_DocumentationBrowser_ComponentTreeNode">
                        <span>
                            {FOLDER_ICON}
                            <span title={label}>{label}</span>
                        </span>
                        <span className="badge bg-secondary">
                            {getChildrenCountDeep(children)}
                        </span>
                    </span>
                ),
                children,
                selected: this.selectedNode?.id === id,
                expanded: true,
                data: {
                    id,
                    kind: "section",
                    type
                }
            };
        };

        const getProjectTypeTreeChild = (
            id: string,
            label: string,
            projectType: ProjectType,
            icon: any
        ): ITreeNode<ProjectTypeNodeData> => {
            const components =
                projectType === ProjectType.DASHBOARD
                    ? this.dashboardComponents
                    : projectType === ProjectType.FIRMWARE
                    ? this.eezguiComponents
                    : this.lvglComponents;

            const children = [
                getComponentSectionTreeChild(
                    projectType + "__actionComponents",
                    "ACTIONS",
                    components,
                    "action",
                    projectType
                ),
                getComponentSectionTreeChild(
                    projectType + "__widgetComponents",
                    "WIDGETS",
                    components,
                    "widget",
                    projectType
                )
            ];

            return {
                id,
                label: (
                    <span className="EezStudio_DocumentationBrowser_ComponentTreeNode">
                        <span>
                            {icon}
                            <span title={label}>{label}</span>
                        </span>
                        <span className="badge bg-secondary">
                            {getChildrenCountDeep(children)}
                        </span>
                    </span>
                ),
                children,
                selected: this.selectedNode?.id === id,
                expanded: true,
                data: {
                    id,
                    kind: "project-type",
                    projectType
                }
            };
        };

        let rootNode: ITreeNode<TreeNodeData>;

        if (this.groupByProjectType) {
            rootNode = {
                id: "_root",
                label: "Root",
                children: [
                    getProjectTypeTreeChild(
                        "__dashboardComponents",
                        "Dashboard",
                        ProjectType.DASHBOARD,
                        DASHBOARD_PROJECT_ICON(32)
                    ),
                    getProjectTypeTreeChild(
                        "__eezguiComponents",
                        "EEZ-GUI",
                        ProjectType.FIRMWARE,
                        EEZ_GUI_PROJECT_ICON(32)
                    ),
                    getProjectTypeTreeChild(
                        "__lvglComponents",
                        "LVGL",
                        ProjectType.LVGL,
                        LVGL_PROJECT_ICON(32)
                    )
                ],
                selected: false,
                expanded: true,
                data: undefined
            };
        } else {
            rootNode = {
                id: "_root",
                label: "Root",
                children: [
                    getComponentSectionTreeChild(
                        "__actionComponents",
                        "ACTIONS",
                        this.allComponents,
                        "action",
                        ProjectType.UNDEFINED
                    ),
                    getComponentSectionTreeChild(
                        "__widgetComponents",
                        "WIDGETS",
                        this.allComponents,
                        "widget",
                        ProjectType.UNDEFINED
                    )
                ],
                selected: false,
                expanded: true,
                data: undefined
            };
        }

        function removeEmpty(node: ITreeNode<TreeNodeData>) {
            node.children.forEach((child: ITreeNode<TreeNodeData>) =>
                removeEmpty(child)
            );

            node.children = node.children.filter(
                (child: ITreeNode<TreeNodeData>) =>
                    child.data?.kind == "component" || child.children.length > 0
            );
        }

        removeEmpty(rootNode);

        return rootNode;
    }

    selectNode(node: DocumentationTreeNode) {
        this.selectedNode = node.data;
    }
}

let model: Model;

export function getModel() {
    if (!model) {
        model = new Model();
    }
    return model;
}
