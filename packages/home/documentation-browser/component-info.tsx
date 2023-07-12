import React from "react";

import {
    IObjectClassInfo,
    ProjectType,
    setParent
} from "project-editor/core/object";

import { MarkdownData, MarkdownDescription } from "./doc-markdown";
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
        let total = 0;
        let drafts = 0;
        let completed = 0;

        if (this.dashboard) {
            this.dashboard.docCounters = this.getDocCounters(
                this.dashboard,
                ProjectType.DASHBOARD
            );
            total += this.dashboard.docCounters.total;
            drafts += this.dashboard.docCounters.drafts;
            completed += this.dashboard.docCounters.completed;
        }

        if (this.eezgui) {
            this.eezgui.docCounters = this.getDocCounters(
                this.eezgui,
                ProjectType.FIRMWARE
            );
            total += this.eezgui.docCounters.total;
            drafts += this.eezgui.docCounters.drafts;
            completed += this.eezgui.docCounters.completed;
        }

        if (this.lvgl) {
            this.lvgl.docCounters = this.getDocCounters(
                this.lvgl,
                ProjectType.LVGL
            );
            total += this.lvgl.docCounters.total;
            drafts += this.lvgl.docCounters.drafts;
            completed += this.lvgl.docCounters.completed;
        }

        this.docCounters = {
            total,
            drafts,
            completed
        };
    }

    getDocCounters(
        projectTypeComponentInfo: IProjectTypeComponentInfo,
        projectType: ProjectType
    ) {
        let total = 0;
        let drafts = 0;
        let completed = 0;

        function inc(markdown?: {
            common: MarkdownDescription | undefined;
            specific: MarkdownDescription | undefined;
        }) {
            total++;

            if (markdown?.common || markdown?.specific) {
                if (markdown?.common?.draft || markdown?.specific?.draft) {
                    drafts++;
                } else {
                    completed++;
                }
            }
        }

        inc(this.getDescriptionMarkdown(projectType));

        for (const propertyName of projectTypeComponentInfo.properties) {
            inc(this.getPropertyDescriptionMarkdown(projectType, propertyName));
        }

        for (const inputName of projectTypeComponentInfo.inputs) {
            inc(this.getInputDescriptionMarkdown(projectType, inputName));
        }

        for (const outputName of projectTypeComponentInfo.outputs) {
            inc(this.getOutputDescriptionMarkdown(projectType, outputName));
        }

        inc(this.getExamplesMarkdown(projectType));

        return { total, drafts, completed };
    }

    renderMarkdown(
        markdown: {
            common: MarkdownDescription | undefined;
            specific: MarkdownDescription | undefined;
        },
        generateHTML: boolean
    ) {
        let text: string | undefined;

        if (markdown.common != undefined) {
            text = markdown.common.raw;
        }

        if (markdown.specific != undefined) {
            if (text == undefined) {
                text = markdown.specific.raw;
            } else {
                text += markdown.specific.raw;
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

    getDescriptionMarkdown(projectType: ProjectType) {
        const type = projectTypeToString(projectType);

        let common = this.common.markdown?.description;
        let specific = this[type]?.markdown?.description;

        return { common, specific };
    }

    renderDescription(projectType: ProjectType, generateHTML: boolean) {
        return this.renderMarkdown(
            this.getDescriptionMarkdown(projectType),
            generateHTML
        );
    }

    getPropertyDescriptionMarkdown(
        projectType: ProjectType,
        propertyName: string
    ) {
        const type = projectTypeToString(projectType);

        let common = this.common.markdown?.properties[propertyName];
        let specific = this[type]?.markdown?.properties[propertyName];

        if (common || specific) {
            return { common, specific };
        }

        return this.getParentPropertyDescriptionMarkdown(
            projectType,
            propertyName
        );
    }

    getParentPropertyDescriptionMarkdown(
        projectType: ProjectType,
        propertyName: string
    ) {
        const type = projectTypeToString(projectType);

        let parent: IProjectTypeComponentInfoParent | undefined;

        let common;
        for (parent = this.common.parent; parent; parent = parent.parent) {
            common = parent.markdown?.properties[propertyName];
            if (common != undefined) {
                break;
            }
        }

        let specific;
        for (parent = this[type]?.parent; parent; parent = parent.parent) {
            specific = parent.markdown?.properties[propertyName];
            if (specific != undefined) {
                break;
            }
        }

        return { common, specific };
    }

    renderPropertyDescription(
        projectType: ProjectType,
        propertyName: string,
        generateHTML: boolean
    ) {
        return this.renderMarkdown(
            this.getPropertyDescriptionMarkdown(projectType, propertyName),
            generateHTML
        );
    }

    getInputDescriptionMarkdown(projectType: ProjectType, inputName: string) {
        const type = projectTypeToString(projectType);

        let common = this.common.markdown?.inputs[inputName];
        let specific = this[type]?.markdown?.inputs[inputName];

        return { common, specific };
    }

    renderInputDescription(
        projectType: ProjectType,
        inputName: string,
        generateHTML: boolean
    ) {
        return this.renderMarkdown(
            this.getInputDescriptionMarkdown(projectType, inputName),
            generateHTML
        );
    }

    getOutputDescriptionMarkdown(projectType: ProjectType, outputName: string) {
        const type = projectTypeToString(projectType);

        let common = this.common.markdown?.outputs[outputName];
        let specific = this[type]?.markdown?.outputs[outputName];

        return { common, specific };
    }

    renderOutputDescription(
        projectType: ProjectType,
        outputName: string,
        generateHTML: boolean
    ) {
        return this.renderMarkdown(
            this.getOutputDescriptionMarkdown(projectType, outputName),
            generateHTML
        );
    }

    getExamplesMarkdown(projectType: ProjectType) {
        const type = projectTypeToString(projectType);

        let common = this.common.markdown?.examples;
        let specific = this[type]?.markdown?.examples;

        return { common, specific };
    }

    renderExamples(projectType: ProjectType, generateHTML: boolean) {
        return this.renderMarkdown(
            this.getExamplesMarkdown(projectType),
            generateHTML
        );
    }
}
