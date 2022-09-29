import React from "react";
import { observable, makeObservable } from "mobx";
import classNames from "classnames";

import { _find, _range } from "eez-studio-shared/algorithm";
import { humanize } from "eez-studio-shared/string";

import {
    registerClass,
    PropertyType,
    makeDerivedClassInfo
} from "project-editor/core/object";
import { Message, propertyNotSetMessage } from "project-editor/store";

import { ProjectType } from "project-editor/project/project";

import type { IFlowContext } from "project-editor/flow/flow-interfaces";

import { Widget } from "project-editor/flow/component";

import { ProjectEditor } from "project-editor/project-editor-interface";
import {
    generalGroup,
    specificGroup
} from "project-editor/ui-components/PropertyGrid/groups";

export class LVGLLabelWidget extends Widget {
    name: string;
    text: string;

    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType === ProjectType.LVGL,

        label: (widget: LVGLLabelWidget) => {
            const project = ProjectEditor.getProject(widget);

            if (!project.projectTypeTraits.hasFlowSupport) {
                if (widget.text) {
                    return `${humanize(widget.type)}: ${widget.text}`;
                }
            }

            if (widget.name) {
                return `${humanize(widget.type)}: ${widget.name}`;
            }

            if (widget.data) {
                return `${humanize(widget.type)}: ${widget.data}`;
            }

            return humanize(widget.type);
        },

        properties: [
            {
                name: "name",
                type: PropertyType.String,
                propertyGridGroup: generalGroup
            },
            {
                name: "text",
                type: PropertyType.String,
                propertyGridGroup: specificGroup
            }
        ],

        defaultValue: {
            left: 0,
            top: 0,
            width: 64,
            height: 32,
            text: "Text"
        },

        icon: (
            <svg
                strokeWidth="2"
                stroke="currentColor"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                viewBox="0 0 24 24"
            >
                <path d="M0 0h24v24H0z" stroke="none" />
                <circle cx="17.5" cy="15.5" r="3.5" />
                <path d="M3 19V8.5a3.5 3.5 0 0 1 7 0V19m-7-6h7m11-1v7" />
            </svg>
        ),

        check: (widget: LVGLLabelWidget) => {
            let messages: Message[] = [];

            if (!widget.text) {
                messages.push(propertyNotSetMessage(widget, "text"));
            }

            return messages;
        }
    });

    constructor() {
        super();

        makeObservable(this, {
            name: observable,
            text: observable
        });
    }

    getClassName() {
        return classNames("eez-widget-component", this.type);
    }

    render(flowContext: IFlowContext, width: number, height: number) {
        return (
            <>
                <span className={classNames(this.style.classNames)}>
                    {this.text}
                </span>
                {super.render(flowContext, width, height)}
            </>
        );
    }
}

registerClass("LVGLLabelWidget", LVGLLabelWidget);
