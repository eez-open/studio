import React from "react";

import { computed, makeObservable } from "mobx";
import { observer } from "mobx-react";
import { IObjectClassInfo, ProjectType } from "project-editor/core/object";
import { ComponentInfo } from "../component-info";
import { ComponentInputs } from "./ComponentInputs";
import { ComponentOutputs } from "./ComponentOutputs";
import { ComponentProperties } from "./ComponentProperties";
import { BodySection } from "./BodySection";
import { projectTypeToString } from "../helper";
import { sourceRootDir } from "eez-studio-shared/util";

////////////////////////////////////////////////////////////////////////////////
export const ComponentHelp = observer(
    class ComponentHelp extends React.Component<{
        componentInfo: ComponentInfo;
        componentClass: IObjectClassInfo;
        projectType: ProjectType;
        generateHTML: boolean;
    }> {
        divRef = React.createRef<HTMLDivElement>();
        dispose: (() => void) | undefined;

        constructor(props: any) {
            super(props);

            makeObservable(this, {
                markdown: computed
            });
        }

        get componentObject() {
            return this.props.componentInfo[
                projectTypeToString(this.props.projectType)
            ]?.componentObject;
        }

        get markdown() {
            if (this.props.projectType == ProjectType.DASHBOARD) {
                return this.props.componentInfo.dashboard?.markdown;
            }
            if (this.props.projectType == ProjectType.FIRMWARE) {
                return this.props.componentInfo.eezgui?.markdown;
            }
            if (this.props.projectType == ProjectType.LVGL) {
                return this.props.componentInfo.lvgl?.markdown;
            }
            return undefined;
        }

        fixMarkdown() {
            if (this.dispose) {
                this.dispose();
                this.dispose = undefined;
            }

            const div = this.divRef.current;
            if (!div) {
                return;
            }

            const { generateHTML } = this.props;

            const imageSrcPrefix = generateHTML
                ? ""
                : `file://${sourceRootDir()}/../help/en-US/components/`;

            $.each($(div).find(".markdown"), function () {
                $.each($(this).find("img"), function () {
                    let src = $(this).attr("src");
                    if (
                        typeof src == "string" &&
                        !src.startsWith("http://") &&
                        !src.startsWith("https://") &&
                        !src.startsWith("file://")
                    ) {
                        if (src.startsWith("../")) {
                            src = src.substring("../".length);
                        }
                        $(this).attr("src", `${imageSrcPrefix}${src}`);
                    }
                });

                if (!generateHTML) {
                    this.style.visibility = "visible";
                }
            });

            if (!generateHTML) {
                $(div).find(".markdown a").on("click", this.onClick);

                this.dispose = () => {
                    $(div).find(".markdown a").off("click", this.onClick);
                };
            }
        }

        componentDidMount() {
            this.fixMarkdown();
        }

        componentDidUpdate() {
            this.fixMarkdown();
        }

        componentWillUnmount(): void {
            if (this.dispose) {
                this.dispose();
                this.dispose = undefined;
            }
        }

        onClick = (event: JQuery.ClickEvent<HTMLAnchorElement>) => {
            event.preventDefault();
            event.stopPropagation();
            openLink(event.target.href);
        };

        render() {
            const { componentInfo } = this.props;

            if (!this.componentObject) {
                return null;
            }

            return (
                <div
                    ref={this.divRef}
                    className="EezStudio_Component_Documentation"
                >
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
                            {this.props.componentInfo.renderDescription(
                                this.props.projectType,
                                this.props.generateHTML
                            )}
                        </BodySection>

                        <ComponentProperties
                            componentInfo={this.props.componentInfo}
                            projectType={this.props.projectType}
                            componentObject={this.componentObject}
                            generateHTML={this.props.generateHTML}
                        />
                        <ComponentInputs
                            componentInfo={this.props.componentInfo}
                            projectType={this.props.projectType}
                            componentObject={this.componentObject}
                            generateHTML={this.props.generateHTML}
                        />
                        <ComponentOutputs
                            componentInfo={this.props.componentInfo}
                            projectType={this.props.projectType}
                            componentObject={this.componentObject}
                            generateHTML={this.props.generateHTML}
                        />

                        <BodySection title="Examples">
                            {this.props.componentInfo.renderExamples(
                                this.props.projectType,
                                this.props.generateHTML
                            )}
                        </BodySection>
                    </div>
                </div>
            );
        }
    }
);

function openLink(url: string) {
    const { shell } = require("electron");
    shell.openExternal(url);
}
