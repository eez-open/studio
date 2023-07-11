import React from "react";
import { action } from "mobx";
import { observer } from "mobx-react";
import * as FlexLayout from "flexlayout-react";
import { isDev } from "eez-studio-shared/util-electron";
import { Loader } from "eez-studio-ui/loader";
import { Tree } from "eez-studio-ui/tree";
import { SearchInput } from "eez-studio-ui/search-input";
import { homeLayoutModels } from "home/home-layout-models";
import { getModel } from "../model";
import { generateMarkdownFilesForAllComponents } from "../doc-markdown";
import { generateHTMLFilesForAllComponents } from "../generate-html";
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
            if (getModel().loading) {
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
                                    checked={getModel().groupByProjectType}
                                    onChange={action(event => {
                                        getModel().groupByProjectType =
                                            event.target.checked;
                                        getModel().selectedNode = undefined;
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
                                    checked={getModel().showGroups}
                                    onChange={action(event => {
                                        getModel().showGroups =
                                            event.target.checked;
                                        getModel().selectedNode = undefined;
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
                            </div>
                        )}
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
                        searchText={getModel().searchText}
                        onClear={action(() => {
                            getModel().searchText = "";
                        })}
                        onChange={action(
                            event =>
                                (getModel().searchText = $(
                                    event.target
                                ).val() as string)
                        )}
                    />
                    <Tree
                        rootNode={getModel().rootNode}
                        selectNode={node => {
                            getModel().selectNode(node);
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
                    projectType={model.selectedNode.projectType}
                    generateHTML={false}
                />
            );
        }
    }
);
