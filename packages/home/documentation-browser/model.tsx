import React from "react";
import {
    action,
    computed,
    makeObservable,
    observable,
    reaction,
    runInAction
} from "mobx";

import {
    fetchUrlOrReadFromCache,
    isDev
} from "eez-studio-shared/util-electron";

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
    isProperSubclassOf,
    PropertyType
} from "project-editor/core/object";
import {
    DASHBOARD_PROJECT_ICON,
    EEZ_GUI_PROJECT_ICON,
    FOLDER_ICON,
    LVGL_PROJECT_ICON
} from "project-editor/ui-components/icons";

import { getGroupsByComponentInfo } from "./helper";
import {
    readMarkdown,
    readParentMarkdown,
    setupMarkdownWatcher
} from "./doc-markdown";
import { ComponentInfo, ParentComponentInfo } from "./component-info";
import { Component } from "project-editor/flow/component";
import {
    getInputDisplayName,
    getOutputDisplayName
} from "project-editor/flow/helper";
import { Icon } from "eez-studio-ui/icon";
import { LVGLScreenWidget } from "project-editor/lvgl/widgets";
import { flagsGroup, statesGroup } from "project-editor/lvgl/widgets/Base";
import {
    AppViewWidget,
    CanvasWidget,
    ListGraphWidget,
    YTGraphWidget
} from "project-editor/flow/components/widgets/eez-gui";
import {
    LVGL_FLAG_CODES,
    LVGL_STATE_CODES
} from "project-editor/lvgl/lvgl-constants";

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

    dashboardProjectStore: ProjectStore;
    eezguiProjectStore: ProjectStore;
    lvglProjectStore: ProjectStore;

    allComponentsNoSearchFilter: ComponentInfo[];

    parentInfoMap = new Map<string, ParentComponentInfo>();

    loading: boolean = true;

    actionDocCounters: {
        total: number;
        drafts: number;
        completed: number;
    };

    widgetDocCounters: {
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
            actionDocCounters: observable,
            widgetDocCounters: observable,
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
        this.dashboardProjectStore = await this.createProjectStore(
            "https://raw.githubusercontent.com/eez-open/eez-project-templates/master/templates/dashboard.eez-project"
        );
        this.eezguiProjectStore = await this.createProjectStore(
            "https://raw.githubusercontent.com/eez-open/eez-project-templates/master/templates/firmware.eez-project"
        );
        this.lvglProjectStore = await this.createProjectStore(
            "https://raw.githubusercontent.com/eez-open/eez-project-templates/master/templates/LVGL-8.3.eez-project"
        );

        await this.loadComponents();

        for (const entry of model.parentInfoMap) {
            entry[1].markdown = await readParentMarkdown(entry[0]);
        }

        this.updateDocCounters();

        this.allComponentsNoSearchFilter.forEach(componentInfo =>
            componentInfo.makeObservable()
        );

        runInAction(() => {
            this.loading = false;
        });

        setupMarkdownWatcher();
    }

    async createProjectStore(projectFileUrl: string) {
        const jsonStr = await fetchUrlOrReadFromCache(projectFileUrl, "json");

        const projectStore = ProjectStore.create({ type: "read-only" });

        const project = loadProject(projectStore, jsonStr, false);

        projectStore.setProject(project, "");

        return projectStore;
    }

    async loadComponents() {
        const doGetProperties = (
            classInfo: ClassInfo,
            componentObject: Component
        ) => {
            let properties = classInfo.properties;

            if (classInfo == ProjectEditor.LVGLWidgetClass.classInfo) {
                properties = properties.slice();

                properties.splice(
                    properties.findIndex(
                        property => property.name == "widgetFlags"
                    ),
                    1,
                    ...Object.keys(LVGL_FLAG_CODES)
                        .filter(
                            flagName =>
                                flagName != "HIDDEN" && flagName != "CLICKABLE"
                        )
                        .map(flagName => ({
                            name: flagName,
                            type: PropertyType.Boolean,
                            propertyGridGroup: flagsGroup
                        }))
                );

                properties.splice(
                    properties.findIndex(property => property.name == "states"),
                    1,
                    ...Object.keys(LVGL_STATE_CODES)
                        .filter(
                            stateName =>
                                stateName != "CHECKED" &&
                                stateName != "DISABLED"
                        )
                        .map(stateName => ({
                            name: stateName,
                            type: PropertyType.Boolean,
                            propertyGridGroup: statesGroup
                        }))
                );
            } else if (
                classInfo.parentClassInfo ==
                ProjectEditor.LVGLWidgetClass.classInfo
            ) {
                properties = properties.slice();

                properties.splice(
                    properties.findIndex(
                        property => property.name == "widgetFlags"
                    ),
                    1
                );

                properties.splice(
                    properties.findIndex(property => property.name == "states"),
                    1
                );

                properties.splice(
                    properties.findIndex(
                        property => property.name == "localStyles"
                    ),
                    1
                );
            }

            return properties
                .filter(property => property.hideInDocumentation != "all")
                .map(property => ({
                    name: getObjectPropertyDisplayName(
                        componentObject,
                        property
                    ),
                    metaInfo: property
                }));
        };

        const getClassProperties = (
            classInfo: ClassInfo,
            componentObject: Component
        ) => {
            const parentProperties = classInfo.parentClassInfo
                ? doGetProperties(classInfo.parentClassInfo, componentObject)
                : [];
            const properties = doGetProperties(classInfo, componentObject);

            return properties.filter(
                property =>
                    parentProperties.find(
                        parentProperty => parentProperty.name == property.name
                    ) == undefined
            );
        };

        const getParentInfo = (
            classInfo: ClassInfo,
            componentObject: Component
        ): ParentComponentInfo => {
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

            const parent = classInfo.parentClassInfo
                ? getParentInfo(classInfo.parentClassInfo, componentObject)
                : undefined;

            const properties = getClassProperties(classInfo, componentObject);

            let parentInfo = this.parentInfoMap.get(className);

            if (parentInfo) {
                if (parentInfo.parent != parent) {
                    throw new Error("Unexpected parent");
                }
                for (const property1 of properties) {
                    if (
                        !parentInfo.properties.find(
                            property2 => property1.name == property2.name
                        )
                    ) {
                        parentInfo.properties.push(property1);
                    }
                }
            } else {
                parentInfo = new ParentComponentInfo(properties, parent);

                this.parentInfoMap.set(className, parentInfo);
            }

            return parentInfo;
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
            if (
                componentClass.objectClass.classInfo ==
                    ProjectEditor.CallActionActionComponentClass.classInfo ||
                componentClass.objectClass.classInfo ==
                    ProjectEditor.UserWidgetWidgetClass.classInfo ||
                componentClass.objectClass.classInfo ==
                    ProjectEditor.LVGLUserWidgetWidgetClass.classInfo ||
                componentClass.objectClass.classInfo ==
                    AppViewWidget.classInfo ||
                componentClass.objectClass.classInfo ==
                    YTGraphWidget.classInfo ||
                componentClass.objectClass.classInfo ==
                    CanvasWidget.classInfo ||
                componentClass.objectClass.classInfo ==
                    ListGraphWidget.classInfo ||
                componentClass.objectClass.classInfo ==
                    LVGLScreenWidget.classInfo
            ) {
                continue;
            }

            let { label, icon, titleStyle } = getComponentVisualData(
                componentClass,
                undefined // projectStore is undefined here
            );

            const componentInfoType = isProperSubclassOf(
                componentClass.objectClass.classInfo,
                ProjectEditor.WidgetClass.classInfo
            )
                ? "widget"
                : "action";

            async function getOrCreateComponentInfo() {
                let componentInfo = componentsMap.get(componentClass.id);

                if (!componentInfo) {
                    componentInfo = new ComponentInfo();

                    componentsMap.set(label, componentInfo);
                    components.push(componentInfo);

                    componentInfo.id = "component_" + componentClass.id;
                    componentInfo.type = componentInfoType;
                    componentInfo.group = getComponentGroupName(componentClass);
                    componentInfo.name = label;
                    componentInfo.icon = icon;
                    componentInfo.titleStyle = titleStyle;

                    componentInfo.properties = [];
                    componentInfo.inputs = [];
                    componentInfo.outputs = [];

                    componentInfo.componentClass = componentClass;
                }

                return componentInfo;
            }

            const componentInfo = await getOrCreateComponentInfo();

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

            function register(componentObject: Component) {
                componentInfo.properties.push(
                    ...getClassProperties(
                        componentClass.objectClass.classInfo,
                        componentObject
                    ).filter(
                        property =>
                            componentInfo.properties.find(
                                x => x.name == property.name
                            ) == undefined
                    )
                );

                componentInfo.inputs.push(
                    ...componentObject
                        .getInputs()
                        .map(input => ({
                            name: getInputDisplayName(
                                componentObject,
                                input.name
                            ),
                            metaInfo: input
                        }))
                        .filter(
                            input =>
                                componentInfo.inputs.find(
                                    x => x.name == input.name
                                ) == undefined
                        )
                );

                componentInfo.outputs.push(
                    ...componentObject
                        .getOutputs()
                        .map(output => ({
                            name: getOutputDisplayName(
                                componentObject,
                                output.name
                            ),
                            metaInfo: output
                        }))
                        .filter(
                            output =>
                                componentInfo.outputs.find(
                                    x => x.name == output.name
                                ) == undefined
                        )
                );
            }

            if (isDashboardComponent) {
                const componentObject = ComponentInfo.createComponentObject(
                    model.dashboardProjectStore,
                    componentClass
                );

                register(componentObject);

                componentInfo.isDashboardComponent = true;

                componentInfo.parent = getParentInfo(
                    componentClass.objectClass.classInfo.parentClassInfo!,
                    componentObject
                );
            }

            if (isEEZGUIComponent) {
                const componentObject = ComponentInfo.createComponentObject(
                    model.eezguiProjectStore,
                    componentClass
                );

                register(componentObject);

                componentInfo.isEezGuiComponent = true;

                componentInfo.parent = getParentInfo(
                    componentClass.objectClass.classInfo.parentClassInfo!,
                    componentObject
                );
            }

            if (isLVGLComponent) {
                const componentObject = ComponentInfo.createComponentObject(
                    model.lvglProjectStore,
                    componentClass
                );

                register(componentObject);

                componentInfo.isLVGLComponent = true;

                componentInfo.parent = getParentInfo(
                    componentClass.objectClass.classInfo.parentClassInfo!,
                    componentObject
                );
            }
        }

        for (const componentInfo of components) {
            if (
                componentInfo.type == "widget" &&
                components.find(
                    otherComponentInfo =>
                        otherComponentInfo != componentInfo &&
                        (otherComponentInfo.name == componentInfo.name ||
                            otherComponentInfo.name.startsWith(
                                componentInfo.name + " ("
                            ))
                )
            ) {
                if (componentInfo.isDashboardComponent) {
                    componentInfo.name += " (Dashboard)";
                } else if (componentInfo.isEezGuiComponent) {
                    componentInfo.name += " (EEZ-GUI)";
                } else {
                    componentInfo.name += " (LVGL)";
                }
            }

            componentInfo.markdown = await readMarkdown(componentInfo);
        }

        this.allComponentsNoSearchFilter = components;
    }

    async reloadMarkdown() {
        for (const componentInfo of model.allComponentsNoSearchFilter) {
            const markdown = await readMarkdown(componentInfo);

            runInAction(() => {
                componentInfo.markdown = markdown;
            });
        }

        for (const entry of model.parentInfoMap) {
            const markdown = await readParentMarkdown(entry[0]);
            runInAction(() => {
                entry[1].markdown = markdown;
            });
        }

        this.updateDocCounters();
    }

    updateDocCounters() {
        const actionDocCounters = {
            total: 0,
            drafts: 0,
            completed: 0
        };

        const widgetDocCounters = {
            total: 0,
            drafts: 0,
            completed: 0
        };

        for (const componentInfo of this.allComponentsNoSearchFilter) {
            componentInfo.updateDocCounters();

            const docCounters =
                componentInfo.type == "action"
                    ? actionDocCounters
                    : widgetDocCounters;

            docCounters.total++;
            docCounters.drafts +=
                componentInfo.docCounters.drafts > 0 &&
                componentInfo.docCounters.drafts ==
                    componentInfo.docCounters.total -
                        componentInfo.docCounters.completed
                    ? 1
                    : 0;
            docCounters.completed +=
                componentInfo.docCounters.completed ==
                componentInfo.docCounters.total
                    ? 1
                    : 0;
        }

        runInAction(() => {
            this.actionDocCounters = actionDocCounters;
            this.widgetDocCounters = widgetDocCounters;
        });
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
            component => component.isDashboardComponent != undefined
        );
    }

    get eezguiComponents(): ComponentInfo[] {
        return this.allComponents.filter(
            component => component.isEezGuiComponent != undefined
        );
    }

    get lvglComponents(): ComponentInfo[] {
        return this.allComponents.filter(
            component => component.isLVGLComponent != undefined
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

            let label = this.groupByProjectType
                ? componentInfo.nameWithoutProjectType
                : componentInfo.name;

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
                            <span title={label}>{label}</span>
                        </span>
                        {isDev && (
                            <span>
                                {componentInfo.docCounters.total -
                                    componentInfo.docCounters.completed -
                                    componentInfo.docCounters.drafts >
                                    0 && (
                                    <span className="badge bg-danger">
                                        {componentInfo.docCounters.total -
                                            componentInfo.docCounters
                                                .completed -
                                            componentInfo.docCounters.drafts}
                                    </span>
                                )}
                                {componentInfo.docCounters.drafts > 0 && (
                                    <span className="badge bg-warning">
                                        {componentInfo.docCounters.drafts}
                                    </span>
                                )}
                                {componentInfo.docCounters.completed ==
                                    componentInfo.docCounters.total && (
                                    <Icon
                                        icon="material:check_circle"
                                        style={{ color: "green" }}
                                        size={20}
                                    />
                                )}
                            </span>
                        )}
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
                .sort(componentsNameCompare);

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
                    .sort(componentsNameCompare);
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

function componentsNameCompare(
    a: DocumentationTreeNode,
    b: DocumentationTreeNode
) {
    function getComponentName(x: ITreeNode) {
        return x.data!.componentInfo.name.toLowerCase();
    }

    return getComponentName(a).localeCompare(getComponentName(b));
}
