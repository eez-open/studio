import React from "react";

import {
    registerClass,
    makeDerivedClassInfo,
    ProjectType,
    PropertyType
} from "project-editor/core/object";

import {
    makeDataPropertyInfo,
    makeStylePropertyInfo,
    Widget
} from "project-editor/flow/component";
import { IFlowContext } from "project-editor/flow/flow-interfaces";
import { observable, makeObservable } from "mobx";
import { specificGroup } from "project-editor/ui-components/PropertyGrid/groups";

////////////////////////////////////////////////////////////////////////////////

export class MarkdownWidget extends Widget {
    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType === ProjectType.DASHBOARD,

        properties: [
            makeDataPropertyInfo("data", {
                hideInPropertyGrid: true
            }),
            {
                name: "text",
                type: PropertyType.MultilineText,
                propertyGridGroup: specificGroup
            },
            makeStylePropertyInfo("style", "Default style")
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
        )
    });

    text: string;

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            text: observable
        });
    }

    override render(
        flowContext: IFlowContext,
        width: number,
        height: number
    ): React.ReactNode {
        const showdown = require("showdown");
        const converter = new showdown.Converter();
        const html = { __html: converter.makeHtml(this.text || "") };
        return (
            <>
                <div dangerouslySetInnerHTML={html} />
                {super.render(flowContext, width, height)}
            </>
        );
    }
}

registerClass("MarkdownWidget", MarkdownWidget);
