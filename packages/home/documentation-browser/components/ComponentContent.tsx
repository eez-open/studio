import React from "react";
import { action } from "mobx";
import { observer } from "mobx-react";
import classNames from "classnames";
import { ProjectType } from "project-editor/core/object";
import {
    DASHBOARD_PROJECT_ICON,
    EEZ_GUI_PROJECT_ICON,
    LVGL_PROJECT_ICON
} from "project-editor/ui-components/icons";
import { getModel } from "../model";
import { ComponentInfo } from "../component-info";
import { ComponentHelp } from "./ComponentHelp";

export const ComponentContent = observer(
    class Content extends React.Component<{
        componentInfo: ComponentInfo;
        projectType: ProjectType;
        generateHTML: boolean;
    }> {
        render() {
            const { componentInfo, projectType } = this.props;

            const isDashboardComponent =
                (projectType == ProjectType.DASHBOARD ||
                    projectType == ProjectType.UNDEFINED) &&
                componentInfo.dashboard != undefined;

            const isEezGuiComponent =
                (projectType == ProjectType.FIRMWARE ||
                    projectType == ProjectType.UNDEFINED) &&
                componentInfo.eezgui != undefined;

            const isLVGLComponent =
                (projectType == ProjectType.LVGL ||
                    projectType == ProjectType.UNDEFINED) &&
                componentInfo.lvgl != undefined;

            const tabId = `component-content-tab`;
            const tabContentId = `component-content-tab-content`;
            const dashboardTabPaneId = `component-content-tab-pane-dashboard`;
            const eezguiTabPaneId = `component-content-tab-pane-eezgui`;
            const lvglTabPaneId = `component-content-tab-pane-lvgl`;

            let isDashboardPaneActive = false;
            let isEezGuiPaneActive = false;
            let isLVGLPaneActive = false;

            if (this.props.generateHTML) {
                if (isDashboardComponent) {
                    isDashboardPaneActive = true;
                } else if (isEezGuiComponent) {
                    isEezGuiPaneActive = true;
                } else {
                    isLVGLPaneActive = true;
                }
            } else {
                let selectedProjectType = getModel().selectedProjectType;

                if (selectedProjectType === ProjectType.DASHBOARD) {
                    if (isDashboardComponent) {
                        isDashboardPaneActive = true;
                    } else {
                        if (isEezGuiComponent) {
                            isEezGuiPaneActive = true;
                        } else {
                            isLVGLPaneActive = true;
                        }
                    }
                } else if (selectedProjectType === ProjectType.FIRMWARE) {
                    if (isEezGuiComponent) {
                        isEezGuiPaneActive = true;
                    } else {
                        if (isDashboardComponent) {
                            isDashboardPaneActive = true;
                        } else {
                            isLVGLPaneActive = true;
                        }
                    }
                } else if (selectedProjectType === ProjectType.LVGL) {
                    if (isLVGLComponent) {
                        isLVGLPaneActive = true;
                    } else {
                        if (isDashboardComponent) {
                            isDashboardPaneActive = true;
                        } else {
                            isEezGuiPaneActive = true;
                        }
                    }
                }
            }

            console.log(
                isDashboardPaneActive,
                isEezGuiPaneActive,
                isLVGLPaneActive
            );

            return (
                <div
                    className={classNames(
                        "EezStudio_DocumentationBrowser_Content_Help",
                        {
                            generateHTML: this.props.generateHTML
                        }
                    )}
                >
                    {projectType == ProjectType.UNDEFINED && (
                        <ul className="nav nav-tabs" id={tabId} role="tablist">
                            {isDashboardComponent && (
                                <li className="nav-item" role="presentation">
                                    <button
                                        className={classNames("nav-link", {
                                            active: isDashboardPaneActive
                                        })}
                                        onClick={action(
                                            () =>
                                                (getModel().selectedProjectType =
                                                    ProjectType.DASHBOARD)
                                        )}
                                        data-bs-toggle={"tab"}
                                        data-bs-target={
                                            "#" + dashboardTabPaneId
                                        }
                                        type="button"
                                        role="tab"
                                        aria-controls={dashboardTabPaneId}
                                        aria-selected={
                                            isDashboardPaneActive
                                                ? "true"
                                                : false
                                        }
                                    >
                                        {DASHBOARD_PROJECT_ICON(24)} Dashboard
                                    </button>
                                </li>
                            )}
                            {isEezGuiComponent && (
                                <li className="nav-item" role="presentation">
                                    <button
                                        className={classNames("nav-link", {
                                            active: isEezGuiPaneActive
                                        })}
                                        onClick={action(
                                            () =>
                                                (getModel().selectedProjectType =
                                                    ProjectType.FIRMWARE)
                                        )}
                                        data-bs-toggle={"tab"}
                                        data-bs-target={"#" + eezguiTabPaneId}
                                        type="button"
                                        role="tab"
                                        aria-controls={eezguiTabPaneId}
                                        aria-selected={
                                            isEezGuiPaneActive ? "true" : false
                                        }
                                    >
                                        {EEZ_GUI_PROJECT_ICON(24)} EEZ-GUI
                                    </button>
                                </li>
                            )}
                            {isLVGLComponent && (
                                <li className="nav-item" role="presentation">
                                    <button
                                        className={classNames("nav-link", {
                                            active: isLVGLPaneActive
                                        })}
                                        onClick={action(
                                            () =>
                                                (getModel().selectedProjectType =
                                                    ProjectType.LVGL)
                                        )}
                                        data-bs-toggle={"tab"}
                                        data-bs-target={"#" + lvglTabPaneId}
                                        type="button"
                                        role="tab"
                                        aria-controls={lvglTabPaneId}
                                        aria-selected={
                                            isLVGLPaneActive ? "true" : false
                                        }
                                    >
                                        {LVGL_PROJECT_ICON(24)} LVGL
                                    </button>
                                </li>
                            )}
                        </ul>
                    )}
                    {projectType == ProjectType.UNDEFINED ? (
                        <div className="tab-content" id={tabContentId}>
                            {isDashboardComponent && (
                                <div
                                    className={classNames("tab-pane fade", {
                                        "show active": isDashboardPaneActive
                                    })}
                                    id={dashboardTabPaneId}
                                    role="tabpanel"
                                    aria-labelledby={dashboardTabPaneId}
                                >
                                    <ComponentHelp
                                        componentInfo={componentInfo}
                                        componentClass={
                                            componentInfo.dashboard!
                                                .componentClass
                                        }
                                        projectType={ProjectType.DASHBOARD}
                                        generateHTML={this.props.generateHTML}
                                    />
                                </div>
                            )}
                            {isEezGuiComponent && (
                                <div
                                    className={classNames("tab-pane fade", {
                                        "show active": isEezGuiPaneActive
                                    })}
                                    id={eezguiTabPaneId}
                                    role="tabpanel"
                                    aria-labelledby={eezguiTabPaneId}
                                >
                                    <ComponentHelp
                                        componentInfo={componentInfo}
                                        componentClass={
                                            componentInfo.eezgui!.componentClass
                                        }
                                        projectType={ProjectType.FIRMWARE}
                                        generateHTML={this.props.generateHTML}
                                    />
                                </div>
                            )}
                            {isLVGLComponent && (
                                <div
                                    className={classNames("tab-pane fade", {
                                        "show active": isLVGLPaneActive
                                    })}
                                    id={lvglTabPaneId}
                                    role="tabpanel"
                                    aria-labelledby={lvglTabPaneId}
                                >
                                    <ComponentHelp
                                        componentInfo={componentInfo}
                                        componentClass={
                                            componentInfo.lvgl!.componentClass
                                        }
                                        projectType={ProjectType.LVGL}
                                        generateHTML={this.props.generateHTML}
                                    />
                                </div>
                            )}
                        </div>
                    ) : (
                        <ComponentHelp
                            componentInfo={componentInfo}
                            componentClass={
                                isDashboardComponent
                                    ? componentInfo.dashboard!.componentClass
                                    : isEezGuiComponent
                                    ? componentInfo.eezgui!.componentClass
                                    : componentInfo.lvgl!.componentClass
                            }
                            projectType={
                                isDashboardComponent
                                    ? ProjectType.DASHBOARD
                                    : isEezGuiComponent
                                    ? ProjectType.FIRMWARE
                                    : ProjectType.LVGL
                            }
                            generateHTML={this.props.generateHTML}
                        />
                    )}
                </div>
            );
        }
    }
);
