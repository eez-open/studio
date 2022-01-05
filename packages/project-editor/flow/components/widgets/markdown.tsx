import React from "react";

import {
    registerClass,
    makeDerivedClassInfo,
    ProjectType,
    PropertyType
} from "project-editor/core/object";

import {
    makeDataPropertyInfo,
    Widget,
    specificGroup
} from "project-editor/flow/component";
import { IFlowContext } from "project-editor/flow/flow-interfaces";
import {
    evalConstantExpression,
    evalExpression
} from "project-editor/flow/expression/expression";
import { observable } from "mobx";
import { ProjectEditor } from "project-editor/project-editor-interface";

////////////////////////////////////////////////////////////////////////////////

export class MarkdownWidget extends Widget {
    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        properties: [
            makeDataPropertyInfo("data", {
                hideInPropertyGrid: true
            }),
            {
                name: "text",
                type: PropertyType.MultilineText,
                propertyGridGroup: specificGroup
            }
        ],
        defaultValue: {
            left: 0,
            top: 0,
            width: 240,
            height: 240
        },

        icon: (
            <svg
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="M7 15v-6l2 2l2 -2v6" />
                <path d="M14 13l2 2l2 -2m-2 2v-6" />
            </svg>
        ),

        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType === ProjectType.DASHBOARD
    });

    @observable text: string;

    getText(flowContext: IFlowContext): { __html: string } | string {
        if (flowContext.DocumentStore.project.isDashboardProject) {
            if (this.text) {
                if (flowContext.flowState) {
                    try {
                        const value = evalExpression(
                            flowContext,
                            this,
                            this.text
                        );

                        if (value != null && value != undefined) {
                            return value;
                        }
                        return "";
                    } catch (err) {
                        console.error(err);
                        return "";
                    }
                }

                if (flowContext.DocumentStore.runtime) {
                    return "";
                }

                try {
                    const result = evalConstantExpression(
                        ProjectEditor.getProject(this),
                        this.text
                    );
                    if (typeof result.value === "string") {
                        return result.value;
                    }
                } catch (err) {}

                return {
                    __html: '<span className="expression">{this.text}</span>'
                };
            }

            if (flowContext.flowState) {
                return "";
            }
        }

        return "<no text>";
    }

    render(flowContext: IFlowContext): React.ReactNode {
        const showdown = require("showdown");
        const converter = new showdown.Converter();
        const html = { __html: converter.makeHtml(this.text || "") };
        return (
            <>
                <div dangerouslySetInnerHTML={html} />
                {super.render(flowContext)}
            </>
        );
    }
}

registerClass("MarkdownWidget", MarkdownWidget);
