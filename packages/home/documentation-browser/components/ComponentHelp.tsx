import React from "react";
import { observer } from "mobx-react";

import { sourceRootDir } from "eez-studio-shared/util";

import {
    DASHBOARD_PROJECT_ICON,
    EEZ_GUI_PROJECT_ICON,
    LVGL_PROJECT_ICON
} from "project-editor/ui-components/icons";

import { ComponentInfo } from "../component-info";
import { ComponentInputs } from "./ComponentInputs";
import { ComponentOutputs } from "./ComponentOutputs";
import { ComponentProperties } from "./ComponentProperties";
import { BodySection } from "./BodySection";

////////////////////////////////////////////////////////////////////////////////
export const ComponentHelp = observer(
    class ComponentHelp extends React.Component<{
        componentInfo: ComponentInfo;
        generateHTML: boolean;
    }> {
        divRef = React.createRef<HTMLDivElement>();
        dispose: (() => void) | undefined;

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

            const isDashboardComponent =
                componentInfo.isDashboardComponent != undefined;
            const isEezGuiComponent =
                componentInfo.isEezGuiComponent != undefined;
            const isLVGLComponent = componentInfo.isLVGLComponent != undefined;

            componentInfo.readAllMarkdown();

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
                            <div>{componentInfo.nameWithoutProjectType}</div>
                        </div>
                        <div className="EezStudio_Component_Documentation_Title_ProjectTypes">
                            {isDashboardComponent && DASHBOARD_PROJECT_ICON(36)}
                            {isEezGuiComponent && EEZ_GUI_PROJECT_ICON(36)}
                            {isLVGLComponent && LVGL_PROJECT_ICON(36)}
                        </div>
                    </div>

                    <div className="EezStudio_Component_Documentation_Body">
                        <BodySection title="Description">
                            {this.props.componentInfo.renderDescription(
                                this.props.generateHTML
                            )}
                        </BodySection>

                        {!this.props.componentInfo.isEmptyProperties() && (
                            <ComponentProperties
                                componentInfo={this.props.componentInfo}
                                generateHTML={this.props.generateHTML}
                            />
                        )}

                        {!this.props.componentInfo.isEmptyInputs() && (
                            <ComponentInputs
                                componentInfo={this.props.componentInfo}
                                generateHTML={this.props.generateHTML}
                            />
                        )}

                        {!this.props.componentInfo.isEmptyOutputs() && (
                            <ComponentOutputs
                                componentInfo={this.props.componentInfo}
                                generateHTML={this.props.generateHTML}
                            />
                        )}

                        {!this.props.componentInfo.isEmptyExamples() && (
                            <BodySection title="Examples">
                                {this.props.componentInfo.renderExamples(
                                    this.props.generateHTML
                                )}
                            </BodySection>
                        )}
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
