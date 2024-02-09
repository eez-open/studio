import React from "react";
import { action } from "mobx";
import { observer } from "mobx-react";
import * as FlexLayout from "flexlayout-react";
import { isDev } from "eez-studio-shared/util-electron";
import { Loader } from "eez-studio-ui/loader";
import { Tree } from "eez-studio-ui/tree";
import { SearchInput } from "eez-studio-ui/search-input";
import { FlexLayoutContainer } from "eez-studio-ui/FlexLayout";
import { homeLayoutModels } from "home/home-layout-models";
import { getModel } from "../model";
import { generateMarkdownFilesForAllComponents } from "../doc-markdown";
import { generateHTMLFilesForAllComponents } from "../generate-html";
import { generateODTFilesForAllComponents } from "../generate-odt";
import { ComponentContent } from "./ComponentContent";

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
            const model = getModel();

            if (model.loading) {
                return <Loader />;
            }

            return (
                <div className="EezStudio_DocumentationBrowser">
                    <div className="EezStudio_DocumentationBrowser_Toolbar">
                        <div>
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
                        {isDev && (
                            <div className="EezStudio_DocumentationBrowser_Stat">
                                <span>Actions</span>
                                {model.actionDocCounters.total -
                                    model.actionDocCounters.completed -
                                    model.actionDocCounters.drafts >
                                    0 && (
                                    <span className="badge bg-danger">
                                        {model.actionDocCounters.total -
                                            model.actionDocCounters.completed -
                                            model.actionDocCounters.drafts}
                                    </span>
                                )}
                                {model.actionDocCounters.drafts > 0 && (
                                    <span className="badge bg-warning">
                                        {model.actionDocCounters.drafts}
                                    </span>
                                )}
                                {model.actionDocCounters.completed > 0 && (
                                    <span className="badge bg-success">
                                        {model.actionDocCounters.completed}
                                    </span>
                                )}
                            </div>
                        )}
                        {isDev && (
                            <div className="EezStudio_DocumentationBrowser_Stat">
                                <span>Widgets</span>
                                {model.widgetDocCounters.total -
                                    model.widgetDocCounters.completed -
                                    model.widgetDocCounters.drafts >
                                    0 && (
                                    <span className="badge bg-danger">
                                        {model.widgetDocCounters.total -
                                            model.widgetDocCounters.completed -
                                            model.widgetDocCounters.drafts}
                                    </span>
                                )}
                                {model.widgetDocCounters.drafts > 0 && (
                                    <span className="badge bg-warning">
                                        {model.widgetDocCounters.drafts}
                                    </span>
                                )}
                                {model.widgetDocCounters.completed > 0 && (
                                    <span className="badge bg-success">
                                        {model.widgetDocCounters.completed}
                                    </span>
                                )}
                            </div>
                        )}
                        {isDev && (
                            <div>
                                <button
                                    className="btn btn-success"
                                    onClick={() =>
                                        generateMarkdownFilesForAllComponents()
                                    }
                                >
                                    Generate Markdown Files
                                </button>
                                <button
                                    className="btn btn-success"
                                    onClick={() =>
                                        generateHTMLFilesForAllComponents()
                                    }
                                >
                                    Generate HTML Files
                                </button>
                                <button
                                    className="btn btn-success"
                                    onClick={() =>
                                        generateODTFilesForAllComponents()
                                    }
                                >
                                    Generate ODT Files
                                </button>
                            </div>
                        )}
                    </div>
                    <div className="EezStudio_DocumentationBrowser_Content">
                        <FlexLayoutContainer
                            model={homeLayoutModels.documentationBrowser}
                            factory={this.factory}
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
            const model = getModel();

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
    class Content extends React.Component<{}> {
        render() {
            const model = getModel();

            if (
                !model.selectedNode ||
                model.selectedNode.kind !== "component"
            ) {
                return null;
            }

            return (
                <ComponentContent
                    componentInfo={model.selectedNode.componentInfo}
                    generateHTML={false}
                />
            );
        }
    }
);
