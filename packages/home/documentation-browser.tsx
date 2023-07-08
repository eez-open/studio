import React from "react";
import { action, computed, makeObservable, observable } from "mobx";
import { observer } from "mobx-react";
import * as FlexLayout from "flexlayout-react";

import { showDialog } from "eez-studio-ui/dialog";
import { ITreeNode, Tree } from "eez-studio-ui/tree";

import { homeLayoutModels } from "home/home-layout-models";

import {
    ClassInfo,
    IObjectClassInfo,
    ProjectType,
    isProperSubclassOf
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
    groupByProjectType = false;
    searchText = "";
    selectedProjectType: ProjectType = ProjectType.DASHBOARD;

    constructor() {
        makeObservable(this, {
            selectedNode: observable,
            groupByProjectType: observable,
            searchText: observable,
            selectedProjectType: observable,
            allComponents: computed,
            rootNode: computed,
            selectNode: action
        });
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
            const { label, icon } = getComponentVisualData(componentClass);

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
                componentInfo.componentClasses.dashboard = componentClass;

                if (
                    componentClass.objectClass.classInfo.flowComponentId !=
                    undefined
                ) {
                    componentInfo.componentClasses.eezgui = componentClass;
                    componentInfo.componentClasses.lvgl = componentClass;
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
        const getComponentTreeChild = (
            componentInfo: ComponentInfo
        ): ITreeNode<ComponentTreeNodeData> => {
            return {
                id: componentInfo.id,
                label: (
                    <span className="EezStudio_DocumentationBrowser_ComponentTreeNode">
                        {typeof componentInfo.icon === "string" ? (
                            <img src={componentInfo.icon} />
                        ) : (
                            componentInfo.icon
                        )}
                        <span title={componentInfo.name}>
                            {componentInfo.name}
                        </span>
                    </span>
                ),
                children: [],
                selected: this.selectedNode?.id === componentInfo.id,
                expanded: false,
                data: {
                    id: componentInfo.id,
                    kind: "component",
                    componentInfo
                }
            };
        };

        const getComponentGroupTreeChild = (
            id: string,
            groupName: string,
            groupComponents: ComponentInfo[]
        ): ITreeNode<GroupTreeNodeData> => {
            let children = groupComponents
                .map(componentInfo => getComponentTreeChild(componentInfo))
                .sort((a, b) => {
                    return a.data!.componentInfo.name.localeCompare(
                        b.data!.componentInfo.name
                    );
                });

            let label = getComponentGroupDisplayName(groupName);

            return {
                id: id + "_" + groupName,
                label: (
                    <span className="EezStudio_DocumentationBrowser_ComponentTreeNode">
                        {FOLDER_ICON}
                        <span title={label}>{label}</span>
                    </span>
                ),
                children,
                selected: this.selectedNode?.id === id + "_" + groupName,
                expanded: true,
                data: {
                    id: id + "_" + groupName,
                    kind: "group",
                    groupName,
                    groupComponents
                }
            };
        };

        const getComponentSectionTreeChild = (
            id: string,
            label: string,
            components: ComponentInfo[],
            type: "widget" | "action"
        ): ITreeNode<SectionTreeNodeData> => {
            const componentPaletteGroupNames = getGroupsByComponentInfo(
                components.filter(componentInfo => componentInfo.type === type)
            );

            const groupEntries = [
                ...componentPaletteGroupNames.entries()
            ].sort();

            return {
                id,
                label: (
                    <span className="EezStudio_DocumentationBrowser_ComponentTreeNode">
                        {FOLDER_ICON}
                        <span title={label}>{label}</span>
                    </span>
                ),
                children: groupEntries.map(groupEntry =>
                    getComponentGroupTreeChild(id, groupEntry[0], groupEntry[1])
                ),
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

            return {
                id,
                label: (
                    <span className="EezStudio_DocumentationBrowser_ComponentTreeNode">
                        {icon}
                        <span title={label}>{label}</span>
                    </span>
                ),
                children: [
                    getComponentSectionTreeChild(
                        projectType + "__widgetComponents",
                        "WIDGETS",
                        components,
                        "widget"
                    ),
                    getComponentSectionTreeChild(
                        projectType + "__actionComponents",
                        "ACTIONS",
                        components,
                        "action"
                    )
                ],
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
                        "__widgetComponents",
                        "WIDGETS",
                        this.allComponents,
                        "widget"
                    ),
                    getComponentSectionTreeChild(
                        "__actionComponents",
                        "ACTIONS",
                        this.allComponents,
                        "action"
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
                                onChange={action(
                                    event =>
                                        (model.groupByProjectType =
                                            event.target.checked)
                                )}
                            />
                            <label
                                className="form-check-label"
                                htmlFor="EezStudio_DocumentationBrowser_Toolbar_GroupByProjectType"
                            >
                                Group by project type
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

            const isDashboardComponent =
                componentInfo.componentClasses.dashboard != undefined;

            const isEezGuiComponent =
                componentInfo.componentClasses.eezgui != undefined;

            const isLVGLComponent =
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

            let classInfo: ClassInfo;
            if (selectedProjectType === ProjectType.DASHBOARD) {
                classInfo =
                    componentInfo.componentClasses.dashboard!.objectClass
                        .classInfo;
            } else if (selectedProjectType === ProjectType.FIRMWARE) {
                classInfo =
                    componentInfo.componentClasses.eezgui!.objectClass
                        .classInfo;
            } else {
                classInfo =
                    componentInfo.componentClasses.lvgl!.objectClass.classInfo;
            }

            return (
                <div className="EezStudio_DocumentationBrowser_Content_Help">
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
                    <ComponentHelp
                        componentInfo={componentInfo}
                        classInfo={classInfo}
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
        classInfo: ClassInfo;
    }> {
        render() {
            const { componentInfo, classInfo } = this.props;

            return (
                <div className="EezStudio_Component_Documentation">
                    <h3>
                        <div>{componentInfo.icon}</div>
                        <div>{componentInfo.name}</div>
                    </h3>

                    <h4>Description</h4>
                    <h4>Parameters</h4>
                    <ul>
                        {classInfo.properties
                            .filter(
                                property => property.expressionType != undefined
                            )
                            .map(property => (
                                <li key={property.name}>{property.name}</li>
                            ))}
                    </ul>
                    <h4>Inputs</h4>
                    <h4>Outputs</h4>
                    <h4>Examples</h4>
                </div>
            );
        }
    }
);
