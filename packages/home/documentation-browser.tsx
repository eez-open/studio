import React, { Fragment } from "react";
import {
    action,
    computed,
    makeObservable,
    observable,
    reaction,
    runInAction
} from "mobx";
import { observer } from "mobx-react";
import * as FlexLayout from "flexlayout-react";
import fs from "fs";
import { resolve } from "path";

import { showDialog } from "eez-studio-ui/dialog";
import { ITreeNode, Tree } from "eez-studio-ui/tree";

import { homeLayoutModels } from "home/home-layout-models";

import {
    IObjectClassInfo,
    ProjectType,
    PropertyInfo,
    getObjectPropertyDisplayName,
    isProperSubclassOf,
    setParent
} from "project-editor/core/object";

import { ProjectEditor } from "project-editor/project-editor-interface";

import {
    getAllComponentClasses,
    getComponentGroupDisplayName,
    getComponentGroupName,
    getComponentVisualData
} from "project-editor/flow/components/components-registry";
import { SearchInput } from "eez-studio-ui/search-input";
import {
    DASHBOARD_PROJECT_ICON,
    EEZ_GUI_PROJECT_ICON,
    FOLDER_ICON,
    LVGL_PROJECT_ICON
} from "project-editor/ui-components/icons";
import classNames from "classnames";
import {
    ProjectStore,
    createObject,
    getCommonProperties,
    loadProject
} from "project-editor/store";
import { isDev } from "eez-studio-shared/util-electron";
import { sourceRootDir } from "eez-studio-shared/util";
import type { Component } from "project-editor/flow/component";
import {
    getInputDisplayName,
    getOutputDisplayName
} from "project-editor/flow/helper";
import { getPropertyGroups } from "project-editor/ui-components/PropertyGrid/groups";
import { guid } from "eez-studio-shared/guid";

////////////////////////////////////////////////////////////////////////////////

export function showDocumentationBrowser() {
    if (!model.documentationBrowserClosed) {
        return;
    }

    const [modalDialog] = showDialog(<DocumentationBrowser />, {
        jsPanel: {
            title: "Components Documentation Browser",
            width: window.innerWidth - 100,
            height: window.innerHeight - 100
        }
    });

    model.documentationBrowserClosed = false;

    function onClosed(event: any) {
        if (event.panel === modalDialog) {
            model.documentationBrowserClosed = true;
            document.removeEventListener("jspanelclosed", onClosed, false);
        }
    }

    document.addEventListener("jspanelbeforeclose", onClosed, false);
}

////////////////////////////////////////////////////////////////////////////////

export class ComponentInfo {
    id: string;
    type: "widget" | "action";
    group: string;
    name: string;
    icon: any;
    titleStyle: React.CSSProperties | undefined;
    componentClasses: {
        eezgui?: IObjectClassInfo;
        lvgl?: IObjectClassInfo;
        dashboard?: IObjectClassInfo;
    };
}

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

////////////////////////////////////////////////////////////////////////////////

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
            selectedProjectType: observable,
            allComponents: computed,
            rootNode: computed,
            selectNode: action
        });

        this.createProjectStores();

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
    }

    async createProjectStores() {
        this.dashboardProjectStore = await this.createProjectStore("dashboard");
        this.eezguiProjectStore = await this.createProjectStore("firmware");
        this.lvglProjectStore = await this.createProjectStore("LVGL");
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

    get allComponents(): ComponentInfo[] {
        const components: ComponentInfo[] = [];
        const componentsMap = new Map<string, ComponentInfo>();

        [
            ...getAllComponentClasses(undefined, ProjectEditor.WidgetClass),
            ...getAllComponentClasses(
                undefined,
                ProjectEditor.ActionComponentClass
            )
        ].forEach(componentClass => {
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
                componentInfo.componentClasses = {};
            }

            const enabledInComponentPalette =
                componentClass.objectClass.classInfo.enabledInComponentPalette;

            if (enabledInComponentPalette) {
                if (enabledInComponentPalette(ProjectType.DASHBOARD)) {
                    componentInfo.componentClasses.dashboard = componentClass;
                }

                if (
                    enabledInComponentPalette(ProjectType.FIRMWARE) ||
                    enabledInComponentPalette(ProjectType.FIRMWARE_MODULE) ||
                    enabledInComponentPalette(ProjectType.RESOURCE) ||
                    enabledInComponentPalette(ProjectType.APPLET)
                ) {
                    componentInfo.componentClasses.eezgui = componentClass;
                }

                if (enabledInComponentPalette(ProjectType.LVGL)) {
                    componentInfo.componentClasses.lvgl = componentClass;
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
                    componentInfo.componentClasses.dashboard = componentClass;
                }

                if (
                    componentClass.objectClass.classInfo.flowComponentId !=
                    undefined
                ) {
                    componentInfo.componentClasses.eezgui = componentClass;

                    if (
                        componentInfo.type != "widget" ||
                        isProperSubclassOf(
                            componentClass.objectClass.classInfo,
                            ProjectEditor.LVGLWidgetClass.classInfo
                        )
                    ) {
                        componentInfo.componentClasses.lvgl = componentClass;
                    }
                }
            }
        });

        return components.filter(componentInfo =>
            componentInfo.name
                .toLowerCase()
                .includes(this.searchText.toLowerCase())
        );
    }

    get dashboardComponents(): ComponentInfo[] {
        return this.allComponents.filter(
            component => component.componentClasses.dashboard != undefined
        );
    }

    get eezguiComponents(): ComponentInfo[] {
        return this.allComponents.filter(
            component => component.componentClasses.eezgui != undefined
        );
    }

    get lvglComponents(): ComponentInfo[] {
        return this.allComponents.filter(
            component => component.componentClasses.lvgl != undefined
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

const model = new Model();

////////////////////////////////////////////////////////////////////////////////

export const DocumentationBrowser = observer(
    class DocumentationBrowser extends React.Component {
        constructor(props: any) {
            super(props);
        }

        componentDidMount() {}

        componentWillUnmount() {}

        factory = (node: FlexLayout.TabNode) => {
            var component = node.getComponent();

            if (component === "TOC") {
                return <TOC />;
            }

            if (component === "Content") {
                return <Content />;
            }

            return null;
        };

        render() {
            return (
                <div className="EezStudio_DocumentationBrowser">
                    <div className="EezStudio_DocumentationBrowser_Toolbar">
                        <div className="form-check">
                            <input
                                className="form-check-input"
                                id="EezStudio_DocumentationBrowser_Toolbar_GroupByProjectType"
                                type="checkbox"
                                checked={model.groupByProjectType}
                                onChange={action(event => {
                                    model.groupByProjectType =
                                        event.target.checked;
                                    model.selectedNode = undefined;
                                })}
                            />
                            <label
                                className="form-check-label"
                                htmlFor="EezStudio_DocumentationBrowser_Toolbar_GroupByProjectType"
                            >
                                Group by project type
                            </label>
                        </div>
                        <div className="form-check">
                            <input
                                className="form-check-input"
                                id="EezStudio_DocumentationBrowser_Toolbar_ShowGroups"
                                type="checkbox"
                                checked={model.showGroups}
                                onChange={action(event => {
                                    model.showGroups = event.target.checked;
                                    model.selectedNode = undefined;
                                })}
                            />
                            <label
                                className="form-check-label"
                                htmlFor="EezStudio_DocumentationBrowser_Toolbar_ShowGroups"
                            >
                                Group by component groups
                            </label>
                        </div>
                    </div>
                    <div className="EezStudio_DocumentationBrowser_Content">
                        <FlexLayout.Layout
                            model={homeLayoutModels.documentationBrowser}
                            factory={this.factory}
                            realtimeResize={true}
                            font={{
                                size: "small"
                            }}
                        />
                    </div>
                </div>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

const TOC = observer(
    class TOC extends React.Component {
        render() {
            return (
                <div className="EezStudio_DocumentationBrowser_Content_TreeContainer">
                    <SearchInput
                        searchText={model.searchText}
                        onClear={action(() => {
                            model.searchText = "";
                        })}
                        onChange={action(
                            event =>
                                (model.searchText = $(
                                    event.target
                                ).val() as string)
                        )}
                    />
                    <Tree
                        rootNode={model.rootNode}
                        selectNode={node => {
                            model.selectNode(node);
                        }}
                        showOnlyChildren={true}
                        style={{ height: "100%", overflow: "auto" }}
                    />
                </div>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

const Content = observer(
    class Content extends React.Component {
        render() {
            if (
                !model.selectedNode ||
                model.selectedNode.kind !== "component"
            ) {
                return null;
            }

            const componentInfo = model.selectedNode.componentInfo;
            const projectType = model.selectedNode.projectType;

            const isDashboardComponent =
                (projectType == ProjectType.DASHBOARD ||
                    projectType == ProjectType.UNDEFINED) &&
                componentInfo.componentClasses.dashboard != undefined;

            const isEezGuiComponent =
                (projectType == ProjectType.FIRMWARE ||
                    projectType == ProjectType.UNDEFINED) &&
                componentInfo.componentClasses.eezgui != undefined;

            const isLVGLComponent =
                (projectType == ProjectType.LVGL ||
                    projectType == ProjectType.UNDEFINED) &&
                componentInfo.componentClasses.lvgl != undefined;

            let selectedProjectType = model.selectedProjectType;

            if (selectedProjectType === ProjectType.DASHBOARD) {
                if (!isDashboardComponent) {
                    if (isEezGuiComponent) {
                        selectedProjectType = ProjectType.FIRMWARE;
                    } else {
                        selectedProjectType = ProjectType.LVGL;
                    }
                }
            } else if (selectedProjectType === ProjectType.FIRMWARE) {
                if (!isEezGuiComponent) {
                    if (isDashboardComponent) {
                        selectedProjectType = ProjectType.DASHBOARD;
                    } else {
                        selectedProjectType = ProjectType.LVGL;
                    }
                }
            } else if (selectedProjectType === ProjectType.LVGL) {
                if (!isLVGLComponent) {
                    if (isDashboardComponent) {
                        selectedProjectType = ProjectType.DASHBOARD;
                    } else {
                        selectedProjectType = ProjectType.FIRMWARE;
                    }
                }
            }

            let projectStore: ProjectStore;
            let componentClass: IObjectClassInfo;
            if (selectedProjectType === ProjectType.DASHBOARD) {
                componentClass = componentInfo.componentClasses.dashboard!;
                projectStore = model.dashboardProjectStore;
            } else if (selectedProjectType === ProjectType.FIRMWARE) {
                componentClass = componentInfo.componentClasses.eezgui!;
                projectStore = model.eezguiProjectStore;
            } else {
                componentClass = componentInfo.componentClasses.lvgl!;
                projectStore = model.lvglProjectStore;
            }

            return (
                <div className="EezStudio_DocumentationBrowser_Content_Help">
                    {projectType == ProjectType.UNDEFINED && (
                        <ul className="nav nav-tabs">
                            {isDashboardComponent && (
                                <li className="nav-item">
                                    <a
                                        className={classNames("nav-link", {
                                            active:
                                                selectedProjectType ==
                                                ProjectType.DASHBOARD
                                        })}
                                        href="#"
                                        onClick={action(
                                            () =>
                                                (model.selectedProjectType =
                                                    ProjectType.DASHBOARD)
                                        )}
                                    >
                                        {DASHBOARD_PROJECT_ICON(24)} Dashboard
                                    </a>
                                </li>
                            )}
                            {isEezGuiComponent && (
                                <li className="nav-item">
                                    <a
                                        className={classNames("nav-link", {
                                            active:
                                                selectedProjectType ==
                                                ProjectType.FIRMWARE
                                        })}
                                        href="#"
                                        onClick={action(
                                            () =>
                                                (model.selectedProjectType =
                                                    ProjectType.FIRMWARE)
                                        )}
                                    >
                                        {EEZ_GUI_PROJECT_ICON(24)} EEZ-GUI
                                    </a>
                                </li>
                            )}
                            {isLVGLComponent && (
                                <li className="nav-item">
                                    <a
                                        className={classNames("nav-link", {
                                            active:
                                                selectedProjectType ==
                                                ProjectType.LVGL
                                        })}
                                        href="#"
                                        onClick={action(
                                            () =>
                                                (model.selectedProjectType =
                                                    ProjectType.LVGL)
                                        )}
                                    >
                                        {LVGL_PROJECT_ICON(24)} LVGL
                                    </a>
                                </li>
                            )}
                        </ul>
                    )}
                    <ComponentHelp
                        componentInfo={componentInfo}
                        componentClass={componentClass}
                        projectStore={projectStore}
                    />
                </div>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

const ComponentHelp = observer(
    class ComponentHelp extends React.Component<{
        componentInfo: ComponentInfo;
        componentClass: IObjectClassInfo;
        projectStore: ProjectStore;
    }> {
        _componentObject: Component | undefined;

        constructor(props: any) {
            super(props);

            makeObservable(this, {
                _componentObject: observable
            });
        }

        createComponentObject() {
            this.removeComponentObject();

            const componentObject = createObject<Component>(
                this.props.projectStore,
                Object.assign(
                    {},
                    this.props.componentClass.objectClass.classInfo
                        .defaultValue,
                    {
                        type: this.props.componentClass.name
                    }
                ),
                this.props.componentClass.objectClass,
                undefined,
                true
            );

            setParent(
                componentObject,
                this.props.projectStore.project.userPages[0].components
            );
            this.props.projectStore.project.userPages[0].components.push(
                componentObject
            );

            runInAction(() => {
                this._componentObject = componentObject;
            });
        }

        removeComponentObject() {
            if (this._componentObject) {
                this.props.projectStore.project.userPages[0].components.splice(
                    0,
                    1
                );

                runInAction(() => {
                    this._componentObject = undefined;
                });
            }
        }

        componentDidMount() {
            this.createComponentObject();
        }

        componentDidUpdate() {
            if (
                this._componentObject != undefined &&
                this._componentObject.type != this.props.componentClass.name
            ) {
                this.createComponentObject();
            }
        }

        componentWillUnmount() {
            this.removeComponentObject();
        }

        get componentObject() {
            return this._componentObject;
        }

        render() {
            const { componentInfo } = this.props;

            if (!this.componentObject) {
                return null;
            }

            return (
                <div className="EezStudio_Component_Documentation">
                    <div className="EezStudio_Component_Documentation_TitleEnclosure">
                        <div
                            className="EezStudio_Component_Documentation_Title"
                            style={componentInfo.titleStyle}
                        >
                            <div>{componentInfo.icon}</div>
                            <div>{componentInfo.name}</div>
                        </div>
                    </div>

                    <div className="EezStudio_Component_Documentation_Body">
                        <BodySection title="Description">
                            Lorem ipsum dolor sit amet, consectetur adipiscing
                            elit. Duis ut ligula mollis, pretium nulla sed,
                            viverra est. Donec porttitor, tortor ut imperdiet
                            interdum, leo elit tristique orci, eu laoreet magna
                            odio in dolor. Nulla posuere mauris sit amet nulla
                            pulvinar, ut scelerisque nunc rutrum. In varius
                            faucibus efficitur. Mauris venenatis ac dui sit amet
                            ornare. Suspendisse nec luctus ipsum. Nullam augue
                            mauris, laoreet et turpis vel, maximus ultricies
                            eros. Aenean ac dui in urna lobortis feugiat. Mauris
                            aliquam mattis tempor. Vivamus faucibus, felis sed
                            mattis interdum, velit nisl dignissim lectus, nec
                            blandit est erat eu nulla.
                        </BodySection>

                        <ComponentProperties
                            componentObject={this.componentObject}
                        />
                        <ComponentInputs
                            componentObject={this.componentObject}
                        />
                        <ComponentOutputs
                            componentObject={this.componentObject}
                        />

                        <BodySection title="Examples"></BodySection>
                    </div>
                </div>
            );
        }
    }
);

const BodySection = observer(
    class BodySection extends React.Component<
        React.PropsWithChildren<{
            title: string;
        }>
    > {
        render() {
            return (
                <div className="EezStudio_Component_Documentation_BodySection">
                    <div>{this.props.title}</div>
                    <div>{this.props.children}</div>
                </div>
            );
        }
    }
);

const ComponentProperties = observer(
    class ComponentProperties extends React.Component<{
        componentObject: Component;
    }> {
        render() {
            const { componentObject } = this.props;

            const properties = getCommonProperties([componentObject]);

            const groupPropertiesArray = getPropertyGroups(
                componentObject,
                properties
            );

            const id = guid();

            return (
                <BodySection title="Properties">
                    <div className="accordion" id={id}>
                        {groupPropertiesArray.map((groupProperties, i) => {
                            const headingId = `${id}_h_${groupProperties.group.id}`;
                            const collapseId = `${id}_c_${groupProperties.group.id}`;

                            return (
                                <div
                                    key={groupProperties.group.id}
                                    className="accordion-item"
                                >
                                    <h2
                                        className="accordion-header"
                                        id={headingId}
                                    >
                                        <button
                                            className={
                                                i == 0
                                                    ? "accordion-button"
                                                    : "accordion-button collapsed"
                                            }
                                            type="button"
                                            data-bs-toggle="collapse"
                                            data-bs-target={`#${collapseId}`}
                                            aria-expanded={
                                                i == 0 ? "true" : "false"
                                            }
                                            aria-controls={collapseId}
                                        >
                                            {groupProperties.group.title ||
                                                "Other"}
                                        </button>
                                    </h2>
                                    <div
                                        id={collapseId}
                                        className={
                                            i == 0
                                                ? "accordion-collapse collapse show"
                                                : "accordion-collapse collapse"
                                        }
                                        aria-labelledby={headingId}
                                        data-bs-parent={`#${id}`}
                                    >
                                        <div className="accordion-body">
                                            <dl>
                                                {groupProperties.properties.map(
                                                    property => (
                                                        <ComponentProperty
                                                            componentObject={
                                                                componentObject
                                                            }
                                                            property={property}
                                                            key={property.name}
                                                        />
                                                    )
                                                )}
                                            </dl>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </BodySection>
            );
        }
    }
);

const ComponentProperty = observer(
    class ComponentProperty extends React.Component<{
        componentObject: Component;
        property: PropertyInfo;
    }> {
        render() {
            const { componentObject, property } = this.props;
            return (
                <>
                    <dt>
                        {getObjectPropertyDisplayName(
                            componentObject,
                            property
                        )}
                    </dt>
                    <dd>{property.expressionType}</dd>
                </>
            );
        }
    }
);

const ComponentInputs = observer(
    class ComponentInputs extends React.Component<{
        componentObject: Component;
    }> {
        render() {
            const { componentObject } = this.props;

            return (
                <BodySection title="Inputs">
                    <dl>
                        {componentObject.getInputs().map(input => (
                            <Fragment key={input.name}>
                                <dt>
                                    {getInputDisplayName(
                                        componentObject,
                                        input.name
                                    )}
                                </dt>
                                <dd>
                                    type={input.type}, optional=
                                    {input.isOptionalInput ? "yes" : "no"},
                                    sequence=
                                    {input.isSequenceInput ? "yes" : "no"}
                                </dd>
                            </Fragment>
                        ))}
                    </dl>
                </BodySection>
            );
        }
    }
);

const ComponentOutputs = observer(
    class ComponentOutputs extends React.Component<{
        componentObject: Component;
    }> {
        render() {
            const { componentObject } = this.props;

            return (
                <BodySection title="outputs">
                    <dl>
                        {componentObject.getOutputs().map(output => (
                            <Fragment key={output.name}>
                                <dt>
                                    {getOutputDisplayName(
                                        componentObject,
                                        output.name
                                    )}
                                </dt>
                                <dd>
                                    type={output.type}, optional=
                                    {output.isOptionalOutput ? "yes" : "no"},
                                    sequence=
                                    {output.isSequenceOutput ? "yes" : "no"}
                                </dd>
                            </Fragment>
                        ))}
                    </dl>
                </BodySection>
            );
        }
    }
);
