import React from "react";
import { action, computed, makeObservable, observable } from "mobx";
import { observer } from "mobx-react";
import * as FlexLayout from "flexlayout-react";

import { showDialog } from "eez-studio-ui/dialog";
import { ITreeNode, Tree } from "eez-studio-ui/tree";

import { homeLayoutModels } from "home/home-layout-models";

import type { EezClass, IObjectClassInfo } from "project-editor/core/object";

import { ProjectEditor } from "project-editor/project-editor-interface";

import {
    getAllComponentClasses,
    getComponentGroupDisplayName,
    getComponentVisualData,
    getGroups
} from "project-editor/flow/components/components-registry";

////////////////////////////////////////////////////////////////////////////////

export function showDocumentationBrowser() {
    if (!model.documentationBrowserClosed) {
        return;
    }

    const [modalDialog] = showDialog(<DocumentationBrowser />, {
        jsPanel: {
            title: "Documentation Browser",
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

interface SectionTreenNodeData {
    kind: "section";
    baseClass: EezClass;
}

interface GroupTreeNodeData {
    kind: "group";
    groupName: string;
    groupComponents: IObjectClassInfo[];
}

interface ComponentTreeNodeData {
    kind: "component";
    label: string;
    componentClass: IObjectClassInfo;
}

type TreeNodeData =
    | SectionTreenNodeData
    | GroupTreeNodeData
    | ComponentTreeNodeData;

type DocumentationTreeNode = ITreeNode<TreeNodeData>;

class Model {
    documentationBrowserClosed = true;

    selectedNode: ComponentTreeNodeData | undefined;

    constructor() {
        makeObservable(this, {
            selectedNode: observable,
            rootNode: computed,
            content: computed,
            selectNode: action
        });
    }

    get rootNode(): DocumentationTreeNode {
        function getComponentTreeChild(
            componentClass: IObjectClassInfo
        ): ITreeNode<ComponentTreeNodeData> {
            const { label, icon } = getComponentVisualData(componentClass);

            return {
                id: componentClass.id,
                label: (
                    <span className="EezStudio_DocumentationBrowser_ComponentTreeNode">
                        {typeof icon === "string" ? <img src={icon} /> : icon}
                        <span title={label}>{label}</span>
                    </span>
                ),
                children: [],
                selected: selectedNode?.componentClass.id === componentClass.id,
                expanded: true,
                data: {
                    kind: "component",
                    label,
                    componentClass
                }
            };
        }

        function getComponentGroupTreeChild(
            id: string,
            groupName: string,
            groupComponents: IObjectClassInfo[]
        ): ITreeNode<GroupTreeNodeData> {
            let children = groupComponents
                .map(componentClass => getComponentTreeChild(componentClass))
                .sort((a, b) => {
                    return a.data!.label.localeCompare(b.data!.label);
                });

            return {
                id: id + "_" + groupName,
                label: getComponentGroupDisplayName(groupName),
                children,
                selected: false,
                expanded: true,
                data: {
                    kind: "group",
                    groupName,
                    groupComponents
                }
            };
        }

        function getComponentSectionTreeChild(
            id: string,
            label: string,
            baseClass: EezClass
        ): ITreeNode<SectionTreenNodeData> {
            const allComponentClasses = getAllComponentClasses(
                undefined,
                baseClass
            );

            const componentPaletteGroupNames = getGroups(
                allComponentClasses,
                undefined,
                undefined
            );

            const groupEntries = [
                ...componentPaletteGroupNames.entries()
            ].sort();

            return {
                id,
                label,
                children: groupEntries.map(groupEntry =>
                    getComponentGroupTreeChild(id, groupEntry[0], groupEntry[1])
                ),
                selected: false,
                expanded: true,
                data: {
                    kind: "section",
                    baseClass
                }
            };
        }

        const selectedNode = this.selectedNode;

        return {
            id: "_root",
            label: "Root",
            children: [
                getComponentSectionTreeChild(
                    "__widgetComponents",
                    "Widgets",
                    ProjectEditor.WidgetClass
                ),
                getComponentSectionTreeChild(
                    "__actionComponents",
                    "Actions",
                    ProjectEditor.ActionComponentClass
                )
            ],
            selected: false,
            expanded: true,
            data: undefined
        };
    }

    selectNode(node: DocumentationTreeNode) {
        if (node.data?.kind === "component") {
            this.selectedNode = node.data;
        }
    }

    get content() {
        return this.selectedNode?.componentClass.id ?? "";
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
                    <FlexLayout.Layout
                        model={homeLayoutModels.documentationBrowser}
                        factory={this.factory}
                        realtimeResize={true}
                        font={{
                            size: "small"
                        }}
                    />
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
                <Tree
                    rootNode={model.rootNode}
                    selectNode={node => {
                        model.selectNode(node);
                    }}
                    showOnlyChildren={true}
                    style={{ height: "100%", overflow: "auto" }}
                />
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

const Content = observer(
    class Content extends React.Component {
        render() {
            return model.content;
        }
    }
);
