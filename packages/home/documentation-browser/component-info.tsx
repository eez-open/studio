import React from "react";

import {
    IObjectClassInfo,
    ProjectType,
    setParent
} from "project-editor/core/object";

import { MarkdownData } from "./doc-markdown";
import { projectTypeToString } from "./helper";
import { markdownToHTML } from "./doc-markdown";
import { ProjectStore, createObject } from "project-editor/store";
import { Component } from "project-editor/flow/component";

export interface IProjectTypeComponentInfoParent {
    properties: string[];
    markdown?: MarkdownData;
    parent: IProjectTypeComponentInfoParent | undefined;
}

interface IProjectTypeComponentInfo {
    componentClass: IObjectClassInfo;
    componentObject: Component;
    properties: string[];
    inputs: string[];
    outputs: string[];
    parent: IProjectTypeComponentInfoParent;
    markdown?: MarkdownData;
    docCounters: {
        total: number;
        drafts: number;
        completed: number;
    };
}

export class ComponentInfo {
    id: string;
    type: "widget" | "action";
    group: string;
    name: string;
    icon: any;
    titleStyle: React.CSSProperties | undefined;

    common: {
        markdown?: MarkdownData;
        parent: IProjectTypeComponentInfoParent;
    };

    dashboard?: IProjectTypeComponentInfo;
    eezgui?: IProjectTypeComponentInfo;
    lvgl?: IProjectTypeComponentInfo;

    docCounters: {
        total: number;
        drafts: number;
        completed: number;
    };

    static createComponentObject = (
        projectStore: ProjectStore,
        componentClass: IObjectClassInfo
    ) => {
        const componentObject = createObject<Component>(
            projectStore,
            Object.assign(
                {},
                componentClass.objectClass.classInfo.defaultValue,
                {
                    type: componentClass.name
                }
            ),
            componentClass.objectClass,
            undefined,
            true
        );

        setParent(
            componentObject,
            projectStore.project.userPages[0].components
        );

        projectStore.project.userPages[0].components.push(componentObject);

        return componentObject;
    };

    updateDocCounters() {
        this.docCounters = {
            total: 0,
            drafts: 0,
            completed: 0
        };

        if (this.dashboard) {
            this.dashboard.docCounters = {
                total: 0,
                drafts: 0,
                completed: 0
            };
        }

        if (this.eezgui) {
            this.eezgui.docCounters = {
                total: 0,
                drafts: 0,
                completed: 0
            };
        }

        if (this.lvgl) {
            this.lvgl.docCounters = {
                total: 0,
                drafts: 0,
                completed: 0
            };
        }
    }

    renderDescription(projectType: ProjectType, generateHTML: boolean) {
        const type = projectTypeToString(projectType);

        let common = this.common.markdown?.description?.raw;
        let specific = this[type]?.markdown?.description?.raw;

        let text;
        if (common != undefined) {
            text = common;
        }

        if (specific != undefined) {
            if (text == undefined) {
                text = specific;
            } else {
                text += specific;
            }
        }

        if (text == undefined) {
            return (
                <div className="alert alert-danger" role="alert">
                    No description
                </div>
            );
        }

        return (
            <div
                className="markdown"
                style={{ visibility: generateHTML ? undefined : "hidden" }}
                dangerouslySetInnerHTML={markdownToHTML(text)}
            />
        );
    }

    renderPropertyDescription(
        projectType: ProjectType,
        propertyName: string,
        generateHTML: boolean
    ) {
        const type = projectTypeToString(projectType);

        let common = this.common.markdown?.properties[propertyName]?.raw;
        let specific = this[type]?.markdown?.properties[propertyName]?.raw;

        let text;
        if (common != undefined) {
            text = common;
        }

        if (specific != undefined) {
            if (text == undefined) {
                text = specific;
            } else {
                text += specific;
            }
        }

        if (text == undefined) {
            const parentPropertyDescription =
                this.renderParentPropertyDescription(
                    projectType,
                    propertyName,
                    generateHTML
                );
            if (parentPropertyDescription) {
                return parentPropertyDescription;
            }

            return (
                <div className="alert alert-danger" role="alert">
                    No property description
                </div>
            );
        }

        return (
            <div
                className="markdown"
                style={{ visibility: generateHTML ? undefined : "hidden" }}
                dangerouslySetInnerHTML={markdownToHTML(text)}
            />
        );
    }

    renderParentPropertyDescription(
        projectType: ProjectType,
        propertyName: string,
        generateHTML: boolean
    ) {
        const type = projectTypeToString(projectType);

        let parent: IProjectTypeComponentInfoParent | undefined;

        let common;
        for (parent = this.common.parent; parent; parent = parent.parent) {
            common = parent.markdown?.properties[propertyName]?.raw;
            if (common != undefined) {
                break;
            }
        }

        let specific;

        for (parent = this[type]?.parent; parent; parent = parent.parent) {
            specific = parent.markdown?.properties[propertyName]?.raw;
            if (specific != undefined) {
                break;
            }
        }

        let text;
        if (common != undefined) {
            text = common;
        }

        if (specific != undefined) {
            if (text == undefined) {
                text = specific;
            } else {
                text += specific;
            }
        }

        if (text == undefined) {
            return undefined;
        }

        return (
            <div
                className="markdown"
                style={{ visibility: generateHTML ? undefined : "hidden" }}
                dangerouslySetInnerHTML={markdownToHTML(text)}
            />
        );
    }

    renderInputDescription(
        projectType: ProjectType,
        inputName: string,
        generateHTML: boolean
    ) {
        const type = projectTypeToString(projectType);

        let common = this.common.markdown?.inputs[inputName]?.raw;
        let specific = this[type]?.markdown?.inputs[inputName]?.raw;

        let text;
        if (common != undefined) {
            text = common;
        }

        if (specific != undefined) {
            if (text == undefined) {
                text = specific;
            } else {
                text += specific;
            }
        }

        if (text == undefined) {
            return (
                <div className="alert alert-danger" role="alert">
                    No input description
                </div>
            );
        }

        return (
            <div
                className="markdown"
                style={{ visibility: generateHTML ? undefined : "hidden" }}
                dangerouslySetInnerHTML={markdownToHTML(text)}
            />
        );
    }

    renderOutputDescription(
        projectType: ProjectType,
        outputName: string,
        generateHTML: boolean
    ) {
        const type = projectTypeToString(projectType);

        let common = this.common.markdown?.outputs[outputName]?.raw;
        let specific = this[type]?.markdown?.outputs[outputName]?.raw;

        let text;
        if (common != undefined) {
            text = common;
        }

        if (specific != undefined) {
            if (text == undefined) {
                text = specific;
            } else {
                text += specific;
            }
        }

        if (text == undefined) {
            return (
                <div className="alert alert-danger" role="alert">
                    No output description
                </div>
            );
        }

        return (
            <div
                className="markdown"
                style={{ visibility: generateHTML ? undefined : "hidden" }}
                dangerouslySetInnerHTML={markdownToHTML(text)}
            />
        );
    }

    renderExamples(projectType: ProjectType, generateHTML: boolean) {
        const type = projectTypeToString(projectType);

        let common = this.common.markdown?.examples?.raw;
        let specific = this[type]?.markdown?.examples?.raw;

        let text;
        if (common != undefined) {
            text = common;
        }

        if (specific != undefined) {
            if (text == undefined) {
                text = specific;
            } else {
                text += specific;
            }
        }

        if (text == undefined) {
            return (
                <div className="alert alert-danger" role="alert">
                    No examples
                </div>
            );
        }

        return (
            <div
                className="markdown"
                style={{ visibility: generateHTML ? undefined : "hidden" }}
                dangerouslySetInnerHTML={markdownToHTML(text)}
            />
        );
    }
}
